import { supabase } from '../supabase';

type Json = Record<string, unknown>;
const rpcClient = supabase as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const num = (v: unknown) => Number(v) || 0;
const text = (v: unknown) => String(v ?? '');
const nullable = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const optNum = (v: unknown): number | null => (v == null ? null : Number(v) || 0);

export type OpsPoint = Record<string, unknown> & { label: string };
export type OpsKpis = Record<string, number>;
export type RiscoItem = { key: string; label: string; value: number; amount?: number; severity: 'alto' | 'medio' | 'baixo'; route: string };
export type NcRecente = { id: string; numero: string | null; tipo: string | null; severidade: string | null; status: string; data_abertura: string | null; obra: string | null };
export type DocVencimento = { id: string; titulo: string; status: string; data_validade: string | null; dias: number | null };
export type Calibracao = { id: string; label: string; tipo: string | null; validade: string | null; dias: number | null };
export type ContratoBalanco = { id: string; numero: string | null; cliente: string | null; valor_limite: number; valor_medido: number; valor_faturado: number; saldo_a_medir: number; consumo_pct: number | null; vigencia_fim: string | null; status: string };

export type DashboardOps = {
  nc: { kpis: OpsKpis; por_severidade: OpsPoint[]; por_classificacao: OpsPoint[]; mensal: OpsPoint[]; recentes: NcRecente[] };
  docgate: { kpis: OpsKpis; por_status: OpsPoint[]; vencimentos: DocVencimento[] };
  equipamentos: { kpis: OpsKpis; calibracoes: Calibracao[]; verificacoes_mensal: OpsPoint[] };
  produtividade: { kpis: OpsKpis; moldadores: OpsPoint[]; operadores: OpsPoint[]; mensal: OpsPoint[] };
  contratos: { kpis: OpsKpis; consumo: OpsPoint[]; balanco: ContratoBalanco[] };
  risco: { itens: RiscoItem[] };
  sla: { kpis: OpsKpis; mensal: OpsPoint[] };
  logistica: { kpis: OpsKpis; mensal: OpsPoint[] };
};

const kpis = (v: unknown): OpsKpis => Object.fromEntries(Object.entries((v ?? {}) as Json).map(([k, x]) => [k, num(x)]));
const points = (v: unknown): OpsPoint[] => ((v ?? []) as Json[]).map((r) => ({ ...r, label: text(r.label) }));

export async function getDashboardOps(filters: { from: string; to: string; clientId?: string; workId?: string }): Promise<DashboardOps> {
  const { data, error } = await rpcClient.rpc('dashboard_ops_v2', { p_from: filters.from, p_to: filters.to, p_client_id: filters.clientId || null, p_work_id: filters.workId || null });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Json;
  const nc = (r.nc ?? {}) as Json; const dg = (r.docgate ?? {}) as Json; const eq = (r.equipamentos ?? {}) as Json;
  const pr = (r.produtividade ?? {}) as Json; const ct = (r.contratos ?? {}) as Json; const ri = (r.risco ?? {}) as Json;
  const sla = (r.sla ?? {}) as Json; const lg = (r.logistica ?? {}) as Json;
  return {
    nc: {
      kpis: kpis(nc.kpis), por_severidade: points(nc.por_severidade), por_classificacao: points(nc.por_classificacao), mensal: points(nc.mensal),
      recentes: ((nc.recentes ?? []) as Json[]).map((x) => ({ id: text(x.id), numero: nullable(x.numero), tipo: nullable(x.tipo), severidade: nullable(x.severidade), status: text(x.status), data_abertura: nullable(x.data_abertura), obra: nullable(x.obra) })),
    },
    docgate: {
      kpis: kpis(dg.kpis), por_status: points(dg.por_status),
      vencimentos: ((dg.vencimentos ?? []) as Json[]).map((x) => ({ id: text(x.id), titulo: text(x.titulo), status: text(x.status), data_validade: nullable(x.data_validade), dias: optNum(x.dias) })),
    },
    equipamentos: {
      kpis: kpis(eq.kpis), verificacoes_mensal: points(eq.verificacoes_mensal),
      calibracoes: ((eq.calibracoes ?? []) as Json[]).map((x) => ({ id: text(x.id), label: text(x.label), tipo: nullable(x.tipo), validade: nullable(x.validade), dias: optNum(x.dias) })),
    },
    produtividade: { kpis: kpis(pr.kpis), moldadores: points(pr.moldadores), operadores: points(pr.operadores), mensal: points(pr.mensal) },
    contratos: {
      kpis: kpis(ct.kpis), consumo: points(ct.consumo),
      balanco: ((ct.balanco ?? []) as Json[]).map((x) => ({ id: text(x.id), numero: nullable(x.numero), cliente: nullable(x.cliente), valor_limite: num(x.valor_limite), valor_medido: num(x.valor_medido), valor_faturado: num(x.valor_faturado), saldo_a_medir: num(x.saldo_a_medir), consumo_pct: optNum(x.consumo_pct), vigencia_fim: nullable(x.vigencia_fim), status: text(x.status) })),
    },
    risco: {
      itens: ((ri.itens ?? []) as Json[]).map((x) => ({ key: text(x.key), label: text(x.label), value: num(x.value), amount: x.amount == null ? undefined : num(x.amount), severity: (['alto', 'medio'].includes(text(x.severity)) ? text(x.severity) : 'baixo') as RiscoItem['severity'], route: text(x.route) })),
    },
    sla: { kpis: kpis(sla.kpis), mensal: points(sla.mensal) },
    logistica: { kpis: kpis(lg.kpis), mensal: points(lg.mensal) },
  };
}
