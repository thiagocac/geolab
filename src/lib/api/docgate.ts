import { supabase } from '../supabase';

const db = supabase;
type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
const rpc = db.rpc as unknown as (fn: string, args: Record<string, unknown>) => RpcResult<unknown[]>;

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
