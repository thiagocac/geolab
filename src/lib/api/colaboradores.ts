import { supabase } from '../supabase';
import { assertUploadSize } from '../upload';

// Colaboradores + certificações (1-N). Validade alimenta o indicador visual e o scan
// notify_scan_certificacao (migration 126). funcoes/ativo alimentam os seletores de
// moldador (programação/concretagem) e operador (rompimentos).
const db = supabase as unknown as { from: (t: string) => any };

export const FUNCOES = ['Moldador', 'Laboratorista', 'Técnico', 'RT'] as const;

export type Cert = { id: string; tipo: string; numero: string | null; validade: string | null; anexo_path: string | null };
export type ColaboradorRow = { id: string; nome: string; documento: string | null; registro_profissional: string | null; funcoes: string[]; ativo: boolean; member_id: string | null; certs: Cert[] };
export type MemberLink = { id: string; full_name: string; email: string; colaborador_id: string | null };
export type ColaboradorLink = { id: string; nome: string; member_id: string | null };
export type ColaboradorRef = { id: string; nome: string; funcoes: string[]; ativo: boolean };
export type UsoColaborador = { concretagens: number; rompimentos: number };

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export async function listColaboradores(): Promise<ColaboradorRow[]> {
  const { data, error } = await db.from('colaboradores')
    .select('id, nome, documento, registro_profissional, funcoes, ativo, member_id, colaborador_certificacoes(id, tipo, numero, validade, anexo_path, deleted_at)')
    .is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({
    id: String(r.id), nome: r.nome, documento: r.documento ?? null, registro_profissional: r.registro_profissional ?? null,
    funcoes: Array.isArray(r.funcoes) ? r.funcoes.map(String) : [], ativo: r.ativo !== false, member_id: r.member_id ? String(r.member_id) : null,
    certs: ((r.colaborador_certificacoes ?? []) as Record<string, any>[]).filter((c) => !c.deleted_at).map((c) => ({ id: String(c.id), tipo: c.tipo, numero: c.numero ?? null, validade: c.validade ?? null, anexo_path: c.anexo_path ?? null })),
  }));
}

// Fonte única (leve) para os dropdowns de moldador/operador. Cacheada em ['colaboradores-ref'].
export async function listColaboradoresRef(): Promise<ColaboradorRef[]> {
  const { data, error } = await db.from('colaboradores')
    .select('id, nome, funcoes, ativo').is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ id: String(r.id), nome: String(r.nome ?? ''), funcoes: Array.isArray(r.funcoes) ? r.funcoes.map(String) : [], ativo: r.ativo !== false }));
}

// Filtra por função + ativo, com fallback permissivo: enquanto ninguém do lab estiver
// marcado com a função, o seletor mostra todos os ativos (não trava a transição).
export function filtrarPorFuncao(refs: ColaboradorRef[], funcao: string): ColaboradorRef[] {
  const ativos = refs.filter((r) => r.ativo);
  const alvo = norm(funcao);
  const comFuncao = ativos.filter((r) => r.funcoes.some((f) => norm(f) === alvo));
  return comFuncao.length > 0 ? comFuncao : ativos;
}

export async function saveColaborador(tenantId: string, id: string | null, values: Record<string, unknown>): Promise<string> {
  if (id) { const { error } = await db.from('colaboradores').update(values).eq('id', id); if (error) throw new Error(error.message); return id; }
  const { data, error } = await db.from('colaboradores').insert({ ...values, tenant_id: tenantId }).select('id').single();
  if (error) throw new Error(error.message); return String(data.id);
}
export async function softDeleteColaborador(id: string): Promise<void> {
  const { error } = await db.from('colaboradores').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// Guarda de exclusão: quantos registros já referenciam o colaborador (best-effort — null se falhar).
export async function contarUsoColaborador(id: string): Promise<UsoColaborador | null> {
  try {
    const [conc, romp] = await Promise.all([
      db.from('concretagens').select('id', { count: 'exact', head: true }).eq('moldador_id', id).is('deleted_at', null),
      db.from('material_tests').select('id', { count: 'exact', head: true }).eq('operador_id', id).is('deleted_at', null),
    ]);
    if (conc.error || romp.error) return null;
    return { concretagens: conc.count ?? 0, rompimentos: romp.count ?? 0 };
  } catch { return null; }
}

export async function addCert(tenantId: string, colaboradorId: string, v: { tipo: string; numero?: string; validade?: string; anexoPath?: string }): Promise<void> {
  const { error } = await db.from('colaborador_certificacoes').insert({ tenant_id: tenantId, colaborador_id: colaboradorId, tipo: v.tipo, numero: v.numero || null, validade: v.validade || null, anexo_path: v.anexoPath || null });
  if (error) throw new Error(error.message);
}
export async function softDeleteCert(id: string): Promise<void> {
  const { error } = await db.from('colaborador_certificacoes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// Anexo da certificação (PDF/scan) no bucket `anexos`, namespaced por colaborador —
// mesmo contrato de RLS do NC (1º segmento do path = tenant_id).
export async function uploadCertAnexo(tenantId: string, colaboradorId: string, file: File): Promise<string> {
  assertUploadSize(file);
  const safe = file.name.replace(/[^\w.-]+/g, '_');
  const path = tenantId + '/colaboradores/' + colaboradorId + '/' + Date.now() + '-' + safe;
  const { error } = await supabase.storage.from('anexos').upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return path;
}
export async function signedCertAnexo(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('anexos').createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// --- Vínculo colaborador ↔ usuário (member). 1:1 garantido por índice único parcial. ---
export async function listMembersForLink(): Promise<MemberLink[]> {
  const [mRes, cRes] = await Promise.all([
    db.from('members').select('id, full_name, email, active').is('deleted_at', null).order('full_name', { ascending: true }),
    db.from('colaboradores').select('id, member_id').is('deleted_at', null),
  ]);
  if (mRes.error) throw new Error(mRes.error.message);
  if (cRes.error) throw new Error(cRes.error.message);
  const byMember = new Map<string, string>();
  for (const r of (cRes.data ?? []) as Record<string, any>[]) if (r.member_id) byMember.set(String(r.member_id), String(r.id));
  return ((mRes.data ?? []) as Record<string, any>[])
    .filter((r) => r.active !== false)
    .map((r) => ({ id: String(r.id), full_name: String(r.full_name ?? ''), email: String(r.email ?? ''), colaborador_id: byMember.get(String(r.id)) ?? null }));
}

export async function listColaboradoresForLink(): Promise<ColaboradorLink[]> {
  const { data, error } = await db.from('colaboradores').select('id, nome, member_id').is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, any>[]).map((r) => ({ id: String(r.id), nome: String(r.nome ?? ''), member_id: r.member_id ? String(r.member_id) : null }));
}

// Define (ou limpa) o member vinculado a um colaborador, preservando 1:1: libera qualquer
// outro colaborador que ainda aponte para este member antes de gravar.
export async function setColaboradorMember(colaboradorId: string, memberId: string | null): Promise<void> {
  if (memberId) {
    const { error: e0 } = await db.from('colaboradores').update({ member_id: null }).eq('member_id', memberId).neq('id', colaboradorId).is('deleted_at', null);
    if (e0) throw new Error(e0.message);
  }
  const { error } = await db.from('colaboradores').update({ member_id: memberId }).eq('id', colaboradorId);
  if (error) throw new Error(error.message);
}
