import { supabase } from '../supabase';
import { listPriceItems } from './contractFinance';

// E1 — propostas / orçamentos. Tabelas propostas + proposta_itens (mig 178); RPCs salvar/converter.
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }> };

export type PropostaItem = { id?: string; catalog_item_id?: string | null; descricao: string; unidade: string | null; tipo_cobranca: string | null; quantidade: number; preco_unitario: number; desconto_pct?: number; ordem?: number };
export type PropostaRow = { id: string; numero: string | null; titulo: string | null; client_id: string | null; work_id: string | null; cliente: string | null; validade: string | null; status: string; condicao_pagamento: string | null; observacoes: string | null; valor_total: number; contrato_id: string | null; revision: number; recipient_name: string | null; recipient_email: string | null; template_version_id: string | null; followup_at: string | null; pdf_path: string | null; created_at: string };
export type PropostaFull = PropostaRow & { itens: PropostaItem[] };

export const PROPOSTA_STATUS = [
  { value: 'rascunho', label: 'Rascunho' }, { value: 'enviada', label: 'Enviada' },
  { value: 'aceita', label: 'Aceita' }, { value: 'recusada', label: 'Recusada' }, { value: 'expirada', label: 'Expirada' },
] as const;

const SEL = 'id, numero, titulo, client_id, work_id, validade, status, condicao_pagamento, observacoes, valor_total, contrato_id, revision, recipient_name, recipient_email, template_version_id, followup_at, pdf_path, created_at, lab_clients(razao_social)';
function mapRow(r: Record<string, any>): PropostaRow {
  return { id: String(r.id), numero: r.numero ?? null, titulo: r.titulo ?? null, client_id: r.client_id ?? null, work_id: r.work_id ?? null, cliente: r.lab_clients?.razao_social ?? null, validade: r.validade ?? null, status: String(r.status ?? 'rascunho'), condicao_pagamento: r.condicao_pagamento ?? null, observacoes: r.observacoes ?? null, valor_total: Number(r.valor_total) || 0, contrato_id: r.contrato_id ?? null, revision: Number(r.revision) || 0, recipient_name: r.recipient_name ?? null, recipient_email: r.recipient_email ?? null, template_version_id: r.template_version_id ?? null, followup_at: r.followup_at ?? null, pdf_path: r.pdf_path ?? null, created_at: String(r.created_at) };
}

export async function listPropostas(): Promise<PropostaRow[]> {
  const { data, error } = await db.from('propostas').select(SEL).is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map(mapRow);
}

export async function getProposta(id: string): Promise<PropostaFull> {
  const { data, error } = await db.from('propostas').select(SEL).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  const { data: itens, error: e2 } = await db.from('proposta_itens').select('id, catalog_item_id, descricao, unidade, tipo_cobranca, quantidade, preco_unitario, desconto_pct, ordem').is('deleted_at', null).eq('proposta_id', id).order('ordem');
  if (e2) throw new Error(e2.message);
  return { ...mapRow(data ?? {}), itens: ((itens ?? []) as Record<string, any>[]).map((i) => ({ id: String(i.id), catalog_item_id: i.catalog_item_id ?? null, descricao: String(i.descricao ?? ''), unidade: i.unidade ?? null, tipo_cobranca: i.tipo_cobranca ?? null, quantidade: Number(i.quantidade) || 0, preco_unitario: Number(i.preco_unitario) || 0, desconto_pct: Number(i.desconto_pct) || 0, ordem: i.ordem ?? 0 })) };
}

export async function salvarProposta(payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await db.rpc('save_proposal_v2', { p_payload: payload });
  if (error) throw new Error(error.message);
  return String(data);
}

// Duplica uma proposta como novo rascunho (cabeçalho + itens; número é gerado pela trigger).
export async function duplicarProposta(id: string): Promise<string> {
  const { data, error } = await db.rpc('duplicate_proposal', { p_proposal_id: id });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function converterPropostaContrato(id: string, numero?: string | null): Promise<string> {
  const { data, error } = await db.rpc('convert_accepted_proposal_v2', { p_proposal_id: id, p_contract_number: numero ?? null });
  if (error) throw new Error(error.message);
  return String(data);
}


export async function gerarRevisaoProposta(id: string): Promise<Record<string, unknown>> {
  const { data, error } = await db.rpc('create_proposal_revision', { p_proposal_id: id });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
}

export async function softDeleteProposta(id: string): Promise<void> {
  const { error } = await db.from('propostas').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// Semeia os itens a partir da tabela de preços do laboratório (escopo 'laboratorio').
export async function seedItensDaTabela(tenantId: string): Promise<PropostaItem[]> {
  try {
    const items = await listPriceItems('laboratorio', tenantId);
    return items.filter((i) => i.ativo).map((i) => ({ descricao: i.descricao, unidade: i.unidade, tipo_cobranca: i.tipo_cobranca, quantidade: 1, preco_unitario: i.preco_unitario }));
  } catch { return []; }
}
