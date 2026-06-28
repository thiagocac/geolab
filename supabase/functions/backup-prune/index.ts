// backup-prune (Concresoft) v1 — retencao do bucket 'backups' com salvaguardas.
//   - so atua nos prefixos 'database/' e 'storage/'
//   - mantem SEMPRE os keep_min arquivos mais recentes por prefixo
//   - so remove o que esta abaixo do cutoff de retencao (retention_days)
//   - registra em backup_log (backup_type='prune') + heartbeat. Nunca lanca a ponto de derrubar.
// Body opcional: { retention_days=30, keep_min=14, dry_run=false }. Fail-closed CRON_SECRET. Self-contained.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, x-cron-secret', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const BUCKET = 'backups';
const PREFIXES = ['database', 'storage'];

interface FileRef { path: string; created: number }

async function listFiles(svc: SupabaseClient, prefix: string): Promise<FileRef[]> {
  const out: FileRef[] = [];
  const { data: dateDirs, error } = await svc.storage.from(BUCKET).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error || !dateDirs) return out;
  for (const dir of dateDirs) {
    if ((dir as { id: string | null }).id) {
      out.push({ path: `${prefix}/${dir.name}`, created: Date.parse((dir as { created_at?: string; updated_at?: string }).created_at || (dir as { updated_at?: string }).updated_at || '') || 0 });
      continue;
    }
    const sub = `${prefix}/${dir.name}`;
    const { data: files } = await svc.storage.from(BUCKET).list(sub, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
    for (const f of files ?? []) {
      if (!(f as { id: string | null }).id) continue;
      out.push({ path: `${sub}/${f.name}`, created: Date.parse((f as { created_at?: string; updated_at?: string }).created_at || (f as { updated_at?: string }).updated_at || '') || 0 });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return json({ ok: false, error: 'CRON_SECRET ausente: fail-closed' }, 500);
  if ((req.headers.get('x-cron-secret') ?? '') !== expected) return json({ ok: false, error: 'cron secret invalido' }, 401);

  const body = await req.json().catch(() => ({})) as { retention_days?: number; keep_min?: number; dry_run?: boolean };
  const retentionDays = Number.isFinite(body.retention_days) ? Math.max(7, Number(body.retention_days)) : 30;
  const keepMin = Number.isFinite(body.keep_min) ? Math.max(1, Number(body.keep_min)) : 14;
  const dryRun = body.dry_run === true;
  const cutoff = Date.now() - retentionDays * 86400000;

  const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const startedAt = new Date();
  try {
    const toDelete: string[] = [];
    const perPrefix: Record<string, { total: number; deletable: number }> = {};
    for (const prefix of PREFIXES) {
      const files = await listFiles(svc, prefix);
      files.sort((a, b) => b.created - a.created);
      const protectedSet = new Set(files.slice(0, keepMin).map((f) => f.path));
      const deletable = files.filter((f) => !protectedSet.has(f.path) && f.created > 0 && f.created < cutoff);
      perPrefix[prefix] = { total: files.length, deletable: deletable.length };
      for (const f of deletable) toDelete.push(f.path);
    }
    let removed = 0; let removeError: string | null = null;
    if (!dryRun && toDelete.length > 0) {
      for (let i = 0; i < toDelete.length; i += 100) {
        const batch = toDelete.slice(i, i + 100);
        const { error } = await svc.storage.from(BUCKET).remove(batch);
        if (error) { removeError = error.message; break; }
        removed += batch.length;
      }
    }
    const finished = new Date();
    await svc.from('backup_log').insert({ backup_type: 'prune', status: removeError ? 'failed' : 'success', started_at: startedAt.toISOString(), finished_at: finished.toISOString(), duration_ms: finished.getTime() - startedAt.getTime(), records_count: removed, error_message: removeError, triggered_by: dryRun ? 'manual:dry_run' : 'cron', details: { retention_days: retentionDays, keep_min: keepMin, dry_run: dryRun, candidates: toDelete.length, removed, per_prefix: perPrefix } });
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'backup-prune', p_expected_max_age_minutes: 10800, p_status: removeError ? 'warning' : 'ok', p_error: removeError, p_description: 'Retencao de backups antigos no Storage' });
    return json({ ok: true, retention_days: retentionDays, keep_min: keepMin, dry_run: dryRun, candidates: toDelete.length, removed, per_prefix: perPrefix });
  } catch (e) {
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'backup-prune', p_expected_max_age_minutes: 10800, p_status: 'error', p_error: (e as Error).message, p_description: 'Retencao de backups antigos no Storage' });
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
