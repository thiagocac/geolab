/**
 * client-telemetry — ingestão de telemetria do frontend (GEOLAB).
 * Portado do GEOCON e ADAPTADO: aceita o vocabulário LEGADO que o frontend v57 já emite
 * (name/severity/at/url_path/value-no-topo, category 'vital') E o CANÔNICO (message/level/
 * occurred_at/url + metadata.value, category 'web-vital'). Normaliza para canônico e grava
 * em client_telemetry_log (a 048 é a fonte de verdade). Assim a EF pode subir ANTES do novo
 * SDK (Camada 5) e a telemetria que já é coletada para de cair no vazio.
 *
 * Corpo: lote { events: [...] } OU evento único legado. Insere tudo em 1 chamada.
 * Rate-limit por (ip:session)/min conta por REQUISIÇÃO. Honra kill-switch ingest_enabled
 * e sample_rate (erros/fatais sempre mantidos). verify_jwt=false (browser no unload).
 *
 * v32 (auditoria de observabilidade 2026-07-06) — SIMPLE REQUEST sem preflight:
 *   - O frontend v175+ envia com content-type text/plain e SEM headers custom → zero OPTIONS
 *     (o preflight dobrava as invocações da EF; ver GEOLAB-Auditoria-Performance-v1 §3.3).
 *     req.json() não exige content-type — parseia o texto normalmente.
 *   - Como simple request não carrega Authorization, o token pode vir no CORPO
 *     ({ events, access_token }) — mesma proteção TLS; usado só para atribuir member/tenant.
 *     Fallback: Authorization header (clientes antigos seguem funcionando).
 */
import { handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/client.ts';
import { ok, fail, serverError } from '../_shared/response.ts';
import { serveWithTelemetry } from '../_shared/telemetry.ts';
import { clientIp } from '../_shared/security.ts';

const FN_NAME = 'client-telemetry';
const MAX_MESSAGE = 2000;
const MAX_STACK = 12000;
const MAX_EVENTS_PER_REQUEST = 50;
const RATE_LIMIT_PER_MINUTE = 120;
const ALLOWED_LEVELS = new Set(['debug', 'info', 'warn', 'error', 'fatal']);

// Evento canônico (o que vai para a tabela). metadata carrega value/name/rating/trace_id.
type EventInput = {
  occurred_at?: string;
  level?: string;
  category?: string;
  message?: string;
  stack?: string;
  url?: string;
  app_version?: string;
  session_id?: string;
  trace_id?: string;
  metadata?: Record<string, unknown>;
};

// Evento cru: canônico + campos LEGADOS do frontend v57 do GEOLAB.
type RawEvent = EventInput & {
  name?: string;        // legado → message (e metadata.name p/ vitais/métricas)
  severity?: string;    // legado → level
  at?: string;          // legado → occurred_at
  url_path?: string;    // legado → url
  value?: unknown;      // legado (topo) → metadata.value
  fingerprint?: string; // legado — IGNORADO (o trigger recomputa error_fingerprint no servidor)
};

function cut(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  return value.slice(0, max);
}

function normalizeLevel(v: unknown): string {
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  return ALLOWED_LEVELS.has(s) ? s : 'info';
}

function isErrorLevel(level: unknown): boolean {
  const s = typeof level === 'string' ? level.toLowerCase() : '';
  return s === 'error' || s === 'fatal';
}

/** Mapeia o vocabulário legado do GEOLAB para o canônico. Idempotente sobre payloads já canônicos. */
function toCanonical(e: RawEvent): EventInput {
  const rawCat = typeof e.category === 'string' ? e.category : '';
  const category = rawCat === 'vital' ? 'web-vital' : rawCat;        // 'vital' (legado) → 'web-vital'
  const message =
    (typeof e.message === 'string' ? e.message : null) ??
    (typeof e.name === 'string' ? e.name : null) ?? '';
  const meta: Record<string, unknown> = (e.metadata && typeof e.metadata === 'object') ? { ...e.metadata } : {};
  // value de topo (legado) → metadata.value (as views leem metadata->>'value' como numérico)
  if (meta.value === undefined && e.value !== undefined && e.value !== null) meta.value = e.value;
  // nome da métrica em metadata.name (vitais/métricas)
  if ((category === 'web-vital' || category === 'metric') && meta.name === undefined && typeof e.name === 'string') {
    meta.name = e.name;
  }
  return {
    occurred_at: (typeof e.occurred_at === 'string' ? e.occurred_at : undefined) ?? (typeof e.at === 'string' ? e.at : undefined),
    level: (typeof e.level === 'string' ? e.level : undefined) ?? (typeof e.severity === 'string' ? e.severity : undefined),
    category: category || undefined,
    message,
    stack: typeof e.stack === 'string' ? e.stack : undefined,
    url: (typeof e.url === 'string' ? e.url : undefined) ?? (typeof e.url_path === 'string' ? e.url_path : undefined),
    app_version: typeof e.app_version === 'string' ? e.app_version : undefined,
    session_id: typeof e.session_id === 'string' ? e.session_id : undefined,
    trace_id: typeof e.trace_id === 'string' ? e.trace_id : undefined,
    metadata: meta,
  };
}

/**
 * Resolve member/tenant a partir do token: 1º o access_token do CORPO (simple request v175+),
 * 2º o Authorization header (legado). Best-effort — telemetria anônima é aceita.
 */
async function resolveMember(req: Request, svc: ReturnType<typeof getServiceClient>, bodyToken?: string) {
  const auth = req.headers.get('Authorization') || '';
  const headerToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const token = (typeof bodyToken === 'string' && bodyToken.startsWith('eyJ')) ? bodyToken.trim() : headerToken;
  if (!token || !token.startsWith('eyJ')) return { member_id: null, tenant_id: null };
  const { data: userResult } = await svc.auth.getUser(token);
  if (!userResult?.user) return { member_id: null, tenant_id: null };
  const { data: member } = await svc
    .from('members')
    .select('id,tenant_id')
    .eq('auth_id', userResult.user.id)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle();
  return { member_id: member?.id || null, tenant_id: member?.tenant_id || null };
}

async function readSettings(svc: ReturnType<typeof getServiceClient>): Promise<{ enabled: boolean; sampleRate: number }> {
  // Best-effort: se a tabela não existir ou der erro, assume habilitado e sample 1.0.
  try {
    const { data, error } = await svc.from('telemetry_settings').select('ingest_enabled,sample_rate').eq('id', 1).maybeSingle();
    if (error || !data) return { enabled: true, sampleRate: 1 };
    const rate = Number(data.sample_rate);
    return { enabled: data.ingest_enabled !== false, sampleRate: Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 1 };
  } catch {
    return { enabled: true, sampleRate: 1 };
  }
}

async function handler(req: Request): Promise<Response> {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return fail('Método não permitido', 405);

  try {
    // req.json() parseia o corpo independentemente do content-type (text/plain incluso).
    const payload = await req.json().catch(() => ({})) as (RawEvent & { events?: RawEvent[]; access_token?: string });

    // Lote { events: [...] } OU evento único legado (message OU name).
    const rawEvents: RawEvent[] = Array.isArray(payload.events)
      ? payload.events
      : ((payload.message || payload.name) ? [payload] : []);
    if (rawEvents.length === 0) return fail('Nenhum evento no corpo (events[], message ou name).', 400);

    // Normaliza legado→canônico e limita o lote.
    const events: EventInput[] = rawEvents.slice(0, MAX_EVENTS_PER_REQUEST).map(toCanonical);

    const svc = getServiceClient();

    // Rate-limit por requisição (o lote é 1 request).
    const ip = clientIp(req);
    const sid = String(events[0]?.session_id || 'anon').slice(0, 64);
    const key = `${ip || 'unknown'}:${sid}`;
    const minute = new Date();
    minute.setSeconds(0, 0);
    const { data: calls, error: rlError } = await svc.rpc('bump_client_telemetry_rate_limit', {
      p_actor_key: key,
      p_bucket_start: minute.toISOString(),
    });
    if (rlError) return fail(rlError.message, 400);
    if (Number(calls || 0) > RATE_LIMIT_PER_MINUTE) return fail('rate_limited', 429);

    const settings = await readSettings(svc);
    if (!settings.enabled) return ok({ recorded: 0, skipped: true });

    // Amostragem server-side: erros/fatais sempre mantidos; sample_rate=1 mantém tudo.
    const sampled = settings.sampleRate >= 1
      ? events
      : events.filter((e) => isErrorLevel(e.level) || Math.random() < settings.sampleRate);
    if (sampled.length === 0) return ok({ recorded: 0, sampled_out: events.length });

    const actor = await resolveMember(req, svc, payload.access_token);
    const userAgent = cut(req.headers.get('user-agent'), 500);

    const rows = sampled
      .map((e) => {
        const message = cut(e.message, MAX_MESSAGE);
        if (!message) return null;                              // sem message/name → descarta
        const meta = (e.metadata && typeof e.metadata === 'object') ? e.metadata : {};
        const metadata = e.trace_id ? { ...meta, trace_id: cut(e.trace_id, 128) } : meta;
        return {
          occurred_at: e.occurred_at || new Date().toISOString(),
          level: normalizeLevel(e.level),
          category: cut(e.category, 64) || 'runtime',
          message,
          stack: cut(e.stack, MAX_STACK),
          url: cut(e.url, 1000),
          user_agent: userAgent,
          member_id: actor.member_id,
          tenant_id: actor.tenant_id,
          app_version: cut(e.app_version, 64),
          session_id: cut(e.session_id, 128),
          metadata,
          ip_address: ip,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) return fail('Eventos inválidos (sem message).', 400);

    const { error } = await svc.from('client_telemetry_log').insert(rows);
    if (error) return fail(error.message, 400);
    return ok({ recorded: rows.length });
  } catch (e) {
    return serverError(e);
  }
}

serveWithTelemetry(FN_NAME, handler);
