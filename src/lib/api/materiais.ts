import { supabase } from '../supabase';
import type { PadraoMoldagem } from '../concreto';

// Traços (operational_materials) como catálogo do laboratório (work_id null).
// padrao_moldagem usa formato rico GEOMAT, com campos legados para compatibilidade.
const db = supabase as unknown as { from: (t: string) => any };

export type PadraoIdade = { idade: number; unidade: 'dia' | 'hora'; quantidade: number };
export type TracoRow = {
  id: string;
  codigo: string;
  nome: string;
  aplicacao: string | null;
  fck_mpa: number | null;
  fcj_mpa: number | null;
  desvio_padrao_mpa: number | null;
  condicao_preparo: string | null;
  slump_previsto_cm: number | null;
  slump_tolerancia_cm: number | null;
  validade_concreto_minutos: number | null;
  idade_controle_dias: number | null;
  brita: string | null;
  dmax_agregado_mm: number | null;
  fator_ac: number | null;
  cimento_tipo: string | null;
  consumo_cimento_kg_m3: number | null;
  aditivo_tipo: string | null;
  metodo_cura: string | null;
  especificacao: string | null;
  schema_campos: Record<string, unknown> | null;
  componentes: Record<string, unknown> | null;
  bombeado: boolean;
  observacoes: string | null;
  padrao_moldagem: PadraoMoldagem[] | PadraoIdade[];
  ativo: boolean;
  work_id: string | null;
  client_id: string | null;
  lab_clients?: { razao_social: string | null; nome_fantasia: string | null } | null;
  client_works?: { nome: string | null } | null;
};

const SELECT_TRACO = 'id, codigo, nome, aplicacao, fck_mpa, fcj_mpa, desvio_padrao_mpa, condicao_preparo, slump_previsto_cm, slump_tolerancia_cm, validade_concreto_minutos, idade_controle_dias, brita, dmax_agregado_mm, fator_ac, cimento_tipo, consumo_cimento_kg_m3, aditivo_tipo, metodo_cura, especificacao, schema_campos, bombeado, observacoes, padrao_moldagem, componentes, ativo, work_id, client_id, lab_clients(razao_social, nome_fantasia), client_works(nome)';

export async function listTracos(): Promise<TracoRow[]> {
  const { data, error } = await db.from('operational_materials')
    .select(SELECT_TRACO)
    .eq('material_kind', 'concreto')
    .is('deleted_at', null)
    .order('codigo', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TracoRow[];
}

export async function saveTraco(tenantId: string, id: string | null, values: Record<string, unknown>): Promise<void> {
  if (id) {
    const { error } = await db.from('operational_materials').update(values).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('operational_materials').insert({ work_id: null, client_id: null, ...values, tenant_id: tenantId, material_kind: 'concreto' });
    if (error) throw new Error(error.message);
  }
}

export async function softDeleteTraco(id: string): Promise<void> {
  const { error } = await db.from('operational_materials').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
