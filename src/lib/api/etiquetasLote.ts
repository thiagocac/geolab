import { supabase } from '../supabase';
import { trackDomainEvent } from '../telemetry';
import { env } from '../env';

// Etiquetas de CP PRÉ-NUMERADAS por LOTE (faixa contígua NNNNNN/AA por ano — migration 140).
// Avulsa = grande sequência sem vínculo; concretagem = previstos + folga de caminhões.
// Distinto de etiquetas.ts (numerarCps/atribuir_numeracao_cp_lote), que numera CPs já moldados.
const db = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (t: string) => any;
};

export type GerarEtiquetasResult = { ok?: boolean; error?: string; id?: string; ano?: number; yy?: string; seq_inicial?: number; seq_final?: number; total?: number; codigo_inicial?: string; codigo_final?: string };

export type GerarEtiquetasParams = { quantidade: number; extra?: number; concretagemId?: string | null; observacao?: string | null; caminhoesPrevistos?: number | null; caminhoesExtra?: number | null; cpsPorCaminhao?: number | null };

export async function gerarEtiquetas(p: GerarEtiquetasParams): Promise<GerarEtiquetasResult> {
  const { data, error } = await db.rpc('gerar_etiquetas', {
    p_quantidade: Math.max(0, Math.round(p.quantidade || 0)),
    p_extra: Math.max(0, Math.round(p.extra || 0)),
    p_concretagem_id: p.concretagemId ?? null,
    p_observacao: p.observacao ?? null,
    p_caminhoes_previstos: p.caminhoesPrevistos ?? null,
    p_caminhoes_extra: p.caminhoesExtra ?? null,
    p_cps_por_caminhao: p.cpsPorCaminhao ?? null,
  });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as GerarEtiquetasResult;
  if (r.ok === false) throw new Error(r.error || 'Falha ao gerar etiquetas');
  trackDomainEvent('etiqueta.lote_gerado', { total: Math.max(0, Math.round(p.quantidade || 0)) + Math.max(0, Math.round(p.extra || 0)), por_concretagem: !!p.concretagemId });
  return r;
}

export type EtiquetaLote = { id: string; origem: 'avulsa' | 'concretagem'; ano: number; seq_inicial: number; seq_final: number; total: number; status: string; observacao: string | null; created_at: string; concretagem_id: string | null; conc_codigo: string | null; conc_rel: string | null; obra: string | null };

export async function listEtiquetaLotes(): Promise<EtiquetaLote[]> {
  const { data, error } = await db.from('etiqueta_lotes')
    .select('id, origem, ano, seq_inicial, seq_final, total, status, observacao, created_at, concretagem_id, concretagens(codigo, numero_relatorio, client_works(nome))')
    .is('deleted_at', null).order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => {
    const c = r.concretagens as Record<string, any> | null;
    const w = c?.client_works as Record<string, any> | null;
    return {
      id: String(r.id), origem: r.origem === 'concretagem' ? 'concretagem' : 'avulsa', ano: Number(r.ano),
      seq_inicial: Number(r.seq_inicial), seq_final: Number(r.seq_final), total: Number(r.total),
      status: String(r.status ?? 'ativo'), observacao: r.observacao ?? null, created_at: String(r.created_at),
      concretagem_id: r.concretagem_id ?? null, conc_codigo: c?.codigo ?? null, conc_rel: c?.numero_relatorio ?? null, obra: w?.nome ?? null,
    };
  });
}

export function codigoEtiqueta(seq: number, ano: number): string {
  return String(seq).padStart(6, '0') + '/' + String(ano).slice(-2);
}

// PDF via EF generate-etiquetas-lote-pdf (espelha etiquetasCpPdfUrl): fetch autenticado -> blob URL.
export async function etiquetaLotePdfUrl(loteId: string, layout: 'rolo' | 'a4'): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-etiquetas-lote-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token }, body: JSON.stringify({ lote_id: loteId, layout }) });
  if (!resp.ok) { const tx = await resp.text(); throw new Error('Falha ao gerar etiquetas: ' + tx.slice(0, 160)); }
  return URL.createObjectURL(await resp.blob());
}

export async function cancelarEtiquetaLote(id: string): Promise<void> {
  const { error } = await db.rpc('cancelar_etiqueta_lote', { p_id: id });
  if (error) throw new Error(error.message);
}

// Picker de concretagens p/ o modo "por concretagem" + estimativa de caminhões/CPs para sugerir a quantidade.
export type ConcretagemEtiqueta = { id: string; codigo: string; rel: string | null; obra: string | null; data: string | null; caminhoesPrevistos: number; cpsPorCaminhao: number };

function somaCps(padrao: any[]): number {
  let s = 0;
  for (const it of padrao) { const q = Number(it?.quantidade ?? it?.quantidadeCp ?? it?.qtd ?? 0); if (Number.isFinite(q)) s += q; }
  return s;
}

export async function listConcretagensParaEtiqueta(): Promise<ConcretagemEtiqueta[]> {
  const { data, error } = await db.from('concretagens')
    .select('id, codigo, numero_relatorio, status, data_programada, data_real, volume_programado_m3, metadata, client_works(nome), operational_materials(padrao_moldagem)')
    .is('deleted_at', null).neq('status', 'cancelada').order('data_programada', { ascending: false, nullsFirst: false }).limit(120);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => {
    const w = r.client_works as Record<string, any> | null;
    const om = r.operational_materials as Record<string, any> | null;
    const md = (r.metadata && typeof r.metadata === 'object') ? r.metadata : {};
    const padrao = Array.isArray(md.padrao_moldagem) ? md.padrao_moldagem : (Array.isArray(om?.padrao_moldagem) ? om.padrao_moldagem : []);
    const cpc = somaCps(padrao);
    const vol = r.volume_programado_m3 == null ? null : Number(r.volume_programado_m3);
    const prevVol = vol != null && vol > 0 ? Math.ceil(vol / 8) : 0;
    return {
      id: String(r.id), codigo: String(r.codigo ?? r.id.slice(0, 6)), rel: r.numero_relatorio ?? null,
      obra: w?.nome ?? null, data: r.data_programada ?? r.data_real ?? null,
      caminhoesPrevistos: Math.max(prevVol, 1), cpsPorCaminhao: cpc > 0 ? cpc : 6,
    };
  });
}
