// admin-reset-password (GEOLAB) - redefine a senha de um usuario (member) do laboratorio.
// Gate: admin do tenant do member OU admin_consulte. Gera senha provisoria. Self-contained.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const fail = (m: string, status = 400) => json({ ok: false, error: m }, status);
const asStr = (v: unknown, f = '') => (typeof v === 'string' && v.trim() ? v.trim() : f);
function randomPassword() { return 'Gl' + crypto.randomUUID().replace(/-/g, '').slice(0, 14) + 'A9!'; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '');
    if (!bearer) return fail('nao autenticado', 401);
    const { data: ures } = await svc.auth.getUser(bearer);
    if (!ures?.user) return fail('nao autenticado', 401);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const memberId = asStr(body.member_id);
    if (!memberId) return fail('member_id obrigatorio');

    const { data: target } = await svc.from('members').select('tenant_id, auth_id, email').eq('id', memberId).is('deleted_at', null).maybeSingle();
    if (!target?.auth_id) return fail('usuario nao encontrado', 404);

    const { data: callerRows } = await svc.from('members').select('tenant_id, role, roles').eq('auth_id', ures.user.id).eq('active', true).is('deleted_at', null);
    const callers = (callerRows ?? []) as Record<string, unknown>[];
    const isConsulte = callers.some((c) => c.role === 'admin_consulte' || (Array.isArray(c.roles) && (c.roles as string[]).includes('admin_consulte')));
    const isAdminOfTenant = callers.some((c) => String(c.tenant_id) === String(target.tenant_id) && (c.role === 'admin' || (Array.isArray(c.roles) && (c.roles as string[]).includes('admin'))));
    if (!isConsulte && !isAdminOfTenant) return fail('apenas admin do laboratorio ou operacao interna', 403);

    const password = randomPassword();
    const { error: ue } = await svc.auth.admin.updateUserById(String(target.auth_id), { password });
    if (ue) return fail('falha ao redefinir senha: ' + ue.message, 500);
    return json({ ok: true, temp_password: password, email: target.email });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
