// Cadeia física do CP (Grupo A): check-in no laboratório, descarte pós-laudo e termo em PDF.
// RPCs das migs 201-204: receber_cps_lote / cps_descartaveis / descartar_cps_lote.
import { supabase } from '../supabase';
import { env } from '../env';

type Json = Record<string, unknown>;
const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> };
};
const text = (v: unknown) => String(v ?? '');
const nullable = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const num = (v: unknown) => Number(v) || 0;

export type CpAReceber = {
  id: string; codigo: string | null; numeracao_lab: string | null; situacao: string; data_moldagem: string | null;
  localizacao: string | null; concretagem_id: string; concretagem_codigo: string | null; obra: string | null;
};
export async function listCpsAReceber(): Promise<CpAReceber[]> {
  const { data, error } = await db.from('corpos_prova')
    .select('id, codigo, numeracao_lab, situacao, data_moldagem, localizacao, concretagem_id, concretagens(codigo, client_works(nome))')
    .is('data_recebimento_lab', null).eq('situacao', 'pendente').is('deleted_at', null)
    .order('data_moldagem', { ascending: true }).limit(600);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Json[]).map((r) => {
    const conc = (r.concretagens ?? {}) as Json;
    const work = (conc.client_works ?? {}) as Json;
    return {
      id: text(r.id), codigo: nullable(r.codigo), numeracao_lab: nullable(r.numeracao_lab), situacao: text(r.situacao),
      data_moldagem: nullable(r.data_moldagem), localizacao: nullable(r.localizacao), concretagem_id: text(r.concretagem_id),
      concretagem_codigo: nullable(conc.codigo), obra: nullable(work.nome),
    };
  });
}

export type ReceberItem = { cp_id: string; resultado: 'ok' | 'quebrado' | 'faltante'; localizacao?: string; motivo?: string; data_receb?: string };
export async function receberCpsLote(tenantId: string, memberId: string, items: ReceberItem[]): Promise<{ recebidos: number; divergencias: number }> {
  const { data, error } = await db.rpc('receber_cps_lote', { p_tenant: tenantId, p_items: items, p_recebido_por: memberId });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Json;
  if (r.ok !== true) throw new Error(text(r.error) || 'Falha no recebimento.');
  return { recebidos: num(r.recebidos), divergencias: num(r.divergencias) };
}

export type CpDescartavel = { cp_id: string; codigo: string | null; numeracao_lab: string | null; situacao: string; localizacao: string | null; data_laudo: string | null; dias_desde_laudo: number };
export async function listCpsDescartaveis(tenantId: string): Promise<CpDescartavel[]> {
  const { data, error } = await db.rpc('cps_descartaveis', { p_tenant: tenantId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Json[]).map((r) => ({
    cp_id: text(r.cp_id), codigo: nullable(r.codigo), numeracao_lab: nullable(r.numeracao_lab), situacao: text(r.situacao),
    localizacao: nullable(r.localizacao), data_laudo: nullable(r.data_laudo), dias_desde_laudo: num(r.dias_desde_laudo),
  }));
}

export async function descartarCpsLote(tenantId: string, memberId: string, cpIds: string[], motivo: string): Promise<{ loteId: string; descartados: number }> {
  const { data, error } = await db.rpc('descartar_cps_lote', { p_tenant: tenantId, p_cp_ids: cpIds, p_motivo: motivo || null, p_responsavel: memberId });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Json;
  if (r.ok !== true) throw new Error(text(r.error) || 'Falha no descarte.');
  return { loteId: text(r.lote_id), descartados: num(r.descartados) };
}

export type DescarteLote = { id: string; numero: string | null; data_descarte: string | null; motivo: string | null; total_cps: number; created_at: string };
export async function listDescarteLotes(): Promise<DescarteLote[]> {
  const { data, error } = await db.from('cp_descarte_lotes')
    .select('id, numero, data_descarte, motivo, total_cps, created_at')
    .is('deleted_at', null).order('created_at', { ascending: false }).limit(30);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Json[]).map((r) => ({
    id: text(r.id), numero: nullable(r.numero), data_descarte: nullable(r.data_descarte), motivo: nullable(r.motivo),
    total_cps: num(r.total_cps), created_at: text(r.created_at),
  }));
}

// PDF via EF generate-cp-descarte-pdf (padrão etiquetaLotePdfUrl): fetch autenticado → Blob.
export async function termoDescartePdf(loteId: string): Promise<Blob> {
  const { data: sess } = await db.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-cp-descarte-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ lote_id: loteId }),
  });
  if (!resp.ok) { const tx = await resp.text(); throw new Error('Falha ao gerar termo: ' + tx.slice(0, 160)); }
  return resp.blob();
}
