import { supabase } from '../supabase';

// Camada de leitura da trilha de BACKUP (admin-only por RLS: backup_log.has_role('admin')).
// As Edge Functions de backup (cron-backup / backup-storage-real / backup-prune / backup-restore-drill /
// prune-storage-retention) sao acionadas por pg_cron com x-cron-secret — NUNCA pelo navegador. Este
// modulo apenas LE backup_log + os heartbeats dos jobs (cron_heartbeat) para o painel /gestao/backups.
// Tabelas novas ainda nao tipadas em database.types.ts => cast permissivo (mesmo padrao do client.ts).
const db = supabase as unknown as { from: (t: string) => any };

export type BackupType = 'database' | 'storage' | 'prune' | 'restore-drill' | 'storage-retention';
export type BackupStatus = 'running' | 'success' | 'verified' | 'failed' | 'corrupt' | 'skipped';

export type BackupLogRow = {
  id: string;
  backup_type: BackupType | string;
  started_at: string;
  finished_at: string | null;
  status: BackupStatus | string;
  file_path: string | null;
  file_size_bytes: number | null;
  records_count: number | null;
  duration_ms: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
  triggered_by: string | null;
  created_at: string;
};

export type BackupCron = {
  job_name: string;
  last_seen_at: string | null;
  expected_max_age_minutes: number | null;
  last_status: string | null;
  last_error: string | null;
  consecutive_failures: number;
  total_runs: number | null;
  total_failures: number | null;
  active: boolean;
  description: string | null;
};

const SELECT = 'id, backup_type, started_at, finished_at, status, file_path, file_size_bytes, records_count, duration_ms, error_message, details, triggered_by, created_at';

// Jobs de backup conhecidos (para o painel destacar a saude da rotina, separada dos demais crons).
export const BACKUP_JOB_NAMES = [
  'cron-backup', 'backup-storage-real', 'backup-health-check', 'backup-prune', 'backup-restore-drill', 'prune-storage-retention',
] as const;

// Histórico recente do backup_log (opcionalmente filtrado por tipo).
export async function listBackupLog(opts: { type?: string; limit?: number } = {}): Promise<BackupLogRow[]> {
  let q = db.from('backup_log').select(SELECT);
  if (opts.type) q = q.eq('backup_type', opts.type);
  const { data, error } = await q.order('started_at', { ascending: false }).limit(opts.limit ?? 100);
  if (error) throw new Error(error.message);
  return (data ?? []) as BackupLogRow[];
}

// Último registro por tipo de backup (cartoes de cobertura no topo do painel).
export async function latestBackupByType(): Promise<Record<string, BackupLogRow>> {
  const { data, error } = await db.from('backup_log').select(SELECT).order('started_at', { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const out: Record<string, BackupLogRow> = {};
  for (const r of (data ?? []) as BackupLogRow[]) if (!out[r.backup_type]) out[r.backup_type] = r;
  return out;
}

// Heartbeats dos jobs de backup (saude da rotina agendada).
export async function listBackupCrons(): Promise<BackupCron[]> {
  const { data, error } = await db.from('cron_heartbeat')
    .select('job_name, last_seen_at, expected_max_age_minutes, last_status, last_error, consecutive_failures, total_runs, total_failures, active, description')
    .in('job_name', BACKUP_JOB_NAMES as unknown as string[])
    .order('job_name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BackupCron[];
}
