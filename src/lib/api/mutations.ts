import { supabase } from '../supabase';
import type { DomainRow } from './types';

// Mutations GEOLAB (enxutas). createRow injeta tenant_id; updated_at fica a cargo do trigger
// set_updated_at (nas tabelas que têm a coluna; client_contacts não tem). Soft-delete sempre.
const db = supabase as unknown as { from: (t: string) => any };

export async function createRow<T extends DomainRow>(table: string, tenantId: string, values: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.from(table).insert({ ...values, tenant_id: tenantId }).select('*').single();
  if (error) throw new Error(error.message);
  return data as T;
}

export async function updateRow<T extends DomainRow>(table: string, id: string, values: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.from(table).update(values).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return data as T;
}

export async function softDelete(table: string, id: string): Promise<void> {
  const { error } = await db.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
