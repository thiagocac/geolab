import { supabase } from '../supabase';

// Financeiro: faturas derivadas de medicoes. emitir (RPC), baixar/cancelar (update; RLS is_tenant_writer inclui financeiro).
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }> };

export type FaturaRow = { id: string; numero: string; medicao_id: string | null; cliente: string; competencia: string | null; valor: number; status: string; data_emissao: string; data_vencimento: string | null; data_pagamento: string | null; forma_pagamento: string | null };
export type MedicaoFaturavel = { id: string; competencia: string | null; valor_total: number; cliente: string };

export async function listFaturas(status?: string, tenantId?: string): Promise<FaturaRow[]> {
  let q = db.from('faturas').select('id, numero, medicao_id, competencia, valor, status, data_emissao, data_vencimento, data_pagamento, forma_pagamento, lab_clients(razao_social)').is('deleted_at', null).order('created_at', { ascending: false });
  if (tenantId) q = q.eq('tenant_id', tenantId); // ativa o índice por tenant; RLS segue garantindo o isolamento
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    id: String(r.id), numero: String(r.numero), medicao_id: r.medicao_id ?? null, cliente: String(r.lab_clients?.razao_social ?? ''),
    competencia: r.competencia ?? null, valor: Number(r.valor) || 0, status: String(r.status),
    data_emissao: String(r.data_emissao ?? '').slice(0, 10), data_vencimento: r.data_vencimento ?? null, data_pagamento: r.data_pagamento ?? null, forma_pagamento: r.forma_pagamento ?? null,
  }));
}

export async function listMedicoesFaturaveis(): Promise<MedicaoFaturavel[]> {
  const { data: meds, error } = await db.from('medicoes').select('id, competencia, valor_total, client_id').eq('status', 'fechada').is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const { data: fats } = await db.from('faturas').select('medicao_id, status').is('deleted_at', null).neq('status', 'cancelada');
  const faturadas = new Set(((fats ?? []) as any[]).map((f) => String(f.medicao_id)));
  const cids = [...new Set(((meds ?? []) as any[]).map((m) => String(m.client_id)).filter(Boolean))];
  const nomes = new Map<string, string>();
  if (cids.length) { const { data: cs } = await db.from('lab_clients').select('id, razao_social').in('id', cids); for (const c of (cs ?? []) as any[]) nomes.set(String(c.id), String(c.razao_social ?? '')); }
  return ((meds ?? []) as any[]).filter((m) => !faturadas.has(String(m.id))).map((m) => ({ id: String(m.id), competencia: m.competencia ?? null, valor_total: Number(m.valor_total) || 0, cliente: nomes.get(String(m.client_id)) ?? '' }));
}

export async function emitirFatura(medicaoId: string, vencimento: string | null): Promise<void> {
  const { error } = await db.rpc('emitir_fatura', { p_medicao_id: medicaoId, p_vencimento: vencimento || null });
  if (error) throw new Error(error.message);
}
export async function baixarFatura(id: string, dataPagamento: string, forma: string | null): Promise<void> {
  const { error } = await db.from('faturas').update({ status: 'paga', data_pagamento: dataPagamento, forma_pagamento: forma || null }).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function cancelarFatura(id: string): Promise<void> {
  const { error } = await db.from('faturas').update({ status: 'cancelada' }).eq('id', id);
  if (error) throw new Error(error.message);
}
