import { supabase } from '../supabase';
import { env } from '../env';
import { APP_VERSION, TELEMETRY_CONFIG, addBreadcrumb, sessionId, currentTraceId, readContext, readBreadcrumbs } from './core';
import { scrub } from './scrub';

export type TelemetryEvent = { category: string; name: string; severity?: string; value?: number; fingerprint?: string; metadata?: Record<string, unknown>; sample?: number };

const IS_DEV = typeof import.meta !== 'undefined' && Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
const queue: Array<Record<string, unknown>> = [];
let installed = false;
let timer: ReturnType<typeof setInterval> | null = null;

function hash(input: string) { let h = 0; for (let i = 0; i < input.length; i += 1) h = ((h << 5) - h + input.charCodeAt(i)) | 0; return Math.abs(h).toString(16); }

export function emit(e: TelemetryEvent) {
  try {
    if (IS_DEV && e.severity === 'debug') return;
    const forced = e.severity === 'error' || e.severity === 'fatal';
    const sample = forced ? 1 : (e.sample ?? 1);
    if (sample < 1 && Math.random() > sample) return;
    const row: Record<string, unknown> = {
      session_id: sessionId(),
      trace_id: currentTraceId(),
      category: e.category,
      name: String(e.name).slice(0, TELEMETRY_CONFIG.maxMessage),
      severity: e.severity ?? 'info',
      value: typeof e.value === 'number' ? e.value : null,
      fingerprint: e.fingerprint ?? null,
      app_version: APP_VERSION,
      url_path: window.location.pathname,
      at: new Date().toISOString(),
      metadata: scrub({ ...readContext(), ...(e.metadata ?? {}) }) as Record<string, unknown>,
    };
    queue.push(row);
    if (queue.length > TELEMETRY_CONFIG.maxBuffer) queue.splice(0, queue.length - TELEMETRY_CONFIG.maxBuffer);
    if (queue.length >= TELEMETRY_CONFIG.maxBatch) void flushTelemetry();
  } catch { /* telemetria nunca quebra o produto */ }
}

/**
 * Envio SIMPLE REQUEST (auditoria de observabilidade v173): content-type text/plain e nenhum
 * header custom → o browser NÃO faz preflight OPTIONS (antes, cada flush custava 2 invocações
 * da EF e 1 RTT extra — GEOLAB-Auditoria-Performance-v1 §3.3). A EF client-telemetry v32 parseia
 * o corpo com req.json() (content-type-agnóstico) e aceita o access_token no CORPO para atribuir
 * member/tenant (simple request não carrega Authorization).
 */
let lastToken: string | null = null;

async function readAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    lastToken = data.session?.access_token ?? null;
  } catch { /* mantém o último conhecido */ }
  return lastToken;
}

function telemetryUrl(extra?: Record<string, string>): string {
  const u = new URL(`${env.supabaseUrl}/functions/v1/client-telemetry`);
  const trace = currentTraceId();
  if (trace) u.searchParams.set('trace_id', trace);
  for (const [k, v] of Object.entries(extra ?? {})) u.searchParams.set(k, v);
  return u.toString();
}

/** POST sem preflight. true = consumido (sucesso ou 4xx descartável); false = reenfileirar. */
async function postEvents(events: Array<Record<string, unknown>>, token: string | null): Promise<boolean> {
  try {
    const body = JSON.stringify(token ? { events, access_token: token } : { events });
    const res = await fetch(telemetryUrl(), { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body });
    if (res.ok) return true;
    return res.status >= 400 && res.status < 500; // 4xx (payload inválido/rate-limit): descarta o lote — nunca envenena a fila
  } catch {
    return false; // rede/5xx: reenfileira
  }
}

let flushing = false;
export async function flushTelemetry() {
  if (flushing) return;
  if (!queue.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  flushing = true;
  try {
    const token = await readAccessToken();
    while (queue.length) {
      const events = queue.splice(0, TELEMETRY_CONFIG.maxBatch);
      const consumed = await postEvents(events, token);
      if (!consumed) {
        queue.unshift(...events);
        if (queue.length > TELEMETRY_CONFIG.maxBuffer) queue.splice(0, queue.length - TELEMETRY_CONFIG.maxBuffer);
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

// Descarga no fim do ciclo de vida (pagehide/oculto): keepalive → sendBeacon. Sem storage.
// v173: lotes de 50 (cap da EF — antes um buffer cheio perdia o excedente) e simple request
// (sem preflight: o par OPTIONS+POST raramente completava durante o teardown da página).
function flushUnload() {
  if (!queue.length) return;
  const all = queue.splice(0, queue.length);
  for (let i = 0; i < all.length; i += 50) {
    const events = all.slice(i, i + 50);
    const body = JSON.stringify(lastToken ? { events, access_token: lastToken } : { events });
    try {
      void fetch(telemetryUrl({ apikey: env.supabaseAnonKey }), { method: 'POST', keepalive: true, headers: { 'content-type': 'text/plain;charset=UTF-8' }, body });
    } catch {
      try { navigator.sendBeacon?.(telemetryUrl({ apikey: env.supabaseAnonKey }), new Blob([body], { type: 'text/plain;charset=UTF-8' })); } catch { /* best-effort */ }
    }
  }
}

export function captureException(error: unknown, opts?: { category?: string; severity?: string; metadata?: Record<string, unknown> }) {
  const err = (error ?? {}) as { message?: string; stack?: string };
  emit({
    category: opts?.category ?? 'error',
    name: err.message ?? String(error),
    severity: opts?.severity ?? 'error',
    fingerprint: hash(`${err.message ?? error}:${(err.stack ?? '').slice(0, 120)}`),
    metadata: { stack: (err.stack ?? '').slice(0, TELEMETRY_CONFIG.maxStack), breadcrumbs: readBreadcrumbs(), ...(opts?.metadata ?? {}) },
  });
}

export function installTelemetry() {
  if (installed) return; installed = true;
  window.addEventListener('error', (ev) => emit({ category: 'error', name: ev.message || 'window.error', severity: 'error', fingerprint: hash(`${ev.message}:${ev.filename}:${ev.lineno}`), metadata: { filename: ev.filename, lineno: ev.lineno, colno: ev.colno, breadcrumbs: readBreadcrumbs() } }));
  window.addEventListener('unhandledrejection', (ev) => { const r = (ev.reason ?? {}) as { message?: string; stack?: string }; emit({ category: 'error', name: r.message ?? String(ev.reason), severity: 'error', fingerprint: hash(String(r.message ?? ev.reason)), metadata: { stack: (r.stack ?? '').slice(0, TELEMETRY_CONFIG.maxStack), breadcrumbs: readBreadcrumbs() } }); });
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushUnload(); });
  window.addEventListener('pagehide', flushUnload);
  window.addEventListener('online', () => { void flushTelemetry(); });
  if (!timer) timer = setInterval(() => { void flushTelemetry(); }, TELEMETRY_CONFIG.flushIntervalMs);
  addBreadcrumb('telemetry-installed', { app_version: APP_VERSION });
}
