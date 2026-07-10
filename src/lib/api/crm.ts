import { supabase } from '../supabase';

type Json = Record<string, unknown>;
const rpcClient = supabase as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const text = (v: unknown) => String(v ?? ''); const nullable = (v: unknown): string | null => v == null || v === '' ? null : String(v); const num = (v: unknown) => Number(v) || 0;
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> { const { data, error } = await rpcClient.rpc(name, args); if (error) throw new Error(error.message); return data as T; }

export type CrmStage = { id: string; key: string; nome: string; ordem: number; probability: number; color: string | null; won: boolean; lost: boolean };
export type CrmLead = { id: string; pipeline_id: string; stage_id: string; title: string; company_name: string | null; contact_name: string | null; email: string | null; phone: string | null; source: string | null; expected_value: number; probability: number; client_id: string | null; work_id: string | null; owner_member_id: string | null; next_action_at: string | null; last_contact_at: string | null; lost_reason: string | null; metadata: Json; created_at: string; updated_at: string };
export type CrmActivity = { id: string; lead_id: string; activity_type: string; subject: string; detail: string | null; due_at: string | null; completed_at: string | null; owner_member_id: string | null; created_at: string };
export type CrmSnapshot = { pipeline_id: string; pipelines: Array<{ id: string; nome: string; padrao: boolean }>; stages: CrmStage[]; leads: CrmLead[]; activities: CrmActivity[]; kpis: { open: number; pipeline_value: number; weighted_value: number; overdue_actions: number } };

export async function getCrmSnapshot(pipelineId?: string): Promise<CrmSnapshot> {
  const raw = await rpc<Json>('crm_snapshot', { p_pipeline_id: pipelineId || null }); const k = (raw.kpis ?? {}) as Json;
  return {
    pipeline_id: text(raw.pipeline_id), pipelines: ((raw.pipelines ?? []) as Json[]).map((r) => ({ id: text(r.id), nome: text(r.nome), padrao: r.padrao === true })),
    stages: ((raw.stages ?? []) as Json[]).map((r) => ({ id: text(r.id), key: text(r.key), nome: text(r.nome), ordem: num(r.ordem), probability: num(r.probability), color: nullable(r.color), won: r.won === true, lost: r.lost === true })),
    leads: ((raw.leads ?? []) as Json[]).map((r) => ({ id: text(r.id), pipeline_id: text(r.pipeline_id), stage_id: text(r.stage_id), title: text(r.title), company_name: nullable(r.company_name), contact_name: nullable(r.contact_name), email: nullable(r.email), phone: nullable(r.phone), source: nullable(r.source), expected_value: num(r.expected_value), probability: num(r.probability), client_id: nullable(r.client_id), work_id: nullable(r.work_id), owner_member_id: nullable(r.owner_member_id), next_action_at: nullable(r.next_action_at), last_contact_at: nullable(r.last_contact_at), lost_reason: nullable(r.lost_reason), metadata: (r.metadata ?? {}) as Json, created_at: text(r.created_at), updated_at: text(r.updated_at) })),
    activities: ((raw.activities ?? []) as Json[]).map((r) => ({ id: text(r.id), lead_id: text(r.lead_id), activity_type: text(r.activity_type), subject: text(r.subject), detail: nullable(r.detail), due_at: nullable(r.due_at), completed_at: nullable(r.completed_at), owner_member_id: nullable(r.owner_member_id), created_at: text(r.created_at) })),
    kpis: { open: num(k.open), pipeline_value: num(k.pipeline_value), weighted_value: num(k.weighted_value), overdue_actions: num(k.overdue_actions) },
  };
}
export async function saveCrmLead(payload: Json): Promise<string> { return String(await rpc('save_crm_lead', { p_payload: payload })); }
export async function moveCrmLead(leadId: string, stageId: string, reason?: string): Promise<string> { return String(await rpc('move_crm_lead', { p_lead_id: leadId, p_stage_id: stageId, p_reason: reason || null })); }
export async function saveCrmActivity(payload: Json): Promise<string> { return String(await rpc('save_crm_activity', { p_payload: payload })); }
export async function convertCrmLeadToProposal(leadId: string, validity?: string): Promise<string> { return String(await rpc('convert_crm_lead_to_proposal', { p_lead_id: leadId, p_validade: validity || null })); }
