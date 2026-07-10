import { supabase } from '../supabase';
import { captureException, trackDomainEvent } from '../telemetry';
import { invokeEdgeFunction } from '../telemetry/edge';
import type { Database } from '../database.types';
import { esperadoMpaPorIdade, normalizePadroes, padroesToDb, toNumber, type PadraoMoldagem } from '../concreto';
import { assertImagem, assertUploadSize } from '../upload';

const db = supabase;

type Rec = Record<string, unknown>;
export type PadraoItem = { idade?: number; idadeControle?: number | string; unidade?: string; unidadeIdade?: string; quantidade?: number; quantidadeCp?: number | string; valor_esperado?: number; valorEsperado?: number | string; tipoEnsaio?: string; tipo_ensaio?: string };
export type ConcretagemRow = {
  id: string; codigo: string | null; numero_relatorio: string | null; status: string; origem: string;
  data_programada: string | null; data_real: string | null; hora_programada?: string | null; hora_inicio?: string | null; hora_fim?: string | null;
  fornecedor_texto: string | null; fck_previsto: number | null; traco_texto?: string | null;
  dimensao_cp?: string | null; local_texto?: string | null; operational_material_id?: string | null;
  volume_programado_m3?: number | null; volume_lancado_m3?: number | null; bombeado?: boolean | null; clima?: string | null; temperatura_ambiente_c?: number | null; moldador_id?: string | null; laboratorista_id?: string | null; formas_previstas?: number | null; observacoes?: string | null;
  metadata?: Rec | null;
  client_id: string; work_id: string;
  lab_clients?: { razao_social: string; nome_fantasia?: string | null } | null;
  client_works?: { nome: string; cidade?: string | null; uf?: string | null } | null;
  operational_materials?: { nome: string; padrao_moldagem?: PadraoItem[]; fck_mpa?: number; slump_previsto_cm?: number | null; slump_tolerancia_cm?: number | null; validade_concreto_minutos?: number | null } | null;
  moldador?: { nome: string } | null;
  laboratorista?: { nome: string } | null;
};
export type CaminhaoRow = {
  id: string; serie: number | null; nota_fiscal: string; placa: string | null; motorista?: string | null; volume_m3: number | null;
  slump_medido_mm: number | null; temperatura_concreto_c: number | null; hora_saida_usina?: string | null; hora_chegada_obra?: string | null; hora_inicio_descarga?: string | null; hora_fim_descarga?: string | null; hora_moldagem?: string | null; houve_adicao_agua?: boolean | null; agua_litros?: number | null; rejeitado?: boolean | null; motivo_rejeicao?: string | null; elementos_concretados?: string | null; observacoes?: string | null;
};

const SEL = 'id, codigo, numero_relatorio, status, origem, data_programada, data_real, hora_programada, hora_inicio, hora_fim, fornecedor_texto, fck_previsto, traco_texto, dimensao_cp, local_texto, operational_material_id, volume_programado_m3, volume_lancado_m3, bombeado, clima, temperatura_ambiente_c, moldador_id, laboratorista_id, formas_previstas, observacoes, metadata, client_id, work_id, lab_clients(razao_social, nome_fantasia), client_works(nome, cidade, uf), operational_materials(nome, padrao_moldagem, fck_mpa, slump_previsto_cm, slump_tolerancia_cm, validade_concreto_minutos), moldador:colaboradores!moldador_id(nome), laboratorista:colaboradores!laboratorista_id(nome)';

export async function listConcretagens(workId?: string, tenantId?: string): Promise<ConcretagemRow[]> {
  let q = db.from('concretagens').select(SEL).is('deleted_at', null);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  if (workId) q = q.eq('work_id', workId);
  const { data, error } = await q.order('data_programada', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ConcretagemRow[];
}

export async function listProgramacoes(tenantId?: string): Promise<ConcretagemRow[]> {
  const rows = await listConcretagens(undefined, tenantId);
  return rows.filter((r) => r.origem === 'programada' || r.origem === 'portal_cliente' || r.status === 'pendente' || !(r.data_real));
}

// Listagem paginada + busca server-side (tela Concretagens). Busca livre nas colunas-base
// (numero_relatorio/codigo/fornecedor_texto); cliente/obra via filtros .eq escopados.
// listConcretagens/listProgramacoes seguem intactas (a programação usa a versão completa).
export async function listConcretagensPaged(opts: { tenantId?: string; clientId?: string; workId?: string; search?: string; page?: number; pageSize?: number }): Promise<{ rows: ConcretagemRow[]; total: number }> {
  const pageSize = opts.pageSize ?? 25;
  const page = Math.max(0, opts.page ?? 0);
  let q = db.from('concretagens').select(SEL, { count: 'exact' }).is('deleted_at', null);
  if (opts.tenantId) q = q.eq('tenant_id', opts.tenantId);
  if (opts.clientId) q = q.eq('client_id', opts.clientId);
  if (opts.workId) q = q.eq('work_id', opts.workId);
  const term = (opts.search ?? '').replace(/[,()*%]/g, ' ').trim();
  if (term) q = q.or(`numero_relatorio.ilike.*${term}*,codigo.ilike.*${term}*,fornecedor_texto.ilike.*${term}*`);
  const { data, error, count } = await q
    .order('data_programada', { ascending: false }).order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as ConcretagemRow[], total: count ?? (data ?? []).length };
}

export async function getConcretagem(id: string): Promise<ConcretagemRow | null> {
  const { data, error } = await db.from('concretagens').select(SEL).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ConcretagemRow | null;
}

export async function createConcretagem(tenantId: string, values: Record<string, unknown>): Promise<{ id: string }> {
  const status = String(values.status ?? 'rascunho');
  const origem = String(values.origem ?? 'programada');
  try {
    const { data, error } = await db.from('concretagens').insert({ ...values, tenant_id: tenantId, status, origem } as unknown as Database['public']['Tables']['concretagens']['Insert']).select('id').single();
    if (error) throw new Error(error.message);
    trackDomainEvent('concretagem.criada', { origem, status_inicial: status });
    return data as { id: string };
  } catch (e) {
    captureException(e, { category: 'domain', metadata: { action: 'concretagem.criar', tenant_id: tenantId, origem, status } });
    trackDomainEvent('concretagem.criar_falhou', { origem, status_inicial: status, reason: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

export async function updateConcretagem(id: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('concretagens').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function confirmarProgramacao(id: string): Promise<void> { await updateConcretagem(id, { status: 'registrado' }); trackDomainEvent('concretagem.confirmada', { concretagem_id: id }); }
export async function cancelarProgramacao(id: string): Promise<void> { await updateConcretagem(id, { status: 'cancelada' }); }

// Atribuição de equipe na programação: moldador (já existente) + laboratorista (FK migration 118).
export async function atribuirEquipe(id: string, moldadorId: string | null, laboratoristaId: string | null): Promise<void> {
  await updateConcretagem(id, { moldador_id: moldadorId || null, laboratorista_id: laboratoristaId || null });
}

// Provisionamento de formas: grava a quantidade prevista (formas_previstas) + o detalhe do cálculo em metadata.formas.
export type FormasDetalhe = { n_amostras: number; cps_por_amostra: number; capacidade_m3: number; volume_m3: number | null };
export async function provisionarFormas(id: string, formasPrevistas: number, detalhe: FormasDetalhe, metadataBase?: Rec | null, padraoMoldagem?: Rec[] | null): Promise<void> {
  const md = (metadataBase && typeof metadataBase === 'object') ? metadataBase : {};
  const meta: Rec = { ...md, formas: detalhe };
  // Traço não cadastrado: grava o padrão editado na concretagem (fonte da geração de CPs e da ficha).
  if (Array.isArray(padraoMoldagem) && padraoMoldagem.length) meta.padrao_moldagem = padraoMoldagem;
  await updateConcretagem(id, { formas_previstas: formasPrevistas, metadata: meta });
}

// Colaboradores p/ os seletores de equipe (id, nome, funções). Função alimenta os agrupamentos do modal.
export type EquipeColab = { id: string; nome: string; funcoes: string[] };
export async function listEquipeColaboradores(): Promise<EquipeColab[]> {
  const { data, error } = await db.from('colaboradores').select('id, nome, funcoes').is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ id: String(r.id), nome: String(r.nome ?? r.id), funcoes: Array.isArray(r.funcoes) ? r.funcoes.map(String) : [] }));
}

const SEL_CAM = 'id, serie, nota_fiscal, placa, motorista, volume_m3, slump_medido_mm, temperatura_concreto_c, hora_saida_usina, hora_chegada_obra, hora_inicio_descarga, hora_fim_descarga, hora_moldagem, houve_adicao_agua, agua_litros, rejeitado, motivo_rejeicao, elementos_concretados, observacoes';
export async function listCaminhoes(concId: string): Promise<CaminhaoRow[]> {
  const { data, error } = await db.from('material_receipts').select(SEL_CAM).eq('concretagem_id', concId).is('deleted_at', null).order('serie');
  if (error) throw new Error(error.message);
  return (data ?? []) as CaminhaoRow[];
}

function addAge(iso: string, idade: number, unidade: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (unidade === 'hora') d.setHours(d.getHours() + idade); else d.setDate(d.getDate() + idade);
  return d.toISOString().slice(0, 10);
}

function metadataPadrao(conc: ConcretagemRow): PadraoItem[] | null {
  const md = (conc.metadata && typeof conc.metadata === 'object') ? conc.metadata : {};
  const p = md.padrao_moldagem;
  return Array.isArray(p) ? p as PadraoItem[] : null;
}

export function padraoMoldagemDaConcretagem(conc: ConcretagemRow | null | undefined): PadraoMoldagem[] {
  if (!conc) return normalizePadroes([], null);
  const fck = conc.operational_materials?.fck_mpa ?? conc.fck_previsto ?? null;
  const p = metadataPadrao(conc) ?? conc.operational_materials?.padrao_moldagem ?? [];
  return normalizePadroes(p, fck);
}

// Padrão de moldagem da última concretagem cadastrada no tenant — usado p/ semear a próxima programação.
export async function ultimoPadraoMoldagem(tenantId: string): Promise<PadraoMoldagem[] | null> {
  if (!tenantId) return null;
  const { data, error } = await db.from('concretagens')
    .select('metadata, fck_previsto, operational_materials(padrao_moldagem, fck_mpa)')
    .eq('tenant_id', tenantId).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  const pad = padraoMoldagemDaConcretagem(data as unknown as ConcretagemRow);
  return pad.length ? pad : null;
}

function sanitizeCaminhaoValues(values: Record<string, unknown>): Record<string, unknown> {
  const allowed = ['nota_fiscal', 'placa', 'motorista', 'volume_m3', 'slump_medido_mm', 'temperatura_concreto_c', 'hora_saida_usina', 'hora_chegada_obra', 'hora_inicio_descarga', 'hora_fim_descarga', 'hora_moldagem', 'houve_adicao_agua', 'agua_litros', 'rejeitado', 'motivo_rejeicao', 'elementos_concretados', 'observacoes', 'external_key'];
  const out: Record<string, unknown> = {};
  for (const key of allowed) if (values[key] !== undefined) out[key] = values[key];
  out.houve_adicao_agua = values.houve_adicao_agua === true;
  out.rejeitado = values.rejeitado === true;
  return out;
}

function padraoFromValues(values: Record<string, unknown>, conc: ConcretagemRow): PadraoItem[] {
  const fck = conc.operational_materials?.fck_mpa ?? conc.fck_previsto ?? null;
  if (Array.isArray(values.padrao_moldagem)) return padroesToDb(normalizePadroes(values.padrao_moldagem, fck)) as PadraoItem[];
  const p = metadataPadrao(conc) ?? conc.operational_materials?.padrao_moldagem ?? [];
  return padroesToDb(normalizePadroes(p, fck)) as PadraoItem[];
}

// Cria caminhão + amostra + CPs pelo padrão de moldagem do caminhão, da concretagem ou do traço.
export async function addCaminhao(tenantId: string, conc: ConcretagemRow, serie: number, values: Record<string, unknown>): Promise<void> {
  let step: 'receipt' | 'amostra' | 'cp' = 'receipt';
  let receiptId: string | null = null;
  let amostraId: string | null = null;
  try {
    const receiptPayload = sanitizeCaminhaoValues(values);
    const { data: rec, error: e1 } = await db.from('material_receipts').insert({ ...receiptPayload, tenant_id: tenantId, concretagem_id: conc.id, serie } as unknown as Database['public']['Tables']['material_receipts']['Insert']).select('id').single();
    if (e1) throw new Error(e1.message);
    receiptId = (rec as { id: string }).id;
    step = 'amostra';
    const hoje = (conc.data_real ?? conc.data_programada ?? new Date().toISOString().slice(0, 10));
    const hora = typeof values.hora_moldagem === 'string' && values.hora_moldagem ? String(values.hora_moldagem) : null;
    const base = conc.codigo ?? conc.id.slice(0, 6);
    const { data: am, error: e2 } = await db.from('amostras').insert({ tenant_id: tenantId, receipt_id: receiptId, concretagem_id: conc.id, codigo: 'AM-' + base + '-' + serie, data_moldagem: hoje, hora_moldagem: hora, status: 'moldada' }).select('id').single();
    if (e2) throw new Error(e2.message);
    amostraId = (am as { id: string }).id;
    step = 'cp';
    const padrao = padraoFromValues(values, conc);
    // Numeração interna do lab por CP (v132): alinhada à ordem de criação dos CPs (índice n-1).
    const numeracoes = Array.isArray(values.numeracoes) ? (values.numeracoes as (string | null | undefined)[]) : [];
    const cps: Record<string, unknown>[] = [];
    let n = 1;
    for (const item of padrao) {
      const idade = toNumber(item.idade ?? item.idadeControle) ?? 28;
      const qtd = toNumber(item.quantidade ?? item.quantidadeCp) ?? 2;
      const unidade = String(item.unidade ?? item.unidadeIdade ?? 'dia').startsWith('hora') ? 'hora' : 'dia';
      const fckRef = conc.fck_previsto ?? conc.operational_materials?.fck_mpa ?? null;
      // Valor esperado SEMPRE calculado do FCK previsto + idade (curva/interpolacao); nao mais lancado.
      const valorEsperado = esperadoMpaPorIdade(idade, unidade === 'hora' ? 'horas' : 'dias', fckRef) ?? toNumber(item.valor_esperado ?? item.valorEsperado) ?? fckRef ?? null;
      for (let i = 0; i < qtd; i++) {
        const rawNum = numeracoes[n - 1];
        const numeracaoLab = typeof rawNum === 'string' && rawNum.trim() ? rawNum.trim() : null;
        cps.push({ tenant_id: tenantId, amostra_id: amostraId, concretagem_id: conc.id, receipt_id: receiptId, material_test_type_id: null, codigo: 'CP-' + base + '-' + serie + '-' + String(n).padStart(2, '0'), numeracao_lab: numeracaoLab, idade_dias: idade, idade_unidade: unidade, data_moldagem: hoje, data_prevista_rompimento: addAge(hoje, idade, unidade), valor_esperado: valorEsperado, situacao: 'pendente', ordem: n });
        n++;
      }
    }
    if (cps.length) { const { error: e3 } = await db.from('corpos_prova').insert(cps as unknown as Database['public']['Tables']['corpos_prova']['Insert'][]); if (e3) throw new Error(e3.message); }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    const metadata = { action: 'caminhao.add', tenant_id: tenantId, concretagem_id: conc.id, material_receipt_id: receiptId, amostra_id: amostraId, serie, step, nota_fiscal: values.nota_fiscal ?? null };
    captureException(e, { category: 'domain', metadata });
    trackDomainEvent('caminhao.add_falhou', { ...metadata, reason });
    throw e;
  }
}

export async function invokeFichaBranco(): Promise<Blob> {
  const { data } = await invokeEdgeFunction<Blob>('generate-ficha-moldagem-pdf', { mode: 'blank' }, {
    responseType: 'blob',
    action: 'relatorio.pdf:generate-ficha-moldagem-pdf',
    ids: { mode: 'blank' },
    failureEvent: 'relatorio.pdf_falhou',
  });
  return data;
}

export async function invokeFicha(concId: string): Promise<Blob> {
  const { data } = await invokeEdgeFunction<Blob>('generate-ficha-moldagem-pdf', { concretagem_id: concId }, {
    responseType: 'blob',
    action: 'relatorio.pdf:generate-ficha-moldagem-pdf',
    ids: { concretagem_id: concId },
    failureEvent: 'relatorio.pdf_falhou',
  });
  return data;
}

export type CpDetalhe = { id: string; codigo: string | null; numeracao_lab: string | null; idade_dias: number | null; idade_unidade: string; situacao: string; receipt_id: string | null; data_prevista_rompimento: string | null; resultado: number | null };
export async function listCpsDaConcretagem(concId: string): Promise<CpDetalhe[]> {
  const { data, error } = await db.from('corpos_prova')
    .select('id, codigo, numeracao_lab, idade_dias, idade_unidade, data_prevista_rompimento, situacao, receipt_id, ordem, material_tests(resultado_valor)')
    .eq('concretagem_id', concId).is('deleted_at', null).order('ordem', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => {
    const mts = Array.isArray(r.material_tests) ? r.material_tests : [];
    const last = mts.length ? Number(mts[mts.length - 1].resultado_valor) : NaN;
    return { id: String(r.id), codigo: r.codigo ?? null, numeracao_lab: r.numeracao_lab ?? null, idade_dias: r.idade_dias ?? null, idade_unidade: String(r.idade_unidade ?? 'dia'), situacao: String(r.situacao ?? 'pendente'), receipt_id: r.receipt_id ?? null, data_prevista_rompimento: r.data_prevista_rompimento ?? null, resultado: Number.isFinite(last) ? last : null };
  });
}

// Traços com fck para os seletores de concretagem.
export type TracoFckOpt = { value: string; label: string; fck: number | null; idade_controle_dias?: number | null; padrao_moldagem?: PadraoItem[]; slump?: number | null; tolerancia?: number | null; validade?: number | null; work_id?: string | null; client_id?: string | null };
// Cadeia de escopo: traco da obra (work_id) > traco da construtora (client_id, work_id null) > catalogo do lab (ambos null).
export async function listTracosComFck(workId?: string | null, clientId?: string | null): Promise<TracoFckOpt[]> {
  let qy = db.from('operational_materials').select('id, nome, fck_mpa, idade_controle_dias, padrao_moldagem, slump_previsto_cm, slump_tolerancia_cm, validade_concreto_minutos, work_id, client_id').eq('material_kind', 'concreto').is('deleted_at', null);
  if (workId && clientId) qy = qy.or(`work_id.eq.${workId},client_id.eq.${clientId},and(work_id.is.null,client_id.is.null)`);
  else if (clientId) qy = qy.or(`client_id.eq.${clientId},and(work_id.is.null,client_id.is.null)`);
  else if (workId) qy = qy.or(`work_id.eq.${workId},and(work_id.is.null,client_id.is.null)`);
  const { data, error } = await qy.order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ value: String(r.id), label: String(r.nome ?? r.id), fck: r.fck_mpa != null ? Number(r.fck_mpa) : null, idade_controle_dias: r.idade_controle_dias != null ? Number(r.idade_controle_dias) : null, padrao_moldagem: Array.isArray(r.padrao_moldagem) ? r.padrao_moldagem : [], slump: r.slump_previsto_cm == null ? null : Number(r.slump_previsto_cm), tolerancia: r.slump_tolerancia_cm == null ? null : Number(r.slump_tolerancia_cm), validade: r.validade_concreto_minutos == null ? null : Number(r.validade_concreto_minutos), work_id: r.work_id ?? null, client_id: r.client_id ?? null }));
}

// OCR da NF/DANFE do caminhão (EF extract-nf-vision). Retorna campos ja nomeados p/ o recebimento.
async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  assertUploadSize(file);
  assertImagem(file);
  const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Falha ao ler arquivo')); r.readAsDataURL(file); });
  return { base64: dataUrl.split(',')[1] ?? '', mime: file.type || 'image/jpeg' };
}
export async function lerNfImagem(file: File): Promise<{ enabled: boolean; dados: Record<string, unknown>; reason?: string }> {
  const { base64, mime } = await fileToBase64(file);
  const { data: out } = await invokeEdgeFunction<{ ok?: boolean; enabled?: boolean; dados?: Record<string, unknown>; reason?: string; error?: string }>('extract-nf-vision', { image_base64: base64, mime }, {
    action: 'ocr.nf',
    ids: { filename: file.name, mime },
  });
  if (out.ok === false) throw new Error(out.error ?? out.reason ?? 'Falha ao ler a NF.');
  return { enabled: out.enabled !== false, dados: out.dados ?? {}, reason: out.reason };
}

// Evidências (melhoria 1.2) — fotos da concretagem/CP/ficha física. Bucket 'evidencias' (RLS por tenant).
export type EvidenciaRow = { id: string; path: string; tipo: string; descricao: string | null; created_at: string; concretagem_id: string | null; receipt_id: string | null };
export async function uploadEvidencia(tenantId: string, concId: string, file: File, opts?: { receiptId?: string | null; tipo?: string; descricao?: string }): Promise<void> {
  assertUploadSize(file);
  assertImagem(file);
  const safe = file.name.replace(/[^\w.-]+/g, '_');
  const path = tenantId + '/conc/' + concId + '/' + Date.now() + '-' + safe;
  const up = await supabase.storage.from('evidencias').upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (up.error) throw new Error(up.error.message);
  const { error } = await db.from('evidencias').insert({ tenant_id: tenantId, concretagem_id: concId, receipt_id: opts?.receiptId ?? null, path, tipo: opts?.tipo ?? 'foto', descricao: opts?.descricao ?? null });
  if (error) throw new Error(error.message);
}
export async function listEvidencias(concId: string): Promise<EvidenciaRow[]> {
  const { data, error } = await db.from('evidencias').select('id, path, tipo, descricao, created_at, concretagem_id, receipt_id').eq('concretagem_id', concId).is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EvidenciaRow[];
}
export async function signedEvidencia(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('evidencias').createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
export async function excluirEvidencia(id: string): Promise<void> {
  const { error } = await db.from('evidencias').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// OCR da FICHA DE MOLDAGEM preenchida (EF extract-ficha-vision). Retorna caminhões detectados p/ conferência.
export type FichaCaminhaoOCR = { serie?: number | null; nota_fiscal?: string | null; qtde_cps?: number | null; placa?: string | null; motorista?: string | null; volume_m3?: number | null; slump_medido_mm?: number | null; temperatura_concreto_c?: number | null; hora_moldagem?: string | null; hora_saida_usina?: string | null; hora_chegada_obra?: string | null; hora_inicio_descarga?: string | null; hora_fim_descarga?: string | null; elementos_concretados?: string | null; conf?: number | null };
export async function lerFichaImagem(file: File, concId: string): Promise<{ enabled: boolean; caminhoes: FichaCaminhaoOCR[]; confianca: number | null; reason?: string }> {
  const { base64, mime } = await fileToBase64(file);
  const { data: out } = await invokeEdgeFunction<{ ok?: boolean; enabled?: boolean; dados?: { caminhoes?: FichaCaminhaoOCR[]; confianca?: number | null }; reason?: string; error?: string }>('extract-ficha-vision', { image_base64: base64, mime, concretagem_id: concId }, {
    action: 'ocr.ficha_moldagem',
    ids: { concretagem_id: concId, filename: file.name, mime },
  });
  if (out.ok === false) throw new Error(out.error ?? out.reason ?? 'Falha ao ler a ficha.');
  return { enabled: out.enabled !== false, caminhoes: out.dados?.caminhoes ?? [], confianca: out.dados?.confianca ?? null, reason: out.reason };
}

// P1-4 (cockpit da Central): RPC concretagens_central_paged (contadores + status_tecnico + nomes +
// numero_relatorio, com filtros e paginacao num round-trip). RPC nova nao tipada em database.types.ts
// => cast permissivo so para esta chamada (o db tipado quebraria o tsc com o nome de funcao desconhecido).
const rpcLoose = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
export type ConcretagemCentralRow = {
  id: string; codigo: string | null; numero_relatorio: string | null; status: string; status_tecnico: string; origem: string;
  data_programada: string | null; data_real: string | null; fornecedor_texto: string | null; fck_previsto: number | null;
  cliente: string | null; obra: string | null;
  n_caminhoes: number; n_cps: number; n_cps_rompidos: number; n_cps_atrasados: number; n_laudos: number;
};
export async function listConcretagensCentral(opts: { tenantId?: string; clientId?: string; workId?: string; status?: string; search?: string; from?: string; to?: string; page?: number; pageSize?: number }): Promise<{ rows: ConcretagemCentralRow[]; total: number }> {
  if (!opts.tenantId) return { rows: [], total: 0 };
  const pageSize = opts.pageSize ?? 25; const page = Math.max(0, opts.page ?? 0);
  const { data, error } = await rpcLoose.rpc('concretagens_central_paged', {
    p_tenant: opts.tenantId, p_client: opts.clientId || null, p_work: opts.workId || null,
    p_status: opts.status || null, p_search: opts.search || null, p_from: opts.from || null, p_to: opts.to || null,
    p_limit: pageSize, p_offset: page * pageSize,
  });
  if (error) throw new Error(error.message);
  const arr = (data ?? []) as Array<Record<string, unknown>>;
  const total = arr.length ? Number(arr[0].total_count ?? 0) : 0;
  const rows: ConcretagemCentralRow[] = arr.map((r) => ({
    id: String(r.id), codigo: (r.codigo as string | null) ?? null, numero_relatorio: (r.numero_relatorio as string | null) ?? null,
    status: String(r.status ?? ''), status_tecnico: String(r.status_tecnico ?? ''), origem: String(r.origem ?? ''),
    data_programada: (r.data_programada as string | null) ?? null, data_real: (r.data_real as string | null) ?? null,
    fornecedor_texto: (r.fornecedor_texto as string | null) ?? null, fck_previsto: r.fck_previsto == null ? null : Number(r.fck_previsto),
    cliente: (r.cliente as string | null) ?? null, obra: (r.obra as string | null) ?? null,
    n_caminhoes: Number(r.n_caminhoes ?? 0), n_cps: Number(r.n_cps ?? 0), n_cps_rompidos: Number(r.n_cps_rompidos ?? 0), n_cps_atrasados: Number(r.n_cps_atrasados ?? 0), n_laudos: Number(r.n_laudos ?? 0),
  }));
  return { rows, total };
}


// T8 (auditoria UX): fornecedores ja usados pelo lab, para autocompletar (datalist) o campo
// texto-livre. Dedupe case-insensitive no cliente; sem migration (distinct via amostra recente).
export async function listFornecedores(): Promise<string[]> {
  const { data, error } = await db.from('concretagens').select('fornecedor_texto').is('deleted_at', null).not('fornecedor_texto', 'is', null).order('created_at', { ascending: false }).limit(400);
  if (error) throw new Error(error.message);
  const seen = new Set<string>(); const out: string[] = [];
  for (const r of (data ?? []) as { fornecedor_texto: string | null }[]) {
    const v = (r.fornecedor_texto ?? '').trim(); const k = v.toLowerCase();
    if (v && !seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
