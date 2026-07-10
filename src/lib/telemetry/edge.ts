import { env } from '../env';
import { supabase } from '../supabase';
import { currentTraceId, addBreadcrumb } from './core';
import { captureException, emit } from './instrument';
import { scrub } from './scrub';

export type EdgeResponseType = 'json' | 'blob' | 'text';

export type EdgeInvokeOptions = {
  responseType?: EdgeResponseType;
  action?: string;
  ids?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  failureEvent?: string;
  method?: 'POST' | 'GET';
  headers?: Record<string, string>;
  failMessage?: string;
};

export type EdgeInvokeResult<T> = {
  data: T;
  response: Response;
  traceId: string | null;
  correlationId: string | null;
};

export class EdgeFunctionError extends Error {
  slug: string;
  status: number;
  correlationId: string | null;
  traceId: string | null;
  payload: unknown;

  constructor(slug: string, status: number, message: string, opts: { correlationId?: string | null; traceId?: string | null; payload?: unknown } = {}) {
    super(message);
    this.name = 'EdgeFunctionError';
    this.slug = slug;
    this.status = status;
    this.correlationId = opts.correlationId ?? null;
    this.traceId = opts.traceId ?? null;
    this.payload = opts.payload ?? null;
  }
}

function emitDomainFailure(event: string, metadata?: Record<string, unknown>) {
  const area = event.includes('.') ? event.split('.')[0] : 'geral';
  emit({ category: 'domain', name: event, severity: 'info', sample: 1, metadata: { event, area, ...(metadata ?? {}) } });
}

async function readErrorPayload(resp: Response): Promise<{ payload: unknown; message: string; correlationId: string | null }> {
  const contentType = resp.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = await resp.json().catch(() => ({})) as Record<string, unknown>;
    const message = typeof payload.error === 'string' && payload.error ? payload.error : `Erro ${resp.status}`;
    const correlationId = typeof payload.correlation_id === 'string' ? payload.correlation_id : null;
    return { payload, message, correlationId };
  }
  const text = await resp.text().catch(() => '');
  return { payload: text, message: text || `Erro ${resp.status}`, correlationId: null };
}

export async function invokeEdgeFunction<T = unknown>(slug: string, body: Record<string, unknown> = {}, opts: EdgeInvokeOptions = {}): Promise<EdgeInvokeResult<T>> {
  const traceId = currentTraceId() || null;
  const url = new URL(`${env.supabaseUrl}/functions/v1/${slug}`);
  if (traceId) url.searchParams.set('trace_id', traceId);
  addBreadcrumb('edge.invoke', { slug, action: opts.action, ids: opts.ids });

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: env.supabaseAnonKey,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers ?? {}),
  };

  const resp = await fetch(url.toString(), {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });

  if (!resp.ok) {
    const parsed = await readErrorPayload(resp);
    const err = new EdgeFunctionError(slug, resp.status, opts.failMessage ?? parsed.message, { correlationId: parsed.correlationId, traceId, payload: parsed.payload });
    const baseMeta = {
      edge_function: slug,
      action: opts.action,
      status: resp.status,
      trace_id: traceId,
      correlation_id: parsed.correlationId,
      ids: opts.ids,
      request_body: scrub(body),
      response_body: scrub(parsed.payload),
      ...(opts.metadata ?? {}),
    };
    captureException(err, { category: 'edge_function', metadata: baseMeta });
    if (opts.failureEvent) emitDomainFailure(opts.failureEvent, { ...baseMeta, reason: err.message });
    throw err;
  }

  const responseType = opts.responseType ?? 'json';
  const data = (responseType === 'blob'
    ? await resp.blob()
    : responseType === 'text'
      ? await resp.text()
      : await resp.json().catch(() => ({}))) as T;
  return { data, response: resp, traceId, correlationId: resp.headers.get('x-correlation-id') };
}
