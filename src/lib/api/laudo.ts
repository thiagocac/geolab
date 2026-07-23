import { supabase } from '../supabase';
import { captureException, trackDomainEvent } from '../telemetry';
import { invokeEdgeFunction } from '../telemetry/edge';
import { env } from '../env';
import { flowLabel } from './workflows';

// Camada de laudos. Emissão/persistencia ficam na EF generate-laudo-ensaio-pdf
// (grava lab_reports status 'rascunho' + laudo_resultados). Aprovação 1-etapa via
// RPCs gated (aprovar_laudo/reabrir_laudo, migration 020). Bucket lab-reports e privado.
const db = supabase as unknown as { from: (t: string) => any };
const rpc = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type LaudoRow = {
  id: string; numero: string; status: string; revisao: number;
  data_emissao: string | null; storage_path: string | null; concretagem_id: string | null;
  work_id: string | null; client_works?: { nome: string } | null;
  assinatura_status?: string | null;
};

export async function listLaudos(tenantId?: string): Promise<LaudoRow[]> {
  let q = db.from('lab_reports')
    .select('id, numero, status, revisao, data_emissao, storage_path, concretagem_id, work_id, assinatura_status, client_works(nome)')
    .is('deleted_at', null);
  if (tenantId) q = q.eq('tenant_id', tenantId); // filtro explícito ativa o índice por tenant; RLS segue garantindo o isolamento
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LaudoRow[];
}
// Listagem paginada + busca server-side (tela Laudos): busca livre no Nº do laudo; obra via filtro .eq.
export async function listLaudosPaged(opts: { tenantId?: string; workId?: string; search?: string; status?: '' | 'pendente' | 'emitido'; page?: number; pageSize?: number }): Promise<{ rows: LaudoRow[]; total: number }> {
  const pageSize = opts.pageSize ?? 25;
  const page = Math.max(0, opts.page ?? 0);
  let q = db.from('lab_reports')
    .select('id, numero, status, revisao, data_emissao, storage_path, concretagem_id, work_id, assinatura_status, client_works(nome)', { count: 'exact' })
    .is('deleted_at', null);
  if (opts.tenantId) q = q.eq('tenant_id', opts.tenantId);
  if (opts.workId) q = q.eq('work_id', opts.workId);
  if (opts.status === 'emitido') q = q.eq('status', 'emitido');
  else if (opts.status === 'pendente') q = q.neq('status', 'emitido');
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

export type ExemplarControle = { nf: string; exemplar: number; fck: number; nao_conforme: boolean };
export type ConformidadeControle = { concretagem_id: string; idade_controle: number; fck: number | null; tem_controle: boolean; algum_nao_conforme: boolean; n_exemplares: number; n_nao_conforme: number; exemplares: ExemplarControle[] };
// Conformidade na idade de controle (para alertar antes de emitir): exemplar (maior do par) < fck.
export async function conformidadeControle(ids: string[]): Promise<Record<string, ConformidadeControle>> {
  if (!ids.length) return {};
  const { data, error } = await rpc.rpc('laudo_conformidade_controle', { p_concretagem_ids: ids });
  if (error) throw new Error(error.message);
  const m: Record<string, ConformidadeControle> = {};
  for (const r of ((data ?? []) as ConformidadeControle[])) m[r.concretagem_id] = r;
  return m;
}

export async function gerarLaudo(concId: string, persist = true): Promise<{ blob: Blob; labReportId: string }> {
  try {
    const { data: blob, response } = await invokeEdgeFunction<Blob>('generate-laudo-ensaio-pdf', { concretagem_id: concId, persist }, {
      responseType: 'blob',
      action: 'relatorio.pdf:generate-laudo-ensaio-pdf',
      ids: { concretagem_id: concId },
      failureEvent: 'relatorio.pdf_falhou',
    });
    let labReportId = response.headers.get('x-lab-report-id') ?? '';
    const persistWarning = response.headers.get('x-persist-warning') ?? '';
    if (persistWarning) {
      captureException(new Error(persistWarning), { category: 'edge_function', severity: 'warn', metadata: { action: 'laudo.gerar.persistencia', concretagem_id: concId, warning: persistWarning } });
      trackDomainEvent('relatorio.pdf_falhou', { concretagem_id: concId, action: 'laudo.gerar.persistencia', reason: persistWarning });
    }
    if (persist && !labReportId) {
      // Fallback: o header x-lab-report-id pode nao estar exposto via CORS no browser.
      // Sem ele, busca o laudo recem-persistido da concretagem para disparar o laudo_pronto.
      const { data } = await db.from('lab_reports').select('id').eq('concretagem_id', concId).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
      labReportId = data?.id ? String(data.id) : '';
    }
    if (persist) trackDomainEvent('laudo.gerado', { concretagem_id: concId });
    return { blob, labReportId };
  } catch (e) {
    captureException(e, { category: 'domain', metadata: { action: 'laudo.gerar', concretagem_id: concId, persist } });
    trackDomainEvent('laudo.gerar_falhou', { concretagem_id: concId, persist, reason: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

export async function downloadUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('lab-reports').createSignedUrl(path, 120);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// Prioriza o PDF assinado (modo a1_local grava <path>-signed.pdf) quando houver assinatura vigente.
export async function baixarLaudoUrl(labReportId: string, fallbackPath: string | null): Promise<string> {
  const { data } = await db.from('laudo_assinaturas')
    .select('signed_storage_path')
    .eq('lab_report_id', labReportId).eq('status', 'assinado').not('signed_storage_path', 'is', null)
    .order('revisao', { ascending: false }).limit(1).maybeSingle();
  const path = (data?.signed_storage_path as string | undefined) || fallbackPath;
  if (!path) throw new Error('Laudo ainda nao persistido.');
  return downloadUrl(path);
}

// [W3] Gate de emissão (mig wf05): detecta resultado insatisfatório/inconsistente,
// INICIA o workflow de liberação (notifica os aprovadores) e informa os bloqueios.
export type LaudoEmissaoBloqueio = { flow_key: string; status: string; iniciado?: boolean };
export async function laudoEmissaoGate(id: string): Promise<{ liberado: boolean; bloqueios: LaudoEmissaoBloqueio[] }> {
  const { data, error } = await rpc.rpc('laudo_emissao_gate', { p_lab_report_id: id });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  return { liberado: r.liberado === true, bloqueios: Array.isArray(r.bloqueios) ? (r.bloqueios as LaudoEmissaoBloqueio[]) : [] };
}

export async function aprovarLaudo(id: string): Promise<void> {
  try {
    // [W3] gate primeiro: se bloqueado, o fluxo de aprovação já fica iniciado e o erro orienta o usuário
    const gate = await laudoEmissaoGate(id);
    if (!gate.liberado) {
      trackDomainEvent('laudo.emissao_bloqueada', { lab_report_id: id, fluxos: gate.bloqueios.map((b) => b.flow_key).join(',') });
      const labels = gate.bloqueios.map((b) => flowLabel(b.flow_key) + ' (' + (b.status === 'pendente' ? (b.iniciado ? 'fluxo iniciado — aguardando aprovação' : 'aguardando aprovação') : b.status) + ')').join('; ');
      throw new Error('Emissão bloqueada por workflow de aprovação: ' + labels + '. Acompanhe e decida em Aprovações.');
    }
    const { error } = await rpc.rpc('aprovar_laudo', { p_lab_report_id: id });
    if (error) throw new Error(error.message);
    trackDomainEvent('laudo.aprovado', { lab_report_id: id });
  } catch (e) {
    captureException(e, { category: 'domain', metadata: { action: 'laudo.aprovar', lab_report_id: id } });
    throw e;
  }
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
  try {
    const { data: out } = await invokeEdgeFunction<{ ok?: boolean; sent?: boolean; reason?: string; to?: string; error?: string }>('enviar-laudo-cliente', { lab_report_id: labReportId }, {
      action: 'laudo.enviar_cliente',
      ids: { lab_report_id: labReportId },
      failureEvent: 'laudo.enviar_falhou',
    });
    if (out.ok === false) throw new Error(out.error ?? 'Falha ao enviar laudo ao cliente.');
    if (out.sent === true) trackDomainEvent('laudo.enviado_cliente', { lab_report_id: labReportId });
    return { sent: out.sent === true, reason: out.reason, to: out.to };
  } catch (e) {
    captureException(e, { category: 'domain', metadata: { action: 'laudo.enviar_cliente', lab_report_id: labReportId } });
    trackDomainEvent('laudo.enviar_falhou', { lab_report_id: labReportId, reason: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}


// Aplica a assinatura configurada (lab_signature_settings.modo) ao laudo emitido (EF sign-laudo-pdf).
export async function assinarLaudo(labReportId: string): Promise<{ status: string; modo: string }> {
  try {
    const { data: out } = await invokeEdgeFunction<{ status?: string; modo?: string; error?: string }>('sign-laudo-pdf', { lab_report_id: labReportId }, {
      action: 'laudo.assinar',
      ids: { lab_report_id: labReportId },
      failureEvent: 'laudo.assinar_falhou',
    });
    return { status: String(out.status ?? ''), modo: String(out.modo ?? '') };
  } catch (e) {
    captureException(e, { category: 'domain', metadata: { action: 'laudo.assinar', lab_report_id: labReportId } });
    trackDomainEvent('laudo.assinar_falhou', { lab_report_id: labReportId, reason: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

// Classificacao Parcial/Final dos laudos do tenant (badge + auto-envio ao emitir Final). RPC laudos_parcial_final (064).
export async function listLaudosClassificacao(): Promise<Record<string, string>> {
  const { data, error } = await rpc.rpc('laudos_parcial_final');
  if (error) throw new Error(error.message);
  const m: Record<string, string> = {};
  for (const r of (data ?? []) as Record<string, unknown>[]) m[String(r.id)] = String(r.parcial_final ?? 'sem_resultados');
  return m;
}

