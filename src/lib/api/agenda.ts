import { supabase } from '../supabase';

// D1 — "Hoje no lab": agrega o dia via RPC agenda_do_dia (mig 180), sem tabela nova.
const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }> };

export type AgendaMoldagem = { id: string; codigo: string | null; numero_relatorio: string | null; hora: string | null; cliente: string | null; obra: string | null; local: string | null; moldador: string | null; laboratorista: string | null; fornecedor: string | null; volume: number | null; status: string };
export type AgendaRompimento = { id: string; codigo: string | null; numeracao: string | null; idade: number | null; idade_unidade: string; obra: string | null; cliente: string | null };
export type AgendaColeta = { id: string; status: string; motorista: string | null; paradas: number };
export type AgendaLaudo = { id: string; numero: string | null; status: string; obra: string | null; cliente: string | null };
export type AgendaDia = { data: string; moldagens: AgendaMoldagem[]; rompimentos: AgendaRompimento[]; coletas: AgendaColeta[]; laudos: AgendaLaudo[] };

export async function getAgendaDoDia(data: string): Promise<AgendaDia> {
  const { data: d, error } = await db.rpc('agenda_do_dia', { p_data: data });
  if (error) throw new Error(error.message);
  const o = (d ?? {}) as Record<string, unknown>;
  const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  return {
    data: String(o.data ?? data),
    moldagens: arr<AgendaMoldagem>(o.moldagens),
    rompimentos: arr<AgendaRompimento>(o.rompimentos),
    coletas: arr<AgendaColeta>(o.coletas),
    laudos: arr<AgendaLaudo>(o.laudos),
  };
}
