import { supabase } from '../supabase';

// Apoio ao assistente de Nova obra. Cria client_works (+ traço inicial opcional
// vinculado a work_id). RLS por tenant; tenant_id injetado.
const db = supabase as unknown as { from: (t: string) => any };

export async function listClientesRef(): Promise<{ value: string; label: string }[]> {
  const { data, error } = await db.from('lab_clients').select('id, razao_social').is('deleted_at', null).order('razao_social', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ value: String(r.id), label: String(r.razao_social ?? r.id) }));
}

export async function createObra(tenantId: string, values: Record<string, unknown>): Promise<string> {
  const { data, error } = await db.from('client_works').insert({ ...values, tenant_id: tenantId }).select('id').single();
  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function createTracoObra(tenantId: string, workId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('operational_materials').insert({ ...values, tenant_id: tenantId, work_id: workId, material_kind: 'concreto' });
  if (error) throw new Error(error.message);
}
