import { supabase } from '../supabase';
import type { DomainRow, ListState, PageResult } from './types';

// Camada de leitura GEOLAB (enxuta). table dinâmico => cast permissivo (como no GEOMAT).
// Filtra deleted_at no front: a RLS do GEOLAB isola por tenant mas NÃO oculta deletados.
const db = supabase as unknown as { from: (t: string) => any };

const searchFields: Record<string, string[]> = {
  lab_clients: ['razao_social', 'nome_fantasia', 'cnpj_cpf'],
  client_works: ['codigo', 'nome', 'cidade'],
  client_contacts: ['nome', 'email'],
  colaboradores: ['nome', 'documento'],
  equipamentos: ['marca_modelo', 'numero_serie'],
  lab_contracts: ['numero', 'descricao'],
};
const esc = (s: string) => s.replace(/[%_]/g, (m) => '\\' + m);

export async function listRows<T extends DomainRow>(table: string, state: ListState): Promise<PageResult<T>> {
  const from = (state.page - 1) * state.pageSize;
  const to = from + state.pageSize - 1;
  let q = db.from(table).select('*', { count: 'exact' }).is('deleted_at', null);
  if (state.filter) for (const [k, v] of Object.entries(state.filter)) q = q.eq(k, v);
  if (state.search) {
    const s = esc(state.search);
    const fs = searchFields[table] ?? ['nome'];
    q = q.or(fs.map((f) => `${f}.ilike.%${s}%`).join(','));
  }
  const { data, error, count } = await q.order(state.sort.column, { ascending: state.sort.direction === 'asc' }).range(from, to);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as T[], count: count ?? 0 };
}

export async function listReference(table: string, labelCol = 'nome', filter?: Record<string, string>): Promise<{ value: string; label: string }[]> {
  let q = db.from(table).select(`id, ${labelCol}`).is('deleted_at', null);
  if (filter) for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { data, error } = await q.order(labelCol, { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ value: String(r.id), label: String(r[labelCol] ?? r.id) }));
}
