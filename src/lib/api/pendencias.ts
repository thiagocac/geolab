import { supabase } from '../supabase';

// Tela de Pendencias — console consolidado do lab. RPC pendencias_resumo (mig 133; Fase 2 mig 141)
// devolve so as contagens (barato); o clique faz deep-link para a tela dona com filtro inicial.
const db = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type Sev = 'info' | 'warning' | 'danger';
export type PendChave =
  | 'cp_hoje' | 'cp_atrasado' | 'cp_pendente' | 'insatisfatorio' | 'prog_sem_caminhao'
  | 'laudo_aprovar' | 'nc_aberta' | 'conc_sem_laudo' | 'importacao_pendente'
  | 'cal_vencida' | 'cal_vencendo' | 'cert_vencida' | 'cert_vencendo';
export type PendResumo = Record<PendChave, { count: number; sev: Sev }>;

const CHAVES: PendChave[] = ['cp_hoje', 'cp_atrasado', 'cp_pendente', 'insatisfatorio', 'prog_sem_caminhao', 'laudo_aprovar', 'nc_aberta', 'conc_sem_laudo', 'importacao_pendente', 'cal_vencida', 'cal_vencendo', 'cert_vencida', 'cert_vencendo'];

export async function getPendenciasResumo(tenantId: string): Promise<PendResumo> {
  const { data, error } = await db.rpc('pendencias_resumo', { p_tenant: tenantId });
  if (error) throw new Error(error.message);
  const raw = (data ?? {}) as Record<string, { count?: number; sev?: string }>;
  const norm = (k: PendChave): { count: number; sev: Sev } => {
    const r = raw[k] ?? {};
    const sev = (r.sev === 'danger' || r.sev === 'warning' || r.sev === 'info') ? r.sev : 'info';
    return { count: Number(r.count ?? 0), sev };
  };
  const out = {} as PendResumo;
  for (const k of CHAVES) out[k] = norm(k);
  return out;
}
