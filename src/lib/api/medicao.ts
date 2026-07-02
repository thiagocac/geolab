import { supabase } from '../supabase';
import { env } from '../env';

const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type EscopoTipo = 'contrato' | 'cliente' | 'obra';
export type Opcao = { id: string; label: string; precos: Record<string, unknown> | null };
export type TestType = { id: string; nome: string; codigo: string | null };
export type MedicaoItem = { key: string; label: string; quantidade: number; preco_unit: number; subtotal: number };
export type Adicional = { descricao: string; valor: number };
export type Medicao = { id: string; escopo: string; competencia: string | null; periodo_inicio: string; periodo_fim: string; status: string; valor_total: number; created_at: string };

const tbl = (e: EscopoTipo) => e === 'contrato' ? 'lab_contracts' : e === 'cliente' ? 'lab_clients' : 'client_works';

export async function listEscopo(escopo: EscopoTipo): Promise<Opcao[]> {
  if (escopo === 'contrato') {
    const { data, error } = await db.from('lab_contracts').select('id, numero, descricao, precos, lab_clients(razao_social)').is('deleted_at', null).order('numero');
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: Record<string, any>) => ({ id: c.id, label: (c.numero || String(c.id).slice(0, 8)) + ' - ' + (c.lab_clients?.razao_social ?? ''), precos: c.precos }));
  }
  if (escopo === 'cliente') {
    const { data, error } = await db.from('lab_clients').select('id, razao_social, nome_fantasia, precos').is('deleted_at', null).order('razao_social');
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: Record<string, any>) => ({ id: c.id, label: c.razao_social || c.nome_fantasia || String(c.id).slice(0, 8), precos: c.precos }));
  }
  const { data, error } = await db.from('client_works').select('id, nome, codigo, precos, lab_clients(razao_social)').is('deleted_at', null).order('nome');
  if (error) throw new Error(error.message);
  return (data ?? []).map((w: Record<string, any>) => ({ id: w.id, label: (w.nome || w.codigo || String(w.id).slice(0, 8)) + ' - ' + (w.lab_clients?.razao_social ?? ''), precos: w.precos }));
}

export async function listTestTypes(): Promise<TestType[]> {
  const { data, error } = await db.from('material_test_types').select('id, nome, codigo').order('nome');
  if (error) throw new Error(error.message);
  return (data ?? []) as TestType[];
}

export async function salvarPrecos(escopo: EscopoTipo, id: string, precos: Record<string, unknown>): Promise<void> {
  const { error } = await db.from(tbl(escopo)).update({ precos }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function computarMedicao(escopo: EscopoTipo, id: string, inicio: string, fim: string, precos: Record<string, unknown>): Promise<{ itens: MedicaoItem[]; valorItens: number; clientId: string | null }> {
  const { data, error } = await db.rpc('computar_medicao', { p_escopo: escopo, p_escopo_id: id, p_inicio: inicio, p_fim: fim, p_precos: precos });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  return { itens: (r.itens ?? []) as MedicaoItem[], valorItens: Number(r.valor_itens ?? 0), clientId: (r.client_id as string) ?? null };
}

export async function computarMedicaoAuto(escopo: EscopoTipo, id: string, inicio: string, fim: string): Promise<{ itens: MedicaoItem[]; valorItens: number; clientId: string | null }> {
  const { data, error } = await db.rpc('gerar_medicao_auto', { p_escopo: escopo, p_escopo_id: id, p_inicio: inicio, p_fim: fim });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  return { itens: (r.itens ?? []) as MedicaoItem[], valorItens: Number(r.valor_itens ?? 0), clientId: (r.client_id as string) ?? null };
}

export async function salvarMedicao(tenantId: string, payload: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await db.from('medicoes').insert({ tenant_id: tenantId, ...payload }).select('id').maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.id as string) ?? null;
}

export async function listMedicoes(escopoId?: string): Promise<Medicao[]> {
  let q = db.from('medicoes').select('id, escopo, competencia, periodo_inicio, periodo_fim, status, valor_total, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(50);
  if (escopoId) q = q.eq('escopo_id', escopoId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Medicao[];
}

export async function pdfMedicaoUrl(medicaoId: string): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/generate-medicao-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token }, body: JSON.stringify({ medicao_id: medicaoId }) });
  if (!resp.ok) { const t = await resp.text(); throw new Error('Falha ao gerar PDF: ' + t.slice(0, 160)); }
  return URL.createObjectURL(await resp.blob());
}
