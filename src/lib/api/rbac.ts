import { supabase } from '../supabase';

const db = supabase;
type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
const rpc = db.rpc as unknown as (fn: string, args: Record<string, unknown>) => RpcResult<unknown[]>;

export type RbacMatrixRow = {
  role_id: string;
  role_key: string;
  role_name: string;
  permission_key: string;
  permission_name: string;
  category: string;
  enabled: boolean;
};

function mapRow(value: unknown): RbacMatrixRow {
  const r = value as Record<string, unknown>;
  return {
    role_id: String(r.role_id ?? ''),
    role_key: String(r.role_key ?? ''),
    role_name: String(r.role_name ?? ''),
    permission_key: String(r.permission_key ?? ''),
    permission_name: String(r.permission_name ?? r.permission_key ?? ''),
    category: String(r.permission_category ?? r.category ?? 'Geral'),
    enabled: r.enabled === true,
  };
}

export async function listRbacMatrix(): Promise<RbacMatrixRow[]> {
  const { data, error } = await rpc('list_rbac_matrix', {});
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function setRolePermissions(roleId: string, permissionKeys: string[]): Promise<void> {
  const { error } = await (db.rpc as unknown as (fn: string, args: Record<string, unknown>) => RpcResult<unknown>)('set_role_permissions', { p_role_id: roleId, p_permission_keys: permissionKeys });
  if (error) throw new Error(error.message);
}
