// admin-create-lab (GEOLAB) - cria laboratorio (tenant) + admin. Restrito a admin_consulte.
// Re-derivado do GEOMAT admin-create-tenant; adaptado: lab=tenant, member role 'admin',
// config_lab (singleton), criacao via auth.admin.createUser (sem SMTP/invite). Self-contained.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const fail = (m: string, status = 400, details?: unknown) => json({ ok: false, error: m, details }, status);
const asStr = (v: unknown, f = '') => (typeof v === 'string' && v.trim() ? v.trim() : f);
function slugify(name: string) { return name.normalize('NFD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
function randomPassword() { return 'Gl' + crypto.randomUUID().replace(/-/g, '').slice(0, 14) + 'A9!'; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '');
    if (!bearer) return fail('nao autenticado', 401);
    const { data: ures } = await svc.auth.getUser(bearer);
    if (!ures?.user) return fail('nao autenticado', 401);
    const { data: caller } = await svc.from('members').select('role, roles').eq('auth_id', ures.user.id).eq('active', true).is('deleted_at', null).limit(1).maybeSingle();
    const callerRoles = Array.isArray(caller?.roles) ? caller.roles : [];
    if (!(caller?.role === 'admin_consulte' || callerRoles.includes('admin_consulte'))) return fail('apenas operacao interna (admin_consulte)', 403);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const labNome = asStr(body.lab_nome, asStr(body.nome));
    const adminEmail = asStr(body.admin_email).toLowerCase();
    const adminNome = asStr(body.admin_nome);
    if (!labNome || !adminEmail || !adminNome) return fail('lab_nome, admin_nome e admin_email sao obrigatorios');
    const slug = slugify(asStr(body.lab_slug, labNome));
    if (!slug) return fail('slug invalido (informe lab_slug)');

    const { data: tenant, error: te } = await svc.from('tenants').insert({ name: labNome, slug, cnpj: asStr(body.cnpj) || null }).select('id').single();
    if (te) return fail('falha ao criar laboratorio (slug ja existe?): ' + te.message, 500);

    const generated = !asStr(body.admin_password);
    const password = asStr(body.admin_password, randomPassword());
    const { data: created, error: ue } = await svc.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { full_name: adminNome, tenant_id: tenant.id } });
    if (ue || !created?.user?.id) {
      await svc.from('tenants').update({ deleted_at: new Date().toISOString() }).eq('id', tenant.id);
      return fail('falha ao criar usuario admin (email ja existe?): ' + (ue?.message ?? 'sem id'), 500);
    }
    const authId = created.user.id;

    const { data: member, error: me } = await svc.from('members').insert({ tenant_id: tenant.id, auth_id: authId, email: adminEmail, full_name: adminNome, cargo: asStr(body.admin_cargo) || null, telefone: asStr(body.admin_telefone) || null, role: 'admin', roles: ['admin'], is_selected: true }).select('id').single();
    if (me) return fail('falha ao criar member: ' + me.message, 500);

    await svc.from('config_lab').insert({ tenant_id: tenant.id });

    // RBAC: cria os papeis built-in e semeia a matriz completa de permissoes para o novo lab.
    await svc.rpc('seed_builtin_roles_and_permissions', { p_tenant_id: tenant.id });

    return json({ ok: true, tenant_id: tenant.id, member_id: member.id, admin_auth_id: authId, temp_password: generated ? password : null });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
