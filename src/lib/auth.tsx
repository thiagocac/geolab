import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { recordLoginEvent } from './api/accountSecurity';

// Auth do GEOLAB (lab = tenant). Adaptado do GEOMAT: aqui resolvemos o vínculo
// direto de `members` (a RLS deixa o usuário ver os próprios vínculos) + RPC select_tenant.

export type Member = { id: string; tenant_id: string; tenant_name: string; email: string; full_name: string | null; role: string; roles: string[]; is_selected: boolean };
export type TenantOption = { tenant_id: string; tenant_name: string; role: string; is_selected: boolean };

type AuthState = {
  ready: boolean;
  session: Session | null;
  member: Member | null;
  tenants: TenantOption[];
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectTenant: (tenantId: string) => Promise<void>;
  reload: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
  can: (...permissions: string[]) => boolean;
  permissions: string[];
  needsTenantSelection: boolean;
};

type MemberRow = {
  id: string; tenant_id: string; email: string; full_name: string | null;
  role: string; roles: string[] | null; is_selected: boolean;
  tenants: { name: string } | { name: string }[] | null;
};

function tenantName(row: MemberRow): string {
  const t = row.tenants;
  if (!t) return '';
  return Array.isArray(t) ? (t[0]?.name ?? '') : t.name;
}


let lastRecordedLoginKey: string | null = null;
function loginEventKey(s: Session | null): string | null {
  if (!s?.user) return null;
  return s.user.id + ':' + (s.user.last_sign_in_at ?? s.expires_at ?? 'current');
}
async function recordLoginEventOnce(s: Session | null) {
  const key = loginEventKey(s);
  if (!key || key === lastRecordedLoginKey) return;
  lastRecordedLoginKey = key;
  try { await recordLoginEvent(s?.user.last_sign_in_at ?? null); } catch { /* segurança da conta é best-effort e não bloqueia login */ }
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const loadContext = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) { setMember(null); setTenants([]); setPermissions([]); return; }
    const { data: rows } = await supabase
      .from('members')
      .select('id, tenant_id, email, full_name, role, roles, is_selected, tenants(name)')
      .eq('auth_id', uid).eq('active', true).is('deleted_at', null);
    const list = (rows as unknown as MemberRow[]) ?? [];
    let options: TenantOption[] = list.map((r) => ({ tenant_id: r.tenant_id, tenant_name: tenantName(r), role: r.role, is_selected: !!r.is_selected }));
    if (options.length === 1 && !options[0].is_selected) {
      await supabase.rpc('select_tenant', { p_tenant_id: options[0].tenant_id });
      options = options.map((o) => ({ ...o, is_selected: true }));
    }
    setTenants(options);
    const current = list.find((r) => r.is_selected) ?? (list.length === 1 ? list[0] : null);
    if (!current) { setMember(null); setPermissions([]); return; }
    setMember({ id: current.id, tenant_id: current.tenant_id, tenant_name: tenantName(current), email: current.email, full_name: current.full_name, role: current.role, roles: current.roles ?? [], is_selected: true });
    try { const { data: perms } = await (supabase.rpc.bind(supabase) as unknown as (fn: string) => PromiseLike<{ data: unknown }>)('current_member_permissions'); setPermissions(Array.isArray(perms) ? (perms as string[]) : []); } catch { setPermissions([]); }
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) { await loadContext(); await recordLoginEventOnce(data.session); }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return;
      setSession(s);
      if (s) { await loadContext(); await recordLoginEventOnce(s); } else { setMember(null); setTenants([]); setPermissions([]); }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadContext]);

  async function signIn(email: string, password: string) {
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) { setError(e.message); throw e; }
  }
  async function signOut() { await supabase.auth.signOut(); setMember(null); setTenants([]); setPermissions([]); }
  async function selectTenant(tenantId: string) {
    const { error: e } = await supabase.rpc('select_tenant', { p_tenant_id: tenantId });
    if (e) throw e;
    await loadContext();
  }
  function hasRole(...roles: string[]) {
    if (!member) return false;
    const set = new Set<string>([member.role, ...(member.roles ?? [])]);
    return roles.some((r) => set.has(r));
  }
  function can(...perms: string[]) {
    if (!member) return false;
    if (member.role === 'admin' || member.role === 'admin_consulte' || (member.roles ?? []).some((r) => r === 'admin' || r === 'admin_consulte')) return true;
    const set = new Set(permissions);
    return perms.some((p) => set.has(p));
  }
  const needsTenantSelection = !!session && tenants.length > 1 && !member;

  const value: AuthState = { ready, session, member, tenants, error, signIn, signOut, selectTenant, reload: loadContext, hasRole, can, permissions, needsTenantSelection };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
