import { serveWithTelemetry } from '../_shared/telemetry.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const clean = (v: unknown) => String(v ?? '').trim();
const pass = () => 'GeoLab#' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase() + '29';
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

serveWithTelemetry('admin-create-client-user', async (req) => {
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

    // Boas-vindas branded (Concresoft Email Kit) via send-notification. Fail-safe: nunca bloqueia a criacao.
    let welcomeSent = false;
    if (clean(body.send_welcome ?? 'true') !== 'false') {
      try {
        const { data: settings } = await admin.from('notification_dispatch_settings').select('dispatch_secret').eq('id', true).maybeSingle();
        const secret = clean(settings?.dispatch_secret);
        const appUrl = Deno.env.get('APP_URL') ?? 'https://lab.consultegeo.org';
        let actionLink = appUrl + '/entrar';
        try {
          const link = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: appUrl + '/redefinir-senha' } });
          const al = (link.data as { properties?: { action_link?: string } } | null)?.properties?.action_link;
          if (al) actionLink = String(al);
        } catch (_e) { /* sem link: cai na tela de login */ }
        if (secret) {
          const { data: t } = await admin.from('tenants').select('name').eq('id', caller.tenant_id).maybeSingle();
          await fetch(url + '/functions/v1/send-notification', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-notify-secret': secret },
            body: JSON.stringify({
              tenant_id: caller.tenant_id, event_type: 'boas_vindas_cliente', email,
              dedupe_key: 'boas_vindas_cliente:' + member.id, entity_type: 'member', entity_id: member.id,
              title: 'Seu acesso ao portal esta pronto', tenant_name: clean(t?.name),
              body: 'Voce foi cadastrado no portal do cliente' + (clean(t?.name) ? ' de ' + clean(t?.name) : '') + '. Clique no botao abaixo para definir sua senha e acompanhar seus ensaios, laudos e programacoes.',
              cta_label: 'Definir minha senha', deep_link: actionLink,
            }),
          });
          welcomeSent = true;
        }
      } catch (_e) { /* boas-vindas nunca bloqueia a criacao do usuario */ }
    }
    return json({ ok: true, member_id: member.id, username: email, temp_password: password, welcome_sent: welcomeSent });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
