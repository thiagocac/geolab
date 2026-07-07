import { supabase } from '../supabase';
import { listPriceItems } from './contractFinance';

// E1 — propostas / orçamentos. Tabelas propostas + proposta_itens (mig 178); RPCs salvar/converter.
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }> };

export type PropostaItem = { descricao: string; unidade: string | null; tipo_cobranca: string | null; quantidade: number; preco_unitario: number; ordem?: number };
export type PropostaRow = { id: string; numero: string | null; titulo: string | null; client_id: string | null; cliente: string | null; validade: string | null; status: string; condicao_pagamento: string | null; observacoes: string | null; valor_total: number; contrato_id: string | null; created_at: string };
export type PropostaFull = PropostaRow & { itens: PropostaItem[] };

export const PROPOSTA_STATUS = [
  { value: 'rascunho', label: 'Rascunho' }, { value: 'enviada', label: 'Enviada' },
  { value: 'aceita', label: 'Aceita' }, { value: 'recusada', label: 'Recusada' }, { value: 'expirada', label: 'Expirada' },
] as const;

const SEL = 'id, numero, titulo, client_id, validade, status, condicao_pagamento, observacoes, valor_total, contrato_id, created_at, lab_clients(razao_social)';
function mapRow(r: Record<string, any>): PropostaRow {
  return { id: String(r.id), numero: r.numero ?? null, titulo: r.titulo ?? null, client_id: r.client_id ?? null, cliente: r.lab_clients?.razao_social ?? null, validade: r.validade ?? null, status: String(r.status ?? 'rascunho'), condicao_pagamento: r.condicao_pagamento ?? null, observacoes: r.observacoes ?? null, valor_total: Number(r.valor_total) || 0, contrato_id: r.contrato_id ?? null, created_at: String(r.created_at) };
}

export async function listPropostas(): Promise<PropostaRow[]> {
  const { data, error } = await db.from('propostas').select(SEL).is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map(mapRow);
}

export async function getProposta(id: string): Promise<PropostaFull> {
  const { data, error } = await db.from('propostas').select(SEL).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  const { data: itens, error: e2 } = await db.from('proposta_itens').select('descricao, unidade, tipo_cobranca, quantidade, preco_unitario, ordem').eq('proposta_id', id).order('ordem');
  if (e2) throw new Error(e2.message);
  return { ...mapRow(data ?? {}), itens: ((itens ?? []) as Record<string, any>[]).map((i) => ({ descricao: String(i.descricao ?? ''), unidade: i.unidade ?? null, tipo_cobranca: i.tipo_cobranca ?? null, quantidade: Number(i.quantidade) || 0, preco_unitario: Number(i.preco_unitario) || 0, ordem: i.ordem ?? 0 })) };
}

export async function salvarProposta(payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await db.rpc('salvar_proposta', { payload });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function converterPropostaContrato(id: string, numero?: string | null): Promise<string> {
  const { data, error } = await db.rpc('converter_proposta_contrato', { p_proposta: id, p_numero: numero ?? null });
  if (error) throw new Error(error.message);
  return String(data);
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
