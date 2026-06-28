import { supabase } from '../supabase';
import { assertUploadSize } from '../upload';

// Motor de NC (engine configuravel re-derivado do GEOMAT). non_conformities = cabeca;
// nc_actions = tratativa dirigida por nc_action_templates + nc_action_transitions.
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }> };

export type NcRow = {
  id: string; numero: string; work_id: string | null; obra: string; classification_code: string | null; classification_nome: string | null;
  tipo_code: string | null; tipo_nome: string | null; origem: string; severidade: string; status: string; data_abertura: string;
  descricao: string | null; entidade_origem: string | null; created_at: string;
};
export type NcAcao = { id: string; descricao: string | null; situacao_codigo: string | null; action_template_id: string | null; template_nome: string; campos_dinamicos: Record<string, unknown>; executada_em: string | null; created_at: string };
export type Template = { id: string; nome: string; classification_code: string; situacao_destino: string | null; conclui_nc: boolean; campos: any[]; mensagem: string | null };
export type Transition = { from_action_id: string; to_action_id: string };

export async function listSituacoes(): Promise<Record<string, string>> {
  const { data, error } = await db.from('nc_situations').select('codigo, nome');
  if (error) throw new Error(error.message);
  const m: Record<string, string> = {}; for (const r of (data ?? []) as any[]) m[String(r.codigo)] = String(r.nome); return m;
}
export async function listClassificacoes(): Promise<{ codigo: string; nome: string }[]> {
  const { data, error } = await db.from('nc_classifications').select('codigo, nome').eq('ativa', true).order('ordem');
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ codigo: String(r.codigo), nome: String(r.nome) }));
}
export async function listTipos(): Promise<{ codigo: string; nome: string; classification_code: string }[]> {
  const { data, error } = await db.from('nc_types').select('codigo, nome, classification_code').eq('ativo', true).order('codigo');
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ codigo: String(r.codigo), nome: String(r.nome), classification_code: String(r.classification_code) }));
}
export async function listObrasRef(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await db.from('client_works').select('id, nome').is('deleted_at', null).order('nome');
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ id: String(r.id), nome: String(r.nome ?? r.id) }));
}

export async function listNcs(f: { status?: string; work_id?: string; page?: number; pageSize?: number }, tenantId?: string): Promise<{ rows: NcRow[]; total: number }> {
  const pageSize = f.pageSize ?? 25;
  const page = Math.max(0, f.page ?? 0);
  let q = db.from('non_conformities')
    .select('id,numero,work_id,classification_code,classification_nome,tipo_code,tipo_nome,origem,severidade,status,data_abertura,descricao,entidade_origem,created_at, client_works(nome)', { count: 'exact' })
    .is('deleted_at', null).order('created_at', { ascending: false });
  if (tenantId) q = q.eq('tenant_id', tenantId); // ativa o índice por tenant; RLS segue garantindo o isolamento
  if (f.status) q = q.eq('status', f.status);
  if (f.work_id) q = q.eq('work_id', f.work_id);
  const { data, error, count } = await q.range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as any[]).map((r) => ({
    id: String(r.id), numero: String(r.numero), work_id: r.work_id ?? null, obra: String(r.client_works?.nome ?? ''),
    classification_code: r.classification_code ?? null, classification_nome: r.classification_nome ?? null,
    tipo_code: r.tipo_code ?? null, tipo_nome: r.tipo_nome ?? null, origem: String(r.origem), severidade: String(r.severidade),
    status: String(r.status), data_abertura: String(r.data_abertura ?? '').slice(0, 10), descricao: r.descricao ?? null,
    entidade_origem: r.entidade_origem ?? null, created_at: String(r.created_at),
  }));
  return { rows, total: count ?? rows.length };
}

export async function listAcoes(ncId: string): Promise<NcAcao[]> {
  const { data, error } = await db.from('nc_actions')
    .select('id, descricao, situacao_codigo, action_template_id, campos_dinamicos, executada_em, created_at, nc_action_templates(nome)')
    .eq('nc_id', ncId).is('deleted_at', null).order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    id: String(r.id), descricao: r.descricao ?? null, situacao_codigo: r.situacao_codigo ?? null, action_template_id: r.action_template_id ?? null,
    template_nome: String(r.nc_action_templates?.nome ?? '—'), campos_dinamicos: (r.campos_dinamicos ?? {}) as Record<string, unknown>,
    executada_em: r.executada_em ?? null, created_at: String(r.created_at),
  }));
}

export async function listTemplates(classificationCode: string): Promise<Template[]> {
  const { data, error } = await db.from('nc_action_templates')
    .select('id, nome, classification_code, situacao_destino, conclui_nc, campos, mensagem, permissao_requerida')
    .eq('classification_code', classificationCode).eq('ativo', true).is('deleted_at', null).order('nome');
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).filter((r) => r.permissao_requerida !== 'sistema').map((r) => ({
    id: String(r.id), nome: String(r.nome), classification_code: String(r.classification_code), situacao_destino: r.situacao_destino ?? null,
    conclui_nc: !!r.conclui_nc, campos: Array.isArray(r.campos) ? r.campos : [], mensagem: r.mensagem ?? null,
  }));
}
export async function listTransitions(): Promise<Transition[]> {
  const { data, error } = await db.from('nc_action_transitions').select('from_action_id, to_action_id').eq('ativo', true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ from_action_id: String(r.from_action_id), to_action_id: String(r.to_action_id) }));
}

export async function abrirNcManual(tenantId: string, v: { work_id: string; tipo_code: string; descricao: string; severidade: string }): Promise<void> {
  const { error } = await db.rpc('abrir_nc_manual', { p_tenant_id: tenantId, p_work_id: v.work_id, p_tipo_code: v.tipo_code, p_descricao: v.descricao, p_severidade: v.severidade });
  if (error) throw new Error(error.message);
}
export async function registrarAcao(payload: { nc_id: string; action_template_id: string; descricao?: string; campos_dinamicos?: Record<string, unknown> }): Promise<Record<string, unknown>> {
  const { data, error } = await db.rpc('registrar_acao_nc', { payload });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
}
export async function excluirNc(id: string): Promise<void> {
  const { error } = await db.from('non_conformities').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function uploadAnexo(tenantId: string, ncId: string, file: File): Promise<{ path: string; nome: string }> {
  assertUploadSize(file);
  const safe = file.name.replace(/[^\w.-]+/g, '_');
  const path = tenantId + '/' + ncId + '/' + Date.now() + '-' + safe;
  const { error } = await supabase.storage.from('anexos').upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return { path, nome: file.name };
}
export async function signedAnexo(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('anexos').createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
