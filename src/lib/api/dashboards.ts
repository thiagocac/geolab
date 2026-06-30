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
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_client_id: filters.clientId ?? null,
    p_work_id: filters.workId ?? null,
    p_material_kind: filters.materialKind ?? 'concreto',
  });
  if (error) throw new Error(error.message);
  return asSnapshot(data, filters);
}
