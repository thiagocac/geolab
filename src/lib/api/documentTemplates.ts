import { supabase } from '../supabase';
import { env } from '../env';

// SPEC-01 (v214) — Motor de templates de documentos (schema de BLOCOS; migs 207/209 + EF generate-document-pdf).
// RN-01: uma versão published por template (publicar arquiva a anterior).
// RN-04: PDF oficial é snapshot (job em document_render_jobs + bucket 'documentos').

const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type BlocoDoc = {
  type: 'titulo' | 'paragrafo' | 'chave_valor' | 'tabela_itens' | 'divisor' | 'espaco' | 'assinaturas';
  text?: string;
  size?: string;
  rows?: Array<{ label: string; value: string }>;
  source?: string;
  columns?: Array<{ header: string; path: string; format?: string; align?: string; width?: number }>;
  total_path?: string;
  total_label?: string;
  h?: number;
  left?: string;
  right?: string;
};

export type DocTemplate = {
  id?: string;
  key: string;
  nome: string;
  escopo: 'proposta' | 'contrato' | 'medicao' | 'recibo' | 'declaracao' | 'outro';
  descricao?: string | null;
  ativo: boolean;
};

export type DocVersion = {
  id?: string;
  template_id: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  title_template: string;
  blocks: BlocoDoc[];
  sample_data: Record<string, unknown>;
};

export async function listTemplates(): Promise<Array<DocTemplate & { id: string }>> {
  const { data, error } = await db.from('document_templates')
    .select('id, key, nome, escopo, descricao, ativo')
    .is('deleted_at', null)
    .order('nome');
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<DocTemplate & { id: string }>;
}

export async function upsertTemplate(t: DocTemplate & { tenant_id?: string }): Promise<string> {
  const payload = { key: t.key.trim(), nome: t.nome.trim(), escopo: t.escopo, descricao: t.descricao ?? null, ativo: t.ativo, updated_at: new Date().toISOString() };
  if (t.id) {
    const { error } = await db.from('document_templates').update(payload).eq('id', t.id);
    if (error) throw new Error(error.message);
    return t.id;
  }
  const { data, error } = await db.from('document_templates').insert({ ...payload, tenant_id: t.tenant_id }).select('id').single();
  if (error) throw new Error(error.message);
  return String((data as { id: string }).id);
}

export async function listVersions(templateId: string): Promise<Array<DocVersion & { id: string }>> {
  const { data, error } = await db.from('document_template_versions')
    .select('id, template_id, version, status, title_template, blocks, sample_data')
    .eq('template_id', templateId)
    .is('deleted_at', null)
    .order('version', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<DocVersion & { id: string }>;
}

/** Salva o rascunho: atualiza a draft existente ou cria a próxima versão. */
export async function saveDraft(templateId: string, tenantId: string, v: Pick<DocVersion, 'title_template' | 'blocks' | 'sample_data'>, draftId?: string): Promise<string> {
  if (draftId) {
    const { error } = await db.from('document_template_versions')
      .update({ title_template: v.title_template, blocks: v.blocks, sample_data: v.sample_data })
      .eq('id', draftId).eq('status', 'draft');
    if (error) throw new Error(error.message);
    return draftId;
  }
  const versoes = await listVersions(templateId);
  const next = (versoes[0]?.version ?? 0) + 1;
  const { data, error } = await db.from('document_template_versions')
    .insert({ tenant_id: tenantId, template_id: templateId, version: next, status: 'draft', title_template: v.title_template, blocks: v.blocks, sample_data: v.sample_data })
    .select('id').single();
  if (error) throw new Error(error.message);
  return String((data as { id: string }).id);
}

/** RN-01: publica a draft e arquiva a published anterior. */
export async function publishVersion(templateId: string, draftId: string): Promise<void> {
  const { error: e1 } = await db.from('document_template_versions')
    .update({ status: 'archived' })
    .eq('template_id', templateId).eq('status', 'published');
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await db.from('document_template_versions')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', draftId);
  if (e2) throw new Error(e2.message);
}

export type GerarDocParams = {
  templateVersionId?: string;
  templateId?: string;
  entityType: string;
  entityId?: string | null;
  preview?: boolean;
};

export async function gerarDocumentoPdf(p: GerarDocParams): Promise<Blob> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-document-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      template_version_id: p.templateVersionId || undefined,
      template_id: p.templateId || undefined,
      entity_type: p.entityType,
      entity_id: p.entityId || undefined,
      preview: p.preview === true,
    }),
  });
  if (!resp.ok) {
    let msg = 'Falha ao gerar documento';
    try { const j = await resp.json(); msg = String(j.error ?? msg); if (Array.isArray(j.campos) && j.campos.length) msg += ': ' + j.campos.join(', '); } catch { /* texto */ }
    throw new Error(msg);
  }
  return await resp.blob();
}

/** Template de proposta pronto para uso (seed de conveniência do editor). */
export function propostaTemplatePadrao(): { title_template: string; blocks: BlocoDoc[]; sample_data: Record<string, unknown> } {
  return {
    title_template: 'Proposta Comercial {{proposta.numero}}',
    blocks: [
      { type: 'chave_valor', rows: [
        { label: 'Cliente', value: '{{cliente.razao_social}}' },
        { label: 'CNPJ/CPF', value: '{{cliente.cnpj_cpf}}' },
        { label: 'Data', value: '{{proposta.data}}' },
        { label: 'Validade', value: '{{proposta.validade}}' },
      ] },
      { type: 'paragrafo', text: 'Apresentamos nossa proposta para os serviços de controle tecnológico de concreto, conforme itens e condições abaixo.' },
      { type: 'titulo', text: 'Serviços e valores' },
      { type: 'tabela_itens', source: 'proposta.itens', total_path: 'total', total_label: 'Valor total', columns: [
        { header: 'Descrição', path: 'descricao', width: 4 },
        { header: 'Un', path: 'unidade', width: 1 },
        { header: 'Qtd', path: 'quantidade', format: 'numero', width: 1 },
        { header: 'Preço unit.', path: 'preco_unitario', format: 'moeda', width: 1.5 },
        { header: 'Total', path: 'total', format: 'moeda', width: 1.5 },
      ] },
      { type: 'titulo', text: 'Condições' },
      { type: 'chave_valor', rows: [
        { label: 'Pagamento', value: '{{proposta.condicao_pagamento}}' },
        { label: 'Observações', value: '{{proposta.observacoes}}' },
      ] },
      { type: 'espaco', h: 20 },
      { type: 'assinaturas', left: '{{lab.responsavel_tecnico}} — {{lab.nome}}', right: '{{cliente.razao_social}}' },
    ],
    sample_data: {
      proposta: {
        numero: 'PROP-2026-0001', data: '10/07/2026', validade: '10/08/2026',
        condicao_pagamento: '28 dias após a medição', observacoes: 'Valores válidos para a região metropolitana.',
        itens: [
          { descricao: 'Ensaio de compressão de CP', unidade: 'un', quantidade: 100, preco_unitario: 18.5, total: 1850 },
          { descricao: 'Visita técnica do moldador', unidade: 'visita', quantidade: 10, preco_unitario: 120, total: 1200 },
        ],
      },
      cliente: { razao_social: 'Construtora Exemplo Ltda', cnpj_cpf: '00.000.000/0001-00' },
    },
  };
}
