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

export async function listLaudos(tenantId?: string): Promise<LaudoRow[]> {
  let q = db.from('lab_reports')
    .select('id, numero, status, revisao, data_emissao, storage_path, concretagem_id, work_id, client_works(nome)')
    .is('deleted_at', null);
  if (tenantId) q = q.eq('tenant_id', tenantId); // filtro explícito ativa o índice por tenant; RLS segue garantindo o isolamento
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LaudoRow[];
}
// Listagem paginada + busca server-side (tela Laudos): busca livre no Nº do laudo; obra via filtro .eq.
export async function listLaudosPaged(opts: { tenantId?: string; workId?: string; search?: string; page?: number; pageSize?: number }): Promise<{ rows: LaudoRow[]; total: number }> {
  const pageSize = opts.pageSize ?? 25;
  const page = Math.max(0, opts.page ?? 0);
  let q = db.from('lab_reports')
    .select('id, numero, status, revisao, data_emissao, storage_path, concretagem_id, work_id, client_works(nome)', { count: 'exact' })
    .is('deleted_at', null);
  if (opts.tenantId) q = q.eq('tenant_id', opts.tenantId);
  if (opts.workId) q = q.eq('work_id', opts.workId);
  const term = (opts.search ?? '').replace(/[%]/g, ' ').trim();
  if (term) q = q.ilike('numero', `%${term}%`);
  const { data, error, count } = await q.order('created_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as LaudoRow[], total: count ?? (data ?? []).length };
}

export type ConcretagemElegivel = { id: string; codigo: string | null; work_nome: string | null };

export async function listConcretagensComResultado(tenantId?: string): Promise<ConcretagemElegivel[]> {
  let q = db.from('material_tests')
    .select('concretagem_id, concretagens(id, codigo, client_works(nome))')
    .not('resultado_valor', 'is', null).is('deleted_at', null);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const seen = new Map<string, ConcretagemElegivel>();
  for (const r of (data ?? []) as Record<string, any>[]) {
    const c = r.concretagens; if (!c || seen.has(c.id)) continue;
    seen.set(c.id, { id: String(c.id), codigo: c.codigo ?? null, work_nome: c.client_works?.nome ?? null });
  }
  return [...seen.values()];
}

export async function gerarLaudo(concId: string, persist = true): Promise<{ blob: Blob; labReportId: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-laudo-ensaio-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ concretagem_id: concId, persist }),
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(t || ('Erro ' + resp.status)); }
  const blob = await resp.blob();
  let labReportId = resp.headers.get('x-lab-report-id') ?? '';
  if (persist && !labReportId) {
    // Fallback: o header x-lab-report-id pode nao estar exposto via CORS no browser.
    // Sem ele, busca o laudo recem-persistido da concretagem para disparar o laudo_pronto.
    const { data } = await db.from('lab_reports').select('id').eq('concretagem_id', concId).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    labReportId = data?.id ? String(data.id) : '';
  }
  return { blob, labReportId };
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

// Dispara o evento laudo_pronto (notify-event resolve gestor/RT + admin e faz fan-out
// para send-notification). Best-effort: a notificacao nunca derruba a geracao do laudo.
export async function notifyLaudoPronto(tenantId: string, labReportId: string, reference?: string): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  await fetch(env.supabaseUrl + '/functions/v1/notify-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ tenant_id: tenantId, event_type: 'laudo_pronto', entity_type: 'lab_report', entity_id: labReportId, reference: reference ?? '', deep_link: '/laudos' }),
  });
}


// ---- Aprovação por magic link (melhoria 3.2) ----
// Gera o link (staff, is_tenant_writer) para enviar ao RT/aprovador. Token cru só trafega aqui; o banco guarda hash.
export async function criarLinkAprovacao(labReportId: string, dias = 14): Promise<string> {
  const { data, error } = await rpc.rpc('criar_magic_link', { p_purpose: 'aprovacao_laudo', p_entity_table: 'lab_reports', p_entity_id: labReportId, p_dias: dias });
  if (error) throw new Error(error.message);
  const token = String(data ?? '');
  if (!token) throw new Error('Falha ao gerar o link.');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lab.consultegeo.org';
  return origin + '/laudo/aprovar/' + token;
}
// Consome o link na página pública (sem login) via EF approve-laudo-link (verify_jwt=false).
export async function decidirLaudoLink(token: string, decision: 'aprovar' | 'devolver' | 'reprovar', comment?: string): Promise<{ ok: boolean; numero?: string; status?: string; error?: string }> {
  const resp = await fetch(env.supabaseUrl + '/functions/v1/approve-laudo-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey },
    body: JSON.stringify({ token, decision, comment: comment ?? '' }),
  });
  const out = (await resp.json().catch(() => ({}))) as { ok?: boolean; numero?: string; status?: string; error?: string };
  if (!resp.ok || out.ok === false) return { ok: false, error: out.error ?? ('Erro ' + resp.status) };
  return { ok: true, numero: out.numero, status: out.status };
}

// Envia o laudo emitido ao contato do cliente (EF enviar-laudo-cliente). sent=false quando dry-run/desabilitado/sem config.
export async function enviarLaudoCliente(labReportId: string): Promise<{ sent: boolean; reason?: string; to?: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/enviar-laudo-cliente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ lab_report_id: labReportId }),
  });
  const out = (await resp.json().catch(() => ({}))) as { ok?: boolean; sent?: boolean; reason?: string; to?: string; error?: string };
  if (!resp.ok || out.ok === false) throw new Error(out.error ?? ('Erro ' + resp.status));
  return { sent: out.sent === true, reason: out.reason, to: out.to };
}


// Classificacao Parcial/Final dos laudos do tenant (badge + auto-envio ao emitir Final). RPC laudos_parcial_final (064).
export async function listLaudosClassificacao(): Promise<Record<string, string>> {
  const { data, error } = await rpc.rpc('laudos_parcial_final');
  if (error) throw new Error(error.message);
  const m: Record<string, string> = {};
  for (const r of (data ?? []) as Record<string, unknown>[]) m[String(r.id)] = String(r.parcial_final ?? 'sem_resultados');
  return m;
}

