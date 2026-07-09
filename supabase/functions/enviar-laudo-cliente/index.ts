// enviar-laudo-cliente (GEOLAB) - envia o laudo EMITIDO ao contato do cliente (lab_clients.email) com o PDF anexado.
// Staff autenticado (verify_jwt=true) confirma member do tenant. NAO envia e-mail direto: delega ao
// send-notification (UNICO ponto de saida Resend; gate allowlist/dry-run/supressao/dedupe + log central).
// Idempotente por revisao (dedupe_key laudo_cliente:<id>:<rev>, dedup em status 'sent'). Auditoria v204 (GEA-001).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// --- Observabilidade (M1, auditoria 2026-07-07): registra cada invocacao em ef_invocation_log ---
// (alimenta v_ef_metrics_hourly e o alarme de 5xx/p95 do telemetry-alarm). Best-effort: nunca
// bloqueia nem altera a resposta da EF. trace_id via ?trace_id= (sem preflight CORS).
const _obsSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _obsTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _obsActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const s = _obsSvc(); const { data: u, error } = await s.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await s.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _obsFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null }) { try { const s = _obsSvc(); const actor = await _obsActor(req); const tr = _obsTrace(req); await s.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(tr ? { trace_id: tr } : {}) } }); } catch { /* telemetria nunca bloqueia a EF */ } }
function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _obsFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }


const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const clean = (v: unknown) => String(v ?? '').trim();
const lower = (v: unknown) => clean(v).toLowerCase();
function pdfFilename(numero: unknown) {
  const safe = clean(numero).replace(/[^0-9A-Za-z]+/g, '-').replace(/^-+|-+$/g, '') || 'laudo';
  return `laudo-${safe}.pdf`;
}

serveWithTelemetry('enviar-laudo-cliente', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authz = req.headers.get('authorization') ?? '';
    if (!authz) return json({ ok: false, error: 'nao autenticado' }, 401);
    const sb = createClient(url, anon, { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ ok: false, error: 'nao autenticado' }, 401);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const reportId = clean(body.lab_report_id);
    if (!reportId) return json({ ok: false, error: 'lab_report_id obrigatorio' }, 400);

    const { data: rep } = await admin.from('lab_reports')
      .select('id, tenant_id, client_id, numero, revisao, status, storage_path, deleted_at')
      .eq('id', reportId).is('deleted_at', null).maybeSingle();
    if (!rep) return json({ ok: false, error: 'laudo nao encontrado' }, 404);

    const { data: mem } = await admin.from('members').select('id')
      .eq('auth_id', ures.user.id).eq('tenant_id', rep.tenant_id).eq('active', true).is('deleted_at', null).maybeSingle();
    if (!mem) return json({ ok: false, error: 'sem permissao neste laboratorio' }, 403);

    if (rep.status !== 'emitido') return json({ ok: false, error: 'o laudo precisa estar emitido para enviar ao cliente' }, 422);
    if (!rep.storage_path) return json({ ok: false, error: 'laudo sem PDF persistido' }, 422);

    const { data: cli } = await admin.from('lab_clients').select('email, razao_social')
      .eq('id', rep.client_id).eq('tenant_id', rep.tenant_id).maybeSingle();
    const to = lower(cli?.email);
    if (!to) return json({ ok: true, sent: false, reason: 'cliente sem e-mail de contato cadastrado' });

    const dedupe = 'laudo_cliente:' + rep.id + ':' + (rep.revisao ?? 0);
    const { data: prev } = await admin.from('notification_dispatch_log').select('id, status, resend_id')
      .eq('dedupe_key', dedupe).eq('status', 'sent').limit(1).maybeSingle();
    if (prev) return json({ ok: true, sent: false, status: prev.status, deduped: true, reason: 'laudo ja enviado ao cliente nesta revisao', resend_id: prev.resend_id ?? null });

    const { data: settings, error: settingsError } = await admin.from('notification_dispatch_settings')
      .select('dispatch_secret').eq('id', true).maybeSingle();
    if (settingsError) return json({ ok: false, error: settingsError.message }, 500);
    const dispatchSecret = clean(settings?.dispatch_secret);
    if (!dispatchSecret) return json({ ok: false, error: 'dispatch_secret ausente: envio fail-closed' }, 500);

    const dl = await admin.storage.from('lab-reports').download(rep.storage_path);
    if (dl.error || !dl.data) return json({ ok: false, error: 'falha ao ler o PDF do laudo' }, 500);
    const buf = new Uint8Array(await dl.data.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const fname = pdfFilename(rep.numero);
    const subject = 'Laudo ' + rep.numero + (Number(rep.revisao) > 0 ? ' (R' + rep.revisao + ')' : '');
    const message = 'Segue em anexo o laudo de ensaio ' + rep.numero + ' (revisao R' + (rep.revisao ?? 0) + ').';

    const sendPayload = {
      tenant_id: rep.tenant_id,
      event_type: 'laudo_disponivel_cliente',
      email: to,
      dedupe_key: dedupe,
      entity_type: 'lab_report',
      entity_id: rep.id,
      title: subject,
      body: message,
      cta_label: 'Abrir Concresoft',
      deep_link: '/laudos',
      reference: rep.numero,
      tenant_name: clean(cli?.razao_social),
      attachments: [{ filename: fname, content: b64, content_type: 'application/pdf' }],
    };

    const res = await fetch(url + '/functions/v1/send-notification', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-notify-secret': dispatchSecret },
      body: JSON.stringify(sendPayload),
    });
    const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return json({ ok: false, error: 'falha no dispatch centralizado', details: out }, 502);
    return json({ ok: true, sent: out.status === 'sent', to, status: out.status, reason: out.reason ?? null, resend_id: out.resend_id ?? null, dedupe_key: out.dedupe_key ?? dedupe });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
