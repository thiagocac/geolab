// _shared/response.ts — helpers de resposta HTTP das Edge Functions.
// v210: serverError() cria correlation_id, persiste stack no ef_log e devolve mensagem genérica.
import { json as baseJson } from './core.ts';
import { errorShape, logEf } from './telemetry.ts';

export function json(body: unknown, init: ResponseInit = {}) {
  return baseJson(body, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return baseJson({ ok: false, error: message, details }, { status });
}

/** Sucesso 200 com envelope { ok: true, ...body }. Aceita body objeto (espalhado) ou escalar (em data). */
export function ok(body: unknown = {}, init: ResponseInit = {}) {
  const payload = body && typeof body === 'object' && !Array.isArray(body)
    ? { ok: true, ...(body as Record<string, unknown>) }
    : { ok: true, data: body };
  return baseJson(payload, { status: 200, ...init });
}

type ServerErrorOptions = {
  req?: Request;
  fnName?: string;
  action?: string;
  status?: number;
  publicMessage?: string;
  metadata?: Record<string, unknown>;
  headers?: HeadersInit;
};

/** Erro seguro: stack completo fica no servidor; cliente recebe só correlation_id. */
export function serverError(e: unknown, opts: ServerErrorOptions | number = {}) {
  const o: ServerErrorOptions = typeof opts === 'number' ? { status: opts } : opts;
  const correlationId = crypto.randomUUID();
  const err = errorShape(e);
  if (o.req && o.fnName) {
    void logEf(o.req, 'error', o.fnName, err.message, {
      action: o.action ?? 'edge.server_error',
      correlation_id: correlationId,
      error_class: err.name,
      stack: err.stack,
      ...(o.metadata ?? {}),
    });
  }
  const headers = new Headers(o.headers ?? {});
  headers.set('x-correlation-id', correlationId);
  return baseJson({ ok: false, error: o.publicMessage ?? 'Erro interno ao processar a solicitação. Informe o código de correlação ao suporte.', correlation_id: correlationId }, { status: o.status ?? 500, headers });
}
