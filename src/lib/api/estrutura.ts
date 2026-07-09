import { supabase } from '../supabase';

// Estrutura por obra (opcional, estrutura_habilitada): grupos -> tipos -> pecas (units).
const db = supabase as unknown as { from: (t: string) => any };

export type Obra = { value: string; label: string };
export async function listObrasEstrutura(): Promise<Obra[]> {
  const { data, error } = await db.from('client_works').select('id, nome, codigo').eq('estrutura_habilitada', true).is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ value: String(r.id), label: (r.codigo ? r.codigo + ' - ' : '') + (r.nome ?? r.id) }));
}

export type Grupo = { id: string; codigo: string; nome: string; tipo_edificacao: string | null };
export type Tipo = { id: string; codigo: string; nome: string; etapa: string | null; volume_projeto_m3: number | null; operational_material_id: string | null };
export type Peca = { id: string; codigo: string; nome: string; etapa: string | null; volume_m3: number | null; unit_group_id: string | null; unit_type_id: string | null };

export async function listGrupos(workId: string): Promise<Grupo[]> {
  const { data, error } = await db.from('unit_groups').select('id, codigo, nome, tipo_edificacao').eq('work_id', workId).is('deleted_at', null).order('ordem', { ascending: true });
  if (error) throw new Error(error.message); return (data ?? []) as Grupo[];
}
export async function listTipos(workId: string): Promise<Tipo[]> {
  const { data, error } = await db.from('unit_types').select('id, codigo, nome, etapa, volume_projeto_m3, operational_material_id').eq('work_id', workId).is('deleted_at', null).order('codigo', { ascending: true });
  if (error) throw new Error(error.message); return (data ?? []) as Tipo[];
}
export async function listPecas(workId: string): Promise<Peca[]> {
  const { data, error } = await db.from('units').select('id, codigo, nome, etapa, volume_m3, unit_group_id, unit_type_id').eq('work_id', workId).is('deleted_at', null).order('ordem', { ascending: true });
  if (error) throw new Error(error.message); return (data ?? []) as Peca[];
}
export async function addEstrutura(table: string, tenantId: string, workId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await db.from(table).insert({ ...values, tenant_id: tenantId, work_id: workId });
  if (error) throw new Error(error.message);
}
export async function delEstrutura(table: string, id: string): Promise<void> {
  const { error } = await db.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// Peças de uma obra para o seletor na concretagem (label amigável) — repontado p/ work_structures (v204).
export async function listPecasObra(workId: string): Promise<{ id: string; label: string }[]> {
  const { data, error } = await db.from('work_structures').select('nome, pecas').eq('work_id', workId).is('deleted_at', null).order('ordem', { ascending: true });
  if (error) throw new Error(error.message);
  const out: { id: string; label: string }[] = [];
  for (const s of (data ?? []) as Record<string, any>[]) {
    const est = String(s.nome ?? '');
    for (const p of (Array.isArray(s.pecas) ? s.pecas : []) as Record<string, any>[]) out.push({ id: String(p.id), label: est + ' \u00b7 ' + String(p.nome ?? '') });
  }
  return out;
}
