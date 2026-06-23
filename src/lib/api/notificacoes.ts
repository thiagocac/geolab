import { supabase } from '../supabase';

// Log de disparos (read-only, RLS por tenant) + preferências do próprio member
// (RLS exige member_id = current_member_id()). Opt-out = channel 'off'.
const db = supabase as unknown as { from: (t: string) => any };

export type LogRow = { id: string; recipient_email: string; event_type: string; status: string; created_at: string; metadata: Record<string, unknown> | null };
export async function listDispatchLog(): Promise<LogRow[]> {
  const { data, error } = await db.from('notification_dispatch_log').select('id, recipient_email, event_type, status, created_at, metadata').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as LogRow[];
}

export async function listMyPrefs(memberId: string): Promise<Record<string, string>> {
  const { data, error } = await db.from('member_notification_prefs').select('event_type, channel').eq('member_id', memberId);
  if (error) throw new Error(error.message);
  const m: Record<string, string> = {};
  for (const r of (data ?? []) as Record<string, unknown>[]) m[String(r.event_type)] = String(r.channel ?? 'email');
  return m;
}
export async function setMyPref(tenantId: string, memberId: string, eventType: string, on: boolean): Promise<void> {
  const channel = on ? 'email' : 'off';
  const { data: existing } = await db.from('member_notification_prefs').select('id').eq('member_id', memberId).eq('event_type', eventType).maybeSingle();
  if (existing?.id) {
    const { error } = await db.from('member_notification_prefs').update({ channel }).eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('member_notification_prefs').insert({ tenant_id: tenantId, member_id: memberId, event_type: eventType, channel });
    if (error) throw new Error(error.message);
  }
}
