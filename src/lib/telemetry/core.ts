export const APP_VERSION = 'v112';
export type TelemetryLevel = 'debug' | 'info' | 'warn' | 'error';

export const TELEMETRY_CONFIG = { maxBatch: 25, flushIntervalMs: 10_000, maxBuffer: 200, maxMessage: 2000, maxStack: 8000 };

function uuid() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2) + Date.now().toString(16); }

const SESSION_ID = uuid();           // 1 sessão = 1 carga de página (sem storage — check-source proíbe)
let traceId = SESSION_ID;
let ctx: Record<string, unknown> = {};

type Breadcrumb = { at: string; name: string; payload?: Record<string, unknown> };
const breadcrumbs: Breadcrumb[] = [];

export function addBreadcrumb(name: string, payload?: Record<string, unknown>) {
  breadcrumbs.push({ at: new Date().toISOString(), name, payload });
  if (breadcrumbs.length > 30) breadcrumbs.shift();
}
export function readBreadcrumbs() { return [...breadcrumbs]; }
export function resetBreadcrumbs() { breadcrumbs.length = 0; }
export function sessionId() { return SESSION_ID; }
export function currentTraceId() { return traceId; }
export function newTrace() { traceId = uuid(); resetBreadcrumbs(); return traceId; }
export function setContext(patch: Record<string, unknown>) { ctx = { ...ctx, ...patch }; }
export function readContext() { return { ...ctx }; }
// compat retro
export function readTelemetryContext() { return { appVersion: APP_VERSION, breadcrumbs: readBreadcrumbs() }; }
