// _shared/telemetry.ts — instrumentação de Edge Functions do GEOLAB.
// v210: reintroduz log estruturado de erros de EF (ef_log/log_ef_event), mantendo
// ef_invocation_log como métrica agregada. Todos os caminhos são best-effort.
import { getServiceClient } from './client.ts';

declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

function waitUntil(promise: Promise<unknown>) {
  try {
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(promise);
    else promise.catch(() => undefined);
  } catch {
    promise.catch(() => undefined);
  }
}

/** trace_id ponta-a-ponta via query param (?trace_id=...), sem preflight CORS. */
export function readTraceId(req: Request): string | null {
  try {
    const t = new URL(req.url).searchParams.get('trace_id');
    return t ? t.slice(0, 128) : null;
  } catch {
    return null;
  }
}

async function resolveActor(req: Request): Promise<{ actor_id: string | null; tenant_id: string | null }> {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return { actor_id: null, tenant_id: null };
  if (!token.startsWith('eyJ')) return { actor_id: null, tenant_id: null };
  try {
    const svc = getServiceClient();
    const { data: userResult, error } = await svc.auth.getUser(token);
    if (error || !userResult?.user) return { actor_id: null, tenant_id: null };
    const { data: member } = await svc
      .from('members')
      .select('id,tenant_id')
      .eq('auth_id', userResult.user.id)
      .eq('active', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (!member) return { actor_id: null, tenant_id: null };
    return { actor_id: String(member.id), tenant_id: String(member.tenant_id) };
  } catch {
    return { actor_id: null, tenant_id: null };
  }
}

function safeUrl(req: Request) {
  try { return new URL(req.url); } catch { return null; }
}

export function errorShape(e: unknown) {
  if (e instanceof Error) return { name: e.name || 'Error', message: e.message, stack: e.stack ?? null };
  return { name: typeof e, message: String(e), stack: null };
}

/**
 * Log estruturado AI-debuggable de evento de Edge Function.
 * Usa RPC public.log_ef_event criada na migration v210. Nunca pode quebrar a EF principal.
 */
export async function logEf(req: Request, level: 'debug' | 'info' | 'warn' | 'error' | 'fatal', fnName: string, message: string, metadata: Record<string, unknown> = {}) {
  try {
    const svc = getServiceClient();
    const actor = await resolveActor(req);
    const url = safeUrl(req);
    await svc.rpc('log_ef_event', {
      p_level: level,
      p_fn_name: fnName,
      p_message: String(message).slice(0, 4000),
      p_trace_id: readTraceId(req),
      p_actor_id: actor.actor_id,
      p_tenant_id: actor.tenant_id,
      p_metadata: {
        method: req.method,
        path: url?.pathname ?? null,
        request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || null,
        ...metadata,
      },
    });
  } catch {
    // O logger nunca bloqueia o fluxo principal.
  }
}

async function finalizeTelemetry(req: Request, o: {
  fnName: string;
  startedAt: string;
  durationMs: number;
  statusCode: number;
  errorMessage: string | null;
  traceId: string | null;
}) {
  try {
    const svc = getServiceClient();
    const actor = await resolveActor(req);
    const url = safeUrl(req);
    await svc.rpc('log_ef_invocation', {
      p_fn_name: o.fnName,
      p_started_at: o.startedAt,
      p_duration_ms: Math.max(0, Math.round(o.durationMs)),
      p_status_code: o.statusCode,
      p_error: o.errorMessage || null,
      p_actor_id: actor.actor_id,
      p_tenant_id: actor.tenant_id,
      p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(),
      p_metadata: {
        method: req.method,
        path: url?.pathname ?? null,
        ...(o.traceId ? { trace_id: o.traceId } : {}),
      },
    });
  } catch {
    // Telemetria nunca bloqueia a EF principal.
  }
}

/** Compat: registra uma invocação manualmente (sem wrap). */
export async function logEfInvocation(req: Request, opts: {
  fnName: string;
  startedAt: string;
  durationMs: number;
  statusCode: number;
  error?: string | null;
}) {
  await finalizeTelemetry(req, {
    fnName: opts.fnName,
    startedAt: opts.startedAt,
    durationMs: opts.durationMs,
    statusCode: opts.statusCode,
    errorMessage: opts.error || null,
    traceId: readTraceId(req),
  });
}

/** Envelopa o handler: cronometra, captura status/erro e grava métricas + erro estruturado. */
export function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) {
  Deno.serve(async (req: Request) => {
    const startedAt = new Date().toISOString();
    const started = performance.now();
    const traceId = readTraceId(req);
    let statusCode = 500;
    let errorMessage: string | null = null;
    try {
      const res = await handler(req);
      statusCode = res.status;
      return res;
    } catch (e) {
      const err = errorShape(e);
      errorMessage = err.message;
      statusCode = 500;
      waitUntil(logEf(req, 'error', fnName, err.message, { action: 'edge.unhandled', error_class: err.name, stack: err.stack }));
      throw e;
    } finally {
      const durationMs = performance.now() - started;
      waitUntil(finalizeTelemetry(req, { fnName, startedAt, durationMs, statusCode, errorMessage, traceId }));
    }
  });
}
