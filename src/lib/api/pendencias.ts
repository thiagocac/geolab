import { supabase } from '../supabase';

// Tela de Pendencias (Fase 1) — console consolidado do lab. RPC pendencias_resumo (migration 133)
// devolve so as contagens (barato); o clique faz deep-link para a tela dona com filtro inicial.
const db = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type Sev = 'info' | 'warning' | 'danger';
export type PendChave = 'cp_hoje' | 'cp_atrasado' | 'cp_pendente' | 'insatisfatorio' | 'prog_sem_caminhao' | 'laudo_aprovar' | 'nc_aberta';
export type PendResumo = Record<PendChave, { count: number; sev: Sev }>;

export async function getPendenciasResumo(tenantId: string): Promise<PendResumo> {
  const { data, error } = await db.rpc('pendencias_resumo', { p_tenant: tenantId });
  if (error) throw new Error(error.message);
  const raw = (data ?? {}) as Record<string, { count?: number; sev?: string }>;
  const norm = (k: PendChave): { count: number; sev: Sev } => {
    const r = raw[k] ?? {};
    const sev = (r.sev === 'danger' || r.sev === 'warning' || r.sev === 'info') ? r.sev : 'info';
    return { count: Number(r.count ?? 0), sev };
  };
  return {
    cp_hoje: norm('cp_hoje'), cp_atrasado: norm('cp_atrasado'), cp_pendente: norm('cp_pendente'),
    insatisfatorio: norm('insatisfatorio'), prog_sem_caminhao: norm('prog_sem_caminhao'),
    laudo_aprovar: norm('laudo_aprovar'), nc_aberta: norm('nc_aberta'),
  };
}
