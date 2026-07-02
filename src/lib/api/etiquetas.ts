import { supabase } from '../supabase';
import { env } from '../env';

// Etiquetas de CP com QR (rolo 60x40 termica / A4 21 por folha Avery L7160-Pimaco A4260).
// Backend: RPC atribuir_numeracao_cp_lote (migrations 128/129, sequencia lab+ano NNNN/AA,
// advisory lock, idempotente) + EF generate-etiquetas-cp-pdf (verify_jwt).
const db = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (t: string) => any;
};

export type NumeracaoLote = { ok?: boolean; error?: string; atribuidos?: number; ja_numerados?: number; primeiro?: string | null; ultimo?: string | null; ano?: string };

// Atribui numeracao_lab sequencial (lab+ano, NNNN/AA) aos CPs da concretagem que ainda nao tem.
// Idempotente: reimprimir etiquetas nunca renumera.
export async function numerarCps(concretagemId: string): Promise<NumeracaoLote> {
  const { data, error } = await db.rpc('atribuir_numeracao_cp_lote', { p_concretagem_id: concretagemId });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as NumeracaoLote;
  if (r.ok === false) throw new Error(r.error || 'Falha ao numerar CPs');
  return r;
}

// Etiquetas em PDF via EF generate-etiquetas-cp-pdf. Espelha racPdfUrl (nc.ts):
// fetch autenticado -> blob URL (aberto com openDeferredTab no chamador).
// layout: 'rolo' (60x40mm, 1/pagina — termica) | 'a4' (21/folha 63,5x38,1).
// cpIds opcional = reimpressao parcial.
export async function etiquetasCpPdfUrl(concretagemId: string, layout: 'rolo' | 'a4', cpIds?: string[]): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const body: Record<string, unknown> = { concretagem_id: concretagemId, layout };
  if (cpIds?.length) body.cp_ids = cpIds;
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-etiquetas-cp-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  if (!resp.ok) { const tx = await resp.text(); throw new Error('Falha ao gerar etiquetas: ' + tx.slice(0, 160)); }
  return URL.createObjectURL(await resp.blob());
}

// Fase 2 do QR: localizar um CP bipado ("CP:<uuid>", leitor USB age como teclado) para a
// tela de Rompimentos focar o campo de carga. RLS escopa por tenant (outro lab -> null).
export type CpQr = { id: string; codigo: string | null; numeracao_lab: string | null; situacao: string | null; lancado: boolean };
export async function cpPorQr(cpId: string): Promise<CpQr | null> {
  const { data, error } = await db.from('corpos_prova')
    .select('id, codigo, numeracao_lab, situacao, material_tests(resultado_valor)')
    .eq('id', cpId).is('deleted_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const arr = Array.isArray(data.material_tests) ? (data.material_tests as Record<string, unknown>[]) : [];
  return {
    id: String(data.id), codigo: data.codigo ?? null, numeracao_lab: data.numeracao_lab ?? null,
    situacao: data.situacao ?? null, lancado: arr.some((t) => t.resultado_valor != null),
  };
}
