import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const clean = (v: unknown) => String(v ?? '').trim();
const pass = () => 'GeoLab#' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase() + '29';
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

const _ctSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _ctTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _ctActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const svc = _ctSvc(); const { data: u, error } = await svc.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await svc.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _ctFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null; traceId: string | null }) { try { const svc = _ctSvc(); const actor = await _ctActor(req); await svc.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(o.traceId ? { trace_id: o.traceId } : {}) } }); } catch { /* nunca bloqueia */ } }
function _ctServeWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); const traceId = _ctTrace(req); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _ctFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage, traceId }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }

_ctServeWithTelemetry('admin-create-client-user', async (req) => {
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
    const { data: caller, error: ec } = await sb.from('members').select('id, tenant_id, role, roles, active').eq('auth_id', ures.user.id).eq('active', true).is('deleted_at', null).order('is_selected', { ascending: false }).limit(1).maybeSingle();
    if (ec || !caller) return json({ ok: false, error: ec?.message ?? 'membro nao encontrado' }, 403);
    const roles = Array.isArray(caller.roles) ? caller.roles as string[] : [];
    const allowed = caller.role === 'admin' || caller.role === 'admin_consulte' || roles.includes('admin') || roles.includes('admin_consulte');
    if (!allowed) return json({ ok: false, error: 'apenas administradores podem criar usuarios de clientes' }, 403);

    const body = await req.json().catch(() => ({}));
    const nome = clean(body.nome || body.full_name);
    const email = clean(body.email).toLowerCase();
    const telefone = clean(body.telefone) || null;
    const password = clean(body.password) || pass();
    const workIds = Array.isArray(body.work_ids) ? [...new Set((body.work_ids as unknown[]).map(clean).filter(isUuid))] : [];
    if (!nome || !email) return json({ ok: false, error: 'nome e email obrigatorios' }, 400);
    if (!workIds.length) return json({ ok: false, error: 'selecione ao menos uma obra' }, 400);

    const { data: works, error: ew } = await admin.from('client_works').select('id').eq('tenant_id', caller.tenant_id).in('id', workIds).is('deleted_at', null);
    if (ew) return json({ ok: false, error: ew.message }, 400);
    if ((works ?? []).length !== workIds.length) return json({ ok: false, error: 'uma ou mais obras nao pertencem ao laboratorio selecionado' }, 400);

    const { data: existing } = await admin.from('members').select('id').eq('tenant_id', caller.tenant_id).eq('email', email).is('deleted_at', null).maybeSingle();
    if (existing?.id) return json({ ok: false, error: 'ja existe um usuario com este email neste laboratorio' }, 409);

    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: nome, geolab_role: 'cliente' } });
    if (created.error || !created.data.user) return json({ ok: false, error: created.error?.message ?? 'falha ao criar usuario auth' }, 400);
    const authId = created.data.user.id;
    const { data: member, error: em } = await admin.from('members').insert({ tenant_id: caller.tenant_id, auth_id: authId, email, full_name: nome, telefone, cargo: 'Cliente portal', role: 'cliente', roles: ['cliente'], active: true, is_selected: true }).select('id').maybeSingle();
    if (em || !member?.id) return json({ ok: false, error: em?.message ?? 'falha ao criar membro' }, 400);
    const rows = workIds.map((work_id) => ({ tenant_id: caller.tenant_id, member_id: member.id, work_id }));
    const { error: eo } = await admin.from('member_obras').insert(rows);
    if (eo) return json({ ok: false, error: eo.message }, 400);
    return json({ ok: true, member_id: member.id, username: email, temp_password: password });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
