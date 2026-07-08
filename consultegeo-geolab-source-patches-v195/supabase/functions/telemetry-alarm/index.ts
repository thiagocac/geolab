// telemetry-alarm — alerting de saude (client health, web-vitals, crons, webhooks, EFs).
// v44 (2026-07-08): error_rate so alarma a versao VIVA (mais nova com volume) e as mais novas;
// versoes antigas em cache (bugs ja corrigidos no vivo) nao alarmam. Ver eventsByVer/refNum.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
const corsHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const handleCors = (req: Request): Response | null => (req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null);
const _json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders, ...(init.headers ?? {}) } });
const fail = (message: string, status = 400, details?: unknown) => _json({ ok: false, error: message, details }, { status });
const ok = (body: unknown = {}, init: ResponseInit = {}) => { const payload = body && typeof body === 'object' && !Array.isArray(body) ? { ok: true, ...(body as Record<string, unknown>) } : { ok: true, data: body }; return _json(payload, { status: 200, ...init }); };
const serverError = (e: unknown, status = 500) => _json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status });
const serviceClient = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const getServiceClient = serviceClient;
function _ctTimingSafeEqual(a: string, b: string): boolean { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function authorizeServiceOrAdmin(req: Request, svc: ReturnType<typeof serviceClient>): Promise<{ ok: true; mode: 'service' | 'admin' } | { ok: false; status: number; error: string }> { const auth = req.headers.get('Authorization') || ''; if (!auth.startsWith('Bearer ')) return { ok: false, status: 401, error: 'missing_bearer' }; const token = auth.slice(7).trim(); const sk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''; if (sk && _ctTimingSafeEqual(token, sk)) return { ok: true, mode: 'service' }; if (!token.startsWith('eyJ')) return { ok: false, status: 401, error: 'invalid_token' }; const { data: u, error } = await svc.auth.getUser(token); if (error || !u?.user) return { ok: false, status: 401, error: 'invalid_jwt' }; const { data: member } = await svc.from('members').select('id,tenant_id,role,roles').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); const roles = Array.isArray((member as { roles?: unknown })?.roles) ? (member as { roles: string[] }).roles : []; if (!member || (member.role !== 'admin' && !roles.includes('admin'))) return { ok: false, status: 403, error: 'admin_required' }; return { ok: true, mode: 'admin' }; }
const readTraceId = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _ctActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const svc = serviceClient(); const { data: u, error } = await svc.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await svc.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _ctFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null; traceId: string | null }) { try { const svc = serviceClient(); const actor = await _ctActor(req); await svc.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(o.traceId ? { trace_id: o.traceId } : {}) } }); } catch { /* nunca bloqueia */ } }
function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); const traceId = readTraceId(req); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _ctFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage, traceId }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }

const FN_NAME = 'telemetry-alarm';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SITE_URL = Deno.env.get('SITE_URL') || 'https://app.concresoft.io';
const SITE_PATH = '/observabilidade';

type CriticalAlert = { key: string; title: string; detail: string; instanceTag: string };
type Settings = { alerting_enabled: boolean; alert_error_rate_pct: number; alert_min_events: number; alert_lcp_p75_ms: number; alert_inp_p75_ms: number; alert_notify_inapp: boolean; alert_cron_enabled: boolean; alert_webhook_dead_letter: number; alert_ef_p95_ms: number; alert_ef_5xx_min: number; alert_cls_p75: number; alert_fcp_p75_ms: number; alert_ttfb_p75_ms: number; alert_ef_latency_exempt: string[]; alert_ef_5xx_window_hours: number; alert_notify_email: boolean; alert_notify_webhook_url: string | null; };
const DEFAULTS: Settings = { alerting_enabled: true, alert_error_rate_pct: 5, alert_min_events: 20, alert_lcp_p75_ms: 4000, alert_inp_p75_ms: 500, alert_notify_inapp: true, alert_cron_enabled: true, alert_webhook_dead_letter: 5, alert_ef_p95_ms: 3000, alert_ef_5xx_min: 3, alert_cls_p75: 0.25, alert_fcp_p75_ms: 3000, alert_ttfb_p75_ms: 1800, alert_ef_latency_exempt: ['backup-'], alert_ef_5xx_window_hours: 6, alert_notify_email: false, alert_notify_webhook_url: null };

async function handler(req: Request): Promise<Response> {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const svc = getServiceClient();
    const cronSecret = Deno.env.get('CRON_SECRET') || '';
    const providedSecret = req.headers.get('x-cron-secret') || '';
    const viaCron = cronSecret !== '' && providedSecret === cronSecret;
    if (!viaCron) { const auth = await authorizeServiceOrAdmin(req, svc); if (!auth.ok) return fail(auth.error, auth.status); }
    let cfg = DEFAULTS;
    try {
      const { data } = await svc.from('telemetry_settings').select('alerting_enabled,alert_error_rate_pct,alert_min_events,alert_lcp_p75_ms,alert_inp_p75_ms,alert_notify_inapp,alert_cron_enabled,alert_webhook_dead_letter,alert_ef_p95_ms,alert_ef_5xx_min,alert_cls_p75,alert_fcp_p75_ms,alert_ttfb_p75_ms,alert_ef_latency_exempt,alert_ef_5xx_window_hours,alert_notify_email,alert_notify_webhook_url').eq('id', 1).maybeSingle();
      if (data) cfg = { ...DEFAULTS, ...data } as Settings;
    } catch { /* defaults */ }
    if (cfg.alerting_enabled === false) {
      await svc.rpc('record_cron_heartbeat', { p_job_name: FN_NAME, p_status: 'ok', p_error: null, p_expected_max_age_minutes: 60, p_description: 'Alerting desativado' });
      return ok({ status: 'disabled' });
    }
    const activeKeys: string[] = [];
    const raised: Array<{ key: string; severity: string }> = [];
    const newlyCritical: CriticalAlert[] = [];
    async function raise(p: { key: string; kind: string; severity: string; title: string; detail: string; metric: string; observed: number; threshold: number; app_version: string | null; }): Promise<void> {
      activeKeys.push(p.key);
      raised.push({ key: p.key, severity: p.severity });
      const { data: isNew } = await svc.rpc('raise_telemetry_alert', { p_alert_key: p.key, p_kind: p.kind, p_severity: p.severity, p_title: p.title, p_detail: p.detail, p_metric: p.metric, p_observed: p.observed, p_threshold: p.threshold, p_app_version: p.app_version });
      if (isNew === true && p.severity === 'critical') {
        let instanceTag = String(Date.now());
        try { const { data: row } = await svc.from('telemetry_alert').select('first_seen_at').eq('alert_key', p.key).eq('status', 'open').order('first_seen_at', { ascending: false }).limit(1).maybeSingle(); if (row?.first_seen_at) instanceTag = String(new Date(row.first_seen_at).getTime()); } catch { /* fallback */ }
        newlyCritical.push({ key: p.key, title: p.title, detail: p.detail, instanceTag });
      }
    }
    try {
      const { data: health } = await svc.from('v_client_health_by_version').select('app_version,events,errors,error_rate_pct');
      const healthRows = (health || []) as Array<{app_version:string|null;events:number;errors:number;error_rate_pct:number|null}>;
      // Referencia = a versao MAIS NOVA (maior vNNN) com volume relevante (>= alert_min_events).
      // Clientes em CACHE em versoes ANTERIORES a ela re-disparam error_rate por bugs ja corrigidos
      // no release vivo (chunk-load pos-deploy, 'invalid date' do dashboard etc.) e nao sao
      // acionaveis (nao da p/ corrigir um cliente que nao atualiza). So a referencia e as MAIS NOVAS
      // (canario de um novo deploy) alarmam; as antigas envelhecem sozinhas. Nao usa "a mais
      // popular": a janela da view e de 7 dias, entao a versao anterior ainda pode ter mais eventos
      // acumulados que a viva.
      const verNum = (v: string | null): number => { const m = /^v(\d+)$/.exec(String(v ?? '')); return m ? Number(m[1]) : Number.NaN; };
      const eventsByVer = new Map<number, number>();
      for (const h of healthRows) { const n = verNum(h.app_version); if (Number.isFinite(n)) eventsByVer.set(n, (eventsByVer.get(n) || 0) + Number(h.events || 0)); }
      let refNum = -1;
      for (const [n, ev] of eventsByVer) { if (ev >= cfg.alert_min_events && n > refNum) refNum = n; }
      for (const h of healthRows) {
        const rate = Number(h.error_rate_pct || 0);
        if (h.events >= cfg.alert_min_events && rate >= cfg.alert_error_rate_pct) {
          const ver = h.app_version || '-';
          const n = verNum(h.app_version);
          if (refNum >= 0 && Number.isFinite(n) && n < refNum) continue;
          const severity = rate >= cfg.alert_error_rate_pct * 2 ? 'critical' : 'warning';
          await raise({ key: 'error_rate:' + ver, kind: 'error_rate', severity, title: 'Taxa de erro elevada na versao ' + ver, detail: rate + '% de erros em ' + h.events + ' eventos (limiar ' + cfg.alert_error_rate_pct + '%).', metric: 'error_rate_pct', observed: rate, threshold: cfg.alert_error_rate_pct, app_version: ver });
        }
      }
    } catch { /* view ausente */ }
    try {
      const { data: vitals } = await svc.from('v_client_vitals_daily').select('day,metric,p75,samples').order('day', { ascending: false }).limit(120);
      const latest = new Map<string, {p75:number|null;samples:number}>();
      for (const v of (vitals || []) as Array<{metric:string;p75:number|null;samples:number}>) if (!latest.has(v.metric)) latest.set(v.metric, v);
      const checks: Array<[string, number, boolean]> = [ ['LCP', cfg.alert_lcp_p75_ms, false], ['INP', cfg.alert_inp_p75_ms, false], ['CLS', cfg.alert_cls_p75, true], ['FCP', cfg.alert_fcp_p75_ms, false], ['TTFB', cfg.alert_ttfb_p75_ms, false] ];
      for (const [metric, threshold, isScore] of checks) {
        const row = latest.get(metric);
        if (row && row.p75 != null && Number(row.p75) > threshold) {
          const shown = isScore ? Number(row.p75).toFixed(3) : Math.round(Number(row.p75)) + 'ms';
          await raise({ key: 'vital:' + metric, kind: 'web_vital', severity: 'warning', title: metric + ' degradado (p75 ' + shown + ')', detail: 'p75 de ' + metric + ' acima do limiar em ' + row.samples + ' amostra(s).', metric, observed: Number(row.p75), threshold, app_version: null });
        }
      }
    } catch { /* view ausente */ }
    if (cfg.alert_cron_enabled !== false) {
      try {
        const { data: jobs } = await svc.from('cron_heartbeat').select('job_name,last_seen_at,expected_max_age_minutes,last_status,consecutive_failures,active');
        const nowMs = Date.now();
        for (const j of (jobs || []) as Array<{job_name:string;last_seen_at:string|null;expected_max_age_minutes:number|null;last_status:string|null;consecutive_failures:number|null;active:boolean|null}>) {
          if (j.active === false) continue;
          if (j.job_name === FN_NAME) continue;
          const fails = Number(j.consecutive_failures || 0);
          const maxAge = Number(j.expected_max_age_minutes || 0);
          const ageMin = j.last_seen_at ? (nowMs - new Date(j.last_seen_at).getTime()) / 60000 : Infinity;
          const stale = maxAge > 0 && ageMin > maxAge;
          if (fails > 0 || stale || j.last_status === 'error') {
            const severity = (fails >= 3 || (maxAge > 0 && ageMin > maxAge * 2)) ? 'critical' : 'warning';
            const ageTxt = Number.isFinite(ageMin) ? Math.round(ageMin) + ' min atras' : 'nunca executou';
            await raise({ key: 'cron:' + j.job_name, kind: 'cron', severity, title: 'Cron ' + j.job_name + ' ' + (stale ? 'atrasado' : 'falhando'), detail: 'Ultima execucao ' + ageTxt + '; ' + fails + ' falha(s) consecutiva(s); status ' + (j.last_status || '-') + '.', metric: 'cron_age_min', observed: Number.isFinite(ageMin) ? Math.round(ageMin) : 0, threshold: maxAge, app_version: null });
          }
        }
      } catch { /* tabela ausente */ }
    }
    try {
      const { data: dls } = await svc.from('v_webhook_dead_letter_alerts').select('tenant_id,dead_letter_count,oldest_dead_at,sample_error');
      for (const d of (dls || []) as Array<{tenant_id:string|null;dead_letter_count:number|null;oldest_dead_at:string|null;sample_error:string|null}>) {
        const count = Number(d.dead_letter_count || 0);
        if (count >= cfg.alert_webhook_dead_letter) {
          const severity = count >= cfg.alert_webhook_dead_letter * 3 ? 'critical' : 'warning';
          await raise({ key: 'webhook_dl:' + (d.tenant_id || 'all'), kind: 'webhook', severity, title: 'Notificacoes na fila morta (' + count + ')', detail: count + ' evento(s) em dead-letter. Ex.: ' + (d.sample_error || '-').slice(0, 160), metric: 'dead_letter_count', observed: count, threshold: cfg.alert_webhook_dead_letter, app_version: null });
        }
      }
    } catch { /* view ausente */ }
    try {
      const windowH = Math.max(1, Number(cfg.alert_ef_5xx_window_hours || 6));
      const sinceIso = new Date(Date.now() - windowH * 3600000).toISOString();
      const { data: efs } = await svc.from('v_ef_metrics_hourly').select('fn_name,hour,calls,errors,errors_5xx,p95_ms').gte('hour', sinceIso).order('hour', { ascending: false }).limit(1000);
      const latestEf = new Map<string, {fn_name:string;p95_ms:number}>();
      const sum5xxBy = new Map<string, number>(); const callsWindowBy = new Map<string, number>();
      for (const e of (efs || []) as Array<{fn_name:string;calls:number;errors_5xx:number;p95_ms:number}>) {
        if (!latestEf.has(e.fn_name)) latestEf.set(e.fn_name, e as never);
        sum5xxBy.set(e.fn_name, (sum5xxBy.get(e.fn_name) || 0) + Number(e.errors_5xx || 0));
        callsWindowBy.set(e.fn_name, (callsWindowBy.get(e.fn_name) || 0) + Number(e.calls || 0));
      }
      for (const e of latestEf.values()) {
        const fivexx = sum5xxBy.get(e.fn_name) || 0;
        const p95 = Number(e.p95_ms || 0);
        const latencyExempt = (cfg.alert_ef_latency_exempt || []).some((pref) => e.fn_name.startsWith(pref));
        const over5xx = fivexx >= cfg.alert_ef_5xx_min;
        const overP95 = !latencyExempt && p95 > cfg.alert_ef_p95_ms;
        if (over5xx || overP95) {
          const severity = (fivexx >= cfg.alert_ef_5xx_min * 3 || (overP95 && p95 > cfg.alert_ef_p95_ms * 2)) ? 'critical' : 'warning';
          const reasons: string[] = [];
          if (over5xx) reasons.push(fivexx + ' erro(s) 5xx em ' + windowH + 'h');
          if (overP95) reasons.push('p95 ' + p95 + 'ms na ultima hora');
          await raise({ key: 'ef:' + e.fn_name, kind: 'edge_function', severity, title: 'Edge Function ' + e.fn_name + ' degradada', detail: reasons.join(' - '), metric: over5xx ? 'errors_5xx' : 'p95_ms', observed: over5xx ? fivexx : p95, threshold: over5xx ? cfg.alert_ef_5xx_min : cfg.alert_ef_p95_ms, app_version: null });
        }
      }
    } catch { /* view ausente */ }
    let resolved = 0;
    try { const { data } = await svc.rpc('resolve_telemetry_alerts', { p_active_keys: activeKeys }); resolved = Number(data || 0); } catch { /* ignore */ }
    let notified = 0; let webhookSent = 0;
    if (newlyCritical.length > 0) {
      const wantInApp = cfg.alert_notify_inapp !== false;
      const wantEmail = cfg.alert_notify_email === true;
      if (wantInApp || wantEmail) notified = await notifyAdmins(svc, newlyCritical, { inApp: wantInApp, email: wantEmail });
      if (cfg.alert_notify_webhook_url) webhookSent = await notifyWebhook(cfg.alert_notify_webhook_url, newlyCritical);
    }
    // Heartbeat reflete EXECUCAO do job (rodou -> 'ok'), nao as descobertas. As descobertas ficam
    // no telemetry_alert (e sao notificadas). Antes marcava 'warning' quando havia alertas, o que
    // inflava consecutive_failures e gerava cron:<job> critico em cascata. Falhas reais de execucao
    // sao capturadas por staleness (sem heartbeat) / status 'error'.
    await svc.rpc('record_cron_heartbeat', { p_job_name: FN_NAME, p_status: 'ok', p_error: null, p_expected_max_age_minutes: 60, p_description: 'Alerting de saude do sistema' });
    return ok({ status: raised.length ? 'warning' : 'ok', raised: raised.length, resolved, notified, webhook: webhookSent });
  } catch (e) { return serverError(e); }
}

// notifyAdmins: e-mail dos alertas criticos via send-notification (unico ponto Resend).
// v34 (auditoria de observabilidade 2026-07-06): apos enviar com sucesso para >=1 admin, marca
// telemetry_alert.notified_at do alerta aberto. Sem isso, o backstop SQL
// (telemetry_notify_pending_alerts, agora sem filtro de kind) reenviaria o mesmo alerta na hora
// seguinte (e-mail duplicado). Alertas que ESCALARAM warning->critical (is_new=false) nao passam
// por aqui e ficam para o backstop — por design.
async function notifyAdmins(svc: ReturnType<typeof getServiceClient>, alerts: CriticalAlert[], channels: { inApp: boolean; email: boolean }): Promise<number> {
  if (!channels.email) return 0;
  if (alerts.length === 0 || !SUPABASE_URL) return 0;
  let admins: Array<{ member_id: string }> = [];
  try { const { data } = await svc.rpc('telemetry_admin_member_ids'); admins = (data || []); } catch { return 0; }
  if (admins.length === 0) return 0;
  const { data: settings } = await svc.from('notification_dispatch_settings').select('dispatch_secret').eq('id', true).maybeSingle();
  const secret = String(settings?.dispatch_secret ?? '');
  if (!secret) return 0;
  let sent = 0;
  const okKeys: string[] = [];
  for (const a of alerts) {
    const title = 'Alerta critico de telemetria: ' + a.title;
    let sentThis = 0;
    for (const adm of admins) {
      try {
        const res = await fetch(SUPABASE_URL + '/functions/v1/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret }, body: JSON.stringify({ member_id: adm.member_id, title, body: a.detail, deep_link: SITE_PATH, cta_label: 'Abrir Observabilidade', reference: a.key, event_type: 'system', entity_type: 'telemetry_alert', dedupe_key: 'telemetry_alert:' + a.key + ':' + a.instanceTag + ':' + adm.member_id }) });
        if (res.ok) { sent++; sentThis++; }
      } catch { /* notificacao nunca derruba o cron */ }
    }
    if (sentThis > 0) okKeys.push(a.key);
  }
  if (okKeys.length > 0) {
    try { await svc.from('telemetry_alert').update({ notified_at: new Date().toISOString() }).in('alert_key', okKeys).eq('status', 'open').is('notified_at', null); } catch { /* best-effort */ }
  }
  return sent;
}

async function notifyWebhook(url: string, alerts: CriticalAlert[]): Promise<number> {
  if (!url || alerts.length === 0) return 0;
  const lines = alerts.map((a) => '- ' + a.title + ' - ' + a.detail).join('\n');
  const text = '[Telemetria] ' + alerts.length + ' incidente(s) critico(s)\n' + lines + '\nPainel: ' + SITE_URL + SITE_PATH;
  try {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, content: text }), signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok ? 1 : 0;
  } catch { return 0; }
}

serveWithTelemetry(FN_NAME, handler);
