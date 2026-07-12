import { supabase } from '../supabase';

// [v238] Helpers do wizard de implantação: criações rápidas e listagens de revisão que
// não existiam nas APIs por domínio. Escrita passa pela RLS normal do tenant (is_tenant_writer).
const db = supabase as unknown as { from: (t: string) => any };
type Rec = Record<string, unknown>;

export async function createCliente(tenantId: string, values: Record<string, unknown>): Promise<string> {
  const { data, error } = await db.from('lab_clients').insert({ ...values, tenant_id: tenantId }).select('id').single();
  if (error) throw new Error(error.message);
  return String(data.id);
}

export type TestTypeResumo = { id: string; nome: string; idade: string };
export async function listTestTypesAtivos(): Promise<TestTypeResumo[]> {
  const { data, error } = await db.from('material_test_types').select('id, nome, idade_controle, idade_controle_unidade, idade_padrao_dias').is('deleted_at', null).eq('ativo', true).order('nome');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Rec[]).map((r) => ({
    id: String(r.id),
    nome: String(r.nome ?? ''),
    idade: r.idade_controle != null ? String(r.idade_controle) + String(r.idade_controle_unidade ?? 'd') : r.idade_padrao_dias != null ? String(r.idade_padrao_dias) + 'd' : '—',
  }));
}

export type CatalogoResumo = { id: string; code: string; nome: string; unidade: string | null; preco: number | null };
export async function listCatalogoResumo(): Promise<CatalogoResumo[]> {
  const { data, error } = await db.from('service_catalog_items').select('id, code, nome, unidade, preco_sugerido').is('deleted_at', null).eq('ativo', true).order('code');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Rec[]).map((r) => ({
    id: String(r.id), code: String(r.code ?? ''), nome: String(r.nome ?? ''),
    unidade: (r.unidade as string | null) ?? null,
    preco: r.preco_sugerido == null ? null : Number(r.preco_sugerido),
  }));
}
