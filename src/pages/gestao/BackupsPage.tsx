import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listBackupLog, latestBackupByType, listBackupCrons, type BackupLogRow, type BackupCron } from '../../lib/api/backup';

/**
 * Painel de Backups (admin) — lê backup_log + heartbeats dos jobs de backup (cron_heartbeat),
 * ambos admin-only por RLS. Auto-refresh a cada 60s. Somente leitura: as Edge Functions de
 * backup são acionadas por pg_cron com x-cron-secret e NUNCA pelo navegador.
 *
 * DEPENDÊNCIA: regenerar database.types.ts após aplicar a migração 071 (backup_log) — senão o
 * tsc/vite acusa "table não existe" em supabase.from('backup_log'). O esbuild (sem typecheck) passa.
 */

const REFRESH_MS = 60_000;

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
function fmtBytes(n: number | null): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}
function fmtDur(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60000)} min`;
}

const STATUS_TONE: Record<string, string> = {
  verified: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  running: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  skipped: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  corrupt: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};
function StatusPill({ s }: { s: string }) {
  const tone = STATUS_TONE[s] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{s}</span>;
}
function CronPill({ c }: { c: BackupCron }) {
  const stale = (c.expected_max_age_minutes ?? 0) > 0 && ageMin(c.last_seen_at) > (c.expected_max_age_minutes ?? 0);
  const bad = c.consecutive_failures > 0 || c.last_status === 'error' || stale;
  const tone = !c.active ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    : bad ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    : c.last_status === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  const label = !c.active ? 'inativo' : bad ? (stale ? 'atrasado' : 'falhando') : (c.last_status ?? 'ok');
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

function CoverageCard({ titulo, row }: { titulo: string; row: BackupLogRow | undefined }) {
  if (!row) return <Stat label={titulo} value="—" detail="sem registro" />;
  const verified = row.details && typeof row.details === 'object' ? (row.details as Record<string, unknown>).self_verified === true : false;
  const detalhe = `${fmtAge(row.started_at)} atrás${verified ? ' · verificado' : ''}`;
  return <Stat label={titulo} value={row.status} detail={detalhe} />;
}

export function BackupsPage() {
  const cobertura = useQuery({ queryKey: ['bkp', 'coverage'], refetchInterval: REFRESH_MS, queryFn: () => latestBackupByType() });
  const log = useQuery({ queryKey: ['bkp', 'log'], refetchInterval: REFRESH_MS, queryFn: () => listBackupLog({ limit: 80 }) });
  const crons = useQuery({ queryKey: ['bkp', 'crons'], refetchInterval: REFRESH_MS, queryFn: () => listBackupCrons() });

  const cov = cobertura.data ?? {};

  return (
    <div className="space-y-6">
      <PageHeader kicker="Sistema" title="Backups" description="Cobertura, histórico e saúde da rotina de backup (banco + storage + drills). Somente leitura — os jobs rodam via cron. Atualiza a cada 60s." />

      {/* Cobertura por tipo */}
      {cobertura.isLoading ? <LoadingState /> : cobertura.error ? <ErrorState message={(cobertura.error as Error).message} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <CoverageCard titulo="Banco (database)" row={cov['database']} />
          <CoverageCard titulo="Storage (manifesto)" row={cov['storage']} />
          <CoverageCard titulo="Drill de restauração" row={cov['restore-drill']} />
          <CoverageCard titulo="Retenção (backups)" row={cov['prune']} />
          <CoverageCard titulo="Retenção (conteúdo)" row={cov['storage-retention']} />
        </div>
      )}

      {/* Saúde dos jobs de backup */}
      <Card>
        <CardHeader kicker="Disponibilidade" title="Saúde da rotina de backup">Jobs agendados (pg_cron) e idade da última execução.</CardHeader>
        <div className="p-5">
          {crons.isLoading ? <LoadingState /> : crons.error ? <ErrorState message={(crons.error as Error).message} />
            : (crons.data?.length ?? 0) === 0 ? <EmptyState />
            : (
            <div className="table-scroll"><table className="table">
              <thead><tr><th>Job</th><th>Estado</th><th>Última</th><th>Falhas seg.</th><th>Execuções</th><th>Descrição</th></tr></thead>
              <tbody>{crons.data!.map((c) => (
                <tr key={c.job_name}>
                  <td className="font-medium">{c.job_name}</td>
                  <td><CronPill c={c} /></td>
                  <td className="text-slate-500">{fmtAge(c.last_seen_at)}</td>
                  <td className="tabular-nums">{c.consecutive_failures}</td>
                  <td className="tabular-nums text-slate-500">{c.total_runs ?? '—'}</td>
                  <td className="text-xs text-slate-500">{c.description ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      </Card>

      {/* Histórico do backup_log */}
      <Card>
        <CardHeader kicker="Histórico" title="Execuções recentes">Últimos registros do backup_log (todos os tipos).</CardHeader>
        <div className="p-5">
          {log.isLoading ? <LoadingState /> : log.error ? <ErrorState message={(log.error as Error).message} />
            : (log.data?.length ?? 0) === 0 ? <EmptyState />
            : (
            <div className="table-scroll"><table className="table">
              <thead><tr><th>Início</th><th>Tipo</th><th>Status</th><th>Registros</th><th>Tamanho</th><th>Duração</th><th>Origem</th><th>Detalhe</th></tr></thead>
              <tbody>{log.data!.map((r) => (
                <tr key={r.id}>
                  <td className="text-slate-500 whitespace-nowrap">{new Date(r.started_at).toLocaleString('pt-BR')}</td>
                  <td className="font-medium">{r.backup_type}</td>
                  <td><StatusPill s={r.status} /></td>
                  <td className="tabular-nums">{r.records_count ?? '—'}</td>
                  <td className="tabular-nums text-slate-500">{fmtBytes(r.file_size_bytes)}</td>
                  <td className="tabular-nums text-slate-500">{fmtDur(r.duration_ms)}</td>
                  <td className="text-xs text-slate-500">{r.triggered_by ?? '—'}</td>
                  <td className="text-xs text-slate-500">{r.error_message ? <span className="text-red-600 dark:text-red-400">{r.error_message}</span> : (r.file_path ?? '—')}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      </Card>
    </div>
  );
}
