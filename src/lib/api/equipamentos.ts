import { supabase } from '../supabase';
import { assertUploadSize } from '../upload';

// Equipamentos + calibração. Espelha o padrão de colaboradores (v146): ativo/anexo já existiam
// no schema; apelido é a única coluna nova (migration 131) para distinguir prensas idênticas.
const db = supabase as unknown as { from: (t: string) => any };

export const TIPOS_EQUIP = [
  { value: 'prensa', label: 'Prensa' },
  { value: 'balanca', label: 'Balança' },
  { value: 'molde', label: 'Molde' },
  { value: 'paquimetro', label: 'Paquímetro' },
  { value: 'outro', label: 'Outro' },
] as const;

export type EquipamentoRow = {
  id: string; tipo: string; apelido: string | null; marca_modelo: string | null; numero_serie: string | null;
  capacidade_kn: number | null; classe: string | null; numero_certificado: string | null;
  data_calibracao: string | null; validade_calibracao: string | null; lab_calibrador: string | null;
  incerteza_mpa: number | null; anexo_certificado_path: string | null; observacao: string | null; ativo: boolean;
};
export type EquipamentoRef = { id: string; tipo: string; apelido: string | null; marca_modelo: string | null; validade_calibracao: string | null; incerteza_mpa: number | null; ativo: boolean };
export type UsoEquipamento = { rompimentos: number };

const SEL = 'id, tipo, apelido, marca_modelo, numero_serie, capacidade_kn, classe, numero_certificado, data_calibracao, validade_calibracao, lab_calibrador, incerteza_mpa, anexo_certificado_path, observacao, ativo';

export function rotuloEquip(e: { apelido?: string | null; marca_modelo?: string | null }): string {
  return (e.apelido || e.marca_modelo || '(sem nome)').trim();
}

export async function listEquipamentos(): Promise<EquipamentoRow[]> {
  const { data, error } = await db.from('equipamentos').select(SEL).is('deleted_at', null).order('tipo', { ascending: true }).order('apelido', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({
    id: String(r.id), tipo: String(r.tipo ?? 'outro'), apelido: r.apelido ?? null, marca_modelo: r.marca_modelo ?? null, numero_serie: r.numero_serie ?? null,
    capacidade_kn: r.capacidade_kn ?? null, classe: r.classe ?? null, numero_certificado: r.numero_certificado ?? null,
    data_calibracao: r.data_calibracao ?? null, validade_calibracao: r.validade_calibracao ?? null, lab_calibrador: r.lab_calibrador ?? null,
    incerteza_mpa: r.incerteza_mpa ?? null, anexo_certificado_path: r.anexo_certificado_path ?? null, observacao: r.observacao ?? null, ativo: r.ativo !== false,
  }));
}

// Fonte leve para os seletores de prensa (Pacote 2). Cacheada em ['equipamentos-ref'].
export async function listEquipamentosRef(): Promise<EquipamentoRef[]> {
  const { data, error } = await db.from('equipamentos').select('id, tipo, apelido, marca_modelo, validade_calibracao, incerteza_mpa, ativo').is('deleted_at', null).order('apelido', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ id: String(r.id), tipo: String(r.tipo ?? 'outro'), apelido: r.apelido ?? null, marca_modelo: r.marca_modelo ?? null, validade_calibracao: r.validade_calibracao ?? null, incerteza_mpa: r.incerteza_mpa ?? null, ativo: r.ativo !== false }));
}

export async function saveEquipamento(tenantId: string, id: string | null, values: Record<string, unknown>): Promise<string> {
  if (id) { const { error } = await db.from('equipamentos').update(values).eq('id', id); if (error) throw new Error(error.message); return id; }
  const { data, error } = await db.from('equipamentos').insert({ ...values, tenant_id: tenantId }).select('id').single();
  if (error) throw new Error(error.message); return String(data.id);
}
export async function softDeleteEquipamento(id: string): Promise<void> {
  const { error } = await db.from('equipamentos').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// Guarda de exclusão: quantos rompimentos já referenciam o equipamento (best-effort — null se falhar).
export async function contarUsoEquipamento(id: string): Promise<UsoEquipamento | null> {
  try {
    const { count, error } = await db.from('material_tests').select('id', { count: 'exact', head: true }).eq('equipamento_id', id).is('deleted_at', null);
    if (error) return null;
    return { rompimentos: count ?? 0 };
  } catch { return null; }
}

// Anexo do certificado de calibração (PDF/scan) no bucket `anexos`, namespaced por equipamento —
// mesmo contrato de RLS do NC/colaboradores (1º segmento do path = tenant_id).
export async function uploadCertEquipAnexo(tenantId: string, equipamentoId: string, file: File): Promise<string> {
  assertUploadSize(file);
  const safe = file.name.replace(/[^\w.-]+/g, '_');
  const path = tenantId + '/equipamentos/' + equipamentoId + '/' + Date.now() + '-' + safe;
  const { error } = await supabase.storage.from('anexos').upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return path;
}
export async function signedCertEquipAnexo(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('anexos').createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// ── Alocação prensa↔obra (migration 132) ──────────────────────────────────────
// Espelha get/setMemberObras. Semântica soft: default e eixo de agenda, não trava o seletor.
const dbRpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export async function getEquipamentoObras(equipamentoId: string): Promise<string[]> {
  const { data, error } = await db.from('equipamento_obras').select('work_id').eq('equipamento_id', equipamentoId).is('deleted_at', null);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => String(r.work_id));
}
export async function setEquipamentoObras(equipamentoId: string, workIds: string[]): Promise<void> {
  const { error } = await dbRpc('set_equipamento_obras', { p_equipamento_id: equipamentoId, p_work_ids: workIds });
  if (error) throw new Error(error.message);
}

// Mapa work_id -> [equipamento_id] de todas as alocações vivas do tenant (base da agenda por prensa).
// Um CP pendente ainda não tem prensa gravada; a prensa "prevista" vem da alocação da obra.
export type AlocacaoMap = Map<string, string[]>;
export async function mapAlocacaoObras(): Promise<AlocacaoMap> {
  const { data, error } = await db.from('equipamento_obras').select('work_id, equipamento_id').is('deleted_at', null);
  if (error) throw new Error(error.message);
  const m: AlocacaoMap = new Map();
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const w = String(r.work_id), e = String(r.equipamento_id);
    const arr = m.get(w) ?? []; arr.push(e); m.set(w, arr);
  }
  return m;
}
