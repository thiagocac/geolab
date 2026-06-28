import { supabase } from '../supabase';

// KPIs do painel a partir das tabelas existentes (RLS por tenant).
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type Kpis = {
  agenda: { atrasados: number; hoje: number; proximos: number; total: number };
  laudos: { rascunho: number; emitido: number; total: number };
  calibracoesVencendo: number;
};

export async function getKpis(tenantId?: string): Promise<Kpis> {
  // KPIs agregados NO BANCO via RPC (dashboard_kpis, SECURITY DEFINER + is_tenant_member): 1 ida-e-volta,
  // sem baixar agenda/laudos/equipamentos só para contar. Números idênticos ao cálculo anterior no cliente.
  const { data, error } = await db.rpc('dashboard_kpis', { p_tenant: tenantId ?? null });
  if (error) throw new Error(error.message);
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number> | null;
  return {
    agenda: {
      atrasados: r?.agenda_atrasados ?? 0,
      hoje: r?.agenda_hoje ?? 0,
      proximos: r?.agenda_proximos ?? 0,
      total: r?.agenda_total ?? 0,
    },
    laudos: {
      rascunho: r?.laudos_rascunho ?? 0,
      emitido: r?.laudos_emitido ?? 0,
      total: r?.laudos_total ?? 0,
    },
    calibracoesVencendo: r?.calibracoes_vencendo ?? 0,
  };
}
