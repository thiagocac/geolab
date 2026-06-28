import { serveWithTelemetry } from '../_shared/telemetry.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const clean = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown): number | null => { const s = clean(v).replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

serveWithTelemetry('client-portal-submit-programacoes', async (req) => {
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
    const { data: member, error: em } = await sb.from('members').select('id, tenant_id, role, roles, active').eq('auth_id', ures.user.id).eq('active', true).is('deleted_at', null).order('is_selected', { ascending: false }).limit(1).maybeSingle();
    if (em || !member) return json({ ok: false, error: em?.message ?? 'membro nao encontrado' }, 403);
    const roles = Array.isArray(member.roles) ? member.roles as string[] : [];
    const canAdmin = member.role === 'admin' || member.role === 'admin_consulte' || roles.includes('admin') || roles.includes('admin_consulte');
    const isCliente = member.role === 'cliente' || roles.includes('cliente');
    if (!canAdmin && !isCliente) return json({ ok: false, error: 'perfil sem permissao para programar pelo portal' }, 403);

    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows as Record<string, unknown>[] : [];
    if (!rows.length) return json({ ok: false, error: 'nenhuma programacao recebida' }, 400);
    if (rows.length > 100) return json({ ok: false, error: 'limite de 100 programacoes por envio' }, 400);

    const workIds = [...new Set(rows.map((r) => clean(r.work_id)).filter(isUuid))];
    if (!workIds.length) return json({ ok: false, error: 'obra obrigatoria' }, 400);
    let allowed = new Set(workIds);
    if (!canAdmin) {
      const { data: scope } = await admin.from('member_obras').select('work_id').eq('tenant_id', member.tenant_id).eq('member_id', member.id).is('deleted_at', null);
      allowed = new Set(((scope ?? []) as Record<string, unknown>[]).map((r) => String(r.work_id)));
    }
    const { data: works, error: ew } = await admin.from('client_works').select('id, client_id, tenant_id').eq('tenant_id', member.tenant_id).in('id', workIds).is('deleted_at', null);
    if (ew) return json({ ok: false, error: ew.message }, 400);
    const byId = new Map(((works ?? []) as Record<string, unknown>[]).map((w) => [String(w.id), w]));
    const payload: Record<string, unknown>[] = [];
    for (const r of rows) {
      const workId = clean(r.work_id);
      const data = clean(r.data_programada);
      if (!workId || !data) continue;
      if (!allowed.has(workId)) return json({ ok: false, error: 'usuario sem acesso a uma das obras informadas' }, 403);
      const w = byId.get(workId);
      if (!w) return json({ ok: false, error: 'obra nao encontrada ou fora do laboratorio' }, 404);
      payload.push({
        tenant_id: member.tenant_id,
        client_id: w.client_id,
        work_id: workId,
        origem: 'portal_cliente',
        status: 'pendente',
        data_programada: data,
        hora_programada: clean(r.hora_programada) || null,
        local_texto: clean(r.local_texto) || null,
        traco_texto: clean(r.traco_texto) || null,
        fck_previsto: num(r.fck_previsto),
        fornecedor_texto: clean(r.fornecedor_texto) || null,
        volume_programado_m3: num(r.volume_programado_m3),
        observacoes: clean(r.observacoes) || null,
        responsavel_member_id: member.id,
        metadata: { portal_cliente: true, enviado_em: new Date().toISOString() },
      });
    }
    if (!payload.length) return json({ ok: false, error: 'nenhuma linha valida' }, 400);
    const { data: inserted, error } = await admin.from('concretagens').insert(payload).select('id');
    if (error) return json({ ok: false, error: error.message }, 400);
    return json({ ok: true, inserted: (inserted ?? []).length });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
