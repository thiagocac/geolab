import { supabase } from '../supabase';

// Traços (operational_materials) como catálogo do laboratório (work_id null).
// padrao_moldagem é jsonb: array de { idade, unidade, quantidade }. material_kind=concreto (v1).
const db = supabase as unknown as { from: (t: string) => any };

export type PadraoIdade = { idade: number; unidade: 'dia' | 'hora'; quantidade: number };
export type TracoRow = {
  id: string; codigo: string; nome: string; fck_mpa: number | null; condicao_preparo: string | null;
  slump_previsto_cm: number | null; slump_tolerancia_cm: number | null; brita: string | null; dmax_agregado_mm: number | null;
  fator_ac: number | null; cimento_tipo: string | null; consumo_cimento_kg_m3: number | null; aditivo_tipo: string | null;
  metodo_cura: string | null; bombeado: boolean; observacoes: string | null; padrao_moldagem: PadraoIdade[]; ativo: boolean;
};

export async function listTracos(): Promise<TracoRow[]> {
  const { data, error } = await db.from('operational_materials')
    .select('id, codigo, nome, fck_mpa, condicao_preparo, slump_previsto_cm, slump_tolerancia_cm, brita, dmax_agregado_mm, fator_ac, cimento_tipo, consumo_cimento_kg_m3, aditivo_tipo, metodo_cura, bombeado, observacoes, padrao_moldagem, ativo')
    .is('deleted_at', null).order('codigo', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TracoRow[];
}

export async function saveTraco(tenantId: string, id: string | null, values: Record<string, unknown>): Promise<void> {
  if (id) {
    const { error } = await db.from('operational_materials').update(values).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('operational_materials').insert({ ...values, tenant_id: tenantId, material_kind: 'concreto', work_id: null });
    if (error) throw new Error(error.message);
  }
}

export async function softDeleteTraco(id: string): Promise<void> {
  const { error } = await db.from('operational_materials').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
