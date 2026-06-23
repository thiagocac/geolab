import { supabase } from '../supabase';
import { env } from '../env';

// Camada de laudos. Emissao/persistencia ficam na EF generate-laudo-ensaio-pdf
// (grava lab_reports status 'rascunho' + laudo_resultados). Aprovacao 1-etapa via
// RPCs gated (aprovar_laudo/reabrir_laudo, migration 020). Bucket lab-reports e privado.
const db = supabase as unknown as { from: (t: string) => any };
const rpc = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type LaudoRow = {
  id: string; numero: string; status: string; revisao: number;
  data_emissao: string | null; storage_path: string | null; concretagem_id: string | null;
  work_id: string | null; client_works?: { nome: string } | null;
};

export async function listLaudos(): Promise<LaudoRow[]> {
  const { data, error } = await db.from('lab_reports')
    .select('id, numero, status, revisao, data_emissao, storage_path, concretagem_id, work_id, client_works(nome)')
    .is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LaudoRow[];
}

export type ConcretagemElegivel = { id: string; codigo: string | null; work_nome: string | null };

export async function listConcretagensComResultado(): Promise<ConcretagemElegivel[]> {
  const { data, error } = await db.from('material_tests')
    .select('concretagem_id, concretagens(id, codigo, client_works(nome))')
    .not('resultado_valor', 'is', null).is('deleted_at', null);
  if (error) throw new Error(error.message);
  const seen = new Map<string, ConcretagemElegivel>();
  for (const r of (data ?? []) as Record<string, any>[]) {
    const c = r.concretagens; if (!c || seen.has(c.id)) continue;
    seen.set(c.id, { id: String(c.id), codigo: c.codigo ?? null, work_nome: c.client_works?.nome ?? null });
  }
  return [...seen.values()];
}

export async function gerarLaudo(concId: string): Promise<{ blob: Blob; labReportId: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-laudo-ensaio-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ concretagem_id: concId, persist: true }),
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(t || ('Erro ' + resp.status)); }
  return { blob: await resp.blob(), labReportId: resp.headers.get('x-lab-report-id') ?? '' };
}

export async function downloadUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('lab-reports').createSignedUrl(path, 120);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function aprovarLaudo(id: string): Promise<void> {
  const { error } = await rpc.rpc('aprovar_laudo', { p_lab_report_id: id });
  if (error) throw new Error(error.message);
}
export async function reabrirLaudo(id: string): Promise<void> {
  const { error } = await rpc.rpc('reabrir_laudo', { p_lab_report_id: id });
  if (error) throw new Error(error.message);
}
