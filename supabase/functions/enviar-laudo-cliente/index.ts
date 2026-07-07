// enviar-laudo-cliente (GEOLAB) — melhoria 3.1. Envia o laudo EMITIDO ao contato do cliente
// (lab_clients.email) com o PDF do laudo ANEXADO. Staff (verify_jwt=true; confirma member do tenant).
//
// Autocontido e alinhado ao contrato do dispatch deployado:
//   • respeita notification_dispatch_settings (dispatch_enabled / dry_run / email_allowlist);
//   • loga em notification_dispatch_log (recipient_email, event_type, status, payload, metadata, dedupe_key);
//   • FAIL-SAFE: sem RESEND_API_KEY/RESEND_FROM_EMAIL -> registra e NÃO envia (status 'skipped').
//   • IDEMPOTENTE por revisão: se já houve envio 'sent' do mesmo laudo+revisão, não reenvia.
//
// Decisão de design (honesta): anexa o PDF em vez de mandar link, porque NÃO há rota pública /portal/m
// nem download anônimo do laudo no app (criar isso é decisão de segurança à parte). Se você preferir
// DELEGAR ao send-notification deployado, troque o bloco `fetch(https://api.resend.com/emails ...)` por
// uma chamada a ele — o gating/log aqui já seguem o mesmo modelo de notification_dispatch_settings/_log.
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

    // autorizacao: solicitante e member ativo do tenant do laudo
    const { data: mem } = await admin.from('members').select('id')
      .eq('auth_id', ures.user.id).eq('tenant_id', rep.tenant_id).eq('active', true).is('deleted_at', null).maybeSingle();
    if (!mem) return json({ ok: false, error: 'sem permissao neste laboratorio' }, 403);

    if (rep.status !== 'emitido') return json({ ok: false, error: 'o laudo precisa estar emitido para enviar ao cliente' }, 422);
    if (!rep.storage_path) return json({ ok: false, error: 'laudo sem PDF persistido' }, 422);

    const { data: cli } = await admin.from('lab_clients').select('email, razao_social')
      .eq('id', rep.client_id).eq('tenant_id', rep.tenant_id).maybeSingle();
    const to = clean(cli?.email);
    if (!to) return json({ ok: true, sent: false, reason: 'cliente sem e-mail de contato cadastrado' });

    const dedupe = 'laudo_cliente:' + rep.id + ':' + (rep.revisao ?? 0);
    const { data: prev } = await admin.from('notification_dispatch_log').select('id')
      .eq('dedupe_key', dedupe).eq('status', 'sent').limit(1).maybeSingle();
    if (prev) return json({ ok: true, sent: false, reason: 'laudo ja enviado ao cliente nesta revisao' });

    const { data: st } = await admin.from('notification_dispatch_settings')
      .select('dispatch_enabled, dry_run, email_allowlist').limit(1).maybeSingle();
    const enabled = st?.dispatch_enabled === true;
    const dryRun = (st?.dry_run as boolean | undefined) !== false;
    const allow = Array.isArray(st?.email_allowlist) ? (st!.email_allowlist as unknown[]).map((e) => String(e).toLowerCase()) : [];
    const allowed = allow.length === 0 || allow.includes(to.toLowerCase());

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? '';
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';

    const logRow = async (status: string, extra?: Record<string, unknown>) => {
      try {
        await admin.from('notification_dispatch_log').insert({
          tenant_id: rep.tenant_id, dedupe_key: dedupe, recipient_email: to, event_type: 'laudo_disponivel_cliente',
          status, notification_type: 'email', entity_type: 'lab_report', entity_id: rep.id,
          payload: { numero: rep.numero, revisao: rep.revisao }, metadata: extra ?? {},
        });
      } catch (_e) { /* log e best-effort */ }
    };

    if (!resendKey || !fromEmail) { await logRow('skipped', { reason: 'resend_nao_configurado' }); return json({ ok: true, sent: false, reason: 'envio de e-mail nao configurado (RESEND_API_KEY/RESEND_FROM_EMAIL)' }); }
    if (!enabled) { await logRow('skipped', { reason: 'dispatch_desabilitado' }); return json({ ok: true, sent: false, reason: 'envio desabilitado nas configuracoes (dispatch_enabled=false)' }); }
    if (dryRun || !allowed) { await logRow('dry_run', { reason: dryRun ? 'dry_run' : 'fora_da_allowlist' }); return json({ ok: true, sent: false, reason: dryRun ? 'dry-run: registrado, nao enviado' : 'destinatario fora da allowlist' }); }

    const dl = await admin.storage.from('lab-reports').download(rep.storage_path);
    if (dl.error || !dl.data) { await logRow('error', { reason: 'falha_download_pdf' }); return json({ ok: false, error: 'falha ao ler o PDF do laudo' }, 500); }
    const buf = new Uint8Array(await dl.data.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const fname = 'laudo-' + String(rep.numero).replace(/[^0-9A-Za-z]+/g, '-') + '.pdf';
    const subject = 'Laudo ' + rep.numero + (Number(rep.revisao) > 0 ? ' (R' + rep.revisao + ')' : '');
    const html = '<p>Ola,</p><p>Segue em anexo o laudo de ensaio <strong>' + rep.numero + '</strong> (revisao R' + (rep.revisao ?? 0) + ').</p><p>Atenciosamente,<br/>' + (clean(cli?.razao_social) ? clean(cli?.razao_social) + ' &middot; ' : '') + 'Laboratorio de controle tecnologico</p>';

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + resendKey },
      body: JSON.stringify({ from: fromEmail, to: [to], subject, html, attachments: [{ filename: fname, content: b64 }] }),
    });
    const out = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) { await logRow('error', { reason: 'resend_' + r.status, detail: JSON.stringify(out).slice(0, 200) }); return json({ ok: false, error: 'falha no envio (Resend ' + r.status + ')' }, 502); }
    await logRow('sent', { resend_id: out.id ?? null });
    return json({ ok: true, sent: true, to, resend_id: out.id ?? null });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
