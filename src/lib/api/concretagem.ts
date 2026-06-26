import { supabase } from '../supabase';
import type { Database } from '../database.types';
import { env } from '../env';
import { normalizePadroes, padroesToDb, toNumber, type PadraoMoldagem } from '../concreto';

const db = supabase;

type Rec = Record<string, unknown>;
export type PadraoItem = { idade?: number; idadeControle?: number | string; unidade?: string; unidadeIdade?: string; quantidade?: number; quantidadeCp?: number | string; valor_esperado?: number; valorEsperado?: number | string; tipoEnsaio?: string; tipo_ensaio?: string };
export type ConcretagemRow = {
  id: string; codigo: string | null; status: string; origem: string;
  data_programada: string | null; data_real: string | null; hora_programada?: string | null; hora_inicio?: string | null; hora_fim?: string | null;
  fornecedor_texto: string | null; fck_previsto: number | null; traco_texto?: string | null;
  dimensao_cp?: string | null; local_texto?: string | null; operational_material_id?: string | null;
  volume_programado_m3?: number | null; volume_lancado_m3?: number | null; bombeado?: boolean | null; clima?: string | null; temperatura_ambiente_c?: number | null; moldador_id?: string | null; observacoes?: string | null;
  metadata?: Rec | null;
  client_id: string; work_id: string;
  lab_clients?: { razao_social: string; nome_fantasia?: string | null } | null;
  client_works?: { nome: string; cidade?: string | null; uf?: string | null } | null;
  operational_materials?: { nome: string; padrao_moldagem?: PadraoItem[]; fck_mpa?: number; slump_previsto_cm?: number | null; slump_tolerancia_cm?: number | null; validade_concreto_minutos?: number | null } | null;
  colaboradores?: { nome: string } | null;
};
export type CaminhaoRow = {
  id: string; serie: number | null; nota_fiscal: string; placa: string | null; motorista?: string | null; volume_m3: number | null;
  slump_medido_cm: number | null; temperatura_concreto_c: number | null; hora_saida_usina?: string | null; hora_chegada_obra?: string | null; hora_inicio_descarga?: string | null; hora_fim_descarga?: string | null; hora_moldagem?: string | null; houve_adicao_agua?: boolean | null; agua_litros?: number | null; rejeitado?: boolean | null; motivo_rejeicao?: string | null; elementos_concretados?: string | null; observacoes?: string | null;
};

const SEL = 'id, codigo, status, origem, data_programada, data_real, hora_programada, hora_inicio, hora_fim, fornecedor_texto, fck_previsto, traco_texto, dimensao_cp, local_texto, operational_material_id, volume_programado_m3, volume_lancado_m3, bombeado, clima, temperatura_ambiente_c, moldador_id, observacoes, metadata, client_id, work_id, lab_clients(razao_social, nome_fantasia), client_works(nome, cidade, uf), operational_materials(nome, padrao_moldagem, fck_mpa, slump_previsto_cm, slump_tolerancia_cm, validade_concreto_minutos), colaboradores(nome)';

export async function listConcretagens(workId?: string): Promise<ConcretagemRow[]> {
  let q = db.from('concretagens').select(SEL).is('deleted_at', null);
  if (workId) q = q.eq('work_id', workId);
  const { data, error } = await q.order('data_programada', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ConcretagemRow[];
}

export async function listProgramacoes(): Promise<ConcretagemRow[]> {
  const rows = await listConcretagens();
  return rows.filter((r) => r.origem === 'programada' || r.origem === 'portal_cliente' || r.status === 'pendente' || !(r.data_real));
}

export async function getConcretagem(id: string): Promise<ConcretagemRow | null> {
  const { data, error } = await db.from('concretagens').select(SEL).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ConcretagemRow | null;
}

export async function createConcretagem(tenantId: string, values: Record<string, unknown>): Promise<{ id: string }> {
  const status = String(values.status ?? 'rascunho');
  const origem = String(values.origem ?? 'programada');
  const { data, error } = await db.from('concretagens').insert({ ...values, tenant_id: tenantId, status, origem } as unknown as Database['public']['Tables']['concretagens']['Insert']).select('id').single();
  if (error) throw new Error(error.message);
  return data as { id: string };
}

export async function updateConcretagem(id: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('concretagens').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function confirmarProgramacao(id: string): Promise<void> { await updateConcretagem(id, { status: 'registrado' }); }
export async function cancelarProgramacao(id: string): Promise<void> { await updateConcretagem(id, { status: 'cancelada' }); }

const SEL_CAM = 'id, serie, nota_fiscal, placa, motorista, volume_m3, slump_medido_cm, temperatura_concreto_c, hora_saida_usina, hora_chegada_obra, hora_inicio_descarga, hora_fim_descarga, hora_moldagem, houve_adicao_agua, agua_litros, rejeitado, motivo_rejeicao, elementos_concretados, observacoes';
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

function sanitizeCaminhaoValues(values: Record<string, unknown>): Record<string, unknown> {
  const allowed = ['nota_fiscal', 'placa', 'motorista', 'volume_m3', 'slump_medido_cm', 'temperatura_concreto_c', 'hora_saida_usina', 'hora_chegada_obra', 'hora_inicio_descarga', 'hora_fim_descarga', 'hora_moldagem', 'houve_adicao_agua', 'agua_litros', 'rejeitado', 'motivo_rejeicao', 'elementos_concretados', 'observacoes', 'external_key'];
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
export async function addCaminhao(tenantId: string, conc: ConcretagemRow, serie: number, values: Record<string, unknown>): Promise<string> {
  const receiptPayload = sanitizeCaminhaoValues(values);
  const { data: rec, error: e1 } = await db.from('material_receipts').insert({ ...receiptPayload, tenant_id: tenantId, concretagem_id: conc.id, serie } as unknown as Database['public']['Tables']['material_receipts']['Insert']).select('id').single();
  if (e1) throw new Error(e1.message);
  const receiptId = (rec as { id: string }).id;
  const hoje = (conc.data_real ?? conc.data_programada ?? new Date().toISOString().slice(0, 10));
  const hora = typeof values.hora_moldagem === 'string' && values.hora_moldagem ? String(values.hora_moldagem) : null;
  const base = conc.codigo ?? conc.id.slice(0, 6);
  const { data: am, error: e2 } = await db.from('amostras').insert({ tenant_id: tenantId, receipt_id: receiptId, concretagem_id: conc.id, codigo: 'AM-' + base + '-' + serie, data_moldagem: hoje, hora_moldagem: hora, status: 'moldada' }).select('id').single();
  if (e2) throw new Error(e2.message);
  const amostraId = (am as { id: string }).id;
  const padrao = padraoFromValues(values, conc);
  const cps: Record<string, unknown>[] = [];
  let n = 1;
  for (const item of padrao) {
    const idade = toNumber(item.idade ?? item.idadeControle) ?? 28;
    const qtd = toNumber(item.quantidade ?? item.quantidadeCp) ?? 2;
    const unidade = String(item.unidade ?? item.unidadeIdade ?? 'dia').startsWith('hora') ? 'hora' : 'dia';
    const valorEsperado = toNumber(item.valor_esperado ?? item.valorEsperado) ?? conc.fck_previsto ?? conc.operational_materials?.fck_mpa ?? null;
    for (let i = 0; i < qtd; i++) {
      cps.push({ tenant_id: tenantId, amostra_id: amostraId, concretagem_id: conc.id, receipt_id: receiptId, material_test_type_id: null, codigo: 'CP-' + base + '-' + serie + '-' + String(n).padStart(2, '0'), idade_dias: idade, idade_unidade: unidade, data_moldagem: hoje, data_prevista_rompimento: addAge(hoje, idade, unidade), valor_esperado: valorEsperado, situacao: 'pendente', ordem: n });
      n++;
    }
  }
  if (cps.length) { const { error: e3 } = await db.from('corpos_prova').insert(cps as unknown as Database['public']['Tables']['corpos_prova']['Insert'][]); if (e3) throw new Error(e3.message); }
  return receiptId;
}

export async function invokeFichaBranco(): Promise<Blob> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-ficha-moldagem-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ mode: 'blank' }),
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(t || ('Erro ' + resp.status)); }
  return resp.blob();
}

export async function invokeFicha(concId: string): Promise<Blob> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-ficha-moldagem-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ concretagem_id: concId }),
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(t || ('Erro ' + resp.status)); }
  return resp.blob();
}

export type CpDetalhe = { id: string; codigo: string | null; idade_dias: number | null; idade_unidade: string; situacao: string; receipt_id: string | null; data_prevista_rompimento: string | null; resultado: number | null };
export async function listCpsDaConcretagem(concId: string): Promise<CpDetalhe[]> {
  const { data, error } = await db.from('corpos_prova')
    .select('id, codigo, idade_dias, idade_unidade, data_prevista_rompimento, situacao, receipt_id, ordem, material_tests(resultado_valor)')
    .eq('concretagem_id', concId).is('deleted_at', null).order('ordem', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => {
    const mts = Array.isArray(r.material_tests) ? r.material_tests : [];
    const last = mts.length ? Number(mts[mts.length - 1].resultado_valor) : NaN;
    return { id: String(r.id), codigo: r.codigo ?? null, idade_dias: r.idade_dias ?? null, idade_unidade: String(r.idade_unidade ?? 'dia'), situacao: String(r.situacao ?? 'pendente'), receipt_id: r.receipt_id ?? null, data_prevista_rompimento: r.data_prevista_rompimento ?? null, resultado: Number.isFinite(last) ? last : null };
  });
}

// Traços com fck para os seletores de concretagem.
export async function listTracosComFck(): Promise<{ value: string; label: string; fck: number | null; padrao_moldagem?: PadraoItem[]; slump?: number | null; tolerancia?: number | null; validade?: number | null }[]> {
  const { data, error } = await db.from('operational_materials').select('id, nome, fck_mpa, padrao_moldagem, slump_previsto_cm, slump_tolerancia_cm, validade_concreto_minutos').is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ value: String(r.id), label: String(r.nome ?? r.id), fck: r.fck_mpa != null ? Number(r.fck_mpa) : null, padrao_moldagem: Array.isArray(r.padrao_moldagem) ? r.padrao_moldagem : [], slump: r.slump_previsto_cm == null ? null : Number(r.slump_previsto_cm), tolerancia: r.slump_tolerancia_cm == null ? null : Number(r.slump_tolerancia_cm), validade: r.validade_concreto_minutos == null ? null : Number(r.validade_concreto_minutos) }));
}

// OCR da NF/DANFE do caminhao (EF extract-nf-vision). Retorna campos ja nomeados p/ o recebimento.
async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Falha ao ler arquivo')); r.readAsDataURL(file); });
  return { base64: dataUrl.split(',')[1] ?? '', mime: file.type || 'image/jpeg' };
}
export async function lerNfImagem(file: File): Promise<{ enabled: boolean; dados: Record<string, unknown>; reason?: string }> {
  const { base64, mime } = await fileToBase64(file);
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/extract-nf-vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ image_base64: base64, mime }),
  });
  const out = (await resp.json().catch(() => ({}))) as { ok?: boolean; enabled?: boolean; dados?: Record<string, unknown>; reason?: string; error?: string };
  if (!resp.ok || out.ok === false) throw new Error(out.error ?? out.reason ?? 'Falha ao ler a NF.');
  return { enabled: out.enabled !== false, dados: out.dados ?? {}, reason: out.reason };
}

// Evidências (melhoria 1.2) — fotos da concretagem/CP/ficha física. Bucket 'evidencias' (RLS por tenant).
export type EvidenciaRow = { id: string; path: string; tipo: string; descricao: string | null; created_at: string; concretagem_id: string | null; receipt_id: string | null };
export async function uploadEvidencia(tenantId: string, concId: string, file: File, opts?: { receiptId?: string | null; tipo?: string; descricao?: string }): Promise<void> {
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
export type FichaCaminhaoOCR = { serie?: number | null; nota_fiscal?: string | null; placa?: string | null; motorista?: string | null; volume_m3?: number | null; slump_medido_cm?: number | null; temperatura_concreto_c?: number | null; hora_saida_usina?: string | null; hora_chegada_obra?: string | null; hora_inicio_descarga?: string | null; hora_fim_descarga?: string | null };
export async function lerFichaImagem(file: File, concId: string): Promise<{ enabled: boolean; caminhoes: FichaCaminhaoOCR[]; confianca: number | null; reason?: string }> {
  const { base64, mime } = await fileToBase64(file);
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/extract-ficha-vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ image_base64: base64, mime, concretagem_id: concId }),
  });
  const out = (await resp.json().catch(() => ({}))) as { ok?: boolean; enabled?: boolean; dados?: { caminhoes?: FichaCaminhaoOCR[]; confianca?: number | null }; reason?: string; error?: string };
  if (!resp.ok || out.ok === false) throw new Error(out.error ?? out.reason ?? 'Falha ao ler a ficha.');
  return { enabled: out.enabled !== false, caminhoes: out.dados?.caminhoes ?? [], confianca: out.dados?.confianca ?? null, reason: out.reason };
}
