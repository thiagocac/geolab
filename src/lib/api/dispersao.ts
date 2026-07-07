import { supabase } from '../supabase';

// B1 — dispersão do par (gêmeos). Δ% = (maior−menor)/média do par na mesma idade.
// RPC dispersao_par_resumo (mig 171) agrega o período por moldador e por operador.
const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }> };

export type DispRow = { colaborador_id: string; nome: string; pares: number; fora: number; pct_fora: number; disp_media: number; disp_max: number };
export type DispResumo = {
  inicio: string; fim: string; limite_pct: number;
  geral: { pares: number; fora: number; disp_media: number; disp_max: number };
  por_moldador: DispRow[]; por_operador: DispRow[];
};

const toRows = (x: unknown): DispRow[] => (Array.isArray(x) ? x : []).map((r) => {
  const o = r as Record<string, unknown>;
  return {
    colaborador_id: String(o.colaborador_id ?? ''), nome: String(o.nome ?? ''),
    pares: Number(o.pares) || 0, fora: Number(o.fora) || 0, pct_fora: Number(o.pct_fora) || 0,
    disp_media: Number(o.disp_media) || 0, disp_max: Number(o.disp_max) || 0,
  };
});

export async function dispersaoParResumo(inicio: string, fim: string): Promise<DispResumo> {
  const { data, error } = await db.rpc('dispersao_par_resumo', { p_inicio: inicio, p_fim: fim });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Record<string, unknown>;
  const g = (d.geral ?? {}) as Record<string, unknown>;
  return {
    inicio: String(d.inicio ?? inicio), fim: String(d.fim ?? fim), limite_pct: Number(d.limite_pct) || 6,
    geral: { pares: Number(g.pares) || 0, fora: Number(g.fora) || 0, disp_media: Number(g.disp_media) || 0, disp_max: Number(g.disp_max) || 0 },
    por_moldador: toRows(d.por_moldador), por_operador: toRows(d.por_operador),
  };
}

// Helper puro para o badge no Rompimentos: dispersão de um conjunto de valores (o par na mesma idade).
export function dispersaoPct(valores: number[]): number | null {
  const v = valores.filter((x) => Number.isFinite(x));
  if (v.length < 2) return null;
  const maior = Math.max(...v), menor = Math.min(...v), media = v.reduce((a, b) => a + b, 0) / v.length;
  if (media <= 0) return null;
  return Math.round(((maior - menor) / media) * 1000) / 10;
}
