import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { buildDailySeries } from '../../lib/telemetry/metrics-math';

/**
 * Painel de observabilidade (admin) — lê as views + telemetry_alert + cron_heartbeat (todas admin-only
 * por RLS; security_invoker faz o filtro). Auto-refresh a cada 60s.
 *
 * DEPENDÊNCIA: regenerar database.types.ts após aplicar 048–050 (as tabelas/views novas precisam estar
 * tipadas) — senão o tsc/vite acusa "table não existe" em supabase.from(...). O esbuild (sem typecheck) passa.
 *
 * DS: usa PageHeader/Card/Stat/State do GEOLAB + classes CSS (card/table/kicker) + Tailwind. Os "pills"
 * de severidade são spans Tailwind (não acoplam ao enum de tons do Badge).
 */

const REFRESH_MS = 60_000;

type Mttr = {
  open_incidents: number; incidents_30d: number; resolved_30d: number; critical_30d: number;
  avg_mttr_minutes_30d: number | null;
};
type Incident = {
  alert_key: string; kind: string; severity: string; title: string; detail: string | null;
  metric: string | null; observed: number | null; threshold: number | null; app_version: string | null;
  first_seen_at: string; last_seen_at: string; occurrences: number;
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
function fmtAge(iso: string | null): string {
  const m = ageMin(iso);
  if (!Number.isFinite(m)) return 'nunca';
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} d`;
}

function SeverityPill({ s }: { s: string }) {
  const tone = s === 'critical'
    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{s}</span>;
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

function Sparkline({ values }: { values: Array<number | null> }) {
  const pts = values
    .map((v, i) => (v == null ? null : ([i, v] as [number, number])))
    .filter((p): p is [number, number] => p !== null);
  if (pts.length < 2) return <span className="text-xs text-slate-400">—</span>;
  const xMax = values.length - 1;
  const ys = pts.map((p) => p[1]);
  const min = Math.min(...ys), max = Math.max(...ys);
  const w = 120, h = 28;
  const sx = (i: number) => (i / xMax) * w;
  const sy = (v: number) => h - ((v - min) / ((max - min) || 1)) * h;
  const d = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} role="img" aria-label="tendência">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-500 dark:text-slate-400" />
    </svg>
  );
}

function latestPerKey<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const it of items) if (!seen.has(key(it))) seen.set(key(it), it);
  return [...seen.values()];
}

export function ObservabilidadePage() {
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const mttr = useQuery({ queryKey: ['obs', 'mttr'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Mttr>(supabase.from('v_telemetry_mttr_summary').select('open_incidents,incidents_30d,resolved_30d,critical_30d,avg_mttr_minutes_30d')) });
  const incidents = useQuery({ queryKey: ['obs', 'incidents'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Incident>(supabase.from('telemetry_alert').select('alert_key,kind,severity,title,detail,metric,observed,threshold,app_version,first_seen_at,last_seen_at,occurrences').eq('status', 'open').order('severity', { ascending: true }).order('last_seen_at', { ascending: false })) });
  const crons = useQuery({ queryKey: ['obs', 'crons'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Cron>(supabase.from('cron_heartbeat').select('job_name,last_seen_at,expected_max_age_minutes,last_status,consecutive_failures,active').order('job_name', { ascending: true })) });
  const health = useQuery({ queryKey: ['obs', 'health'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Health>(supabase.from('v_client_health_by_version').select('app_version,events,errors,error_rate_pct,sessions').order('events', { ascending: false })) });
  const release = useQuery({ queryKey: ['obs', 'release'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Release>(supabase.from('v_release_health').select('app_version,sessions,crash_free_sessions_pct').order('sessions', { ascending: false })) });
  const efs = useQuery({ queryKey: ['obs', 'efs'], refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const data = await rows<Ef>(supabase.from('v_ef_metrics_hourly').select('fn_name,hour,calls,errors_5xx,p95_ms').gte('hour', since).order('hour', { ascending: false }));
      return latestPerKey(data, (e) => e.fn_name).sort((a, b) => (b.p95_ms ?? 0) - (a.p95_ms ?? 0));
    } });
  const vitals = useQuery({ queryKey: ['obs', 'vitals'], refetchInterval: REFRESH_MS,
    queryFn: () => rows<Vital>(supabase.from('v_client_vitals_daily').select('day,metric,p75,samples').order('day', { ascending: false })) });

  async function runAlarmNow() {
    setRunning(true); setRunMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('telemetry-alarm', { body: {} });
      if (error) throw error;
      const d = data as { raised?: number; resolved?: number } | null;
      setRunMsg(`Alarme executado: ${d?.raised ?? 0} ativo(s), ${d?.resolved ?? 0} resolvido(s).`);
      void Promise.all([mttr.refetch(), incidents.refetch(), crons.refetch()]);
    } catch (e) {
      setRunMsg(`Falha ao executar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  const m = mttr.data?.[0];
  const vitalMetrics = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader kicker="Sistema" title="Observabilidade" description="Saúde do frontend, Edge Functions, crons e incidentes — janela recente. Atualiza a cada 60s." />
        <div className="flex flex-col items-end gap-1">
          <button type="button" onClick={runAlarmNow} disabled={running}
            className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">
            {running ? 'Executando…' : 'Rodar alarme agora'}
          </button>
          {runMsg ? <span className="text-xs text-slate-500 dark:text-slate-400">{runMsg}</span> : null}
        </div>
      </div>

      {/* KPIs */}
      {mttr.isLoading ? <LoadingState /> : mttr.error ? <ErrorState message={(mttr.error as Error).message} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Incidentes abertos" value={m?.open_incidents ?? 0} />
          <Stat label="Críticos (30d)" value={m?.critical_30d ?? 0} />
          <Stat label="Incidentes (30d)" value={m?.incidents_30d ?? 0} />
          <Stat label="Resolvidos (30d)" value={m?.resolved_30d ?? 0} />
          <Stat label="MTTR médio (30d)" value={m?.avg_mttr_minutes_30d != null ? `${m.avg_mttr_minutes_30d} min` : '—'} />
        </div>
      )}

      {/* Incidentes abertos */}
      <Card>
        <CardHeader kicker="Incidentes" title="Alertas abertos">Abertos por gravidade. Resolvem sozinhos quando o sinal normaliza.</CardHeader>
        <div className="p-5">
          {incidents.isLoading ? <LoadingState /> : incidents.error ? <ErrorState message={(incidents.error as Error).message} />
            : (incidents.data?.length ?? 0) === 0 ? <p className="text-sm text-emerald-700 dark:text-emerald-400">Nenhum incidente aberto. ✓</p>
            : (
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Gravidade</th><th>Tipo</th><th>Título</th><th>Observado / limiar</th><th>Desde</th><th>Ocorr.</th></tr></thead>
                <tbody>
                  {incidents.data!.map((i) => (
                    <tr key={i.alert_key}>
                      <td><SeverityPill s={i.severity} /></td>
                      <td className="text-slate-500">{i.kind}</td>
                      <td><div className="font-medium text-slate-800 dark:text-slate-100">{i.title}</div>{i.detail ? <div className="text-xs text-slate-500">{i.detail}</div> : null}</td>
                      <td className="tabular-nums">{i.observed ?? '—'}{i.threshold != null ? ` / ${i.threshold}` : ''}</td>
                      <td className="text-slate-500">{fmtAge(i.first_seen_at)}</td>
                      <td className="tabular-nums">{i.occurrences}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Crons */}
        <Card>
          <CardHeader kicker="Disponibilidade" title="Crons (watchdog)">Jobs agendados e idade da última execução.</CardHeader>
          <div className="p-5">
            {crons.isLoading ? <LoadingState /> : crons.error ? <ErrorState message={(crons.error as Error).message} />
              : (crons.data?.length ?? 0) === 0 ? <EmptyState />
              : (
              <div className="table-scroll"><table className="table">
                <thead><tr><th>Job</th><th>Estado</th><th>Última</th><th>Falhas seg.</th></tr></thead>
                <tbody>{crons.data!.map((c) => (
                  <tr key={c.job_name}><td className="font-medium">{c.job_name}</td><td><CronPill c={c} /></td><td className="text-slate-500">{fmtAge(c.last_seen_at)}</td><td className="tabular-nums">{c.consecutive_failures}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        </Card>

        {/* Edge Functions */}
        <Card>
          <CardHeader kicker="Edge Functions" title="Latência e erros (24h)">p95 da última hora e 5xx por função.</CardHeader>
          <div className="p-5">
            {efs.isLoading ? <LoadingState /> : efs.error ? <ErrorState message={(efs.error as Error).message} />
              : (efs.data?.length ?? 0) === 0 ? <EmptyState />
              : (
              <div className="table-scroll"><table className="table">
                <thead><tr><th>Função</th><th>Chamadas</th><th>5xx</th><th>p95 (ms)</th></tr></thead>
                <tbody>{efs.data!.map((e) => (
                  <tr key={e.fn_name}><td className="font-medium">{e.fn_name}</td><td className="tabular-nums">{e.calls}</td><td className={`tabular-nums ${e.errors_5xx > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>{e.errors_5xx}</td><td className="tabular-nums">{e.p95_ms ?? '—'}</td></tr>
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
                <tbody>{release.data!.map((r) => (
                  <tr key={r.app_version}><td className="font-medium">{r.app_version}</td><td className="tabular-nums">{r.sessions}</td><td className={`tabular-nums ${(r.crash_free_sessions_pct ?? 100) < 95 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-emerald-700 dark:text-emerald-400'}`}>{r.crash_free_sessions_pct ?? '—'}%</td></tr>
                ))}</tbody>
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
                    <div className="mt-2"><Sparkline values={series.values} /></div>
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
