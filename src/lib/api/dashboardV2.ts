import { supabase } from '../supabase';

/**
 * Dashboard v2 — leituras agregadas dedicadas (mig 205).
 * v_dashboard_filter_options: opções da barra de filtros em 1 query (cliente/obra/traço/fornecedor).
 * v_dashboard_quality_points: pontos de qualidade por resultado, base de drill-down.
 * As views são security_invoker; RLS das tabelas base decide o tenant. Ainda não tipadas no
 * database.types.ts gerado — acesso via cast estrutural (mesmo padrão do dashboards.ts).
 */

const db = supabase as unknown as {
  from: (table: string) => {
    select: (cols: string) => {
      order: (col: string) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

export type FilterOptionKind = 'cliente' | 'obra' | 'traco' | 'fornecedor';
export type FilterOption = { kind: FilterOptionKind; id: string; label: string; parent_id: string | null };
export type FilterOptions = {
  clientes: FilterOption[];
  obras: FilterOption[];
  tracos: FilterOption[];
  fornecedores: FilterOption[];
};

export const emptyFilterOptions: FilterOptions = { clientes: [], obras: [], tracos: [], fornecedores: [] };

export async function getDashboardFilterOptions(): Promise<FilterOptions> {
  const { data, error } = await db.from('v_dashboard_filter_options').select('kind,id,label,parent_id').order('label');
  if (error) throw new Error(error.message);
  const rows = (Array.isArray(data) ? data : []) as FilterOption[];
  return {
    clientes: rows.filter((r) => r.kind === 'cliente'),
    obras: rows.filter((r) => r.kind === 'obra'),
    tracos: rows.filter((r) => r.kind === 'traco'),
    fornecedores: rows.filter((r) => r.kind === 'fornecedor'),
  };
}

// ---- Qualidade v2 (RPC dashboard_qualidade_v2, mig 206) ----

const rpcDb = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type QualidadeSeriePoint = { label: string; valor: number };
export type QualidadeRankRow = { id?: string | null; nome: string; valor: number; taxa?: number | null; count?: number; detalhe?: string };
export type QualidadeHeatCell = { row: string; col: string; valor: number; detalhe?: string };
export type QualidadeV2 = {
  insatisfatorios_mensal: QualidadeSeriePoint[];
  altas_mensal: QualidadeSeriePoint[];
  variacao_mensal: QualidadeSeriePoint[];
  insatisfatorios_obra: QualidadeRankRow[];
  tracos_altos: QualidadeRankRow[];
  dispersao_tracos: QualidadeRankRow[];
  heatmap_fck_obra: QualidadeHeatCell[];
  ensaios_controle: number;
};

export const emptyQualidadeV2: QualidadeV2 = {
  insatisfatorios_mensal: [], altas_mensal: [], variacao_mensal: [],
  insatisfatorios_obra: [], tracos_altos: [], dispersao_tracos: [],
  heatmap_fck_obra: [], ensaios_controle: 0,
};

export async function getDashboardQualidadeV2(params: {
  from?: string; to?: string; clientId?: string; workId?: string; tracoId?: string; fornecedor?: string;
}): Promise<QualidadeV2> {
  const { data, error } = await rpcDb.rpc('dashboard_qualidade_v2', {
    p_from: params.from || null,
    p_to: params.to || null,
    p_client_id: params.clientId || null,
    p_work_id: params.workId || null,
    p_traco_id: params.tracoId || null,
    p_fornecedor: params.fornecedor || null,
  });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Partial<QualidadeV2>;
  return {
    insatisfatorios_mensal: d.insatisfatorios_mensal ?? [],
    altas_mensal: d.altas_mensal ?? [],
    variacao_mensal: d.variacao_mensal ?? [],
    insatisfatorios_obra: d.insatisfatorios_obra ?? [],
    tracos_altos: d.tracos_altos ?? [],
    dispersao_tracos: d.dispersao_tracos ?? [],
    heatmap_fck_obra: d.heatmap_fck_obra ?? [],
    ensaios_controle: Number(d.ensaios_controle ?? 0),
  };
}
