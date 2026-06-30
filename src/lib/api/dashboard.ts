import { supabase } from '../supabase';

// KPIs do painel a partir das tabelas existentes (RLS por tenant).
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type Kpis = {
  agenda: { atrasados: number; hoje: number; proximos: number; total: number };
  laudos: { rascunho: number; emitido: number; total: number };
  calibracoesVencendo: number;
  volumeMes: number;
};

export async function getKpis(tenantId?: string): Promise<Kpis> {
  // KPIs agregados NO BANCO via RPC (dashboard_kpis, SECURITY DEFINER + is_tenant_member): 1 ida-e-volta,
  // sem baixar agenda/laudos/equipamentos so para contar. numeric volta como string -> Number().
  const { data, error } = await db.rpc('dashboard_kpis', { p_tenant: tenantId ?? null });
  if (error) throw new Error(error.message);
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number | string> | null;
  return {
    agenda: {
      atrasados: Number(r?.agenda_atrasados ?? 0),
      hoje: Number(r?.agenda_hoje ?? 0),
      proximos: Number(r?.agenda_proximos ?? 0),
      total: Number(r?.agenda_total ?? 0),
    },
    laudos: {
      rascunho: Number(r?.laudos_rascunho ?? 0),
      emitido: Number(r?.laudos_emitido ?? 0),
      total: Number(r?.laudos_total ?? 0),
    },
    calibracoesVencendo: Number(r?.calibracoes_vencendo ?? 0),
    volumeMes: Number(r?.volume_mes ?? 0),
  };
}
