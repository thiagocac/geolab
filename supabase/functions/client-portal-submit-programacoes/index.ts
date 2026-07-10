import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const clean = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown): number | null => { const s = clean(v).replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

// v215 — padrão de moldagem informado pelo cliente (por linha da programação). Sanitização
// server-side: só campos conhecidos, idade/quantidade em faixas sãs, máx. 20 itens. Canônico =
// metadata.padrao_moldagem (mesmo shape do padroesToDb; o staff lê via padraoMoldagemDaConcretagem
// e os CPs/ficha herdam automaticamente na confirmação).
const TIPOS_ENSAIO = new Set(['compressao', 'elasticidade', 'tracao_flexao']);
function sanitizePadraoMoldagem(v: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(v) || !v.length) return null;
  const out: Record<string, unknown>[] = [];
  for (const raw of v.slice(0, 20)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const idade = Number(String(r.idadeControle ?? r.idade ?? '').replace(',', '.'));
    const qtd = Math.round(Number(String(r.quantidadeCp ?? r.quantidade ?? '').replace(',', '.')));
    if (!Number.isFinite(idade) || idade <= 0 || idade > 10000) continue;
    if (!Number.isFinite(qtd) || qtd <= 0 || qtd > 50) continue;
    const unidade = String(r.unidadeIdade ?? r.unidade ?? 'dias').toLowerCase().startsWith('hora') ? 'horas' : 'dias';
    const tipoRaw = String(r.tipoEnsaio ?? r.tipo_ensaio ?? 'compressao');
    const tipo = TIPOS_ENSAIO.has(tipoRaw) ? tipoRaw : 'compressao';
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : crypto.randomUUID().slice(0, 8),
      idadeControle: idade, unidadeIdade: unidade, tipoEnsaio: tipo, quantidadeCp: qtd,
      idade, unidade: unidade === 'horas' ? 'hora' : 'dia', quantidade: qtd,
    });
  }
  return out.length ? out : null;
}

const _ctSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _ctTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _ctActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const svc = _ctSvc(); const { data: u, error } = await svc.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await svc.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _ctFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null; traceId: string | null }) { try { const svc = _ctSvc(); const actor = await _ctActor(req); await svc.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(o.traceId ? { trace_id: o.traceId } : {}) } }); } catch { /* nunca bloqueia */ } }
function _ctServeWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); const traceId = _ctTrace(req); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _ctFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage, traceId }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }

_ctServeWithTelemetry('client-portal-submit-programacoes', async (req) => {
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
    const { data: member, error: em } = await sb.from('members').select('id, tenant_id, role, roles, active, portal_permissoes').eq('auth_id', ures.user.id).eq('active', true).is('deleted_at', null).order('is_selected', { ascending: false }).limit(1).maybeSingle();
    if (em || !member) return json({ ok: false, error: em?.message ?? 'membro nao encontrado' }, 403);
    const roles = Array.isArray(member.roles) ? member.roles as string[] : [];
    const canAdmin = member.role === 'admin' || member.role === 'admin_consulte' || roles.includes('admin') || roles.includes('admin_consulte');
    const isCliente = member.role === 'cliente' || roles.includes('cliente');
    if (!canAdmin && !isCliente) return json({ ok: false, error: 'perfil sem permissao para programar pelo portal' }, 403);
    const perm = (member.portal_permissoes && typeof member.portal_permissoes === 'object') ? member.portal_permissoes as Record<string, unknown> : null;
    if (isCliente && perm && perm.programar === false) return json({ ok: false, error: 'recurso "programar" nao habilitado para este acesso' }, 403);

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
      const pm = sanitizePadraoMoldagem(r.padrao_moldagem);
      payload.push({
        tenant_id: member.tenant_id, client_id: w.client_id, work_id: workId,
        origem: 'portal_cliente', status: 'pendente', data_programada: data,
        hora_programada: clean(r.hora_programada) || null, local_texto: clean(r.local_texto) || null,
        traco_texto: clean(r.traco_texto) || null, fck_previsto: num(r.fck_previsto),
        fornecedor_texto: clean(r.fornecedor_texto) || null, volume_programado_m3: num(r.volume_programado_m3),
        observacoes: clean(r.observacoes) || null, responsavel_member_id: member.id,
        metadata: { portal_cliente: true, enviado_em: new Date().toISOString(), ...(pm ? { padrao_moldagem: pm } : {}) },
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
