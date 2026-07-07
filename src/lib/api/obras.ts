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
  const { data: w } = await db.from('client_works').select('client_id').eq('id', workId).maybeSingle();
  const clientId = (w?.client_id as string | undefined) ?? null;
  const { error } = await db.from('operational_materials').insert({ ...values, tenant_id: tenantId, work_id: workId, client_id: clientId, material_kind: 'concreto' });
  if (error) throw new Error(error.message);
}

// D4 — duplicar obra (RPC duplicar_obra, mig 177): copia estrutura + traços + config, não dados operacionais.
export async function duplicarObra(workId: string): Promise<string> {
  const rpc = (supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>).bind(supabase);
  const { data, error } = await rpc('duplicar_obra', { p_work_id: workId });
  if (error) throw new Error(error.message);
  return String(data);
}
