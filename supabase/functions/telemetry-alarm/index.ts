/**
 * telemetry-alarm — avaliador HORÁRIO de saúde do sistema (GEOLAB).
 * Portado do GEOCON (Parte VII.1) e adaptado ao GEOLAB.
 *
 * Avalia 5 sinais transversais e abre/resolve incidentes em telemetry_alert (escopo por kind):
 *   1) taxa de erro por versão (v_client_health_by_version)
 *   2) Web Vitals p75 (v_client_vitals_daily)
 *   3) crons parados/falhando (cron_heartbeat)
 *   4) notificações em dead-letter (v_webhook_dead_letter_alerts → notify_event_outbox)
 *   5) Edge Functions degradadas (v_ef_metrics_hourly)
 * Somente na TRANSIÇÃO para crítico, escala (in-app/e-mail/webhook). Autorização fail-closed:
 * header x-cron-secret (do vault, usado pelo pg_cron — convenção 033/044) OU service-role/admin.
 *
 * Adaptações vs doador:
 *   - Segredo de cron: CRON_SECRET / x-cron-secret (não TELEMETRY_CRON_SECRET/x-telemetry-secret).
 *   - SITE_URL/SITE_PATH do GEOLAB.
 *   - notifyAdmins: send-notification NÃO está no source do GEOLAB (só deployada) → o payload abaixo
 *     é o do GEOCON e PRECISA ser conferido contra o contrato real (ver comentário em notifyAdmins).
 *     A detecção/raise/resolve funciona SEM notificação — os alertas ficam visíveis em telemetry_alert.
 */
import { handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/client.ts';
import { ok, fail, serverError } from '../_shared/response.ts';
import { authorizeServiceOrAdmin } from '../_shared/security.ts';
import { serveWithTelemetry } from '../_shared/telemetry.ts';

const FN_NAME = 'telemetry-alarm';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SITE_URL = Deno.env.get('SITE_URL') || 'https://lab.consultegeo.org';
const SITE_PATH = '/observabilidade';

type CriticalAlert = { key: string; title: string; detail: string; instanceTag: string };

type Settings = {
  alerting_enabled: boolean; alert_error_rate_pct: number; alert_min_events: number;
  alert_lcp_p75_ms: number; alert_inp_p75_ms: number; alert_notify_inapp: boolean;
  alert_cron_enabled: boolean; alert_webhook_dead_letter: number; alert_ef_p95_ms: number;
  alert_ef_5xx_min: number; alert_cls_p75: number; alert_fcp_p75_ms: number; alert_ttfb_p75_ms: number;
  alert_ef_latency_exempt: string[]; alert_ef_5xx_window_hours: number;
  alert_notify_email: boolean; alert_notify_webhook_url: string | null;
};
const DEFAULTS: Settings = {
  alerting_enabled: true, alert_error_rate_pct: 5, alert_min_events: 20, alert_lcp_p75_ms: 4000,
  alert_inp_p75_ms: 500, alert_notify_inapp: true, alert_cron_enabled: true, alert_webhook_dead_letter: 5,
  alert_ef_p95_ms: 3000, alert_ef_5xx_min: 3, alert_cls_p75: 0.25, alert_fcp_p75_ms: 3000,
  alert_ttfb_p75_ms: 1800, alert_ef_latency_exempt: ['backup-'], alert_ef_5xx_window_hours: 6,
  alert_notify_email: false, alert_notify_webhook_url: null,
};

async function handler(req: Request): Promise<Response> {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const svc = getServiceClient();

    // Autorização fail-closed: cron (x-cron-secret) OU service-role/admin.
    const cronSecret = Deno.env.get('CRON_SECRET') || '';
    const providedSecret = req.headers.get('x-cron-secret') || '';
    const viaCron = cronSecret !== '' && providedSecret === cronSecret;
    if (!viaCron) {
      const auth = await authorizeServiceOrAdmin(req, svc);
      if (!auth.ok) return fail(auth.error, auth.status);
    }

    let cfg = DEFAULTS;
    try {
      const { data } = await svc.from('telemetry_settings')
        .select('alerting_enabled,alert_error_rate_pct,alert_min_events,alert_lcp_p75_ms,alert_inp_p75_ms,alert_notify_inapp,alert_cron_enabled,alert_webhook_dead_letter,alert_ef_p95_ms,alert_ef_5xx_min,alert_cls_p75,alert_fcp_p75_ms,alert_ttfb_p75_ms,alert_ef_latency_exempt,alert_ef_5xx_window_hours,alert_notify_email,alert_notify_webhook_url')
        .eq('id', 1).maybeSingle();
      if (data) cfg = { ...DEFAULTS, ...data } as Settings;
    } catch { /* defaults */ }

    if (cfg.alerting_enabled === false) {
      await svc.rpc('record_cron_heartbeat', { p_job_name: FN_NAME, p_status: 'ok', p_error: null,
        p_expected_max_age_minutes: 60, p_description: 'Alerting desativado' });
      return ok({ status: 'disabled' });
    }

    const activeKeys: string[] = [];
    const raised: Array<{ key: string; severity: string }> = [];
    const newlyCritical: CriticalAlert[] = [];

    async function raise(p: { key: string; kind: string; severity: string; title: string; detail: string;
      metric: string; observed: number; threshold: number; app_version: string | null; }): Promise<void> {
      activeKeys.push(p.key);
      raised.push({ key: p.key, severity: p.severity });
      const { data: isNew } = await svc.rpc('raise_telemetry_alert', {
        p_alert_key: p.key, p_kind: p.kind, p_severity: p.severity, p_title: p.title,
        p_detail: p.detail, p_metric: p.metric, p_observed: p.observed, p_threshold: p.threshold, p_app_version: p.app_version,
      });
      if (isNew === true && p.severity === 'critical') {     // notifica só na TRANSIÇÃO crítica
        let instanceTag = String(Date.now());
        try {
          const { data: row } = await svc.from('telemetry_alert').select('first_seen_at')
            .eq('alert_key', p.key).eq('status', 'open').order('first_seen_at', { ascending: false }).limit(1).maybeSingle();
          if (row?.first_seen_at) instanceTag = String(new Date(row.first_seen_at).getTime());
        } catch { /* fallback: timestamp do run */ }
        newlyCritical.push({ key: p.key, title: p.title, detail: p.detail, instanceTag });
      }
    }

    // 1) Taxa de erro por versão (v_client_health_by_version)
    try {
      const { data: health } = await svc.from('v_client_health_by_version').select('app_version,events,errors,error_rate_pct');
      for (const h of (health || []) as Array<{app_version:string|null;events:number;errors:number;error_rate_pct:number|null}>) {
        const rate = Number(h.error_rate_pct || 0);
        if (h.events >= cfg.alert_min_events && rate >= cfg.alert_error_rate_pct) {
          const ver = h.app_version || '—';
          const severity = rate >= cfg.alert_error_rate_pct * 2 ? 'critical' : 'warning';
          await raise({ key: `error_rate:${ver}`, kind: 'error_rate', severity,
            title: `Taxa de erro elevada na versão ${ver}`,
            detail: `${rate}% de erros em ${h.events} eventos (limiar ${cfg.alert_error_rate_pct}%).`,
            metric: 'error_rate_pct', observed: rate, threshold: cfg.alert_error_rate_pct, app_version: ver });
        }
      }
    } catch { /* view ausente */ }

    // 2) Web Vitals p75 (v_client_vitals_daily) — LCP/INP/CLS/FCP/TTFB
    try {
      const { data: vitals } = await svc.from('v_client_vitals_daily').select('day,metric,p75,samples').order('day', { ascending: false }).limit(120);
      const latest = new Map<string, {p75:number|null;samples:number}>();
      for (const v of (vitals || []) as Array<{metric:string;p75:number|null;samples:number}>) if (!latest.has(v.metric)) latest.set(v.metric, v);
      const checks: Array<[string, number, boolean]> = [
        ['LCP', cfg.alert_lcp_p75_ms, false], ['INP', cfg.alert_inp_p75_ms, false],
        ['CLS', cfg.alert_cls_p75, true], ['FCP', cfg.alert_fcp_p75_ms, false], ['TTFB', cfg.alert_ttfb_p75_ms, false],
      ];
      for (const [metric, threshold, isScore] of checks) {
        const row = latest.get(metric);
        if (row && row.p75 != null && Number(row.p75) > threshold) {
          const shown = isScore ? Number(row.p75).toFixed(3) : `${Math.round(Number(row.p75))}ms`;
          await raise({ key: `vital:${metric}`, kind: 'web_vital', severity: 'warning',
            title: `${metric} degradado (p75 ${shown})`,
            detail: `p75 de ${metric} acima do limiar em ${row.samples} amostra(s).`,
            metric, observed: Number(row.p75), threshold, app_version: null });
        }
      }
    } catch { /* view ausente */ }

    // 3) Crons parados/falhando (cron_heartbeat)
    if (cfg.alert_cron_enabled !== false) {
      try {
        const { data: jobs } = await svc.from('cron_heartbeat').select('job_name,last_seen_at,expected_max_age_minutes,last_status,consecutive_failures,active');
        const nowMs = Date.now();
        for (const j of (jobs || []) as Array<{job_name:string;last_seen_at:string|null;expected_max_age_minutes:number|null;last_status:string|null;consecutive_failures:number|null;active:boolean|null}>) {
          if (j.active === false) continue;
          if (j.job_name === FN_NAME) continue;             // não alarma sobre si mesmo
          const fails = Number(j.consecutive_failures || 0);
          const maxAge = Number(j.expected_max_age_minutes || 0);
          const ageMin = j.last_seen_at ? (nowMs - new Date(j.last_seen_at).getTime()) / 60000 : Infinity;
          const stale = maxAge > 0 && ageMin > maxAge;
          if (fails > 0 || stale || j.last_status === 'error') {
            const severity = (fails >= 3 || (maxAge > 0 && ageMin > maxAge * 2)) ? 'critical' : 'warning';
            const ageTxt = Number.isFinite(ageMin) ? `${Math.round(ageMin)} min atrás` : 'nunca executou';
            await raise({ key: `cron:${j.job_name}`, kind: 'cron', severity,
              title: `Cron "${j.job_name}" ${stale ? 'atrasado' : 'falhando'}`,
              detail: `Última execução ${ageTxt}; ${fails} falha(s) consecutiva(s); status ${j.last_status || '—'}.`,
              metric: 'cron_age_min', observed: Number.isFinite(ageMin) ? Math.round(ageMin) : 0, threshold: maxAge, app_version: null });
          }
        }
      } catch { /* tabela ausente */ }
    }

    // 4) Notificações em dead-letter (v_webhook_dead_letter_alerts → notify_event_outbox)
    try {
      const { data: dls } = await svc.from('v_webhook_dead_letter_alerts').select('tenant_id,dead_letter_count,oldest_dead_at,sample_error');
      for (const d of (dls || []) as Array<{tenant_id:string|null;dead_letter_count:number|null;oldest_dead_at:string|null;sample_error:string|null}>) {
        const count = Number(d.dead_letter_count || 0);
        if (count >= cfg.alert_webhook_dead_letter) {
          const severity = count >= cfg.alert_webhook_dead_letter * 3 ? 'critical' : 'warning';
          await raise({ key: `webhook_dl:${d.tenant_id || 'all'}`, kind: 'webhook', severity,
            title: `Notificações na fila morta (${count})`,
            detail: `${count} evento(s) em dead-letter. Ex.: ${(d.sample_error || '—').slice(0, 160)}`,
            metric: 'dead_letter_count', observed: count, threshold: cfg.alert_webhook_dead_letter, app_version: null });
        }
      }
    } catch { /* view ausente */ }

    // 5) Edge Functions degradadas (v_ef_metrics_hourly): p95 última hora + soma de 5xx na janela
    try {
      const windowH = Math.max(1, Number(cfg.alert_ef_5xx_window_hours || 6));
      const sinceIso = new Date(Date.now() - windowH * 3600000).toISOString();
      const { data: efs } = await svc.from('v_ef_metrics_hourly').select('fn_name,hour,calls,errors,errors_5xx,p95_ms')
        .gte('hour', sinceIso).order('hour', { ascending: false }).limit(1000);
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
          if (over5xx) reasons.push(`${fivexx} erro(s) 5xx em ${windowH}h`);
          if (overP95) reasons.push(`p95 ${p95}ms na última hora`);
          await raise({ key: `ef:${e.fn_name}`, kind: 'edge_function', severity,
            title: `Edge Function "${e.fn_name}" degradada`, detail: reasons.join(' · '),
            metric: over5xx ? 'errors_5xx' : 'p95_ms', observed: over5xx ? fivexx : p95,
            threshold: over5xx ? cfg.alert_ef_5xx_min : cfg.alert_ef_p95_ms, app_version: null });
        }
      }
    } catch { /* view ausente */ }

    // 6) Resolve o que saiu de alarme (escopo por kind via resolve_telemetry_alerts)
    let resolved = 0;
    try { const { data } = await svc.rpc('resolve_telemetry_alerts', { p_active_keys: activeKeys }); resolved = Number(data || 0); } catch { /* ignore */ }

    // 7) Escalonamento das transições críticas: in-app + e-mail + webhook (best-effort)
    let notified = 0; let webhookSent = 0;
    if (newlyCritical.length > 0) {
      const wantInApp = cfg.alert_notify_inapp !== false;
      const wantEmail = cfg.alert_notify_email === true;
      if (wantInApp || wantEmail) notified = await notifyAdmins(svc, newlyCritical, { inApp: wantInApp, email: wantEmail });
      if (cfg.alert_notify_webhook_url) webhookSent = await notifyWebhook(cfg.alert_notify_webhook_url, newlyCritical);
    }

    const hasCritical = raised.some((r) => r.severity === 'critical');
    await svc.rpc('record_cron_heartbeat', { p_job_name: FN_NAME,
      p_status: raised.length ? 'warning' : 'ok',
      p_error: raised.length ? `${raised.length} alerta(s) ativo(s)${hasCritical ? ' (crítico)' : ''}` : null,
      p_expected_max_age_minutes: 60, p_description: 'Alerting de saúde do sistema' });
    return ok({ status: raised.length ? 'warning' : 'ok', raised: raised.length, resolved, notified, webhook: webhookSent });
  } catch (e) { return serverError(e); }
}

/**
 * ADAPTAR (GEOLAB): a EF send-notification existe deployada mas NÃO está no source — então o contrato
 * abaixo é o do GEOCON e PRECISA ser conferido (campos recipient_member_id/send_email/send_in_app/
 * dedupe_key/event_type, e se event_type 'system' é válido em notification_event_types). A detecção e o
 * registro do incidente (telemetry_alert) funcionam SEM isto; a notificação é o acréscimo. Nunca derruba o cron.
 */
async function notifyAdmins(
  svc: ReturnType<typeof getServiceClient>,
  alerts: CriticalAlert[],
  channels: { inApp: boolean; email: boolean },
): Promise<number> {
  if (alerts.length === 0 || !SUPABASE_URL || !SERVICE_ROLE_KEY) return 0;
  if (!channels.inApp && !channels.email) return 0;
  let admins: Array<{ member_id: string }> = [];
  try { const { data } = await svc.rpc('telemetry_admin_member_ids'); admins = (data || []); } catch { return 0; }
  if (admins.length === 0) return 0;
  let sent = 0;
  for (const a of alerts) {
    const title = `Alerta crítico de telemetria: ${a.title}`;
    for (const adm of admins) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY },
          body: JSON.stringify({
            recipient_member_id: adm.member_id, title, body: a.detail, link: SITE_PATH,
            event_type: 'system', send_email: channels.email, send_in_app: channels.inApp,
            entity_type: 'telemetry_alert',
            dedupe_key: `telemetry_alert:${a.key}:${a.instanceTag}:${adm.member_id}`,
            metadata: { source: FN_NAME, alert_key: a.key, instance: a.instanceTag },
          }),
        });
        if (res.ok) sent++;
      } catch { /* notificação nunca derruba o cron */ }
    }
  }
  return sent;
}

// Slack ("text") e Discord ("content") cobertos no mesmo payload. URL vem de telemetry_settings.alert_notify_webhook_url.
async function notifyWebhook(url: string, alerts: CriticalAlert[]): Promise<number> {
  if (!url || alerts.length === 0) return 0;
  const lines = alerts.map((a) => `• ${a.title} — ${a.detail}`).join('\n');
  const text = `[Telemetria] ${alerts.length} incidente(s) crítico(s)\n${lines}\nPainel: ${SITE_URL}${SITE_PATH}`;
  try {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text }), signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok ? 1 : 0;
  } catch { return 0; }
}

serveWithTelemetry(FN_NAME, handler);
