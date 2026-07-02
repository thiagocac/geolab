import { supabase } from '../supabase';

const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type ContractFinanceFilters = { from?: string; to?: string; clientId?: string; workId?: string; contractId?: string };
export type ContractFinanceKpis = { contratos: number; obras: number; medido: number; faturado: number; recebido: number; aberto: number; vencido: number; margem_estimada: number };
export type ContractFinanceRow = { id: string; numero: string; cliente: string; obra: string; status: string; inicio: string | null; fim: string | null; valor_contratado: number; medido: number; faturado: number; recebido: number; aberto: number; vencido: number; reajuste: string | null };
export type ReceivableRow = { id: string; numero: string; cliente: string; competencia: string | null; vencimento: string | null; valor: number; status: string; dias_atraso: number };
export type ContractFinanceSnapshot = { kpis: ContractFinanceKpis; contratos: ContractFinanceRow[]; recebiveis: ReceivableRow[]; series: Record<string, Array<Record<string, unknown>>> };

const zeroKpis: ContractFinanceKpis = { contratos: 0, obras: 0, medido: 0, faturado: 0, recebido: 0, aberto: 0, vencido: 0, margem_estimada: 0 };

export async function getContractFinanceSnapshot(filters: ContractFinanceFilters): Promise<ContractFinanceSnapshot> {
  const { data, error } = await db.rpc('contract_finance_snapshot', {
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_client_id: filters.clientId ?? null,
    p_work_id: filters.workId ?? null,
    p_contract_id: filters.contractId ?? null,
  });
  if (error) throw new Error(error.message);
  const r = (Array.isArray(data) ? data[0] : data) as Partial<ContractFinanceSnapshot> | null;
  return { kpis: { ...zeroKpis, ...(r?.kpis ?? {}) }, contratos: (r?.contratos ?? []) as ContractFinanceRow[], recebiveis: (r?.recebiveis ?? []) as ReceivableRow[], series: (r?.series ?? {}) as Record<string, Array<Record<string, unknown>>> };
}

export type PriceItem = { id?: string; escopo: string; escopo_id: string; item_code: string; descricao: string; unidade: string; preco_unitario: number; ativo: boolean; tipo_cobranca: string };
export const TIPO_COBRANCA_OPCOES: { value: string; label: string; unidade: string }[] = [
  { value: 'por_cp_ensaiado', label: 'Por CP ensaiado (rompido)', unidade: 'cp' },
  { value: 'por_cp_moldado', label: 'Por CP moldado', unidade: 'cp' },
  { value: 'por_laudo', label: 'Por laudo emitido', unidade: 'laudo' },
  { value: 'por_visita', label: 'Por visita do moldador', unidade: 'visita' },
  { value: 'por_forma', label: 'Por forma', unidade: 'forma' },
  { value: 'deslocamento', label: 'Deslocamento', unidade: 'km' },
  { value: 'fixo_mensal', label: 'Fixo mensal', unidade: 'mes' },
  { value: 'adicional', label: 'Adicional / avulso', unidade: 'un' },
];
export async function listPriceItems(escopo: string, escopoId: string): Promise<PriceItem[]> {
  const { data, error } = await db.from('lab_contract_price_items').select('id, escopo, escopo_id, item_code, descricao, unidade, preco_unitario, ativo, tipo_cobranca').eq('escopo', escopo).eq('escopo_id', escopoId).is('deleted_at', null).order('item_code');
  if (error) throw new Error(error.message);
  return (data ?? []) as PriceItem[];
}

export async function upsertPriceItem(item: PriceItem): Promise<void> {
  const { error } = await db.rpc('upsert_contract_price_item', { p_payload: item });
  if (error) throw new Error(error.message);
}
