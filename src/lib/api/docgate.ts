import { supabase } from '../supabase';

const db = supabase;
type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
const rpc = db.rpc.bind(db) as unknown as (fn: string, args: Record<string, unknown>) => RpcResult<unknown[]>;

export type DocGateConformityRow = {
  requirement_id: string;
  document_type_code: string;
  document_type_name: string;
  categoria: string;
  anchor_scope: string;
  anchor_id: string | null;
  nivel_gate: 'informativo' | 'aviso' | 'bloqueante' | string;
  aplica_em_emissao_laudo: boolean;
  situacao: string;
  document_id: string | null;
  document_status: string | null;
  data_validade: string | null;
  dias_para_vencer: number | null;
  observacoes: string | null;
  updated_at: string;
};

export type LaudoGateBlock = {
  severity: 'aviso' | 'bloqueante' | string;
  code: string;
  message: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
};

function asBool(v: unknown): boolean { return v === true || v === 'true'; }
function asInt(v: unknown): number | null { const n = Number(v); return Number.isFinite(n) ? n : null; }

function mapConformity(data: unknown[] | null): DocGateConformityRow[] {
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      requirement_id: String(r.requirement_id ?? ''),
      document_type_code: String(r.document_type_code ?? ''),
      document_type_name: String(r.document_type_name ?? 'Documento'),
      categoria: String(r.categoria ?? 'outro'),
      anchor_scope: String(r.anchor_scope ?? 'lab'),
      anchor_id: r.anchor_id == null ? null : String(r.anchor_id),
      nivel_gate: String(r.nivel_gate ?? 'aviso'),
      aplica_em_emissao_laudo: asBool(r.aplica_em_emissao_laudo),
      situacao: String(r.situacao ?? 'pendente'),
      document_id: r.document_id == null ? null : String(r.document_id),
      document_status: r.document_status == null ? null : String(r.document_status),
      data_validade: r.data_validade == null ? null : String(r.data_validade),
      dias_para_vencer: asInt(r.dias_para_vencer),
      observacoes: r.observacoes == null ? null : String(r.observacoes),
      updated_at: String(r.updated_at ?? new Date().toISOString()),
    };
  });
}

function mapBlocks(data: unknown[] | null): LaudoGateBlock[] {
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      severity: String(r.severity ?? 'aviso'),
      code: String(r.code ?? 'docgate'),
      message: String(r.message ?? 'Pendência documental'),
      entity_type: String(r.entity_type ?? 'documento'),
      entity_id: r.entity_id == null ? null : String(r.entity_id),
      metadata: r.metadata && typeof r.metadata === 'object' ? r.metadata as Record<string, unknown> : null,
    };
  });
}

export async function listDocGateConformity(opts: { anchorScope?: string; anchorId?: string; workId?: string; situacoes?: string[]; gate?: string[]; limit?: number } = {}): Promise<DocGateConformityRow[]> {
  const { data, error } = await rpc('list_docgate_conformity', {
    p_anchor_scope: opts.anchorScope || null,
    p_anchor_id: opts.anchorId || null,
    p_work_id: opts.workId || null,
    p_situacoes: opts.situacoes?.length ? opts.situacoes : null,
    p_gate: opts.gate?.length ? opts.gate : null,
    p_limit: opts.limit ?? 300,
  });
  if (error) throw new Error(error.message);
  return mapConformity(data);
}

export async function listLaudoGateBlocks(concretagemId: string): Promise<LaudoGateBlock[]> {
  const id = concretagemId.trim();
  if (!id) return [];
  const { data, error } = await rpc('docgate_laudo_blocks', { p_concretagem_id: id });
  if (error) throw new Error(error.message);
  return mapBlocks(data);
}

// ----- Gestão de documentos (Onda 2): tudo via PostgREST + storage (sem RPC) -----
const dbx = supabase as unknown as { from: (t: string) => any; storage: { from: (b: string) => any } };

export type DocReqInfo = { document_type_id: string; anchor_scope: string; anchor_id: string | null; work_id: string | null; client_id: string | null };

export async function getRequirementInfo(requirementId: string): Promise<DocReqInfo | null> {
  const { data, error } = await dbx.from('lab_document_requirements')
    .select('document_type_id, anchor_scope, anchor_id, work_id, client_id').eq('id', requirementId).is('deleted_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { document_type_id: String(data.document_type_id), anchor_scope: String(data.anchor_scope), anchor_id: data.anchor_id ? String(data.anchor_id) : null, work_id: data.work_id ? String(data.work_id) : null, client_id: data.client_id ? String(data.client_id) : null };
}

export async function anexarDocumento(input: { tenantId: string; memberId: string; requirementId: string; titulo: string; dataValidade: string | null; file: File }): Promise<void> {
  const info = await getRequirementInfo(input.requirementId);
  if (!info) throw new Error('Requisito nao encontrado.');
  const safe = input.file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
  const path = input.tenantId + '/docgate/' + input.requirementId + '/' + Date.now() + '-' + safe;
  const up = await dbx.storage.from('anexos').upload(path, input.file, { upsert: false, contentType: input.file.type || 'application/octet-stream' });
  if (up.error) throw new Error(up.error.message);
  const ins = await dbx.from('lab_documents').insert({
    tenant_id: input.tenantId, document_type_id: info.document_type_id, requirement_id: input.requirementId,
    anchor_scope: info.anchor_scope, anchor_id: info.anchor_id, work_id: info.work_id, client_id: info.client_id,
    titulo: input.titulo || input.file.name, status: 'em_analise', storage_path: path,
    mime_type: input.file.type || null, file_size: input.file.size, data_validade: input.dataValidade || null,
    created_by: input.memberId, updated_by: input.memberId,
  }).select('id').single();
  if (ins.error) throw new Error(ins.error.message);
  await dbx.from('lab_document_events').insert({ tenant_id: input.tenantId, document_id: ins.data.id, requirement_id: input.requirementId, acao: 'anexado', actor_member_id: input.memberId, para_status: 'em_analise' });
}

export async function decidirDocumento(input: { tenantId: string; memberId: string; documentId: string; requirementId: string; aprovar: boolean; motivo?: string | null; deStatus?: string | null }): Promise<void> {
  const novo = input.aprovar ? 'aprovado' : 'recusado';
  const upd = await dbx.from('lab_documents').update({ status: novo, reviewed_by: input.memberId, reviewed_at: new Date().toISOString(), motivo_recusa: input.aprovar ? null : (input.motivo || null), updated_by: input.memberId }).eq('id', input.documentId);
  if (upd.error) throw new Error(upd.error.message);
  await dbx.from('lab_document_events').insert({ tenant_id: input.tenantId, document_id: input.documentId, requirement_id: input.requirementId, acao: novo, actor_member_id: input.memberId, de_status: input.deStatus || null, para_status: novo, observacao: input.aprovar ? null : (input.motivo || null) });
}

export async function signedDocUrl(documentId: string): Promise<string> {
  const { data, error } = await dbx.from('lab_documents').select('storage_path').eq('id', documentId).maybeSingle();
  if (error) throw new Error(error.message);
  const path = data?.storage_path;
  if (!path) throw new Error('Documento sem arquivo anexado.');
  const signed = await dbx.storage.from('anexos').createSignedUrl(String(path), 120);
  if (signed.error) throw new Error(signed.error.message);
  return String(signed.data.signedUrl);
}
