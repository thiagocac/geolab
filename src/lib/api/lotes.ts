import { supabase } from '../supabase';

// Aceitacao de lote (NBR 12655). RPCs re-derivadas do GEOMAT (criar/calcular),
// coleta por amostra (exemplar = 1 NF, resistencia = maior do par). RLS por tenant.
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }> };

export type LoteRow = {
  id: string; numero: string; work_id: string; obra: string; fck_mpa: number; condicao_preparo: string;
  idade_controle_dias: number; periodo_inicio: string | null; periodo_fim: string | null; status: string;
  n_exemplares: number; fcm: number | null; sd: number | null; fck_est: number | null; created_at: string;
};

export async function listObrasRef(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await db.from('client_works').select('id, nome').is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), nome: String(r.nome ?? r.id) }));
}

export async function listLotes(workId?: string): Promise<LoteRow[]> {
  let q = db.from('lotes_aceitacao')
    .select('id, numero, work_id, fck_mpa, condicao_preparo, idade_controle_dias, periodo_inicio, periodo_fim, status, n_exemplares, fcm, sd, fck_est, created_at, client_works(nome)')
    .is('deleted_at', null).order('created_at', { ascending: false });
  if (workId) q = q.eq('work_id', workId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({
    id: String(r.id), numero: String(r.numero), work_id: String(r.work_id), obra: String(r.client_works?.nome ?? ''),
    fck_mpa: Number(r.fck_mpa), condicao_preparo: String(r.condicao_preparo), idade_controle_dias: Number(r.idade_controle_dias),
    periodo_inicio: r.periodo_inicio ?? null, periodo_fim: r.periodo_fim ?? null, status: String(r.status),
    n_exemplares: Number(r.n_exemplares), fcm: r.fcm == null ? null : Number(r.fcm), sd: r.sd == null ? null : Number(r.sd),
    fck_est: r.fck_est == null ? null : Number(r.fck_est), created_at: String(r.created_at),
  }));
}

export async function criarLote(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await db.rpc('criar_lote_aceitacao', { payload });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
}
export async function recalcularLote(id: string): Promise<Record<string, unknown>> {
  const { data, error } = await db.rpc('calcular_aceitacao_lote', { p_lote: id });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
}
export async function excluirLote(id: string): Promise<void> {
  const { error } = await db.from('lotes_aceitacao').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
