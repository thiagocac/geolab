import { supabase } from '../supabase';

const db = supabase;

type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
const rpc = db.rpc.bind(db) as unknown as (fn: string, args: Record<string, unknown>) => RpcResult<unknown[]>;

export type TimelineEvent = {
  event_kind: string;
  event_subtype: string | null;
  event_at: string;
  event_date: string | null;
  title: string;
  subtitle: string | null;
  severity: 'info' | 'warn' | 'error' | string;
  ref_table: string | null;
  ref_id: string | null;
  actor_name: string | null;
  work_id: string | null;
  work_nome: string | null;
  concretagem_id: string | null;
  concretagem_codigo: string | null;
  metadata: Record<string, unknown> | null;
};

function mapRows(data: unknown[] | null): TimelineEvent[] {
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      event_kind: String(r.event_kind ?? 'evento'),
      event_subtype: r.event_subtype == null ? null : String(r.event_subtype),
      event_at: String(r.event_at ?? new Date().toISOString()),
      event_date: r.event_date == null ? null : String(r.event_date),
      title: String(r.title ?? 'Evento'),
      subtitle: r.subtitle == null ? null : String(r.subtitle),
      severity: String(r.severity ?? 'info'),
      ref_table: r.ref_table == null ? null : String(r.ref_table),
      ref_id: r.ref_id == null ? null : String(r.ref_id),
      actor_name: r.actor_name == null ? null : String(r.actor_name),
      work_id: r.work_id == null ? null : String(r.work_id),
      work_nome: r.work_nome == null ? null : String(r.work_nome),
      concretagem_id: r.concretagem_id == null ? null : String(r.concretagem_id),
      concretagem_codigo: r.concretagem_codigo == null ? null : String(r.concretagem_codigo),
      metadata: r.metadata && typeof r.metadata === 'object' ? r.metadata as Record<string, unknown> : null,
    };
  });
}

export async function listTenantTimeline(opts: { kinds?: string[]; from?: string; to?: string; severity?: string[]; limit?: number; before?: string | null } = {}): Promise<TimelineEvent[]> {
  const { data, error } = await rpc('list_tenant_timeline', {
    p_kinds: opts.kinds?.length ? opts.kinds : null,
    p_from: opts.from || null,
    p_to: opts.to || null,
    p_severity: opts.severity?.length ? opts.severity : null,
    p_limit: opts.limit ?? 200,
    p_before: opts.before ?? null,
  });
  if (error) throw new Error(error.message);
  return mapRows(data);
}

export async function listWorkTimeline(workId: string, opts: { kinds?: string[]; from?: string; to?: string; severity?: string[]; limit?: number; before?: string | null } = {}): Promise<TimelineEvent[]> {
  const { data, error } = await rpc('list_work_timeline', {
    p_work_id: workId,
    p_kinds: opts.kinds?.length ? opts.kinds : null,
    p_from: opts.from || null,
    p_to: opts.to || null,
    p_severity: opts.severity?.length ? opts.severity : null,
    p_limit: opts.limit ?? 200,
    p_before: opts.before ?? null,
  });
  if (error) throw new Error(error.message);
  return mapRows(data);
}

export async function listConcretagemTimeline(concretagemId: string, opts: { kinds?: string[]; from?: string; to?: string; severity?: string[]; limit?: number; before?: string | null } = {}): Promise<TimelineEvent[]> {
  const { data, error } = await rpc('list_concretagem_timeline', {
    p_concretagem_id: concretagemId,
    p_kinds: opts.kinds?.length ? opts.kinds : null,
    p_from: opts.from || null,
    p_to: opts.to || null,
    p_severity: opts.severity?.length ? opts.severity : null,
    p_limit: opts.limit ?? 200,
    p_before: opts.before ?? null,
  });
  if (error) throw new Error(error.message);
  return mapRows(data);
}

export async function listCpTimeline(cpId: string): Promise<TimelineEvent[]> {
  const { data, error } = await rpc('cp_timeline', { p_cp_id: cpId });
  if (error) throw new Error(error.message);
  return mapRows(data ?? null);
}
