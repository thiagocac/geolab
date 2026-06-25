import { supabase } from '../supabase';
import type { PortalLaudoView, PortalResultadoRow, ParcialFinal } from '../portal/types';

const rpc = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

// Resultados consolidados (1 linha por CP) no escopo do membro logado (RPC SECURITY DEFINER).
export async function listPortalResultados(workId?: string): Promise<PortalResultadoRow[]> {
  const { data, error } = await rpc.rpc('portal_resultados', { p_work_id: workId ?? null });
  if (error) throw new Error(error.message);
  return (data ?? []) as PortalResultadoRow[];
}

// Laudos do escopo do membro + classificacao Parcial/Final por exemplar.
export async function listPortalLaudosView(workId?: string): Promise<PortalLaudoView[]> {
  const { data, error } = await rpc.rpc('portal_laudos', { p_work_id: workId ?? null });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    numero: String(r.numero ?? ''),
    status: String(r.status ?? ''),
    revisao: Number(r.revisao ?? 0),
    escopo: (r.escopo as string | null) ?? null,
    data_emissao: (r.data_emissao as string | null) ?? null,
    work_id: (r.work_id as string | null) ?? null,
    work_nome: (r.work_nome as string | null) ?? null,
    concretagem_id: (r.concretagem_id as string | null) ?? null,
    tem_pdf: r.tem_pdf === true,
    parcial_final: (String(r.parcial_final ?? 'sem_resultados') as ParcialFinal),
  }));
}
