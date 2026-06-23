import { supabase } from '../supabase';

// Colaboradores + certificações (1-N). Validade alimenta o indicador visual.
const db = supabase as unknown as { from: (t: string) => any };

export type Cert = { id: string; tipo: string; numero: string | null; validade: string | null };
export type ColaboradorRow = { id: string; nome: string; documento: string | null; registro_profissional: string | null; certs: Cert[] };

export async function listColaboradores(): Promise<ColaboradorRow[]> {
  const { data, error } = await db.from('colaboradores')
    .select('id, nome, documento, registro_profissional, colaborador_certificacoes(id, tipo, numero, validade, deleted_at)')
    .is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({
    id: String(r.id), nome: r.nome, documento: r.documento ?? null, registro_profissional: r.registro_profissional ?? null,
    certs: ((r.colaborador_certificacoes ?? []) as Record<string, any>[]).filter((c) => !c.deleted_at).map((c) => ({ id: String(c.id), tipo: c.tipo, numero: c.numero ?? null, validade: c.validade ?? null })),
  }));
}
export async function saveColaborador(tenantId: string, id: string | null, values: Record<string, unknown>): Promise<string> {
  if (id) { const { error } = await db.from('colaboradores').update(values).eq('id', id); if (error) throw new Error(error.message); return id; }
  const { data, error } = await db.from('colaboradores').insert({ ...values, tenant_id: tenantId }).select('id').single();
  if (error) throw new Error(error.message); return String(data.id);
}
export async function softDeleteColaborador(id: string): Promise<void> {
  const { error } = await db.from('colaboradores').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function addCert(tenantId: string, colaboradorId: string, v: { tipo: string; numero?: string; validade?: string }): Promise<void> {
  const { error } = await db.from('colaborador_certificacoes').insert({ tenant_id: tenantId, colaborador_id: colaboradorId, tipo: v.tipo, numero: v.numero || null, validade: v.validade || null });
  if (error) throw new Error(error.message);
}
export async function softDeleteCert(id: string): Promise<void> {
  const { error } = await db.from('colaborador_certificacoes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
