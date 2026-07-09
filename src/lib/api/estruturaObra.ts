import { supabase } from '../supabase';

// Estrutura da obra simplificada (v204): 1 "Estrutura" (Bloco/Torre/Anexo) com Peças em jsonb.
// Substitui unit_groups/unit_types/units. RLS: is_tenant_member (leitura) / is_tenant_writer (escrita).
const db = supabase as unknown as { from: (t: string) => any };

export function novoId(): string {
  try { return crypto.randomUUID(); } catch { return 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
}

export type EstruturaPeca = { id: string; nome: string };
export type Estrutura = { id: string; work_id: string; nome: string; ordem: number; pecas: EstruturaPeca[] };

function normPecas(v: unknown): EstruturaPeca[] {
  if (!Array.isArray(v)) return [];
  return (v as Record<string, unknown>[])
    .map((p, i) => ({ id: String(p?.id ?? novoId()), nome: String(p?.nome ?? '').trim(), ordem: Number(p?.ordem ?? i) }))
    .filter((p) => p.nome)
    .sort((a, b) => a.ordem - b.ordem)
    .map((p) => ({ id: p.id, nome: p.nome }));
}

export type ObraRef = { value: string; label: string };
export async function listObras(): Promise<ObraRef[]> {
  const { data, error } = await db.from('client_works').select('id, nome, codigo').is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ value: String(r.id), label: (r.codigo ? r.codigo + ' - ' : '') + (r.nome ?? r.id) }));
}

export async function listEstruturas(workId: string): Promise<Estrutura[]> {
  const { data, error } = await db.from('work_structures').select('id, work_id, nome, ordem, pecas').eq('work_id', workId).is('deleted_at', null).order('ordem', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ id: String(r.id), work_id: String(r.work_id), nome: String(r.nome ?? ''), ordem: Number(r.ordem ?? 0), pecas: normPecas(r.pecas) }));
}

export async function salvarEstrutura(tenantId: string, workId: string, e: { id?: string; nome: string; ordem?: number; pecas: EstruturaPeca[] }): Promise<void> {
  const nome = e.nome.trim();
  if (!nome) throw new Error('Informe o nome da estrutura.');
  const pecas = e.pecas.map((p, i) => ({ id: p.id || novoId(), nome: p.nome.trim(), ordem: i })).filter((p) => p.nome);
  if (e.id) {
    const { error } = await db.from('work_structures').update({ nome, pecas }).eq('id', e.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('work_structures').insert({ tenant_id: tenantId, work_id: workId, nome, ordem: e.ordem ?? 0, pecas });
    if (error) throw new Error(error.message);
  }
}

export async function duplicarEstrutura(tenantId: string, workId: string, e: Estrutura): Promise<void> {
  const pecas = e.pecas.map((p, i) => ({ id: novoId(), nome: p.nome, ordem: i }));
  const { error } = await db.from('work_structures').insert({ tenant_id: tenantId, work_id: workId, nome: e.nome + ' (cópia)', ordem: (e.ordem ?? 0) + 1, pecas });
  if (error) throw new Error(error.message);
}

export async function removerEstrutura(id: string): Promise<void> {
  const { error } = await db.from('work_structures').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
