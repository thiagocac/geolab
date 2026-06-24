import { supabase } from '../supabase';

// Configuracao do motor de NC: parametros de tolerancia (nc_parameters, lidos pelos gatilhos)
// e fluxo de tratativa (nc_action_templates + nc_action_transitions). RLS: parametros=writer; templates=admin.
const db = supabase as unknown as { from: (t: string) => any };

export type NcParams = { id: string | null; nome: string; validade_concreto_h: string; slump_tol_mm: string; flow_tol_mm: string; conclusao_auto_pct: string; acao_imediata_pct: string; tolerancia_lancamento_min: string };
export type TemplateFull = { id: string; nome: string; classification_code: string; situacao_destino: string | null; conclui_nc: boolean; ativo: boolean; mensagem: string | null; permite_multipla_acao: boolean; permissao_requerida: string | null };
export type Transition = { from_action_id: string; to_action_id: string };

const s = (v: unknown) => (v == null ? '' : String(v));
const num = (v: string) => (v.trim() === '' ? null : Number(v));

export async function getParametros(): Promise<NcParams> {
  const { data, error } = await db.from('nc_parameters')
    .select('id, nome, validade_concreto_h, slump_tol_mm, flow_tol_mm, conclusao_auto_pct, acao_imediata_pct, tolerancia_lancamento_min')
    .is('deleted_at', null).is('classification_code', null).order('created_at').limit(1);
  if (error) throw new Error(error.message);
  const r = ((data ?? []) as any[])[0];
  return r ? { id: String(r.id), nome: String(r.nome), validade_concreto_h: s(r.validade_concreto_h), slump_tol_mm: s(r.slump_tol_mm), flow_tol_mm: s(r.flow_tol_mm), conclusao_auto_pct: s(r.conclusao_auto_pct), acao_imediata_pct: s(r.acao_imediata_pct), tolerancia_lancamento_min: s(r.tolerancia_lancamento_min) }
    : { id: null, nome: 'Parametros gerais', validade_concreto_h: '', slump_tol_mm: '', flow_tol_mm: '', conclusao_auto_pct: '', acao_imediata_pct: '', tolerancia_lancamento_min: '' };
}

export async function salvarParametros(tenantId: string, p: NcParams): Promise<void> {
  const vals = { nome: p.nome || 'Parametros gerais', validade_concreto_h: num(p.validade_concreto_h), slump_tol_mm: num(p.slump_tol_mm), flow_tol_mm: num(p.flow_tol_mm), conclusao_auto_pct: num(p.conclusao_auto_pct), acao_imediata_pct: num(p.acao_imediata_pct), tolerancia_lancamento_min: num(p.tolerancia_lancamento_min) };
  if (p.id) { const { error } = await db.from('nc_parameters').update(vals).eq('id', p.id); if (error) throw new Error(error.message); }
  else { const { error } = await db.from('nc_parameters').insert({ ...vals, tenant_id: tenantId, material_kind: 'concreto' }); if (error) throw new Error(error.message); }
}

export async function listTemplatesFull(cls: string): Promise<TemplateFull[]> {
  const { data, error } = await db.from('nc_action_templates')
    .select('id, nome, classification_code, situacao_destino, conclui_nc, ativo, mensagem, permite_multipla_acao, permissao_requerida')
    .eq('classification_code', cls).is('deleted_at', null).order('nome');
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ id: String(r.id), nome: String(r.nome), classification_code: String(r.classification_code), situacao_destino: r.situacao_destino ?? null, conclui_nc: !!r.conclui_nc, ativo: !!r.ativo, mensagem: r.mensagem ?? null, permite_multipla_acao: !!r.permite_multipla_acao, permissao_requerida: r.permissao_requerida ?? null }));
}

export async function updateTemplate(id: string, v: { nome: string; mensagem: string | null; ativo: boolean; permite_multipla_acao: boolean }): Promise<void> {
  const { error } = await db.from('nc_action_templates').update({ nome: v.nome, mensagem: v.mensagem, ativo: v.ativo, permite_multipla_acao: v.permite_multipla_acao }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listTransitions(): Promise<Transition[]> {
  const { data, error } = await db.from('nc_action_transitions').select('from_action_id, to_action_id').eq('ativo', true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ from_action_id: String(r.from_action_id), to_action_id: String(r.to_action_id) }));
}
