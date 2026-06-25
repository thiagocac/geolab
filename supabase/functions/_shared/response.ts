// _shared/response.ts — helpers de resposta HTTP das Edge Functions.
// EXTENSÃO ADITIVA: somados ok() e serverError() (usados pelas EFs portadas do GEOCON:
// client-telemetry e telemetry-alarm). json() e fail() preservados sem mudança de comportamento.
import { json as baseJson } from './core.ts';

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

/** Erro 500 a partir de uma exceção (mensagem segura; nunca vaza stack ao cliente). */
export function serverError(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : String(e);
  return baseJson({ ok: false, error: message }, { status });
}
