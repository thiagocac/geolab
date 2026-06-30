import { supabase } from '../supabase';

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type MemberOption = { id: string; label: string; role: string };
export type WorkOption = { id: string; label: string };
export type ApprovalDelegation = {
  id: string;
  permission_key: string;
  entity_type: string;
  work_id: string | null;
  work_nome: string | null;
  delegator_member_id: string;
  delegator_name: string;
  delegatee_member_id: string;
  delegatee_name: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  revoked_at: string | null;
  reason: string | null;
  created_at: string;
};

export async function listMembersForDelegation(): Promise<MemberOption[]> {
  const { data, error } = await db.from('members').select('id, full_name, email, role').eq('active', true).is('deleted_at', null).order('full_name', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), label: String(r.full_name || r.email || r.id), role: String(r.role ?? '') }));
}

export async function listWorksForDelegation(): Promise<WorkOption[]> {
  const { data, error } = await db.from('client_works').select('id, nome').is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), label: String(r.nome || r.id) }));
}

function mapDelegation(value: unknown): ApprovalDelegation {
  const r = value as Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    permission_key: String(r.permission_key ?? 'laudo.aprovar'),
    entity_type: String(r.entity_type ?? 'lab_report'),
    work_id: r.work_id == null ? null : String(r.work_id),
    work_nome: r.work_nome == null && r.work_name == null ? null : String(r.work_nome ?? r.work_name),
    delegator_member_id: String(r.delegator_member_id ?? ''),
    delegator_name: String(r.delegator_name ?? '-'),
    delegatee_member_id: String(r.delegatee_member_id ?? ''),
    delegatee_name: String(r.delegatee_name ?? '-'),
    starts_at: String(r.starts_at ?? ''),
    ends_at: String(r.ends_at ?? ''),
    active: r.active === true,
    revoked_at: r.revoked_at == null ? null : String(r.revoked_at),
    reason: r.reason == null ? null : String(r.reason),
    created_at: String(r.created_at ?? ''),
  };
}

export async function listApprovalDelegations(activeOnly = false): Promise<ApprovalDelegation[]> {
  const { data, error } = await db.rpc('list_approval_delegations', { p_active_only: activeOnly });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).map(mapDelegation);
}

export async function createApprovalDelegation(input: { delegatorMemberId: string; delegateeMemberId: string; permissionKey: string; startsAt: string; endsAt: string; reason?: string; workId?: string | null }): Promise<string> {
  const { data, error } = await db.rpc('create_approval_delegation', {
    p_delegator_member_id: input.delegatorMemberId,
    p_delegatee_member_id: input.delegateeMemberId,
    p_permission_key: input.permissionKey,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_reason: input.reason?.trim() || null,
    p_work_id: input.workId || null,
  });
  if (error) throw new Error(error.message);
  return String(data ?? '');
}

export async function revokeApprovalDelegation(id: string, reason?: string): Promise<void> {
  const { error } = await db.rpc('revoke_approval_delegation', { p_delegation_id: id, p_reason: reason?.trim() || null });
  if (error) throw new Error(error.message);
}

export async function temDelegacaoAprovacao(): Promise<boolean> {
  const { data, error } = await db.rpc('current_tem_delegacao_aprovacao');
  if (error) throw new Error(error.message);
  return data === true;
}
