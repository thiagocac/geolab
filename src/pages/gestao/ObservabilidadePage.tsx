import { useState, useEffect, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { supabase } from '../../lib/supabase';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { AlertTriangle, CheckCircle, Bell } from '../../components/ui/icons';
import { buildDailySeries } from '../../lib/telemetry/metrics-math';

/**
 * Painel de observabilidade (admin) — lê as views + telemetry_alert + cron_heartbeat (todas admin-only
 * por RLS; security_invoker faz o filtro). Auto-refresh a cada 60s.
 *
 * DEPENDÊNCIA: regenerar database.types.ts após aplicar 048–050 (as tabelas/views novas precisam estar
 * tipadas) — senão o tsc/vite acusa "table não existe" em supabase.from(...). O esbuild (sem typecheck) passa.
 *
 * DS: usa PageHeader/Card/State do GEOLAB + classes CSS (card/table/kicker) + Tailwind. Os "pills" são
 * spans Tailwind (não acoplam ao enum de tons do Badge).
 *
 * v99 — banner de saúde · coluna "Notificação" (notified_at/076) · card do plano de controle (077) ·
 *       chip de família por kind · KPIs com cor · estado "ao vivo" + Atualizar · barra de crash-free.
 * v100 — incidentes investigáveis: filtros (severidade/família/não-notificados) + alternância
 *        Abertos|Resolvidos(7d) com duração até resolver (resolved_at) · sparkline 24h por Edge Function.
 */

const REFRESH_MS = 60_000;
const tipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)', fontSize: 13 } as const;

// Runners do "plano de controle" da telemetria: avaliam sinais e/ou enviam e-mail de incidente.
// Se algum atrasa, alertas podem não disparar (ou e-mails não sair) de forma silenciosa.
const CONTROL_PLANE = /^telemetry-(alarm|pg-alarm|email-alarm|release-alarm|ops-alarm|notify)$/;

type Mttr = {
  open_incidents: number; incidents_30d: number; resolved_30d: number; critical_30d: number;
  avg_mttr_minutes_30d: number | null;
};
type Incident = {
  alert_key: string; kind: string; severity: string; title: string; detail: string | null;
  metric: string | null; observed: number | null; threshold: number | null; app_version: string | null;
  first_seen_at: string; last_seen_at: string; resolved_at?: string | null; occurrences: number; notified_at: string | null;
};
type Cron = {
  job_name: string; last_seen_at: string | null; expected_max_age_minutes: number | null;
  last_status: string | null; consecutive_failures: number; active: boolean;
};
type Health = { app_version: string; events: number; errors: number; error_rate_pct: number | null; sessions: number };
type Release = { app_version: string; sessions: number; crash_free_sessions_pct: number | null };
type Ef = { fn_name: string; hour: string; calls: number; errors_5xx: number; p95_ms: number | null };
type Vital = { day: string; metric: string; p75: number | null; samples: number };

async function rows<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

function ageMin(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}
function humanMin(min: number): string {
  if (!Number.isFinite(min) || min < 0) return '—';
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
}
function fmtAge(iso: string | null): string {
  if (!iso) return 'nunca';
  return humanMin(ageMin(iso));
}
// Duração entre dois instantes (ex.: tempo até resolver = resolved_at - first_seen_at).
function fmtSpan(fromIso: string, toIso: string | null | undefined): string {
  if (!toIso) return '—';
  return humanMin((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000);
}

// kind -> família (namespaces disjuntos: EF cobre frontend/ef/release/cron; SQL cobre pg_/email/ops/schedule…)
function kindFamily(kind: string): { label: string; cls: string } {
  const k = (kind || '').toLowerCase();
  if (k.startsWith('pg_') || k === 'db_health') return { label: 'Banco', cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' };
  if (k === 'release_health' || k === 'crash_free') return { label: 'Release', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' };
  if (k === 'email_health' || k.startsWith('email')) return { label: 'E-mail', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' };
  if (k === 'ops_health') return { label: 'Ops', cls: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' };
  if (k === 'schedule_health' || k === 'cron') return { label: 'Agenda', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' };
  if (k === 'frontend_health' || k === 'web_vital' || k === 'error_rate') return { label: 'Frontend', cls: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300' };
  if (k.startsWith('ef_')) return { label: 'Edge Fn', cls: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300' };
  return { label: kind, cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
}

// Série horária (últimas N horas) de um campo, para sparkline por EF.
function buildHourly(list: Ef[], field: 'calls' | 'p95_ms', hours = 24): Array<number | null> {
  const byHour = new Map<string, number>();
  for (const r of list) {
    const k = String(r.hour).slice(0, 13); // YYYY-MM-DDTHH
    const v = Number(r[field]);
    if (Number.isFinite(v)) byHour.set(k, v);
  }
  const out: Array<number | null> = [];
  const now = Date.now();
  for (let i = hours - 1; i >= 0; i--) {
    const k = new Date(now - i * 3600_000).toISOString().slice(0, 13);
    out.push(byHour.has(k) ? byHour.get(k)! : null);
  }
  return out;
}

function SeverityPill({ s }: { s: string }) {
  const tone = s === 'critical'
    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{s}</span>;
}
function FamilyPill({ kind }: { kind: string }) {
  const fam = kindFamily(kind);
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${fam.cls}`} title={kind}>{fam.label}</span>;
}
// Surfacing do notified_at (076): crítico aberto e NÃO notificado é problema (o e-mail não saiu).
function NotifyPill({ at, severity }: { at: string | null; severity: string }) {
  if (at) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
        title={new Date(at).toLocaleString('pt-BR')}>
        notificado · {fmtAge(at)}
      </span>
    );
  }
  if (severity === 'critical') {
    return <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">não notificado</span>;
  }
  return <span className="text-xs text-slate-400">—</span>;
}
function CronPill({ c }: { c: Cron }) {
  const stale = (c.expected_max_age_minutes ?? 0) > 0 && ageMin(c.last_seen_at) > (c.expected_max_age_minutes ?? 0);
  const bad = c.consecutive_failures > 0 || c.last_status === 'error' || stale;
  const tone = !c.active ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    : bad ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  const label = !c.active ? 'inativo' : bad ? (stale ? 'atrasado' : 'falhando') : 'ok';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

function MetricCard({ label, value, hint, tone = 'default' }:
  { label: string; value: string | number; hint?: string; tone?: 'default' | 'bad' | 'warn' | 'good' }) {
  const valueCls = tone === 'bad' ? 'text-red-600 dark:text-red-400'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'good' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-slate-950 dark:text-slate-50';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="kicker">{label}</p>
      <strong className={`mt-2 block text-2xl font-extrabold tabular-nums ${valueCls}`}>{value}</strong>
      {hint ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

function HealthBanner({ openCrit, critUnnotified, openWarn, stalePlane }:
  { openCrit: number; critUnnotified: number; openWarn: number; stalePlane: string[] }) {
  const level = openCrit > 0 || stalePlane.length > 0 ? 'red' : openWarn > 0 ? 'amber' : 'green';
  const palette = {
    red: { wrap: 'border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40', icon: 'text-red-600 dark:text-red-400', Ico: AlertTriangle },
    amber: { wrap: 'border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40', icon: 'text-amber-600 dark:text-amber-400', Ico: AlertTriangle },
    green: { wrap: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40', icon: 'text-emerald-600 dark:text-emerald-400', Ico: CheckCircle },
  }[level] as { wrap: string; icon: string; Ico: typeof AlertTriangle };
  const parts: string[] = [];
  if (openCrit > 0) parts.push(`${openCrit} crítico(s) aberto(s)`);
  if (critUnnotified > 0) parts.push(`${critUnnotified} sem notificação`);
  if (stalePlane.length > 0) parts.push(`runner(s) atrasado(s): ${stalePlane.join(', ')}`);
  if (level === 'amber' && openWarn > 0) parts.push(`${openWarn} aviso(s) aberto(s)`);
  const title = level === 'red' ? 'Atenção necessária' : level === 'amber' ? 'Operacional, com avisos' : 'Tudo saudável';
  const Ico = palette.Ico;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${palette.wrap}`}>
      <Ico size={20} className={`mt-0.5 shrink-0 ${palette.icon}`} />
      <div className="min-w-0">
        <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {parts.length ? parts.join(' · ') : 'Nenhum incidente aberto e todos os runners de telemetria em dia.'}
        </p>
      </div>
    </div>
  );
}

function MiniTrend({ values, color = '#C5117E' }: { values: Array<number | null>; color?: string }) {
  const gid = 'mt' + useId().replace(/:/g, '');
  if (values.filter((v) => v != null).length < 2) return <span className="text-xs text-slate-400">—</span>;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div style={{ height: 38 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 3, right: 2, bottom: 0, left: 2 }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} fill={`url(#${gid})`} connectNulls dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type SevFilter = 'all' | 'critical' | 'warning';

export function ObservabilidadePage() {
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Filtros da seção de incidentes
  const [view, setView] = useState<'open' | 'resolved'>('open');
  const [sevFilter, setSevFilter] = useState<SevFilter>('all');
  const [famFilter, setFamFilter] = useState<string>('all');
  const [onlyUnnotified, setOnlyUnnotified] = useState(false);

  const mttr = useQuery({ queryKey: ['obs', 'mttr'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Mttr>(supabase.from('v_telemetry_mttr_summary').select('open_incidents,incidents_30d,resolved_30d,critical_30d,avg_mttr_minutes_30d')) });
  const incidents = useQuery({ queryKey: ['obs', 'incidents'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Incident>(supabase.from('telemetry_alert').select('alert_key,kind,severity,title,detail,metric,observed,threshold,app_version,first_seen_at,last_seen_at,occurrences,notified_at').eq('status', 'open').order('severity', { ascending: true }).order('last_seen_at', { ascending: false })) });
  const resolved = useQuery({ queryKey: ['obs', 'resolved'], refetchInterval: REFRESH_MS, enabled: view === 'resolved',
    queryFn: () => {
      const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
      return rows<Incident>(supabase.from('telemetry_alert').select('alert_key,kind,severity,title,detail,metric,observed,threshold,app_version,first_seen_at,last_seen_at,resolved_at,occurrences,notified_at').eq('status', 'resolved').gte('resolved_at', since).order('resolved_at', { ascending: false }).limit(100));
    } });
  const crons = useQuery({ queryKey: ['obs', 'crons'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Cron>(supabase.from('cron_heartbeat').select('job_name,last_seen_at,expected_max_age_minutes,last_status,consecutive_failures,active').order('job_name', { ascending: true })) });
  const health = useQuery({ queryKey: ['obs', 'health'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Health>(supabase.from('v_client_health_by_version').select('app_version,events,errors,error_rate_pct,sessions').order('events', { ascending: false })) });
  const release = useQuery({ queryKey: ['obs', 'release'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Release>(supabase.from('v_release_health').select('app_version,sessions,crash_free_sessions_pct').order('sessions', { ascending: false })) });
  const efs = useQuery({ queryKey: ['obs', 'efs'], refetchInterval: REFRESH_MS,
    queryFn: () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      return rows<Ef>(supabase.from('v_ef_metrics_hourly').select('fn_name,hour,calls,errors_5xx,p95_ms').gte('hour', since).order('hour', { ascending: true }));
    } });
  const vitals = useQuery({ queryKey: ['obs', 'vitals'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Vital>(supabase.from('v_client_vitals_daily').select('day,metric,p75,samples').order('day', { ascending: false })) });

  function refetchAll() {
    void Promise.all([mttr.refetch(), incidents.refetch(), resolved.refetch(), crons.refetch(), efs.refetch(), health.refetch(), release.refetch(), vitals.refetch()]);
  }

  async function runAlarmNow() {
    setRunning(true); setRunMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('telemetry-alarm', { body: {} });
      if (error) throw error;
      const d = data as { raised?: number; resolved?: number } | null;
      setRunMsg(`Alarme executado: ${d?.raised ?? 0} ativo(s), ${d?.resolved ?? 0} resolvido(s).`);
      refetchAll();
    } catch (e) {
      setRunMsg(`Falha ao executar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  const m = mttr.data?.[0];
  const openList = incidents.data ?? [];
  const openCrit = openList.filter((i) => i.severity === 'critical');
  const critUnnotified = openCrit.filter((i) => !i.notified_at);
  const openWarn = openList.filter((i) => i.severity !== 'critical');

  // Incidentes: fonte conforme a aba + filtros client-side
  const incSource = view === 'open' ? openList : (resolved.data ?? []);
  const incLoading = view === 'open' ? incidents.isLoading : resolved.isLoading;
  const incError = (view === 'open' ? incidents.error : resolved.error) as Error | null;
  const famOptions = Array.from(new Set(incSource.map((i) => kindFamily(i.kind).label))).sort();
  const incFiltered = incSource.filter((i) =>
    (sevFilter === 'all' || i.severity === sevFilter)
    && (famFilter === 'all' || kindFamily(i.kind).label === famFilter)
    && (view === 'resolved' || !onlyUnnotified || !i.notified_at));

  // Crons: separa plano de controle dos demais jobs
  const planeCrons = (crons.data ?? []).filter((c) => CONTROL_PLANE.test(c.job_name));
  const otherCrons = (crons.data ?? []).filter((c) => !CONTROL_PLANE.test(c.job_name));
  const stalePlaneNames = planeCrons
    .filter((c) => c.active && (c.consecutive_failures > 0 || c.last_status === 'error' || ((c.expected_max_age_minutes ?? 0) > 0 && ageMin(c.last_seen_at) > (c.expected_max_age_minutes ?? 0))))
    .map((c) => c.job_name);

  // Edge Functions: agrupa série horária por função; "último" = hora mais recente
  const efRows = efs.data ?? [];
  const efByFn = new Map<string, Ef[]>();
  for (const r of efRows) { const a = efByFn.get(r.fn_name); if (a) a.push(r); else efByFn.set(r.fn_name, [r]); }
  const efLatest = Array.from(efByFn.values()).map((list) => list[list.length - 1]);
  const efByP95 = [...efLatest].sort((a, b) => (b.p95_ms ?? 0) - (a.p95_ms ?? 0));
  const topEfs = efByP95.slice(0, 10);

  const vitalMetrics = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
  const lastSync = Math.max(mttr.dataUpdatedAt, incidents.dataUpdatedAt, crons.dataUpdatedAt, efs.dataUpdatedAt, health.dataUpdatedAt, release.dataUpdatedAt, vitals.dataUpdatedAt);
  const syncAgeS = lastSync ? Math.max(0, Math.round((now - lastSync) / 1000)) : null;
  const bannerReady = !incidents.isLoading && !incidents.error && !crons.isLoading && !crons.error;

  const selectCls = 'rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader kicker="Sistema" title="Observabilidade" description="Saúde do frontend, Edge Functions, crons e incidentes — janela recente." />
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={refetchAll}
              className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
              Atualizar
            </button>
            <button type="button" onClick={runAlarmNow} disabled={running}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">
              <Bell size={16} />{running ? 'Executando…' : 'Rodar alarme agora'}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {syncAgeS != null ? `atualizado há ${syncAgeS}s · auto 60s` : 'ao vivo · auto 60s'}
          </div>
          {runMsg ? <span className="text-xs text-slate-500 dark:text-slate-400">{runMsg}</span> : null}
        </div>
      </div>

      {/* Banner de saúde */}
      {bannerReady ? (
        <HealthBanner openCrit={openCrit.length} critUnnotified={critUnnotified.length} openWarn={openWarn.length} stalePlane={stalePlaneNames} />
      ) : null}

      {/* KPIs */}
      {mttr.isLoading ? <LoadingState /> : mttr.error ? <ErrorState message={(mttr.error as Error).message} /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Incidentes abertos" value={m?.open_incidents ?? 0} tone={(m?.open_incidents ?? 0) > 0 ? 'warn' : 'good'} />
          <MetricCard label="Críticos não notificados" value={incidents.isLoading ? '—' : critUnnotified.length}
            tone={!incidents.isLoading && critUnnotified.length > 0 ? 'bad' : 'good'} hint={!incidents.isLoading && critUnnotified.length > 0 ? 'e-mail não saiu' : undefined} />
          <MetricCard label="Críticos (30d)" value={m?.critical_30d ?? 0} tone={(m?.critical_30d ?? 0) > 0 ? 'bad' : 'default'} />
          <MetricCard label="Incidentes (30d)" value={m?.incidents_30d ?? 0} />
          <MetricCard label="Resolvidos (30d)" value={m?.resolved_30d ?? 0} tone="good" />
          <MetricCard label="MTTR médio (30d)" value={m?.avg_mttr_minutes_30d != null ? `${m.avg_mttr_minutes_30d} min` : '—'} />
        </div>
      )}

      {/* Latência p95 por EF (gráfico) */}
      <Card>
        <CardHeader kicker="Edge Functions" title="Latência p95 por função (top)">As funções mais lentas na janela recente.</CardHeader>
        <div className="p-5">
          {efs.isLoading ? <LoadingState /> : efs.error ? <ErrorState message={(efs.error as Error).message} /> : topEfs.length === 0 ? <EmptyState /> : (
            <div style={{ height: Math.min(300, 30 + topEfs.length * 26) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topEfs} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 10 }}>
                  <CartesianGrid horizontal={false} stroke="var(--line)" />
                  <XAxis type="number" tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} axisLine={false} tickLine={false} unit="ms" />
                  <YAxis type="category" dataKey="fn_name" width={160} tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={tipStyle} />
                  <Bar dataKey="p95_ms" radius={[0, 5, 5, 0]} maxBarSize={18}>
                    {topEfs.map((e) => <Cell key={e.fn_name} fill={(e.p95_ms ?? 0) > 1500 ? '#ef4444' : (e.p95_ms ?? 0) > 600 ? '#f59e0b' : '#16a34a'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      {/* Incidentes (abertos / resolvidos) com filtros */}
      <Card>
        <CardHeader kicker="Incidentes" title="Alertas">Abertos resolvem sozinhos quando o sinal normaliza. Filtre por gravidade/família e veja o histórico recente com o tempo até resolver.</CardHeader>
        <div className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-600">
              {(['open', 'resolved'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${view === v ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>
                  {v === 'open' ? 'Abertos' : 'Resolvidos (7d)'}
                </button>
              ))}
            </div>
            <select className={selectCls} value={sevFilter} onChange={(e) => setSevFilter(e.target.value as SevFilter)} aria-label="Filtrar por gravidade">
              <option value="all">Toda gravidade</option>
              <option value="critical">Crítico</option>
              <option value="warning">Aviso</option>
            </select>
            <select className={selectCls} value={famFilter} onChange={(e) => setFamFilter(e.target.value)} aria-label="Filtrar por família">
              <option value="all">Toda família</option>
              {famOptions.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            {view === 'open' ? (
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={onlyUnnotified} onChange={(e) => setOnlyUnnotified(e.target.checked)} className="rounded border-slate-300" />
                só não notificados
              </label>
            ) : null}
            {!incLoading && !incError ? <span className="ml-auto text-xs text-slate-400">{incFiltered.length} de {incSource.length}</span> : null}
          </div>

          {incLoading ? <LoadingState /> : incError ? <ErrorState message={incError.message} />
            : incSource.length === 0 ? (
              view === 'open'
                ? <p className="text-sm text-emerald-700 dark:text-emerald-400">Nenhum incidente aberto. ✓</p>
                : <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum incidente resolvido nos últimos 7 dias.</p>
            )
            : incFiltered.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum incidente com os filtros atuais.</p>
            : (
            <div className="table-scroll">
              <table className="table">
                {view === 'open' ? (
                  <thead><tr><th>Gravidade</th><th>Família</th><th>Título</th><th>Observado / limiar</th><th>Notificação</th><th>Desde</th><th>Ocorr.</th></tr></thead>
                ) : (
                  <thead><tr><th>Gravidade</th><th>Família</th><th>Título</th><th>Observado / limiar</th><th>Resolvido</th><th>Durou</th><th>Ocorr.</th></tr></thead>
                )}
                <tbody>
                  {incFiltered.map((i) => (
                    <tr key={i.alert_key}>
                      <td><SeverityPill s={i.severity} /></td>
                      <td><FamilyPill kind={i.kind} /></td>
                      <td><div className="font-medium text-slate-800 dark:text-slate-100">{i.title}</div>{i.detail ? <div className="text-xs text-slate-500">{i.detail}</div> : null}</td>
                      <td className="tabular-nums">{i.observed ?? '—'}{i.threshold != null ? ` / ${i.threshold}` : ''}</td>
                      {view === 'open' ? (
                        <>
                          <td><NotifyPill at={i.notified_at} severity={i.severity} /></td>
                          <td className="text-slate-500">{fmtAge(i.first_seen_at)}</td>
                        </>
                      ) : (
                        <>
                          <td className="text-slate-500">{fmtAge(i.resolved_at ?? null)}</td>
                          <td className="tabular-nums text-slate-500">{fmtSpan(i.first_seen_at, i.resolved_at)}</td>
                        </>
                      )}
                      <td className="tabular-nums">{i.occurrences}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Plano de controle da telemetria (runners de alarme & notificação) */}
      <Card>
        <CardHeader kicker="Telemetria" title="Runners de alarme & notificação">Avaliam sinais e enviam e-mails de incidente. Se um atrasa, alertas podem não disparar — vigie a idade da última execução.</CardHeader>
        <div className="p-5">
          {crons.isLoading ? <LoadingState /> : crons.error ? <ErrorState message={(crons.error as Error).message} /> : planeCrons.length === 0 ? <EmptyState /> : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {planeCrons.map((c) => (
                <div key={c.job_name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800 dark:text-slate-100">{c.job_name}</div>
                    <div className="text-xs text-slate-500">última: {fmtAge(c.last_seen_at)}{c.consecutive_failures > 0 ? ` · ${c.consecutive_failures} falha(s)` : ''}</div>
                  </div>
                  <CronPill c={c} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Outros jobs (manutenção / backup / canário) */}
        <Card>
          <CardHeader kicker="Disponibilidade" title="Outros jobs agendados">Rollup, prune, backups e canário sintético — idade da última execução.</CardHeader>
          <div className="p-5">
            {crons.isLoading ? <LoadingState /> : crons.error ? <ErrorState message={(crons.error as Error).message} />
              : otherCrons.length === 0 ? <EmptyState />
              : (
              <div className="table-scroll"><table className="table">
                <thead><tr><th>Job</th><th>Estado</th><th>Última</th><th>Falhas seg.</th></tr></thead>
                <tbody>{otherCrons.map((c) => (
                  <tr key={c.job_name}><td className="font-medium">{c.job_name}</td><td><CronPill c={c} /></td><td className="text-slate-500">{fmtAge(c.last_seen_at)}</td><td className="tabular-nums">{c.consecutive_failures}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        </Card>

        {/* Edge Functions */}
        <Card>
          <CardHeader kicker="Edge Functions" title="Latência e erros (24h)">p95 da última hora, 5xx e tendência de chamadas por hora.</CardHeader>
          <div className="p-5">
            {efs.isLoading ? <LoadingState /> : efs.error ? <ErrorState message={(efs.error as Error).message} />
              : efByP95.length === 0 ? <EmptyState />
              : (
              <div className="table-scroll"><table className="table">
                <thead><tr><th>Função</th><th>Chamadas</th><th>5xx</th><th>p95 (ms)</th><th className="w-24">24h</th></tr></thead>
                <tbody>{efByP95.map((e) => (
                  <tr key={e.fn_name}>
                    <td className="font-medium">{e.fn_name}</td>
                    <td className="tabular-nums">{e.calls}</td>
                    <td className={`tabular-nums ${e.errors_5xx > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>{e.errors_5xx}</td>
                    <td className="tabular-nums">{e.p95_ms ?? '—'}</td>
                    <td className="w-24"><MiniTrend values={buildHourly(efByFn.get(e.fn_name) ?? [], 'calls')} color="#64748b" /></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        </Card>

        {/* Erro por versão */}
        <Card>
          <CardHeader kicker="RUM" title="Taxa de erro por versão (7d)">Erros sobre eventos, por app_version.</CardHeader>
          <div className="p-5">
            {health.isLoading ? <LoadingState /> : health.error ? <ErrorState message={(health.error as Error).message} />
              : (health.data?.length ?? 0) === 0 ? <EmptyState />
              : (
              <div className="table-scroll"><table className="table">
                <thead><tr><th>Versão</th><th>Eventos</th><th>Erros</th><th>Taxa</th></tr></thead>
                <tbody>{health.data!.map((h) => (
                  <tr key={h.app_version}><td className="font-medium">{h.app_version}</td><td className="tabular-nums">{h.events}</td><td className="tabular-nums">{h.errors}</td><td className={`tabular-nums ${(h.error_rate_pct ?? 0) >= 5 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>{h.error_rate_pct ?? 0}%</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        </Card>

        {/* Crash-free */}
        <Card>
          <CardHeader kicker="Release health" title="Crash-free por versão (30d)">Sessões sem erro, no estilo Sentry.</CardHeader>
          <div className="p-5">
            {release.isLoading ? <LoadingState /> : release.error ? <ErrorState message={(release.error as Error).message} />
              : (release.data?.length ?? 0) === 0 ? <EmptyState />
              : (
              <div className="table-scroll"><table className="table">
                <thead><tr><th>Versão</th><th>Sessões</th><th>Crash-free</th></tr></thead>
                <tbody>{release.data!.map((r) => {
                  const pct = r.crash_free_sessions_pct;
                  return (
                    <tr key={r.app_version}>
                      <td className="font-medium">{r.app_version}</td>
                      <td className="tabular-nums">{r.sessions}</td>
                      <td>
                        {pct == null ? <span className="text-slate-400">—</span> : (
                          <div className="flex items-center gap-2">
                            <span className={`tabular-nums ${pct < 95 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-emerald-700 dark:text-emerald-400'}`}>{pct}%</span>
                            <div className="h-1.5 w-16 overflow-hidden rounded bg-slate-200 dark:bg-slate-700"><div className={`h-full rounded ${pct < 95 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </div>
        </Card>
      </div>

      {/* Web Vitals */}
      <Card>
        <CardHeader kicker="RUM" title="Web Vitals (p75, 14 dias)">Tendência diária por métrica.</CardHeader>
        <div className="p-5">
          {vitals.isLoading ? <LoadingState /> : vitals.error ? <ErrorState message={(vitals.error as Error).message} />
            : (vitals.data?.length ?? 0) === 0 ? <EmptyState />
            : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vitalMetrics.map((metric) => {
                const series = buildDailySeries(vitals.data as Vital[], metric, 'p75', 14);
                const last = [...series.values].reverse().find((v) => v != null);
                if (last == null) return null;
                return (
                  <div key={metric} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="kicker">{metric}</span>
                      <strong className="tabular-nums text-lg font-extrabold text-slate-900 dark:text-slate-50">{metric === 'CLS' ? last.toFixed(3) : `${Math.round(last)}ms`}</strong>
                    </div>
                    <div className="mt-2"><MiniTrend values={series.values} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
