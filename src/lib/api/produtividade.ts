import { supabase } from '../supabase';

// Relatório de produtividade por colaborador (RPC relatorio_produtividade): moldagem + rompimento no período.
const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }> };

export type ProdRow = { colaborador_id: string; nome: string; funcoes: string[]; concretagens: number; cps_moldados: number; rompimentos: number };

export async function relatorioProdutividade(inicio: string, fim: string): Promise<{ inicio: string; fim: string; linhas: ProdRow[] }> {
  const { data, error } = await db.rpc('relatorio_produtividade', { p_inicio: inicio, p_fim: fim });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as { inicio?: string; fim?: string; linhas?: any[] };
  const linhas = Array.isArray(d.linhas) ? d.linhas.map((r) => ({
    colaborador_id: String(r.colaborador_id), nome: String(r.nome),
    funcoes: Array.isArray(r.funcoes) ? r.funcoes.map(String) : [],
    concretagens: Number(r.concretagens) || 0, cps_moldados: Number(r.cps_moldados) || 0, rompimentos: Number(r.rompimentos) || 0,
  })) : [];
  return { inicio: String(d.inicio ?? inicio), fim: String(d.fim ?? fim), linhas };
}
