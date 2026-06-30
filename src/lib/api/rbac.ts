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

const dbx = supabase as unknown as { from: (t: string) => any };

export type PermissionCatalog = { key: string; name: string; category: string; description: string | null; risk_level: string };
export async function listPermissionsCatalog(): Promise<PermissionCatalog[]> {
  const { data, error } = await dbx.from('permissions').select('key, name, category, description, risk_level').eq('active', true).order('category', { ascending: true }).order('key', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PermissionCatalog[];
}

export type RoleRow = { id: string; key: string; name: string; description: string | null; built_in: boolean; active: boolean };
export async function listRoles(): Promise<RoleRow[]> {
  const { data, error } = await dbx.from('roles').select('id, key, name, description, built_in, active').is('deleted_at', null).order('built_in', { ascending: false }).order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RoleRow[];
}

const rpcAny = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
export async function upsertRole(id: string | null, name: string, description: string): Promise<string> {
  const { data, error } = await rpcAny('upsert_role', { p_role_id: id, p_key: null, p_name: name, p_description: description });
  if (error) throw new Error(error.message);
  return String(data ?? '');
}
export async function cloneRole(sourceId: string, name: string): Promise<string> {
  const { data, error } = await rpcAny('clone_role', { p_source_role_id: sourceId, p_name: name });
  if (error) throw new Error(error.message);
  return String(data ?? '');
}
export async function setRoleActive(id: string, active: boolean): Promise<void> {
  const { error } = await rpcAny('set_role_active', { p_role_id: id, p_active: active });
  if (error) throw new Error(error.message);
}
