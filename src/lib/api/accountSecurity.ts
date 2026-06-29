import { supabase } from '../supabase';

const db = supabase as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type LoginEvent = {
  id: string;
  tenant_id?: string;
  member_id?: string;
  member_name?: string;
  email?: string;
  signed_in_at: string;
  user_agent: string | null;
  ip: string | null;
  origin: string;
  recorded_at?: string;
};
export type AuthAttemptSummary = {
  window_minutes: number;
  total_attempts: number;
  failed_attempts: number;
  distinct_email_hashes: number;
  distinct_ips: number;
  suspicious: boolean;
};

export async function recordLoginEvent(signedInAt?: string | null): Promise<void> {
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent.slice(0, 500);
  const { error } = await db.rpc('record_login_event', { p_signed_in_at: signedInAt || null, p_user_agent: userAgent });
  if (error) throw new Error(error.message);
}

function mapLogin(value: unknown): LoginEvent {
  const r = value as Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    tenant_id: r.tenant_id == null ? undefined : String(r.tenant_id),
    member_id: r.member_id == null ? undefined : String(r.member_id),
    member_name: r.member_name == null ? undefined : String(r.member_name),
    email: r.email == null ? undefined : String(r.email),
    signed_in_at: String(r.signed_in_at ?? ''),
    user_agent: r.user_agent == null ? null : String(r.user_agent),
    ip: r.ip == null ? null : String(r.ip),
    origin: String(r.origin ?? 'app'),
    recorded_at: r.recorded_at == null ? undefined : String(r.recorded_at),
  };
}

export async function listMyLoginEvents(limit = 20): Promise<LoginEvent[]> {
  const { data, error } = await db.rpc('list_my_login_events', { p_limit: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).map(mapLogin);
}

export async function adminListLoginEvents(limit = 100): Promise<LoginEvent[]> {
  const { data, error } = await db.rpc('admin_list_login_events', { p_limit: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).map(mapLogin);
}

export async function adminAuthAttemptSummary(minutes = 60): Promise<AuthAttemptSummary | null> {
  const { data, error } = await db.rpc('admin_auth_attempt_summary', { p_minutes: minutes });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | null);
  if (!row) return null;
  return {
    window_minutes: Number(row.window_minutes ?? minutes),
    total_attempts: Number(row.total_attempts ?? 0),
    failed_attempts: Number(row.failed_attempts ?? 0),
    distinct_email_hashes: Number(row.distinct_email_hashes ?? 0),
    distinct_ips: Number(row.distinct_ips ?? 0),
    suspicious: row.suspicious === true,
  };
}
