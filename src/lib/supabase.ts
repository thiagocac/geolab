import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { env } from './env';
import { currentTraceId } from './telemetry/core';

/**
 * Propagação de trace ponta-a-ponta (Observabilidade — opcional).
 * Envolve o fetch do cliente Supabase para carregar o trace ativo (currentTraceId):
 *   - Edge Functions (/functions/v1/): via ?trace_id=  → a EF lê com readTraceId (serveWithTelemetry).
 *     NUNCA header custom em EF: dispararia preflight CORS contra a allow-list fixa do _shared/cors.ts.
 *   - PostgREST (/rest/v1/): via header x-trace-id → lido por app_trace_id() (049) em request.headers.
 *     Escopo SÓ em /rest/v1/ (Auth/Storage ficam intactos; o CORS deles pode não permitir o header).
 * É best-effort: qualquer falha cai no fetch original — nunca quebra uma chamada.
 *
 * RISCO: roda em toda chamada de dados. Os dois toggles abaixo permitem desligar cada metade.
 * O x-trace-id em PostgREST só rende valor se os triggers de auditoria gravarem app_trace_id().
 */
const TRACE_EDGE_FUNCTIONS = true; // ?trace_id= em EF (correlaciona ef_invocation_log) — baixo risco
const TRACE_REST = true;           // x-trace-id em /rest/v1/ (correlaciona audit_log) — requer app_trace_id consumido

const realFetch: typeof fetch = globalThis.fetch.bind(globalThis);

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return '';
}

const tracedFetch: typeof fetch = (input, init) => {
  try {
    const traceId = currentTraceId();
    if (!traceId) return realFetch(input, init);
    const url = urlOf(input);

    // Edge Functions → ?trace_id= (só reescreve string/URL; Request é imutável quanto à URL).
    if (TRACE_EDGE_FUNCTIONS && url.includes('/functions/v1/') && (typeof input === 'string' || input instanceof URL)) {
      const u = new URL(url);
      if (!u.searchParams.has('trace_id')) u.searchParams.set('trace_id', traceId);
      return realFetch(u.toString(), init);
    }

    // PostgREST → header x-trace-id (PostgREST reflete o header em CORS).
    if (TRACE_REST && url.includes('/rest/v1/')) {
      const headers = new Headers(init?.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
      if (!headers.has('x-trace-id')) headers.set('x-trace-id', traceId);
      return realFetch(input, { ...init, headers });
    }

    return realFetch(input, init); // Auth/Storage/Realtime e demais: intactos
  } catch {
    return realFetch(input, init); // fail-open: nunca quebra a chamada
  }
};

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 10 } },
  global: { fetch: tracedFetch },
});

export async function requireCurrentUser() { const { data, error } = await supabase.auth.getUser(); if (error) throw error; return data.user; }
