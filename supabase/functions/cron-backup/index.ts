// cron-backup (Concresoft) v8 — dump logico do banco para o bucket 'backups', AGORA com:
//   - cobertura DINAMICA (list_public_tables() menos uma exclusion-list curada): tabela nova entra sozinha
//   - auditoria em backup_log (running -> verified/corrupt/success)
//   - AUTO-VERIFICACAO (re-download + SHA-256): todo backup nasce 'verified' (ou 'corrupt' se os bytes diferem)
//   - heartbeat (record_cron_heartbeat) para o watchdog
// Fail-closed em CRON_SECRET (header x-cron-secret). Service-role. Self-contained. Agendado 15 3 * * * (pg_cron).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, x-cron-secret', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

// Tabelas deliberadamente FORA do dump logico: telemetria/logs/filas/tokens efemeros e config com segredo.
// (Reconstruivel/alto volume, ou ja coberto, ou sensivel.) Tabela nova NAO listada aqui ENTRA no backup.
const EXCLUDE = new Set<string>([
  'client_telemetry_log', 'client_telemetry_rate_limit', 'cron_heartbeat', 'ef_invocation_log',
  'frontend_canary_checks', 'telemetry_alert', 'telemetry_error_group', 'telemetry_rollup_daily', 'telemetry_settings',
  'notification_dispatch_log', 'notify_event_outbox', 'email_suppressions', 'magic_links',
  'notification_dispatch_settings', 'backup_log',
]);

const SCHEMA_VERSION = 32;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return json({ ok: false, error: 'CRON_SECRET ausente: fail-closed' }, 500);
  if ((req.headers.get('x-cron-secret') ?? '') !== expected) return json({ ok: false, error: 'cron secret invalido' }, 401);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const startedAt = new Date();
  const triggeredBy = (() => { try { return new URL(req.url).searchParams.get('by') || 'cron'; } catch { return 'cron'; } })();

  // 1) registro inicial em backup_log
  const { data: log, error: logErr } = await svc.from('backup_log')
    .insert({ backup_type: 'database', status: 'running', triggered_by: triggeredBy, started_at: startedAt.toISOString() })
    .select('id').single();
  if (logErr || !log) return json({ ok: false, error: `backup_log insert: ${logErr?.message ?? 'sem id'}` }, 500);
  const logId = (log as { id: string }).id;

  try {
    // 2) cobertura dinamica
    let dynamic = true;
    let allTables: string[] = [];
    const { data: tbls, error: tErr } = await svc.rpc('list_public_tables');
    if (tErr || !Array.isArray(tbls)) {
      dynamic = false; // fallback minimo (nucleo do dominio) se a RPC falhar
      allTables = ['tenants', 'members', 'member_obras', 'lab_clients', 'client_works', 'concretagens', 'material_receipts', 'amostras', 'corpos_prova', 'material_tests', 'lab_reports', 'laudo_resultados'];
    } else {
      allTables = (tbls as Array<{ table_name: string }>).map((r) => r.table_name).filter(Boolean);
    }
    const included = allTables.filter((t) => !EXCLUDE.has(t));
    const excluded = allTables.filter((t) => EXCLUDE.has(t));

    // 3) dump
    const dump: Record<string, unknown> = { generated_at: startedAt.toISOString(), schema_version: SCHEMA_VERSION, dynamic, tables_included: included, tables_excluded: excluded, tables: {} };
    let total = 0;
    const failed: string[] = [];
    for (const t of included) {
      const { data, error } = await svc.from(t).select('*');
      if (error) { (dump.tables as Record<string, unknown>)[t] = { error: error.message }; failed.push(t); continue; }
      (dump.tables as Record<string, unknown>)[t] = data ?? [];
      total += (data ?? []).length;
    }

    // 4) upload particionado por data
    const day = startedAt.toISOString().slice(0, 10);
    const path = `database/${day}/backup-${Date.now()}.json`;
    const bytes = new TextEncoder().encode(JSON.stringify(dump));
    const checksum = await sha256Hex(bytes);
    const up = await svc.storage.from('backups').upload(path, bytes, { contentType: 'application/json', upsert: false });
    if (up.error) {
      const f = new Date();
      await svc.from('backup_log').update({ status: 'failed', finished_at: f.toISOString(), duration_ms: f.getTime() - startedAt.getTime(), error_message: up.error.message, details: { tables_failed: failed } }).eq('id', logId);
      await svc.rpc('record_cron_heartbeat', { p_job_name: 'cron-backup', p_expected_max_age_minutes: 1440, p_status: 'error', p_error: up.error.message, p_description: 'Backup logico diario (dinamico + auto-verificado)' });
      return json({ ok: false, error: up.error.message }, 500);
    }

    // 5) AUTO-VERIFICACAO: re-download + re-hash
    let verified = false; let verifyError: string | null = null; let mismatch = false;
    try {
      const { data: blob, error: dErr } = await svc.storage.from('backups').download(path);
      if (dErr || !blob) { verifyError = `verificacao inconclusiva (download): ${dErr?.message ?? 'vazio'}`; }
      else {
        const back = new Uint8Array(await blob.arrayBuffer());
        const actual = await sha256Hex(back);
        verified = actual === checksum;
        if (!verified) { mismatch = true; verifyError = `checksum divergente (esperado ${checksum.slice(0, 12)}…, obtido ${actual.slice(0, 12)}…)`; }
      }
    } catch (e) { verifyError = `verificacao inconclusiva: ${(e as Error).message}`; }

    const finished = new Date();
    const finalStatus = verified ? 'verified' : (mismatch ? 'corrupt' : 'success');
    await svc.from('backup_log').update({
      status: finalStatus, finished_at: finished.toISOString(), file_path: path, file_size_bytes: bytes.length,
      records_count: total, duration_ms: finished.getTime() - startedAt.getTime(), error_message: verified ? null : verifyError,
      details: { checksum_sha256: checksum, self_verified: verified, verify_inconclusive: !verified && !mismatch, dynamic_table_list: dynamic, tables_included: included, tables_excluded: excluded, tables_failed: failed, verified_at: finished.toISOString() },
    }).eq('id', logId);

    const degraded = !dynamic || !verified || failed.length > 0;
    const hbStatus = mismatch ? 'error' : (degraded ? 'warning' : 'ok');
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'cron-backup', p_expected_max_age_minutes: 1440, p_status: hbStatus, p_error: hbStatus === 'ok' ? null : [!dynamic ? 'lista estatica (fallback)' : null, verifyError, failed.length ? `tabelas com erro: ${failed.join(', ')}` : null].filter(Boolean).join(' · '), p_description: 'Backup logico diario (dinamico + auto-verificado)' });

    return json({ ok: true, backup_log_id: logId, day, path, status: finalStatus, self_verified: verified, tables: included.length, excluded: excluded.length, rows: total, failed, checksum_sha256: checksum, bytes: bytes.length });
  } catch (e) {
    const f = new Date();
    await svc.from('backup_log').update({ status: 'failed', finished_at: f.toISOString(), duration_ms: f.getTime() - startedAt.getTime(), error_message: (e as Error).message }).eq('id', logId);
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'cron-backup', p_expected_max_age_minutes: 1440, p_status: 'error', p_error: (e as Error).message, p_description: 'Backup logico diario (dinamico + auto-verificado)' });
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
