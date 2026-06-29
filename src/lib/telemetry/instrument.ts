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

export async function flushTelemetry() {
  if (!queue.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const events = queue.splice(0, TELEMETRY_CONFIG.maxBatch);
  try {
    await supabase.functions.invoke('client-telemetry', { body: { events } });
    if (queue.length) void flushTelemetry();
  } catch {
    queue.unshift(...events);
    if (queue.length > TELEMETRY_CONFIG.maxBuffer) queue.splice(0, queue.length - TELEMETRY_CONFIG.maxBuffer);
  }
}

// Descarga no fim do ciclo de vida (pagehide/oculto): keepalive → sendBeacon. Sem storage.
function flushUnload() {
  if (!queue.length) return;
  const events = queue.splice(0, queue.length);
  try {
    const url = `${env.supabaseUrl}/functions/v1/client-telemetry`; // OBS-001/LGPD-001: apikey vai no header, fora da query (não vaza em logs)
    const payload = JSON.stringify({ events });
    void fetch(url, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json', apikey: env.supabaseAnonKey }, body: payload });
  } catch {
    try { navigator.sendBeacon?.(`${env.supabaseUrl}/functions/v1/client-telemetry?apikey=${env.supabaseAnonKey}`, new Blob([JSON.stringify({ events })], { type: 'application/json' })); } catch { /* best-effort */ }
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
