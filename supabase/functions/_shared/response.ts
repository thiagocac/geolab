import { json as baseJson } from './core.ts';
export function json(body: unknown, init: ResponseInit = {}) { return baseJson(body, init); }
export function fail(message: string, status = 400, details?: unknown) { return baseJson({ ok: false, error: message, details }, { status }); }
