import { supabase } from '../supabase';
import { env } from '../env';
import { cargaParaMpa, fatorHD as fatorHDCore, type UnidadeCarga } from '../concreto/cp';

const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }> };

type Rec = Record<string, unknown>;

export type MaterialTestResult = {
  id: string;
  resultado_valor: number | null;
  carga_ruptura_kn: number | null;
  data_rompimento: string | null;
  hora_rompimento: string | null;
  cp_diametro_mm: number | null;
  cp_altura_mm: number | null;
  tipo_ruptura: string | null;
  capeamento: string | null;
  massa_cp_g: number | null;
  equipamento_id: string | null;
  operador_id: string | null;
  created_at?: string | null;
};

export type CpRompimento = {
  id: string;
  codigo: string | null;
  numeracao_lab?: string | null;
  external_key: string | null;
  amostra_id: string | null;
  idade_dias: number | null;
  idade_unidade: string;
  data_prevista_rompimento: string | null;
  data_real_rompimento: string | null;
  data_moldagem: string | null;
  situacao: string;
  motivo_descarte: string | null;
  valor_esperado: number | null;
  metadata: Rec | null;
  concretagem_id: string | null;
  receipt_id: string | null;
  material_test_type_id: string | null;
  contraprova: boolean | null;
  contraprova_de_id: string | null;
  material_tests?: MaterialTestResult[] | null;
  material_receipts?: { id: string; nota_fiscal: string | null; serie: number | null; external_key: string | null; volume_m3: number | null; slump_medido_cm: number | null; temperatura_concreto_c: number | null; elementos_concretados: string | null } | null;
  material_test_types?: { id: string; codigo: string | null; nome: string | null; unidade_resultado: string | null; idade_controle: number | null; idade_controle_unidade: string | null; cp_diametro_padrao_mm: number | null; cp_altura_padrao_mm: number | null } | null;
  concretagens?: { id: string; codigo: string | null; numero_relatorio: string | null; fck_previsto: number | null; fornecedor_texto: string | null; client_works?: { nome: string | null } | null; lab_clients?: { razao_social: string | null; nome_fantasia?: string | null } | null } | null;
};

export type CpPendente = CpRompimento;

export function resultadoAtual(cp: CpRompimento): MaterialTestResult | null {
  const arr = Array.isArray(cp.material_tests) ? cp.material_tests : [];
  if (!arr.length) return null;
  return [...arr].sort((a, b) => String(a.created_at ?? a.id).localeCompare(String(b.created_at ?? b.id))).at(-1) ?? null;
}

const SELECT_CP = 'id, codigo, numeracao_lab, external_key, amostra_id, idade_dias, idade_unidade, data_prevista_rompimento, data_real_rompimento, data_moldagem, situacao, motivo_descarte, valor_esperado, metadata, concretagem_id, receipt_id, material_test_type_id, contraprova, contraprova_de_id, material_tests(id, resultado_valor, carga_ruptura_kn, data_rompimento, hora_rompimento, cp_diametro_mm, cp_altura_mm, tipo_ruptura, capeamento, massa_cp_g, equipamento_id, operador_id, created_at), material_receipts(id, nota_fiscal, serie, external_key, volume_m3, slump_medido_cm, temperatura_concreto_c, elementos_concretados), material_test_types(id, codigo, nome, unidade_resultado, idade_controle, idade_controle_unidade, cp_diametro_padrao_mm, cp_altura_padrao_mm), concretagens(id, codigo, numero_relatorio, fck_previsto, fornecedor_texto, client_works(nome), lab_clients(razao_social, nome_fantasia))';
const SELECT_CP_SEM_NUM = SELECT_CP.replace('numeracao_lab, ', '');

export async function listCpsRompimento(tenantId?: string, opts?: { situacao?: string }): Promise<CpRompimento[]> {
  const situacao = opts?.situacao;
  let q = db.from('corpos_prova').select(SELECT_CP).is('deleted_at', null);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  if (situacao) q = q.eq('situacao', situacao);
  let { data, error } = await q.order('data_prevista_rompimento', { ascending: true });
  if (error && /numeracao_lab/i.test(error.message)) {
    let rq = db.from('corpos_prova').select(SELECT_CP_SEM_NUM).is('deleted_at', null);
    if (tenantId) rq = rq.eq('tenant_id', tenantId);
    if (situacao) rq = rq.eq('situacao', situacao);
    const retry = await rq.order('data_prevista_rompimento', { ascending: true });
    data = retry.data; error = retry.error;
  }
  if (error) throw new Error(error.message);
  return (data ?? []) as CpRompimento[];
}

export async function listAgenda(tenantId?: string): Promise<CpPendente[]> {
  // Mesmo resultado de antes (CPs pendentes), mas com situacao filtrada NO SERVIDOR
  // (antes: fetch completo + filter client-side) e escopo de tenant explicito quando informado.
  return listCpsRompimento(tenantId, { situacao: 'pendente' });
}

// Contadores globais (pendente/atrasado/rompido/insatisfatorio) calculados NO BANCO via RPC
// (rompimentos_resumo, SECURITY DEFINER + is_tenant_member) — evita baixar todos os CPs só para somar.
export async function resumoRompimentos(tenantId: string): Promise<{ pendente: number; atrasado: number; rompido: number; insatisfatorio: number }> {
  const { data, error } = await db.rpc('rompimentos_resumo', { p_tenant: tenantId });
  if (error) throw new Error(error.message);
  const r = (Array.isArray(data) ? data[0] : data) as { pendente?: number; atrasado?: number; rompido?: number; insatisfatorio?: number } | null;
  return { pendente: r?.pendente ?? 0, atrasado: r?.atrasado ?? 0, rompido: r?.rompido ?? 0, insatisfatorio: r?.insatisfatorio ?? 0 };
}

// Fator de correcao h/d (ABNT NBR 5739), interpolado.
export function fatorHD(d: number, h: number): number { return fatorHDCore(d, h); }
export function calcMPa(cargaKn: number, d: number, h: number): number { return cargaParaMpa(cargaKn, 'kn', d, h); }

export type LancamentoInput = {
  resultado_valor?: number | null;
  carga_ruptura?: number | null;
  carga_unidade?: UnidadeCarga;
  carga_ruptura_kn?: number | null;
  cp_diametro_mm: number;
  cp_altura_mm: number;
  tipo_ruptura?: string | null;
  capeamento?: string | null;
  massa_cp_g?: number | null;
  equipamento_id?: string | null;
  operador_id?: string | null;
  data_rompimento: string;
  hora_rompimento?: string | null;
  justificativa?: string | null;
  origem_log?: string | null;
};

function missingRpc(error: { message: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42883' || /function .* does not exist|Could not find the function|schema cache/i.test(error.message);
}

function mpaFromInput(v: LancamentoInput): { mpa: number; kn: number | null } {
  if (v.resultado_valor != null && Number.isFinite(Number(v.resultado_valor))) return { mpa: Math.round(Number(v.resultado_valor) * 10) / 10, kn: v.carga_ruptura_kn ?? null };
  const carga = Number(v.carga_ruptura ?? v.carga_ruptura_kn ?? 0);
  const unidade = v.carga_unidade ?? 'kn';
  const kn = unidade === 'kn' ? carga : unidade === 'tf' ? carga * 9.80665 : carga * 0.00980665;
  return { mpa: cargaParaMpa(carga, unidade, Number(v.cp_diametro_mm) || 100, Number(v.cp_altura_mm) || 200), kn };
}

async function directLancamento(tenantId: string, cp: CpRompimento, v: LancamentoInput): Promise<number> {
  const { mpa, kn } = mpaFromInput(v);
  const previous = resultadoAtual(cp);
  if (previous?.id) await db.from('material_tests').update({ deleted_at: new Date().toISOString() }).eq('id', previous.id);
  const { error: e1 } = await db.from('material_tests').insert({
    tenant_id: tenantId,
    corpo_prova_id: cp.id,
    concretagem_id: cp.concretagem_id,
    receipt_id: cp.receipt_id,
    material_test_type_id: cp.material_test_type_id,
    idade_dias: cp.idade_dias,
    idade_unidade: cp.idade_unidade,
    data_rompimento: v.data_rompimento,
    hora_rompimento: v.hora_rompimento || null,
    carga_ruptura_kn: kn,
    cp_diametro_mm: v.cp_diametro_mm || 100,
    cp_altura_mm: v.cp_altura_mm || 200,
    resultado_valor: mpa,
    unidade_resultado: 'MPa',
    fck_referencia_mpa: cp.valor_esperado ?? cp.concretagens?.fck_previsto ?? null,
    tipo_ruptura: v.tipo_ruptura || null,
    capeamento: v.capeamento || null,
    massa_cp_g: v.massa_cp_g ?? null,
    equipamento_id: v.equipamento_id || null,
    operador_id: v.operador_id || null,
    origem: v.origem_log || 'manual',
    justificativa_alteracao: previous ? (v.justificativa || 'Alteração manual pela tela de resultados') : null,
  });
  if (e1) throw new Error(e1.message);
  const log = Array.isArray(cp.metadata?.rompimento_log) ? cp.metadata?.rompimento_log as unknown[] : [];
  const metadata = { ...(cp.metadata ?? {}), rompimento_log: previous ? [...log, { at: new Date().toISOString(), before: previous, after: { resultado_valor: mpa, data_rompimento: v.data_rompimento, hora_rompimento: v.hora_rompimento ?? null }, origem: v.origem_log ?? 'manual' }] : log };
  const { error: e2 } = await db.from('corpos_prova').update({ situacao: 'rompido', data_real_rompimento: v.data_rompimento, metadata }).eq('id', cp.id);
  if (e2) throw new Error(e2.message);
  return mpa;
}

export async function lancarRompimentoCp(tenantId: string, cp: CpRompimento, v: LancamentoInput): Promise<number> {
  const payload = { corpo_prova_id: cp.id, ...v };
  const rpc = await db.rpc('lancar_rompimento_cp', { payload });
  if (!rpc.error) {
    const data = rpc.data as Rec | null;
    if (data && Number.isFinite(Number(data.resultado_valor))) return Number(data.resultado_valor);
    return mpaFromInput(v).mpa;
  }
  if (!missingRpc(rpc.error)) throw new Error(rpc.error.message);
  return directLancamento(tenantId, cp, v);
}

export async function lancarResultado(tenantId: string, cp: CpPendente, v: LancamentoInput): Promise<number> {
  return lancarRompimentoCp(tenantId, cp, v);
}

export async function lancarSituacaoCp(cp: CpRompimento, situacao: 'pendente' | 'rompido' | 'descartado' | 'falhou' | 'ausente', motivo?: string): Promise<void> {
  const payload = { corpo_prova_id: cp.id, situacao, motivo: motivo ?? null };
  const rpc = await db.rpc('lancar_situacao_cp', { payload });
  if (!rpc.error) return;
  if (!missingRpc(rpc.error)) throw new Error(rpc.error.message);
  const metadata = { ...(cp.metadata ?? {}), rompimento_log: [...(Array.isArray(cp.metadata?.rompimento_log) ? cp.metadata?.rompimento_log as unknown[] : []), { at: new Date().toISOString(), before: cp.situacao, after: situacao, motivo: motivo ?? null }] };
  const { error } = await db.from('corpos_prova').update({ situacao, motivo_descarte: motivo ?? cp.motivo_descarte ?? null, metadata }).eq('id', cp.id);
  if (error) throw new Error(error.message);
}

export async function setNumeracaoCp(cp: CpRompimento, numeracao: string): Promise<void> {
  const rpc = await db.rpc('set_numeracao_cp', { p_id: cp.id, p_numeracao: numeracao || null });
  if (!rpc.error) return;
  if (!missingRpc(rpc.error) && !/numeracao_lab/i.test(rpc.error.message)) throw new Error(rpc.error.message);
  const metadata = { ...(cp.metadata ?? {}), numeracao_lab: numeracao || null };
  const { error } = await db.from('corpos_prova').update({ metadata }).eq('id', cp.id);
  if (error) throw new Error(error.message);
}

export async function gerarContraprova(cp: CpRompimento): Promise<void> {
  const rpc = await db.rpc('gerar_contraprova_cp', { payload: { corpo_prova_id: cp.id } });
  if (!rpc.error) return;
  if (!missingRpc(rpc.error)) throw new Error(rpc.error.message);
  const { data, error } = await db.from('corpos_prova').select('*').eq('id', cp.id).maybeSingle();
  if (error) throw new Error(error.message);
  const src = (data ?? cp) as Rec;
  const insert: Rec = { ...src };
  delete insert.id; delete insert.created_at; delete insert.updated_at;
  insert.codigo = String(src.codigo ?? 'CP') + '-CP';
  insert.contraprova = true;
  insert.contraprova_de_id = cp.id;
  insert.situacao = 'pendente';
  insert.data_real_rompimento = null;
  insert.motivo_descarte = null;
  const ins = await db.from('corpos_prova').insert(insert);
  if (ins.error) throw new Error(ins.error.message);
}

export type AuditItem = { at: string; member_id?: string | null; before?: unknown; after?: unknown; motivo?: string | null; origem?: string | null };
export async function listRompimentoAudit(cpId: string): Promise<AuditItem[]> {
  const { data, error } = await db.from('corpos_prova').select('metadata').eq('id', cpId).maybeSingle();
  if (error) throw new Error(error.message);
  const md = ((data as Rec | null)?.metadata ?? {}) as Rec;
  return Array.isArray(md.rompimento_log) ? md.rompimento_log as AuditItem[] : [];
}

export async function gerarAgendaPdf(payload: Record<string, unknown>): Promise<Blob> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-agenda-rompimento-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(t || ('Erro ' + resp.status)); }
  return resp.blob();
}

// E1 — aceitação por exemplar na idade de controle (default 28d, configurável por lab/traço).
// Dispara resultado_abaixo_fck SE o exemplar (maior do par na idade de controle) < fck.
// Idades menores não reprovam (acompanhamento).
// Best-effort: nunca derruba o lançamento. Dedupe por amostra (exemplar).
export async function maybeNotifyAbaixoFck(
  tenantId: string,
  cp: { id: string; amostra_id: string | null; idade_dias: number | null; idade_unidade: string; codigo?: string | null },
  fck: number | null,
  idadeControle = 28,
): Promise<void> {
  try {
    const isControle = Number(cp.idade_dias) === idadeControle && cp.idade_unidade !== 'hora';
    if (!isControle || !cp.amostra_id || !fck || fck <= 0) return;
    const { data: sibs } = await db.from('corpos_prova').select('id').eq('amostra_id', cp.amostra_id).is('deleted_at', null);
    const ids = ((sibs ?? []) as Rec[]).map((r) => r.id).filter(Boolean);
    if (!ids.length) return;
    const { data: mts } = await db.from('material_tests').select('resultado_valor, idade_dias, idade_unidade').in('corpo_prova_id', ids).is('deleted_at', null);
    const vals = ((mts ?? []) as Rec[])
      .filter((r) => Number(r.idade_dias) === idadeControle && String(r.idade_unidade) !== 'hora')
      .map((r) => Number(r.resultado_valor)).filter((v) => Number.isFinite(v));
    if (!vals.length) return;
    const exemplar = Math.max(...vals);
    if (exemplar >= fck) return;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token ?? '';
    await fetch(env.supabaseUrl + '/functions/v1/notify-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
      body: JSON.stringify({ tenant_id: tenantId, event_type: 'resultado_abaixo_fck', entity_type: 'amostra', entity_id: cp.amostra_id, reference: cp.codigo ?? '', deep_link: '/laudos', body: 'Exemplar abaixo do fck na idade de controle: ' + exemplar.toFixed(1) + ' < ' + fck.toFixed(1) + ' MPa.' }),
    });
  } catch { /* best-effort */ }
}

export type LoteAbaixoFck = { amostra_id: string; codigo: string | null; exemplar: number; fck: number };

// Item D: 1 chamada (transacao server-side) em vez de N. O servidor calcula as amostras
// abaixo do fck na idade de controle e devolve a lista para notificar 1x por amostra.
export async function lancarRompimentosLote(itens: Array<Record<string, unknown>>, idadeControle = 28): Promise<{ ok: number; abaixoFck: LoteAbaixoFck[] }> {
  const res = await db.rpc('lancar_rompimentos_lote', { payload: { itens, idade_controle: idadeControle } });
  if (res.error) throw new Error(res.error.message);
  const d = (res.data ?? {}) as Rec;
  const abaixo = Array.isArray(d.abaixo_fck)
    ? (d.abaixo_fck as Rec[]).map((a) => ({ amostra_id: String(a.amostra_id), codigo: a.codigo == null ? null : String(a.codigo), exemplar: Number(a.exemplar), fck: Number(a.fck) }))
    : [];
  return { ok: Number(d.ok ?? 0), abaixoFck: abaixo };
}

export async function notifyAbaixoFck(tenantId: string, a: LoteAbaixoFck): Promise<void> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token ?? '';
    await fetch(env.supabaseUrl + '/functions/v1/notify-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
      body: JSON.stringify({ tenant_id: tenantId, event_type: 'resultado_abaixo_fck', entity_type: 'amostra', entity_id: a.amostra_id, reference: a.codigo ?? '', deep_link: '/laudos', body: 'Exemplar abaixo do fck na idade de controle: ' + a.exemplar.toFixed(1) + ' < ' + a.fck.toFixed(1) + ' MPa.' }),
    });
  } catch { /* best-effort */ }
}
