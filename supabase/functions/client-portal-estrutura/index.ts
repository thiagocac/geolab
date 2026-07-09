import { serveWithTelemetry } from '../_shared/telemetry.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const clean = (v: unknown) => String(v ?? '').trim();
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

function sanitizePecas(v: unknown): { id: string; nome: string; ordem: number }[] {
  if (!Array.isArray(v)) return [];
  return (v as Record<string, unknown>[])
    .map((p, i) => ({ id: (p && typeof p.id === 'string' && p.id) ? p.id : crypto.randomUUID(), nome: clean(p?.nome), ordem: Number.isFinite(Number(p?.ordem)) ? Number(p.ordem) : i }))
    .filter((p) => p.nome)
    .map((p, i) => ({ id: p.id, nome: p.nome, ordem: i }));
}

// Portal do cliente: cadastro da estrutura da obra (Estruturas + Peças em jsonb). Escrita via service-role,
// escopada por member_obras. Espelha o padrao de client-portal-submit-programacoes.
serveWithTelemetry('client-portal-estrutura', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authz = req.headers.get('authorization') ?? '';
    if (!authz) return json({ ok: false, error: 'nao autenticado' }, 401);
    const sb = createClient(url, anon, { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ ok: false, error: 'nao autenticado' }, 401);
    const { data: member, error: em } = await sb.from('members').select('id, tenant_id, role, roles, active, portal_permissoes').eq('auth_id', ures.user.id).eq('active', true).is('deleted_at', null).order('is_selected', { ascending: false }).limit(1).maybeSingle();
    if (em || !member) return json({ ok: false, error: em?.message ?? 'membro nao encontrado' }, 403);
    const roles = Array.isArray(member.roles) ? member.roles as string[] : [];
    const canAdmin = member.role === 'admin' || member.role === 'admin_consulte' || roles.includes('admin') || roles.includes('admin_consulte');
    const isCliente = member.role === 'cliente' || roles.includes('cliente');
    if (!canAdmin && !isCliente) return json({ ok: false, error: 'perfil sem permissao' }, 403);
    const perm = (member.portal_permissoes && typeof member.portal_permissoes === 'object') ? member.portal_permissoes as Record<string, unknown> : null;
    if (isCliente && perm && perm.estrutura === false) return json({ ok: false, error: 'recurso estrutura nao habilitado para este acesso' }, 403);

    let allowed: Set<string> | null = null;
    if (!canAdmin) {
      const { data: scope } = await admin.from('member_obras').select('work_id').eq('tenant_id', member.tenant_id).eq('member_id', member.id).is('deleted_at', null);
      allowed = new Set(((scope ?? []) as Record<string, unknown>[]).map((r) => String(r.work_id)));
    }
    const workOk = (wid: string) => canAdmin || (allowed !== null && allowed.has(wid));

    const body = await req.json().catch(() => ({}));
    const action = clean(body.action) || 'list';

    if (action === 'list') {
      const workId = clean(body.work_id);
      if (!isUuid(workId)) return json({ ok: false, error: 'obra obrigatoria' }, 400);
      if (!workOk(workId)) return json({ ok: false, error: 'sem acesso a esta obra' }, 403);
      const { data, error } = await admin.from('work_structures').select('id, work_id, nome, ordem, pecas').eq('tenant_id', member.tenant_id).eq('work_id', workId).is('deleted_at', null).order('ordem', { ascending: true }).order('created_at', { ascending: true });
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true, estruturas: data ?? [] });
    }

    if (action === 'save') {
      const workId = clean(body.work_id);
      if (!isUuid(workId)) return json({ ok: false, error: 'obra obrigatoria' }, 400);
      if (!workOk(workId)) return json({ ok: false, error: 'sem acesso a esta obra' }, 403);
      const { data: w } = await admin.from('client_works').select('id').eq('tenant_id', member.tenant_id).eq('id', workId).is('deleted_at', null).maybeSingle();
      if (!w) return json({ ok: false, error: 'obra nao encontrada' }, 404);
      const est = (body.estrutura && typeof body.estrutura === 'object') ? body.estrutura : {};
      const nome = clean(est.nome);
      if (!nome) return json({ ok: false, error: 'informe o nome da estrutura' }, 400);
      const pecas = sanitizePecas(est.pecas);
      const id = clean(est.id);
      if (id) {
        const { data: row } = await admin.from('work_structures').select('id, work_id').eq('tenant_id', member.tenant_id).eq('id', id).is('deleted_at', null).maybeSingle();
        if (!row || !workOk(String(row.work_id))) return json({ ok: false, error: 'estrutura nao encontrada' }, 403);
        const { error } = await admin.from('work_structures').update({ nome, pecas }).eq('id', id);
        if (error) return json({ ok: false, error: error.message }, 400);
        return json({ ok: true, id });
      }
      const { data: ins, error } = await admin.from('work_structures').insert({ tenant_id: member.tenant_id, work_id: workId, nome, ordem: Number(est.ordem) || 0, pecas }).select('id').maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true, id: ins?.id });
    }

    if (action === 'duplicate') {
      const id = clean(body.id);
      if (!isUuid(id)) return json({ ok: false, error: 'id obrigatorio' }, 400);
      const { data: row } = await admin.from('work_structures').select('id, work_id, nome, ordem, pecas').eq('tenant_id', member.tenant_id).eq('id', id).is('deleted_at', null).maybeSingle();
      if (!row || !workOk(String(row.work_id))) return json({ ok: false, error: 'estrutura nao encontrada' }, 403);
      const pecas = sanitizePecas(row.pecas).map((p) => ({ id: crypto.randomUUID(), nome: p.nome, ordem: p.ordem }));
      const { data: ins, error } = await admin.from('work_structures').insert({ tenant_id: member.tenant_id, work_id: row.work_id, nome: String(row.nome) + ' (cópia)', ordem: (Number(row.ordem) || 0) + 1, pecas }).select('id').maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true, id: ins?.id });
    }

    if (action === 'delete') {
      const id = clean(body.id);
      if (!isUuid(id)) return json({ ok: false, error: 'id obrigatorio' }, 400);
      const { data: row } = await admin.from('work_structures').select('id, work_id').eq('tenant_id', member.tenant_id).eq('id', id).is('deleted_at', null).maybeSingle();
      if (!row || !workOk(String(row.work_id))) return json({ ok: false, error: 'estrutura nao encontrada' }, 403);
      const { error } = await admin.from('work_structures').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ ok: false, error: 'acao invalida' }, 400);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
