// backup-restore-drill (Concresoft) v1 — prova de RESTAURABILIDADE, 100% read-only.
//   1) INTEGRIDADE: re-download + SHA-256 vs registrado
//   2) PARSE: JSON.parse do dump (nao truncado/corrompido)
//   3) COBERTURA: tabelas esperadas (list_public_tables menos EXCLUDE) presentes no dump
//   4) CONSISTENCIA: contagem do dump vs contagem ATUAL no banco, por tabela (drift)
// Unico INSERT: backup_log (backup_type='restore-drill'). NUNCA escreve em tabela de negocio.
// Fail-closed CRON_SECRET. Self-contained. Agendado semanal (0 5 * * 0).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, x-cron-secret', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const EXCLUDE = new Set<string>([
  'client_telemetry_log', 'client_telemetry_rate_limit', 'cron_heartbeat', 'ef_invocation_log',
  'frontend_canary_checks', 'telemetry_alert', 'telemetry_error_group', 'telemetry_rollup_daily', 'telemetry_settings',
  'notification_dispatch_log', 'notify_event_outbox', 'email_suppressions', 'magic_links',
  'notification_dispatch_settings', 'backup_log',
]);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function currentCount(svc: SupabaseClient, table: string): Promise<number | null> {
  const { count, error } = await svc.from(table).select('*', { count: 'exact', head: true });
  if (error) return null;
  return count ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return json({ ok: false, error: 'CRON_SECRET ausente: fail-closed' }, 500);
  if ((req.headers.get('x-cron-secret') ?? '') !== expected) return json({ ok: false, error: 'cron secret invalido' }, 401);

  const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const startedAt = new Date();
  const finishDrill = async (status: string, problem: string | null, findings: Record<string, unknown>) => {
    const finished = new Date();
    await svc.from('backup_log').insert({ backup_type: 'restore-drill', status, started_at: startedAt.toISOString(), finished_at: finished.toISOString(), duration_ms: finished.getTime() - startedAt.getTime(), error_message: problem, triggered_by: 'cron', details: findings });
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'backup-restore-drill', p_expected_max_age_minutes: 10800, p_status: status === 'verified' ? 'ok' : 'warning', p_error: problem, p_description: 'Drill de restauracao (read-only) do ultimo backup' });
    return status !== 'failed' ? json({ ok: true, status, restorable: status === 'verified', problem, ...findings }) : json({ ok: false, error: problem ?? 'drill falhou', ...findings }, 400);
  };

  try {
    const { data: target, error: tErr } = await svc.from('backup_log').select('*').eq('backup_type', 'database').in('status', ['verified', 'success']).not('file_path', 'is', null).order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!target || !target.file_path) return await finishDrill('failed', 'Nenhum backup de banco bem-sucedido encontrado para testar.', {});

    const findings: Record<string, unknown> = { source_backup_log_id: target.id, file_path: target.file_path };
    const { data: blob, error: dErr } = await svc.storage.from('backups').download(target.file_path);
    if (dErr || !blob) return await finishDrill('failed', `download falhou: ${dErr?.message ?? 'vazio'}`, findings);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const actual = await sha256Hex(bytes);
    const expectedChk = (target.details && typeof target.details === 'object') ? String((target.details as Record<string, unknown>).checksum_sha256 ?? '') : '';
    const checksumOk = !!expectedChk && expectedChk === actual;
    findings.checksum_ok = checksumOk; findings.checksum_expected = expectedChk || null; findings.checksum_actual = actual;

    let payload: Record<string, unknown> | null = null;
    try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { findings.parse_ok = false; return await finishDrill('failed', `JSON invalido: ${(e as Error).message}`, findings); }
    findings.parse_ok = true;
    const dumpTables = (payload && typeof payload.tables === 'object' && payload.tables) ? payload.tables as Record<string, unknown> : {};
    const dumpNames = Object.keys(dumpTables);
    findings.dump_table_count = dumpNames.length;

    let missing: string[] = [];
    const { data: allTbls } = await svc.rpc('list_public_tables');
    if (Array.isArray(allTbls)) {
      const expectedTbls = (allTbls as Array<{ table_name: string }>).map((r) => r.table_name).filter((t) => t && !EXCLUDE.has(t));
      const present = new Set(dumpNames);
      missing = expectedTbls.filter((t) => !present.has(t));
    }
    findings.missing_tables = missing;

    const perTable: Array<Record<string, unknown>> = [];
    let drift = 0;
    for (const t of dumpNames) {
      const val = dumpTables[t];
      if (val && typeof val === 'object' && !Array.isArray(val) && 'error' in (val as Record<string, unknown>)) { perTable.push({ table: t, backup_rows: 0, current_rows: null, delta: null, error: String((val as Record<string, unknown>).error) }); continue; }
      const backupRows = Array.isArray(val) ? val.length : 0;
      const cur = await currentCount(svc, t);
      const delta = cur == null ? null : cur - backupRows;
      if (delta != null && delta !== 0) drift++;
      perTable.push({ table: t, backup_rows: backupRows, current_rows: cur, delta });
    }
    findings.per_table = perTable; findings.drift_tables = drift;

    const restorable = checksumOk && findings.parse_ok === true && missing.length === 0;
    const problem = [!checksumOk ? 'checksum divergente' : null, missing.length ? `${missing.length} tabela(s) ausente(s) no dump` : null].filter(Boolean).join(' · ') || null;
    return await finishDrill(restorable ? 'verified' : 'corrupt', problem, findings);
  } catch (e) {
    return await finishDrill('failed', (e as Error).message, {});
  }
});
