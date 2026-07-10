import { supabase } from '../supabase';

// SPEC-02 (v214) — Catálogo mestre de serviços do laboratório (service_catalog_items, mig 208).
// Escrita direta na tabela (RLS is_tenant_writer decide), mesmo padrão da tabela de preços.

const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type CatalogItem = {
  id?: string;
  code: string;
  nome: string;
  descricao?: string | null;
  material_kind?: string;
  unidade: string;
  tipo_cobranca: string;
  preco_sugerido: number;
  custo_estimado: number;
  ativo: boolean;
};

export async function listCatalogItems(): Promise<CatalogItem[]> {
  const { data, error } = await db.from('service_catalog_items')
    .select('id, code, nome, descricao, material_kind, unidade, tipo_cobranca, preco_sugerido, custo_estimado, ativo')
    .is('deleted_at', null)
    .order('code');
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogItem[];
}

export async function upsertCatalogItem(item: CatalogItem & { tenant_id?: string }): Promise<void> {
  const payload = {
    code: item.code.trim(),
    nome: item.nome.trim(),
    descricao: item.descricao ?? null,
    material_kind: item.material_kind ?? 'concreto',
    unidade: item.unidade || 'un',
    tipo_cobranca: item.tipo_cobranca,
    preco_sugerido: Number(item.preco_sugerido) || 0,
    custo_estimado: Number(item.custo_estimado) || 0,
    ativo: item.ativo,
    updated_at: new Date().toISOString(),
  };
  if (item.id) {
    const { error } = await db.from('service_catalog_items').update(payload).eq('id', item.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('service_catalog_items').insert({ ...payload, tenant_id: item.tenant_id });
    if (error) throw new Error(error.message);
  }
}

export async function seedCatalogDefaults(): Promise<number> {
  const { data, error } = await db.rpc('seed_service_catalog_defaults');
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
