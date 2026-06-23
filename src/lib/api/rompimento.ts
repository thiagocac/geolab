import { supabase } from '../supabase';

const db = supabase as unknown as { from: (t: string) => any };

export type CpPendente = {
  id: string; codigo: string | null; idade_dias: number | null; idade_unidade: string;
  data_prevista_rompimento: string | null; data_moldagem: string | null;
  concretagem_id: string | null; material_test_type_id: string | null;
  concretagens?: { codigo: string | null; fck_previsto: number | null; client_works?: { nome: string } | null } | null;
};

export async function listAgenda(): Promise<CpPendente[]> {
  const { data, error } = await db.from('corpos_prova')
    .select('id, codigo, idade_dias, idade_unidade, data_prevista_rompimento, data_moldagem, concretagem_id, material_test_type_id, concretagens(codigo, fck_previsto, client_works(nome))')
    .eq('situacao', 'pendente').is('deleted_at', null)
    .order('data_prevista_rompimento', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CpPendente[];
}

// Fator de correcao h/d (ABNT NBR 5739), interpolado.
export function fatorHD(d: number, h: number): number {
  const r = d > 0 ? h / d : 2;
  if (r >= 2.0) return 1.0;
  if (r >= 1.75) return 0.98 + ((r - 1.75) / 0.25) * 0.02;
  if (r >= 1.5) return 0.97 + ((r - 1.5) / 0.25) * 0.01;
  if (r >= 1.25) return 0.94 + ((r - 1.25) / 0.25) * 0.03;
  if (r >= 1.0) return 0.87 + ((r - 1.0) / 0.25) * 0.07;
  return 0.87;
}
export function calcMPa(cargaKn: number, d: number, h: number): number {
  const area = Math.PI * (d / 2) * (d / 2);
  if (!area) return 0;
  const mpa = ((cargaKn * 1000) / area) * fatorHD(d, h);
  return Math.round(mpa * 10) / 10;
}

export type LancamentoInput = { carga_ruptura_kn: number; cp_diametro_mm: number; cp_altura_mm: number; tipo_ruptura?: string; capeamento?: string; equipamento_id?: string | null; operador_id?: string | null; data_rompimento: string };

export async function lancarResultado(tenantId: string, cp: CpPendente, v: LancamentoInput): Promise<number> {
  const mpa = calcMPa(v.carga_ruptura_kn, v.cp_diametro_mm, v.cp_altura_mm);
  const { error: e1 } = await db.from('material_tests').insert({
    tenant_id: tenantId, corpo_prova_id: cp.id, concretagem_id: cp.concretagem_id, material_test_type_id: cp.material_test_type_id,
    idade_dias: cp.idade_dias, idade_unidade: cp.idade_unidade, data_rompimento: v.data_rompimento,
    carga_ruptura_kn: v.carga_ruptura_kn, cp_diametro_mm: v.cp_diametro_mm, cp_altura_mm: v.cp_altura_mm,
    resultado_valor: mpa, unidade_resultado: 'MPa', fck_referencia_mpa: cp.concretagens?.fck_previsto ?? null,
    tipo_ruptura: v.tipo_ruptura ?? null, capeamento: v.capeamento ?? null,
    equipamento_id: v.equipamento_id ?? null, operador_id: v.operador_id ?? null, origem: 'manual',
  });
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await db.from('corpos_prova').update({ situacao: 'rompido', data_real_rompimento: v.data_rompimento }).eq('id', cp.id);
  if (e2) throw new Error(e2.message);
  return mpa;
}
