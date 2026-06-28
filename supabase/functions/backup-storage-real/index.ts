// backup-storage-real (Concresoft) v1 — manifesto dos objetos de Storage -> bucket 'backups'.
// Inventaria todos os buckets (exceto 'backups'), grava manifesto JSON + backup_log + heartbeat + checksum.
// Fail-closed em CRON_SECRET. Service-role. Self-contained. Agendado 45 3 * * * (pg_cron).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, x-cron-secret', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function listBucket(svc: SupabaseClient, bucket: string, prefix = '', depth = 0): Promise<Array<Record<string, unknown>>> {
  if (depth > 12) return [];
  const out: Array<Record<string, unknown>> = [];
  const { data, error } = await svc.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) return [{ bucket, prefix, error: error.message }];
  for (const obj of data ?? []) {
    const path = prefix ? `${prefix}/${obj.name}` : obj.name;
    if ((obj as { id: string | null }).id === null && !(obj as { metadata?: unknown }).metadata) {
      out.push(...await listBucket(svc, bucket, path, depth + 1));
    } else {
      out.push({ bucket, path, size: (obj as { metadata?: { size?: number } }).metadata?.size ?? 0, updated_at: (obj as { updated_at?: string }).updated_at ?? null });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return json({ ok: false, error: 'CRON_SECRET ausente: fail-closed' }, 500);
  if ((req.headers.get('x-cron-secret') ?? '') !== expected) return json({ ok: false, error: 'cron secret invalido' }, 401);

  const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const startedAt = new Date();
  const triggeredBy = (() => { try { return new URL(req.url).searchParams.get('by') || 'cron'; } catch { return 'cron'; } })();
  const { data: log, error: logErr } = await svc.from('backup_log').insert({ backup_type: 'storage', status: 'running', triggered_by: triggeredBy, started_at: startedAt.toISOString() }).select('id').single();
  if (logErr || !log) return json({ ok: false, error: `backup_log insert: ${logErr?.message ?? 'sem id'}` }, 500);
  const logId = (log as { id: string }).id;

  try {
    const { data: buckets, error: bErr } = await svc.storage.listBuckets();
    if (bErr) throw new Error(bErr.message);
    const manifest: Record<string, unknown> = { exported_at: startedAt.toISOString(), buckets: {} };
    let totalObjects = 0; let totalSize = 0;
    for (const b of buckets ?? []) {
      if (b.name === 'backups') continue;
      const objects = await listBucket(svc, b.name);
      totalObjects += objects.length;
      totalSize += objects.reduce((s, o) => s + Number(o.size ?? 0), 0);
      (manifest.buckets as Record<string, unknown>)[b.name] = objects;
    }
    const day = startedAt.toISOString().slice(0, 10);
    const path = `storage/${day}/manifest-${Date.now()}.json`;
    const bytes = new TextEncoder().encode(JSON.stringify(manifest));
    const checksum = await sha256Hex(bytes);
    const up = await svc.storage.from('backups').upload(path, bytes, { contentType: 'application/json', upsert: false });
    const finished = new Date();
    await svc.from('backup_log').update({ status: up.error ? 'failed' : 'success', finished_at: finished.toISOString(), file_path: up.error ? null : path, file_size_bytes: bytes.length, records_count: totalObjects, duration_ms: finished.getTime() - startedAt.getTime(), error_message: up.error?.message ?? null, details: { checksum_sha256: checksum, total_size_bytes: totalSize } }).eq('id', logId);
    if (up.error) {
      await svc.rpc('record_cron_heartbeat', { p_job_name: 'backup-storage-real', p_expected_max_age_minutes: 1440, p_status: 'error', p_error: up.error.message, p_description: 'Manifesto diario de Storage' });
      return json({ ok: false, error: up.error.message }, 500);
    }
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'backup-storage-real', p_expected_max_age_minutes: 1440, p_status: 'ok', p_error: null, p_description: 'Manifesto diario de Storage' });
    return json({ ok: true, backup_log_id: logId, path, objects: totalObjects, total_size_bytes: totalSize, checksum_sha256: checksum });
  } catch (e) {
    const f = new Date();
    await svc.from('backup_log').update({ status: 'failed', finished_at: f.toISOString(), duration_ms: f.getTime() - startedAt.getTime(), error_message: (e as Error).message }).eq('id', logId);
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'backup-storage-real', p_expected_max_age_minutes: 1440, p_status: 'error', p_error: (e as Error).message, p_description: 'Manifesto diario de Storage' });
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
