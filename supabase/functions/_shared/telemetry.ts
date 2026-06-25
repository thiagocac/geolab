// _shared/telemetry.ts — instrumentação de Edge Functions (NOVO no GEOLAB).
// Portado do GEOCON e APARADO: removidos logEf()/log_ef_event/ef_log (logs estruturados de EF,
// fora do escopo da spec). Mantém o essencial: serveWithTelemetry registra cada invocação em
// ef_invocation_log via RPC log_ef_invocation (criada na 049), best-effort, sem nunca quebrar a EF.
import { getServiceClient } from './client.ts';

declare const EdgeRuntime: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;

function waitUntil(promise: Promise<unknown>) {
  try {
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(promise);
    } else {
      promise.catch(() => undefined);
    }
  } catch {
    promise.catch(() => undefined);
  }
}

/**
 * trace_id ponta-a-ponta. O cliente NÃO envia header custom (dispararia preflight CORS e exigiria
 * x-trace-id no Access-Control-Allow-Headers de TODA EF). O trace_id viaja como query param
 * (?trace_id=...), inócuo para EFs antigas e sem preflight.
 */
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
    // Log de invocação (alimenta v_ef_metrics_hourly). OPTIONS é descartado dentro da RPC.
    // O erro (se houver) fica em ef_invocation_log.error_message — sem ef_log estruturado (aparado).
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
        path: new URL(req.url).pathname,
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

/** Envelopa o handler: cronometra, captura status/erro e grava a invocação (best-effort, pós-resposta). */
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
      errorMessage = e instanceof Error ? e.message : String(e);
      statusCode = 500;
      throw e;
    } finally {
      const durationMs = performance.now() - started;
      waitUntil(finalizeTelemetry(req, { fnName, startedAt, durationMs, statusCode, errorMessage, traceId }));
    }
  });
}
