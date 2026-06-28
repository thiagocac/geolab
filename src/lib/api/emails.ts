import { supabase } from '../supabase';

// Camada da trilha de E-MAIL para o painel /gestao/emails (admin).
//   - notification_dispatch_log: SELECT por is_tenant_member(tenant_id) => SEMPRE filtramos tenant_id
//     explicitamente (alem da RLS) para evitar full-scan em escala.
//   - notification_dispatch_settings: singleton (id=true), SELECT/UPDATE por has_role('admin_consulte').
//     NUNCA expomos dispatch_secret ao cliente.
//   - notify_event_outbox: fila do dispatcher SQL (backlog/dead-letter), SELECT por tenant.
// Tabelas novas ainda nao tipadas em database.types.ts => cast permissivo (padrao do client.ts).
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export type DispatchStatus = 'queued' | 'sent' | 'skipped' | 'suppressed' | 'failed' | 'bounced' | 'complained';

export type DispatchLogRow = {
  id: string;
  tenant_id: string;
  recipient_email: string;
  event_type: string;
  status: DispatchStatus | string;
  entity_type: string | null;
  entity_id: string | null;
  resend_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  open_count: number | null;
  click_count: number | null;
  notification_type: string | null;
  dedupe_key: string | null;
  last_clicked_url: string | null;
  last_user_agent: string | null;
  created_at: string;
  updated_at: string | null;
};

export type DispatchSettings = {
  dispatch_enabled: boolean;
  dry_run: boolean;
  email_allowlist: string[] | null;
  notify_event_url: string | null;
  updated_at: string | null;
};

export type OutboxRow = {
  id: string;
  tenant_id: string | null;
  event_type: string;
  mode: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
};

const LOG_SELECT = 'id, tenant_id, recipient_email, event_type, status, entity_type, entity_id, resend_id, error_message, metadata, delivered_at, opened_at, clicked_at, bounced_at, complained_at, open_count, click_count, notification_type, dedupe_key, last_clicked_url, last_user_agent, created_at, updated_at';

// Log de envios recente do tenant (filtro explicito de tenant_id + opcional status).
export async function listDispatchLog(tenantId: string, opts: { status?: string; limit?: number } = {}): Promise<DispatchLogRow[]> {
  if (!tenantId) return [];
  let q = db.from('notification_dispatch_log').select(LOG_SELECT).eq('tenant_id', tenantId).is('deleted_at', null);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(opts.limit ?? 100);
  if (error) throw new Error(error.message);
  return (data ?? []) as DispatchLogRow[];
}

// Contagem por status numa janela (cartoes do topo). Reduz no cliente a partir de uma janela recente.
export async function dispatchCountsByStatus(tenantId: string, days = 7): Promise<Record<string, number>> {
  if (!tenantId) return {};
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await db.from('notification_dispatch_log')
    .select('status').eq('tenant_id', tenantId).is('deleted_at', null).gte('created_at', since).limit(5000);
  if (error) throw new Error(error.message);
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as Array<{ status: string }>) out[r.status] = (out[r.status] ?? 0) + 1;
  return out;
}

// Configuracao de despacho (singleton). NUNCA seleciona dispatch_secret.
export async function getDispatchSettings(): Promise<DispatchSettings | null> {
  const { data, error } = await db.from('notification_dispatch_settings')
    .select('dispatch_enabled, dry_run, email_allowlist, notify_event_url, updated_at').eq('id', true).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as DispatchSettings | null;
}

// Atualiza flags de despacho (admin). Mantem o secret intacto (nao tocamos a coluna).
export async function saveDispatchSettings(patch: Partial<Pick<DispatchSettings, 'dispatch_enabled' | 'dry_run' | 'email_allowlist'>>, updatedBy?: string): Promise<void> {
  const { error } = await db.from('notification_dispatch_settings')
    .update({ ...patch, updated_by: updatedBy ?? null, updated_at: new Date().toISOString() }).eq('id', true);
  if (error) throw new Error(error.message);
}

// Fila do dispatcher SQL (backlog/dead-letter) do tenant.
export async function listOutbox(tenantId: string, opts: { status?: string; limit?: number } = {}): Promise<OutboxRow[]> {
  if (!tenantId) return [];
  let q = db.from('notify_event_outbox').select('id, tenant_id, event_type, mode, status, attempts, last_error, created_at, processed_at').eq('tenant_id', tenantId);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(opts.limit ?? 100);
  if (error) throw new Error(error.message);
  return (data ?? []) as OutboxRow[];
}

// Supressoes de e-mail (bounce/reclamacao/manual). Tabela GLOBAL (PK email, sem tenant_id);
// RLS de SELECT exige has_role('admin_consulte') — a UI tambem se restringe a esse papel.
export type SuppressionRow = { email: string; reason: string | null; created_at: string };
export async function listSuppressions(limit = 200): Promise<SuppressionRow[]> {
  const { data, error } = await db.from('email_suppressions')
    .select('email, reason, created_at').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SuppressionRow[];
}

// Escrita via RPC (a tabela só tem policy de SELECT). Autorizadas a admin_consulte no banco.
export async function addSuppression(email: string, reason = 'manual'): Promise<void> {
  const { error } = await db.rpc('email_suppression_add', { p_email: email, p_reason: reason });
  if (error) throw new Error(error.message);
}
export async function removeSuppression(email: string): Promise<void> {
  const { error } = await db.rpc('email_suppression_remove', { p_email: email });
  if (error) throw new Error(error.message);
}

// Catálogo de tipos de evento (rótulos amigáveis). RLS de SELECT = true (legível por qualquer autenticado).
export type EventType = {
  key: string; codigo: string | null; categoria: string | null; severidade: string | null;
  descricao: string | null; default_channel: string | null; is_system: boolean | null; digest: boolean | null; active: boolean | null;
};
export async function listEventTypes(): Promise<EventType[]> {
  const { data, error } = await db.from('notification_event_types')
    .select('key, codigo, categoria, severidade, descricao, default_channel, is_system, digest, active')
    .order('categoria', { ascending: true }).order('key', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EventType[];
}
