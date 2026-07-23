import { supabase } from '../supabase';

// [W2] Motor de aprovação genérico — camada de API (RPCs wf_* da Leva W1 + tabelas de config).
// Mesmo padrão untyped-wrapper do delegacoes.ts (RPCs novas ainda fora do database.types.ts).
const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type FlowKey =
  | 'laudo_insatisfatorio' | 'laudo_inconsistente' | 'medicao_interna'
  | 'premiacao' | 'portal_solicitacao' | 'documento'
  | 'resultado_retificacao' | 'laudo_reemissao' | 'cp_descarte';

export type FlowDef = { key: FlowKey; label: string; entity: string; permission: string; hint: string };

// Espelha wf_flow_entity_type/permission/label do banco (Leva W1). Ordem = exibição.
export const FLOW_CATALOG: FlowDef[] = [
  { key: 'laudo_insatisfatorio', label: 'Liberação de laudo insatisfatório', entity: 'lab_report', permission: 'laudo.aprovar', hint: 'Exemplar abaixo do fck na idade de controle bloqueia a emissão (botão Emitir e link de aprovação) até o fluxo aprovar.' },
  { key: 'laudo_inconsistente', label: 'Liberação de laudo inconsistente', entity: 'lab_report', permission: 'laudo.aprovar', hint: 'CP de idade menor com resultado maior que o de idade maior (mesma amostra/NF) bloqueia a emissão. Tolerância configurável abaixo.' },
  { key: 'medicao_interna', label: 'Aprovação de medição', entity: 'medicao', permission: 'medicao.decidir', hint: 'Fechar a medição inicia a aprovação; enviar ao cliente e faturar ficam bloqueados até aprovar. Devolver reabre a medição.' },
  { key: 'premiacao', label: 'Aprovação de premiação', entity: 'bonus_cycle', permission: 'premiacao.gerenciar', hint: 'Ciclo calculado vai por "Enviar para aprovação"; o fluxo efetiva o ciclo ao aprovar. Com o gatilho ligado, aprovar direto é bloqueado.' },
  { key: 'portal_solicitacao', label: 'Solicitação do portal do cliente', entity: 'portal_correcao_pedido', permission: 'portal.gerenciar', hint: 'Pedido criado no portal entra em aprovação interna; a equipe só decide/aplica após o fluxo aprovar (reprovar rejeita o pedido).' },
  { key: 'documento', label: 'Aprovação documental', entity: 'lab_document', permission: 'docgate.gerenciar', hint: 'Documento em análise entra no fluxo; aprovar/recusar direto fica bloqueado — o desfecho do fluxo aplica o status.' },
  { key: 'resultado_retificacao', label: 'Retificação de resultado', entity: 'material_test', permission: 'resultado.aprovar', hint: 'Editar resultado já lançado exige aprovação de segunda pessoa (gate entra na Leva W5).' },
  { key: 'laudo_reemissao', label: 'Reemissão de laudo', entity: 'lab_report', permission: 'laudo.aprovar', hint: 'Reemitir revisão de laudo já enviado ao cliente exige aprovação (gate entra na Leva W5).' },
  { key: 'cp_descarte', label: 'Descarte de corpos de prova', entity: 'cp_descarte_lote', permission: 'nc.gerenciar', hint: 'Lote de descarte com CP pendente exige aprovação do gestor (gate entra na Leva W5).' },
];

export const WORKFLOW_ROLES: { value: string; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gestor_qualidade', label: 'Gestor da Qualidade' },
  { value: 'laboratorista', label: 'Laboratorista' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'operador_campo', label: 'Operador de campo' },
];
export const WORKFLOW_ACTIONS = ['aprovar', 'devolver', 'reprovar'] as const;

export function flowLabel(flowKey: string): string {
  return FLOW_CATALOG.find((f) => f.key === flowKey)?.label ?? flowKey;
}

export type WorkflowStepDef = {
  id?: string; ordem: number; nome: string; role_required: string;
  aprovador_especifico_id: string | null; sla_hours: number; obrigatoria: boolean;
  instrucoes: string | null; actions: string[];
};
export type WorkflowTemplate = {
  id: string; flow_key: string; nome: string; descricao: string | null;
  active: boolean; is_default: boolean; client_id: string | null; work_id: string | null;
  client_nome: string | null; work_nome: string | null; steps: WorkflowStepDef[];
};

function mapTemplate(value: unknown): WorkflowTemplate {
  const r = value as Record<string, unknown>;
  const cli = r.lab_clients as Record<string, unknown> | null;
  const wrk = r.client_works as Record<string, unknown> | null;
  const steps = (((r.workflow_steps as unknown[]) ?? []) as Record<string, unknown>[])
    .filter((s) => s.deleted_at == null)
    .map((s) => ({
      id: String(s.id ?? ''), ordem: Number(s.ordem ?? 0), nome: String(s.nome ?? ''),
      role_required: String(s.role_required ?? ''),
      aprovador_especifico_id: s.aprovador_especifico_id == null ? null : String(s.aprovador_especifico_id),
      sla_hours: Number(s.sla_hours ?? 48), obrigatoria: s.obrigatoria !== false,
      instrucoes: s.instrucoes == null ? null : String(s.instrucoes),
      actions: Array.isArray(s.actions) ? (s.actions as string[]) : ['aprovar', 'devolver', 'reprovar'],
    }))
    .sort((a, b) => a.ordem - b.ordem);
  return {
    id: String(r.id ?? ''), flow_key: String(r.flow_key ?? ''), nome: String(r.nome ?? ''),
    descricao: r.descricao == null ? null : String(r.descricao),
    active: r.active === true, is_default: r.is_default === true,
    client_id: r.client_id == null ? null : String(r.client_id),
    work_id: r.work_id == null ? null : String(r.work_id),
    client_nome: cli == null ? null : String(cli.nome_fantasia || cli.razao_social || ''),
    work_nome: wrk == null ? null : String(wrk.nome || ''),
    steps,
  };
}

export async function listWorkflowTemplates(flowKey: string): Promise<WorkflowTemplate[]> {
  const { data, error } = await db.from('workflow_templates')
    .select('*, workflow_steps(*), lab_clients(razao_social, nome_fantasia), client_works(nome)')
    .eq('flow_key', flowKey).is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).map(mapTemplate);
}

export type SaveTemplateInput = {
  id?: string | null; tenantId: string; flowKey: string; nome: string; descricao?: string | null;
  clientId?: string | null; workId?: string | null; active: boolean;
  steps: Array<Pick<WorkflowStepDef, 'nome' | 'role_required' | 'aprovador_especifico_id' | 'sla_hours' | 'obrigatoria' | 'instrucoes' | 'actions'>>;
};

export async function saveWorkflowTemplate(input: SaveTemplateInput): Promise<string> {
  const entity = FLOW_CATALOG.find((f) => f.key === input.flowKey)?.entity ?? 'lab_report';
  const row = {
    tenant_id: input.tenantId, flow_key: input.flowKey, entity_type: entity,
    nome: input.nome.trim(), descricao: input.descricao?.trim() || null,
    client_id: input.clientId || null, work_id: input.workId || null,
    active: input.active,
  };
  let templateId = input.id ?? null;
  if (templateId) {
    const { error } = await db.from('workflow_templates').update({ ...row, updated_at: new Date().toISOString() }).eq('id', templateId);
    if (error) throw new Error(error.message);
    const { error: e2 } = await db.from('workflow_steps').update({ deleted_at: new Date().toISOString() }).eq('template_id', templateId).is('deleted_at', null);
    if (e2) throw new Error(e2.message);
  } else {
    const { data, error } = await db.from('workflow_templates').insert({ ...row, is_default: false }).select('id').single();
    if (error) throw new Error(error.message);
    templateId = String((data as Record<string, unknown>).id);
  }
  const stepsRows = input.steps.map((s, i) => ({
    tenant_id: input.tenantId, template_id: templateId, ordem: i + 1,
    nome: s.nome.trim() || `Etapa ${i + 1}`, role_required: s.role_required,
    aprovador_especifico_id: s.aprovador_especifico_id || null,
    sla_hours: Math.max(1, Math.round(s.sla_hours || 48)), obrigatoria: s.obrigatoria !== false,
    instrucoes: s.instrucoes?.trim() || null,
    actions: s.actions.length ? s.actions : ['aprovar', 'devolver', 'reprovar'],
  }));
  if (stepsRows.length) {
    const { error } = await db.from('workflow_steps').insert(stepsRows);
    if (error) throw new Error(error.message);
  }
  return String(templateId);
}

export async function setTemplateActive(id: string, active: boolean): Promise<void> {
  const { error } = await db.from('workflow_templates').update({ active, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteWorkflowTemplate(id: string): Promise<void> {
  const { error } = await db.from('workflow_templates').update({ active: false, deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ---- Gatilhos por fluxo ----
export type WorkflowGatilho = { id: string; flow_key: string; enabled: boolean; params: Record<string, unknown> };

export async function listWorkflowGatilhos(): Promise<WorkflowGatilho[]> {
  const { data, error } = await db.from('workflow_gatilhos').select('id, flow_key, enabled, params').order('flow_key');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), flow_key: String(r.flow_key), enabled: r.enabled === true,
    params: (r.params as Record<string, unknown>) ?? {},
  }));
}

export async function saveWorkflowGatilho(id: string, enabled: boolean, params: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('workflow_gatilhos').update({ enabled, params, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ---- Clientes p/ escopo do template (obras vêm de listWorksForDelegation) ----
export type ScopeOption = { id: string; label: string };
export async function listClientsForScope(): Promise<ScopeOption[]> {
  const { data, error } = await db.from('lab_clients').select('id, razao_social, nome_fantasia').is('deleted_at', null).order('razao_social', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), label: String(r.nome_fantasia || r.razao_social || r.id) }));
}

// ---- Motor (RPCs da Leva W1) ----
export type WfStartResult = { started: boolean; reason?: string; instance_id?: string; etapas?: number };
export async function startWorkflow(flowKey: string, entityId: string, context: Record<string, unknown> = {}): Promise<WfStartResult> {
  const { data, error } = await db.rpc('wf_start', { p_flow_key: flowKey, p_entity_id: entityId, p_context: context, p_template_id: null });
  if (error) throw new Error(error.message);
  return (data ?? { started: false }) as WfStartResult;
}

export type WfDecideResult = { ok: boolean; instance_id: string; instance_status: string; etapa_decidida: number; via: string; proxima_etapa?: string };
export async function decideWorkflowStep(instanceId: string, acao: 'aprovar' | 'devolver' | 'reprovar', comentario?: string): Promise<WfDecideResult> {
  const { data, error } = await db.rpc('wf_decide', { p_instance_id: instanceId, p_acao: acao, p_comentario: comentario?.trim() || null, p_step_id: null });
  if (error) throw new Error(error.message);
  return data as WfDecideResult;
}

export async function cancelWorkflow(instanceId: string, motivo?: string): Promise<void> {
  const { error } = await db.rpc('wf_cancel', { p_instance_id: instanceId, p_motivo: motivo?.trim() || null });
  if (error) throw new Error(error.message);
}

export async function workflowGate(flowKey: string, entityId: string): Promise<string> {
  const { data, error } = await db.rpc('wf_gate', { p_flow_key: flowKey, p_entity_id: entityId });
  if (error) throw new Error(error.message);
  return String(data ?? 'nao_exigido');
}

export type PendingApproval = {
  instance_id: string; step_id: string; flow_key: string; flow_label: string;
  entity_type: string; entity_id: string; ref: string | null; context: Record<string, unknown>;
  etapa_nome: string; etapa_ordem: number; total_etapas: number;
  role_required: string; assigned_to: string | null; due_at: string | null;
  actions: string[]; instrucoes: string | null; started_at: string; started_by: string | null;
};

export async function listPendingForMe(): Promise<PendingApproval[]> {
  const { data, error } = await db.rpc('wf_pending_for_me');
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).map((v) => v as PendingApproval);
}

export async function pendingCount(): Promise<number> {
  const { data, error } = await db.rpc('wf_pending_count');
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

// ---- Instâncias por entidade (painel/timeline) ----
export type InstanceStep = {
  id: string; ordem: number; nome: string; role_required: string; status: string;
  assigned_to: string | null; due_at: string | null; decided_at: string | null;
  comment: string | null; instrucoes: string | null;
  decided_nome: string | null; via_delegacao: boolean;
};
export type WorkflowInstance = {
  id: string; flow_key: string; status: string; outcome: string | null;
  context: Record<string, unknown>; started_at: string; finished_at: string | null;
  finish_comment: string | null; steps: InstanceStep[];
};

export async function listInstancesForEntity(entityType: string, entityId: string): Promise<WorkflowInstance[]> {
  const { data, error } = await db.from('workflow_instances')
    .select('*, approval_steps(*, decided_member:members!approval_steps_decided_by_fkey(full_name))')
    .eq('entity_type', entityType).eq('entity_id', entityId).is('deleted_at', null)
    .order('started_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), flow_key: String(r.flow_key), status: String(r.status),
    outcome: r.outcome == null ? null : String(r.outcome),
    context: (r.context as Record<string, unknown>) ?? {},
    started_at: String(r.started_at ?? ''),
    finished_at: r.finished_at == null ? null : String(r.finished_at),
    finish_comment: r.finish_comment == null ? null : String(r.finish_comment),
    steps: (((r.approval_steps as unknown[]) ?? []) as Record<string, unknown>[]).map((s) => {
      const dm = s.decided_member as Record<string, unknown> | null;
      return {
        id: String(s.id), ordem: Number(s.ordem ?? 0), nome: String(s.nome ?? ''),
        role_required: String(s.role_required ?? ''), status: String(s.status ?? ''),
        assigned_to: s.assigned_to == null ? null : String(s.assigned_to),
        due_at: s.due_at == null ? null : String(s.due_at),
        decided_at: s.decided_at == null ? null : String(s.decided_at),
        comment: s.comment == null ? null : String(s.comment),
        instrucoes: s.instrucoes == null ? null : String(s.instrucoes),
        decided_nome: dm == null ? null : String(dm.full_name ?? ''),
        via_delegacao: s.decided_via_delegation != null,
      };
    }).sort((a, b) => a.ordem - b.ordem),
  }));
}

// ---- Histórico de decisões (tenant-scoped via RLS) ----
export type DecisionRow = {
  id: string; decided_at: string; status: string; etapa: string; ordem: number;
  decided_nome: string; comment: string | null; flow_key: string; ref: string | null; via_delegacao: boolean;
};
export async function listDecisionHistory(limit = 100): Promise<DecisionRow[]> {
  const { data, error } = await db.from('approval_steps')
    .select('id, ordem, nome, status, decided_at, comment, decided_via_delegation, decided_member:members!approval_steps_decided_by_fkey(full_name), workflow_instances!approval_steps_instance_id_fkey(flow_key, context)')
    .not('decided_at', 'is', null)
    .order('decided_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const dm = r.decided_member as Record<string, unknown> | null;
    const inst = r.workflow_instances as Record<string, unknown> | null;
    const ctx = (inst?.context as Record<string, unknown>) ?? {};
    return {
      id: String(r.id), decided_at: String(r.decided_at ?? ''), status: String(r.status ?? ''),
      etapa: String(r.nome ?? ''), ordem: Number(r.ordem ?? 0),
      decided_nome: dm == null ? '-' : String(dm.full_name ?? '-'),
      comment: r.comment == null ? null : String(r.comment),
      flow_key: inst == null ? '' : String(inst.flow_key ?? ''),
      ref: ctx.ref == null ? null : String(ctx.ref),
      via_delegacao: r.decided_via_delegation != null,
    };
  });
}

// [W3] entidades com instância de workflow ABERTA (badge nas listas de domínio)
export async function listOpenWorkflowEntities(entityType: string): Promise<Record<string, number>> {
  const { data, error } = await db.from('workflow_instances')
    .select('entity_id').eq('entity_type', entityType).eq('status', 'aberto').is('deleted_at', null);
  if (error) throw new Error(error.message);
  const map: Record<string, number> = {};
  for (const r of ((data ?? []) as Record<string, unknown>[])) {
    const k = String(r.entity_id);
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}
