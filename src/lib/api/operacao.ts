import { supabase } from '../supabase';
import { env } from '../env';

// Operação interna. Criação de usuário/laboratório passa por EF service-role
// (admin-invite-member / admin-create-lab); leitura de members é direta (RLS por tenant).
const db = supabase as unknown as { from: (t: string) => any };

async function callEF(slug: string, body: unknown): Promise<Record<string, unknown>> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(env.supabaseUrl + '/functions/v1/' + slug, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok || data.ok === false) throw new Error(String(data.error ?? 'Erro ' + resp.status));
  return data;
}

export type MemberRow = { id: string; full_name: string | null; email: string; cargo: string | null; role: string; active: boolean };

export async function listMembers(): Promise<MemberRow[]> {
  const { data, error } = await db.from('members').select('id, full_name, email, cargo, role, active').is('deleted_at', null).order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MemberRow[];
}
export async function inviteMember(input: { full_name: string; email: string; role: string; cargo?: string; telefone?: string }): Promise<{ member_id?: string; temp_password?: string | null }> {
  return callEF('admin-invite-member', input) as Promise<{ member_id?: string; temp_password?: string | null }>;
}
export async function setMemberActive(id: string, active: boolean): Promise<void> {
  const { error } = await db.from('members').update({ active }).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function createLab(input: { lab_nome: string; lab_slug?: string; admin_email: string; admin_nome: string; cnpj?: string }): Promise<{ temp_password?: string | null; tenant_id?: string }> {
  return callEF('admin-create-lab', input) as Promise<{ temp_password?: string | null; tenant_id?: string }>;
}

const rpcOp = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type LabMemberRow = {
  member_id: string; full_name: string | null; email: string; cargo: string | null; telefone: string | null;
  active: boolean; role: string; role_ids: string[]; role_keys: string[]; n_obras: number; n_overrides: number; last_login: string | null;
};
export async function listLabMembers(): Promise<LabMemberRow[]> {
  const { data, error } = await rpcOp('list_lab_members');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    member_id: String(r.member_id), full_name: (r.full_name as string) ?? null, email: String(r.email),
    cargo: (r.cargo as string) ?? null, telefone: (r.telefone as string) ?? null, active: r.active === true,
    role: String(r.role ?? ''), role_ids: (r.role_ids as string[]) ?? [], role_keys: (r.role_keys as string[]) ?? [],
    n_obras: Number(r.n_obras ?? 0), n_overrides: Number(r.n_overrides ?? 0), last_login: (r.last_login as string) ?? null,
  }));
}
export async function updateMember(id: string, full_name: string, cargo: string, telefone: string): Promise<void> {
  const { error } = await rpcOp('update_member', { p_member_id: id, p_full_name: full_name, p_cargo: cargo, p_telefone: telefone });
  if (error) throw new Error(error.message);
}
export async function setMemberRoles(memberId: string, roleIds: string[]): Promise<void> {
  const { error } = await rpcOp('assign_member_roles', { p_member_id: memberId, p_role_ids: roleIds });
  if (error) throw new Error(error.message);
}
export async function getMemberObras(memberId: string): Promise<string[]> {
  const { data, error } = await db.from('member_obras').select('work_id').eq('member_id', memberId).is('deleted_at', null);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => String(r.work_id));
}
export async function setMemberObras(memberId: string, workIds: string[]): Promise<void> {
  const { error } = await rpcOp('set_member_obras', { p_member_id: memberId, p_work_ids: workIds });
  if (error) throw new Error(error.message);
}
export async function getMemberOverrides(memberId: string): Promise<{ permission_key: string; allowed: boolean }[]> {
  const { data, error } = await db.from('member_permission_overrides').select('permission_key, allowed').eq('member_id', memberId).is('deleted_at', null);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ permission_key: String(r.permission_key), allowed: r.allowed === true }));
}
export async function setMemberOverride(memberId: string, permissionKey: string, allowed: boolean | null): Promise<void> {
  const { error } = await rpcOp('set_member_override', { p_member_id: memberId, p_permission_key: permissionKey, p_allowed: allowed });
  if (error) throw new Error(error.message);
}
export async function listObrasRef(): Promise<{ value: string; label: string }[]> {
  const { data, error } = await db.from('client_works').select('id, nome').is('deleted_at', null).order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ value: String(r.id), label: String(r.nome) }));
}

export async function resetPassword(memberId: string): Promise<{ temp_password?: string | null }> {
  return callEF('admin-reset-password', { member_id: memberId }) as Promise<{ temp_password?: string | null }>;
}
export async function getMemberEffectivePermissions(memberId: string): Promise<string[]> {
  const { data, error } = await rpcOp('member_effective_permissions', { p_member_id: memberId });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as string[]) : [];
}
