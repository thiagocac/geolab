// portal-laudo-url (GEOLAB) - assina download de laudo APOS verificar escopo do solicitante.
// Cliente: so obras vinculadas (member_can_access_work). Staff: qualquer obra do tenant.
// Necessario porque o bucket lab-reports nao tem policy de storage p/ laudos (e policy nao escopa por obra).
// + serveWithTelemetry inline (best-effort, nunca quebra a EF).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const clean = (v: unknown) => String(v ?? '').trim();

const _ctSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _ctTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _ctActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const svc = _ctSvc(); const { data: u, error } = await svc.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await svc.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _ctFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null; traceId: string | null }) { try { const svc = _ctSvc(); const actor = await _ctActor(req); await svc.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(o.traceId ? { trace_id: o.traceId } : {}) } }); } catch { /* nunca bloqueia */ } }
function _ctServeWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); const traceId = _ctTrace(req); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _ctFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage, traceId }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }

_ctServeWithTelemetry('portal-laudo-url', async (req) => {
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

    const body = await req.json().catch(() => ({}));
    const reportId = clean(body.lab_report_id);
    if (!reportId) return json({ ok: false, error: 'lab_report_id obrigatorio' }, 400);

    const { data: rep } = await admin.from('lab_reports')
      .select('id, work_id, storage_path, deleted_at').eq('id', reportId).is('deleted_at', null).maybeSingle();
    if (!rep || !rep.storage_path) return json({ ok: false, error: 'laudo nao encontrado' }, 404);
    if (!rep.work_id) return json({ ok: false, error: 'laudo sem obra; download indisponivel pelo portal' }, 422);

    const { data: can, error: ce } = await sb.rpc('member_can_access_work', { p_work_id: rep.work_id });
    if (ce) return json({ ok: false, error: ce.message }, 403);
    if (can !== true) return json({ ok: false, error: 'sem acesso a este laudo' }, 403);

    const { data: signed, error: se } = await admin.storage.from('lab-reports').createSignedUrl(String(rep.storage_path), 120);
    if (se || !signed?.signedUrl) return json({ ok: false, error: se?.message ?? 'falha ao assinar' }, 500);
    return json({ ok: true, url: signed.signedUrl });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
