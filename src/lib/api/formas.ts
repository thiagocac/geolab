import { supabase } from '../supabase';

// Controle logistico de formas (moldes de CP) por obra. Desvinculado da concretagem:
// movimentos avulsos de entrega/coleta; saldo = entregas - coletas (v_formas_saldo).
const db = supabase as unknown as { from: (t: string) => any };

export type ObraRef = { id: string; nome: string; cliente: string };
export type SaldoRow = { work_id: string; obra: string; cliente: string; saldo: number };
export type MovRow = { id: string; data: string; work_id: string; obra: string; tipo: string; quantidade: number; colaborador: string | null; observacoes: string | null };

export async function listObrasFormas(): Promise<ObraRef[]> {
  const { data, error } = await db.from('client_works').select('id, nome, lab_clients(razao_social)').is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ id: String(r.id), nome: String(r.nome ?? r.id), cliente: String(r.lab_clients?.razao_social ?? '') }));
}

export async function listColaboradoresRef(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await db.from('colaboradores').select('id, nome').is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ id: String(r.id), nome: String(r.nome ?? r.id) }));
}

// Saldo por obra: a view v_formas_saldo nao tem FK declarada (resolve nomes via mapa de obras).
export async function listSaldo(obras: ObraRef[]): Promise<SaldoRow[]> {
  const { data, error } = await db.from('v_formas_saldo').select('work_id, saldo');
  if (error) throw new Error(error.message);
  const map = new Map(obras.map((o) => [o.id, o]));
  return ((data ?? []) as Record<string, any>[])
    .map((r) => { const o = map.get(String(r.work_id)); return { work_id: String(r.work_id), obra: o?.nome ?? '—', cliente: o?.cliente ?? '', saldo: Number(r.saldo) || 0 }; })
    .filter((r) => r.saldo !== 0)
    .sort((a, b) => b.saldo - a.saldo);
}

export async function listMovimentos(workId?: string): Promise<MovRow[]> {
  let q = db.from('forma_movimentacoes')
    .select('id, data, work_id, tipo, quantidade, observacoes, client_works(nome), colaboradores(nome)')
    .is('deleted_at', null).order('data', { ascending: false }).order('created_at', { ascending: false }).limit(100);
  if (workId) q = q.eq('work_id', workId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({
    id: String(r.id), data: String(r.data ?? '').slice(0, 10), work_id: String(r.work_id),
    obra: String(r.client_works?.nome ?? ''), tipo: String(r.tipo), quantidade: Number(r.quantidade) || 0,
    colaborador: r.colaboradores?.nome ?? null, observacoes: r.observacoes ?? null,
  }));
}

export async function addMovimento(tenantId: string, v: { work_id: string; tipo: string; quantidade: number; data: string; colaborador_id?: string | null; observacoes?: string | null }): Promise<void> {
  const { error } = await db.from('forma_movimentacoes').insert({ tenant_id: tenantId, work_id: v.work_id, tipo: v.tipo, quantidade: v.quantidade, data: v.data, colaborador_id: v.colaborador_id || null, observacoes: v.observacoes || null });
  if (error) throw new Error(error.message);
}

export async function removeMovimento(id: string): Promise<void> {
  const { error } = await db.from('forma_movimentacoes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
