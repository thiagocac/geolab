// cron-nc-digest (Concresoft) - digest diario de NAO-CONFORMIDADES abertas nas ultimas 24h:
// por tenant, lista as NCs novas e envia e-mail aos admins/gestores via send-notification. Fail-closed CRON_SECRET.
// v2 (auditoria de observabilidade 2026-07-07, M1/M2):
//   - Este espelho era um STUB de 331 bytes; se o deploy-supabase.sh o deployasse, MATARIA a EF viva.
//     Agora carrega o corpo real (re-derivado do vivo v7) + instrumentacao.
//   - record_cron_heartbeat('cron-nc-digest', 1560) no fim (e 'error' no catch) — visivel ao watchdog.
//   - serveWithTelemetry: invocacoes em ef_invocation_log.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// --- Observabilidade (M1): registra cada invocacao em ef_invocation_log ---
const _obsSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
async function _obsFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null }) { try { const s = _obsSvc(); await s.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: null, p_tenant_id: null, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname } }); } catch { /* telemetria nunca bloqueia a EF */ } }
function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _obsFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, x-cron-secret', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const HEARTBEAT_MAX_AGE_MIN = 1560; // job diario (0 11 * * *): 24h + 2h de folga

async function notify(url: string, secret: string, payload: Record<string, unknown>) {
  try { await fetch(url + '/functions/v1/send-notification', { method: 'POST', headers: { 'content-type': 'application/json', 'x-notify-secret': secret }, body: JSON.stringify(payload) }); } catch { /* best-effort */ }
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return json({ ok: false, error: 'CRON_SECRET ausente: fail-closed' }, 500);
  if ((req.headers.get('x-cron-secret') ?? '') !== expected) return json({ ok: false, error: 'cron secret invalido' }, 401);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  try {
    const today = ymd(Date.now());
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: settings } = await svc.from('notification_dispatch_settings').select('dispatch_secret').eq('id', true).maybeSingle();
    const secret = String(settings?.dispatch_secret ?? '');
    const { data: tenants } = await svc.from('tenants').select('id, name').eq('active', true).is('deleted_at', null);
    let sent = 0, tenantsComNc = 0;
    for (const t of (tenants ?? []) as Record<string, unknown>[]) {
      const tid = String(t.id);
      const { data: ncs } = await svc.from('non_conformities')
        .select('numero, tipo_nome, tipo_code, severidade, origem, client_works(nome)')
        .eq('tenant_id', tid).eq('status', 'aberta').gte('created_at', since).is('deleted_at', null).order('severidade', { ascending: true }).limit(200);
      const lista = (ncs ?? []) as Record<string, unknown>[];
      if (!lista.length) continue;
      tenantsComNc++;
      const linhas = lista.map((n) => { const w = (n.client_works ?? {}) as Record<string, unknown>; return '- ' + String(n.numero ?? '?') + ' (' + String(n.tipo_nome ?? n.tipo_code ?? '-') + ', ' + String(n.severidade ?? '-') + ') - ' + String(w.nome ?? '-'); }).join('\n');
      const body = lista.length + ' nao-conformidade(s) aberta(s) nas ultimas 24h:\n' + linhas;
      const { data: admins } = await svc.from('members').select('id, email, full_name').eq('tenant_id', tid).eq('active', true).is('deleted_at', null).in('role', ['admin', 'gestor_qualidade', 'laboratorista']);
      for (const m of (admins ?? []) as Record<string, unknown>[]) {
        if (!m.email) continue;
        await notify(url, secret, { tenant_id: tid, tenant_name: t.name, member_id: m.id, email: m.email, event_type: 'digest_nc', title: 'Nao-conformidades abertas - ' + today, body, deep_link: '/nao-conformidades', cta_label: 'Abrir NCs', dedupe_key: 'digest_nc:' + tid + ':' + today + ':' + String(m.email).toLowerCase() });
        sent++;
      }
    }
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'cron-nc-digest', p_expected_max_age_minutes: HEARTBEAT_MAX_AGE_MIN, p_status: 'ok', p_error: null, p_description: 'Digest diario de NCs abertas (motor NC DB-ready)' });
    return json({ ok: true, today, tenants_com_nc: tenantsComNc, emails: sent });
  } catch (e) {
    try { await svc.rpc('record_cron_heartbeat', { p_job_name: 'cron-nc-digest', p_expected_max_age_minutes: HEARTBEAT_MAX_AGE_MIN, p_status: 'error', p_error: (e as Error).message, p_description: 'Digest diario de NCs abertas (motor NC DB-ready)' }); } catch { /* best-effort */ }
    return json({ ok: false, error: (e as Error).message }, 500);
  }
}

serveWithTelemetry('cron-nc-digest', handler);
