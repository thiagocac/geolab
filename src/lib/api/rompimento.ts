import { supabase } from '../supabase';
import { env } from '../env';

const db = supabase as unknown as { from: (t: string) => any };

export type CpPendente = {
  id: string; codigo: string | null; amostra_id: string | null; idade_dias: number | null; idade_unidade: string;
  data_prevista_rompimento: string | null; data_moldagem: string | null;
  concretagem_id: string | null; material_test_type_id: string | null;
  concretagens?: { codigo: string | null; fck_previsto: number | null; client_works?: { nome: string } | null } | null;
};

export async function listAgenda(): Promise<CpPendente[]> {
  const { data, error } = await db.from('corpos_prova')
    .select('id, codigo, amostra_id, idade_dias, idade_unidade, data_prevista_rompimento, data_moldagem, concretagem_id, material_test_type_id, concretagens(codigo, fck_previsto, client_works(nome))')
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

// E1 — aceitacao por exemplar na idade de controle (28d). Dispara resultado_abaixo_fck
// SE o exemplar (maior do par no 28d) < fck. Idades menores nao reprovam (acompanhamento).
// Best-effort: nunca derruba o lancamento. Dedupe por amostra (exemplar).
const dbm = supabase as unknown as { from: (t: string) => any };
export async function maybeNotifyAbaixoFck(
  tenantId: string,
  cp: { id: string; amostra_id: string | null; idade_dias: number | null; idade_unidade: string; codigo?: string | null },
  fck: number | null,
): Promise<void> {
  try {
    const isControle = Number(cp.idade_dias) === 28 && cp.idade_unidade !== 'hora';
    if (!isControle || !cp.amostra_id || !fck || fck <= 0) return;
    const { data: sibs } = await dbm.from('corpos_prova').select('id').eq('amostra_id', cp.amostra_id).is('deleted_at', null);
    const ids = ((sibs ?? []) as Record<string, unknown>[]).map((r) => r.id).filter(Boolean);
    if (!ids.length) return;
    const { data: mts } = await dbm.from('material_tests').select('resultado_valor, idade_dias, idade_unidade').in('corpo_prova_id', ids).is('deleted_at', null);
    const vals = ((mts ?? []) as Record<string, unknown>[])
      .filter((r) => Number(r.idade_dias) === 28 && String(r.idade_unidade) !== 'hora')
      .map((r) => Number(r.resultado_valor)).filter((v) => isFinite(v));
    if (!vals.length) return;
    const exemplar = Math.max(...vals);
    if (exemplar >= fck) return;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token ?? '';
    await fetch(env.supabaseUrl + '/functions/v1/notify-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
      body: JSON.stringify({ tenant_id: tenantId, event_type: 'resultado_abaixo_fck', entity_type: 'amostra', entity_id: cp.amostra_id, reference: cp.codigo ?? '', deep_link: '/laudos', body: 'Exemplar abaixo do fck na idade de controle: ' + exemplar.toFixed(1) + ' < ' + fck.toFixed(1) + ' MPa.' }),
    });
  } catch { /* best-effort */ }
}
