import { supabase } from '../supabase';
import { captureException, trackDomainEvent } from '../telemetry';
import { invokeEdgeFunction } from '../telemetry/edge';
import { calcMPa, maybeNotifyAbaixoFck } from './rompimento';

// Importação em lote (manual) de resultados de rompimento. Grava material_tests +
// fecha o CP, com rastreabilidade em lotes_importacao(+linhas) e external_key idempotente.
const db = supabase as unknown as { from: (t: string) => any };

export type ConcOption = { id: string; codigo: string | null; numero_relatorio: string | null; work_nome: string | null };
export async function listConcretagensComPendentes(tenantId?: string): Promise<ConcOption[]> {
  let q = db.from('corpos_prova')
    .select('concretagem_id, concretagens(id, codigo, numero_relatorio, client_works(nome))')
    .eq('situacao', 'pendente').is('deleted_at', null);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const seen = new Map<string, ConcOption>();
  for (const r of (data ?? []) as Record<string, any>[]) {
    const c = r.concretagens; if (!c || seen.has(c.id)) continue;
    seen.set(c.id, { id: String(c.id), codigo: c.codigo ?? null, numero_relatorio: c.numero_relatorio ?? null, work_nome: c.client_works?.nome ?? null });
  }
  return [...seen.values()];
}

export type PendenteCP = { id: string; codigo: string | null; amostra_id: string | null; idade_dias: number | null; idade_unidade: string; material_test_type_id: string | null; concretagem_id: string | null; fck: number | null; concretagem_codigo: string | null };
export async function getPendentes(concId: string): Promise<PendenteCP[]> {
  const { data, error } = await db.from('corpos_prova')
    .select('id, codigo, amostra_id, idade_dias, idade_unidade, material_test_type_id, concretagem_id, concretagens(codigo, fck_previsto)')
    .eq('concretagem_id', concId).eq('situacao', 'pendente').is('deleted_at', null).order('idade_dias', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ id: String(r.id), codigo: r.codigo, amostra_id: r.amostra_id ?? null, idade_dias: r.idade_dias, idade_unidade: r.idade_unidade, material_test_type_id: r.material_test_type_id, concretagem_id: r.concretagem_id, fck: r.concretagens?.fck_previsto ?? null, concretagem_codigo: r.concretagens?.codigo ?? null }));
}

function trackLinhaFalha(e: unknown, origem: 'manual' | 'ocr', linhaNumero: number, l: { cp: PendenteCP }, extra?: Record<string, unknown>) {
  const reason = e instanceof Error ? e.message : String(e);
  const metadata = {
    action: 'rompimento.importacao_linha',
    origem,
    linha_numero: linhaNumero,
    corpo_prova_id: l.cp.id,
    concretagem_id: l.cp.concretagem_id,
    numeracao: l.cp.codigo,
    idade_dias: l.cp.idade_dias,
    reason,
    ...extra,
  };
  captureException(e, { category: 'domain', metadata });
  trackDomainEvent('rompimento.importacao_linha_falhou', metadata);
}

export type LinhaInput = { cp: PendenteCP; carga_ruptura_kn: number; cp_diametro_mm: number; cp_altura_mm: number; tipo_ruptura?: string; data_rompimento: string };
export async function importarLote(tenantId: string, linhas: LinhaInput[]): Promise<number> {
  if (!linhas.length) return 0;
  const { data: lote, error: le } = await db.from('lotes_importacao').insert({ tenant_id: tenantId, origem: 'manual', linhas_extraidas: linhas.length }).select('id').single();
  if (le) {
    captureException(new Error(le.message), { category: 'domain', metadata: { action: 'rompimento.importacao_lote_criar', origem: 'manual', tenant_id: tenantId, linhas: linhas.length } });
    throw new Error(le.message);
  }
  const loteId = lote.id as string;
  let n = 0;
  for (let i = 0; i < linhas.length; i += 1) {
    const l = linhas[i];
    try {
      const mpa = calcMPa(l.carga_ruptura_kn, l.cp_diametro_mm, l.cp_altura_mm);
      const { data: mt, error: e1 } = await db.from('material_tests').insert({
        tenant_id: tenantId, corpo_prova_id: l.cp.id, concretagem_id: l.cp.concretagem_id, material_test_type_id: l.cp.material_test_type_id,
        idade_dias: l.cp.idade_dias, idade_unidade: l.cp.idade_unidade, data_rompimento: l.data_rompimento,
        carga_ruptura_kn: l.carga_ruptura_kn, cp_diametro_mm: l.cp_diametro_mm, cp_altura_mm: l.cp_altura_mm,
        resultado_valor: mpa, unidade_resultado: 'MPa', fck_referencia_mpa: l.cp.fck, tipo_ruptura: l.tipo_ruptura ?? null, origem: 'importacao',
      }).select('id').single();
      if (e1) throw new Error(e1.message);
      const { error: ue } = await db.from('corpos_prova').update({ situacao: 'rompido', data_real_rompimento: l.data_rompimento }).eq('id', l.cp.id);
      if (ue) throw new Error(ue.message);
      await maybeNotifyAbaixoFck(tenantId, { id: l.cp.id, amostra_id: l.cp.amostra_id, idade_dias: l.cp.idade_dias, idade_unidade: l.cp.idade_unidade, codigo: l.cp.codigo }, l.cp.fck);
      const { error: lie } = await db.from('lotes_importacao_linhas').insert({ tenant_id: tenantId, lote_id: loteId, linha_numero: i + 1, dados_extraidos: { cp: l.cp.codigo, carga_kn: l.carga_ruptura_kn, mpa }, resultado_id: mt.id, external_key: 'manual:' + (l.cp.concretagem_codigo ?? l.cp.concretagem_id) + ':' + (l.cp.codigo ?? l.cp.id) });
      if (lie) throw new Error(lie.message);
      n += 1;
    } catch (e) {
      trackLinhaFalha(e, 'manual', i + 1, l, { lote_id: loteId, carga_ruptura_kn: l.carga_ruptura_kn });
    }
  }
  await db.from('lotes_importacao').update({ confirmed_at: new Date().toISOString(), linhas_extraidas: n }).eq('id', loteId);
  trackDomainEvent('importacao.confirmada', { origem: 'manual', linhas: n, falhas: linhas.length - n, lote_id: loteId });
  return n;
}

// --- OCR (extract-laudo-vision): le imagens de folhas de resultado e importa MPa direto ---

export type OcrResultado = { nf?: string; idade?: number; idade_unidade?: string; mpa?: number; data_rompimento?: string };

type OcrVisionResponse = { enabled?: boolean; resultados?: OcrResultado[]; reason?: string };

export async function extrairOcr(imgs: { base64: string; mime: string }[]): Promise<{ enabled: boolean; resultados: OcrResultado[]; reason?: string }> {
  const paginas = imgs.slice(0, 4).map((i) => ({ image_base64: i.base64, mime: i.mime }));
  try {
    const { data: j } = await invokeEdgeFunction<OcrVisionResponse>('extract-laudo-vision', { paginas }, {
      action: 'ocr.laudo_resultados',
      ids: { paginas: paginas.length },
      metadata: { mime_types: paginas.map((p) => p.mime) },
    });
    return { enabled: j?.enabled !== false, resultados: Array.isArray(j?.resultados) ? j.resultados : [], reason: j?.reason ? String(j.reason) : undefined };
  } catch (e) {
    captureException(e, { category: 'domain', metadata: { action: 'ocr.laudo_resultados', paginas: paginas.length } });
    throw e;
  }
}

export async function importarResultadosDiretos(tenantId: string, linhas: { cp: PendenteCP; mpa: number; data_rompimento: string }[]): Promise<number> {
  if (!linhas.length) return 0;
  const { data: lote, error: le } = await db.from('lotes_importacao').insert({ tenant_id: tenantId, origem: 'ocr', linhas_extraidas: linhas.length }).select('id').single();
  if (le) {
    captureException(new Error(le.message), { category: 'domain', metadata: { action: 'rompimento.importacao_lote_criar', origem: 'ocr', tenant_id: tenantId, linhas: linhas.length } });
    throw new Error(le.message);
  }
  const loteId = lote.id as string;
  let n = 0;
  for (let i = 0; i < linhas.length; i += 1) {
    const l = linhas[i];
    try {
      const { data: mt, error: e1 } = await db.from('material_tests').insert({
        tenant_id: tenantId, corpo_prova_id: l.cp.id, concretagem_id: l.cp.concretagem_id, material_test_type_id: l.cp.material_test_type_id,
        idade_dias: l.cp.idade_dias, idade_unidade: l.cp.idade_unidade, data_rompimento: l.data_rompimento,
        resultado_valor: l.mpa, unidade_resultado: 'MPa', fck_referencia_mpa: l.cp.fck, origem: 'ocr',
      }).select('id').single();
      if (e1) throw new Error(e1.message);
      const { error: ue } = await db.from('corpos_prova').update({ situacao: 'rompido', data_real_rompimento: l.data_rompimento }).eq('id', l.cp.id);
      if (ue) throw new Error(ue.message);
      await maybeNotifyAbaixoFck(tenantId, { id: l.cp.id, amostra_id: l.cp.amostra_id, idade_dias: l.cp.idade_dias, idade_unidade: l.cp.idade_unidade, codigo: l.cp.codigo }, l.cp.fck);
      const { error: lie } = await db.from('lotes_importacao_linhas').insert({ tenant_id: tenantId, lote_id: loteId, linha_numero: i + 1, dados_extraidos: { cp: l.cp.codigo, mpa: l.mpa, origem: 'ocr' }, resultado_id: mt.id, external_key: 'ocr:' + (l.cp.concretagem_codigo ?? l.cp.concretagem_id) + ':' + (l.cp.codigo ?? l.cp.id) });
      if (lie) throw new Error(lie.message);
      n += 1;
    } catch (e) {
      trackLinhaFalha(e, 'ocr', i + 1, l, { lote_id: loteId, mpa: l.mpa });
    }
  }
  await db.from('lotes_importacao').update({ confirmed_at: new Date().toISOString(), linhas_extraidas: n }).eq('id', loteId);
  trackDomainEvent('importacao.confirmada', { origem: 'ocr', linhas: n, falhas: linhas.length - n, lote_id: loteId });
  return n;
}
