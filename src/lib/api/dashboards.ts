import { supabase } from '../supabase';

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type DashboardFilters = { from?: string; to?: string; clientId?: string; workId?: string; materialKind?: string };
export type KpiSet = Record<string, number>;
export type SeriePoint = { label: string; valor: number; volume?: number; ensaios?: number; conforme?: number; nao_conforme?: number; meta?: number };
export type RankingRow = { id?: string; nome: string; valor: number; detalhe?: string; taxa?: number; volume?: number; count?: number };
export type HeatmapRow = { obra: string; faixa: string; valor: number; detalhe?: string };
export type AlertRow = { id?: string; tipo: string; titulo: string; detalhe: string; severidade: 'critico' | 'alto' | 'medio' | 'baixo'; data?: string; link?: string };
export type FinanceRow = { label: string; previsto: number; realizado: number; aberto: number; vencido: number };
export type LabDashboardSnapshot = {
  generated_at: string;
  filters: DashboardFilters;
  kpis: KpiSet;
  series: Record<string, SeriePoint[]>;
  rankings: Record<string, RankingRow[]>;
  heatmaps: Record<string, HeatmapRow[]>;
  alerts: AlertRow[];
  finance: FinanceRow[];
  lists: Record<string, Array<Record<string, unknown>>>;
};

export const emptySnapshot = (filters: DashboardFilters = {}): LabDashboardSnapshot => ({
  generated_at: new Date().toISOString(),
  filters,
  kpis: {},
  series: {},
  rankings: {},
  heatmaps: {},
  alerts: [],
  finance: [],
  lists: {},
});

function asSnapshot(data: unknown, filters: DashboardFilters): LabDashboardSnapshot {
  const r = (Array.isArray(data) ? data[0] : data) as Partial<LabDashboardSnapshot> | null;
  if (!r || typeof r !== 'object') return emptySnapshot(filters);
  return {
    generated_at: String(r.generated_at ?? new Date().toISOString()),
    filters: { ...filters, ...(r.filters ?? {}) },
    kpis: (r.kpis ?? {}) as KpiSet,
    series: (r.series ?? {}) as Record<string, SeriePoint[]>,
    rankings: (r.rankings ?? {}) as Record<string, RankingRow[]>,
    heatmaps: (r.heatmaps ?? {}) as Record<string, HeatmapRow[]>,
    alerts: (r.alerts ?? []) as AlertRow[],
    finance: (r.finance ?? []) as FinanceRow[],
    lists: (r.lists ?? {}) as Record<string, Array<Record<string, unknown>>>,
  };
}

export async function getLabDashboardSnapshot(filters: DashboardFilters): Promise<LabDashboardSnapshot> {
  const { data, error } = await db.rpc('dashboard_laboratorio_snapshot', {
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_client_id: filters.clientId || null,
    p_work_id: filters.workId || null,
    p_material_kind: filters.materialKind || 'concreto',
  });
  if (error) throw new Error(error.message);
  return asSnapshot(data, filters);
}

// B4 — carta de controle (Shewhart X̄-R, subgrupo = par de gêmeos na idade de controle).
export type CartaScope = 'traco' | 'obra' | 'fornecedor';
export type CartaPonto = { label: string; data: string | null; x: number; r: number; exemplar: number; fora: boolean };
export type CartaControle = {
  scope: CartaScope; idade: number; fck: number | null; n: number;
  a2?: number; d4?: number; xbb?: number; rbar?: number; ucl_x?: number; lcl_x?: number; cl_x?: number; ucl_r?: number;
  fora_controle?: number; abaixo_fck?: number | null; pontos: CartaPonto[];
};
export type CartaOpcoes = { tracos: Array<{ id: string; nome: string }>; obras: Array<{ id: string; nome: string }>; fornecedores: string[] };

export async function cartaControleOpcoes(): Promise<CartaOpcoes> {
  const { data, error } = await db.rpc('carta_controle_opcoes');
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Record<string, unknown>;
  const opts = (x: unknown): Array<{ id: string; nome: string }> => (Array.isArray(x) ? x : []).map((o) => ({ id: String((o as any).id ?? ''), nome: String((o as any).nome ?? '') }));
  return { tracos: opts(d.tracos), obras: opts(d.obras), fornecedores: (Array.isArray(d.fornecedores) ? d.fornecedores : []).map(String) };
}

export async function getCartaControle(scope: CartaScope, id: string | null, fornecedor: string | null, from?: string | null, to?: string | null): Promise<CartaControle> {
  const { data, error } = await db.rpc('carta_controle', { p_scope: scope, p_id: id || null, p_fornecedor: fornecedor || null, p_from: from || null, p_to: to || null });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Record<string, any>;
  const pontos: CartaPonto[] = (Array.isArray(d.pontos) ? d.pontos : []).map((p: any) => ({
    label: String(p.label ?? ''), data: p.data ?? null, x: Number(p.x) || 0, r: Number(p.r) || 0, exemplar: Number(p.exemplar) || 0, fora: !!p.fora,
  }));
  return {
    scope, idade: Number(d.idade) || 28, fck: d.fck == null ? null : Number(d.fck), n: Number(d.n) || 0,
    a2: d.a2 != null ? Number(d.a2) : undefined, d4: d.d4 != null ? Number(d.d4) : undefined,
    xbb: d.xbb != null ? Number(d.xbb) : undefined, rbar: d.rbar != null ? Number(d.rbar) : undefined,
    ucl_x: d.ucl_x != null ? Number(d.ucl_x) : undefined, lcl_x: d.lcl_x != null ? Number(d.lcl_x) : undefined,
    cl_x: d.cl_x != null ? Number(d.cl_x) : undefined, ucl_r: d.ucl_r != null ? Number(d.ucl_r) : undefined,
    fora_controle: d.fora_controle != null ? Number(d.fora_controle) : undefined,
    abaixo_fck: d.abaixo_fck == null ? null : Number(d.abaixo_fck), pontos,
  };
}
