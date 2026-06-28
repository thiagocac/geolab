// prune-storage-retention (Concresoft) v1 — RETENCAO DOS BUCKETS DE CONTEUDO, MODO RELATORIO (NAO APAGA).
// Inventaria lab-reports/evidencias/fichas/anexos, cruza cada objeto com TODAS as colunas de path
// conhecidas no banco e classifica: referenciado vs candidato-a-orfao, com distribuicao de idade.
// Grava em backup_log (backup_type='storage-retention') + heartbeat. NAO DELETA — a exclusao fica
// desabilitada ate haver TTLs definidos e o mapeamento por bucket confirmado (preservacao de laudo).
// Fail-closed em CRON_SECRET. Service-role. Self-contained. Agendado semanal (20 4 * * 0).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, x-cron-secret', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const CONTENT_BUCKETS = ['lab-reports', 'evidencias', 'fichas', 'anexos'];
const PATH_COLUMNS: Array<[string, string]> = [
  ['lab_reports', 'storage_path'], ['config_lab', 'logo_path'], ['evidencias', 'path'],
  ['colaborador_certificacoes', 'anexo_path'], ['equipamentos', 'anexo_certificado_path'],
  ['lab_contracts', 'anexo_path'], ['operational_materials', 'carta_traco_path'], ['lotes_importacao', 'arquivo_path'],
];

function basename(p: string): string { const i = p.lastIndexOf('/'); return i >= 0 ? p.slice(i + 1) : p; }
function normalize(v: string): string {
  let s = v.trim();
  try { if (s.startsWith('http')) { const u = new URL(s); s = u.pathname; } } catch { /* noop */ }
  s = s.replace(/^\/+/, '');
  const parts = s.split('/');
  const bi = parts.findIndex((p) => CONTENT_BUCKETS.includes(p));
  if (bi >= 0) s = parts.slice(bi + 1).join('/');
  return s;
}

async function listBucket(svc: SupabaseClient, bucket: string, prefix = '', depth = 0): Promise<Array<{ path: string; created: number; size: number }>> {
  if (depth > 12) return [];
  const out: Array<{ path: string; created: number; size: number }> = [];
  const { data, error } = await svc.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) return out;
  for (const obj of data ?? []) {
    const path = prefix ? `${prefix}/${obj.name}` : obj.name;
    if ((obj as { id: string | null }).id === null && !(obj as { metadata?: unknown }).metadata) {
      out.push(...await listBucket(svc, bucket, path, depth + 1));
    } else {
      out.push({ path, created: Date.parse((obj as { created_at?: string }).created_at || '') || 0, size: (obj as { metadata?: { size?: number } }).metadata?.size ?? 0 });
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
  const { data: log, error: logErr } = await svc.from('backup_log').insert({ backup_type: 'storage-retention', status: 'running', triggered_by: 'cron', started_at: startedAt.toISOString() }).select('id').single();
  if (logErr || !log) return json({ ok: false, error: `backup_log insert: ${logErr?.message ?? 'sem id'}` }, 500);
  const logId = (log as { id: string }).id;

  try {
    const refFull = new Set<string>();
    const refBase = new Set<string>();
    for (const [table, col] of PATH_COLUMNS) {
      const { data, error } = await svc.from(table).select(col);
      if (error) continue;
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const raw = row[col];
        if (typeof raw === 'string' && raw) { const n = normalize(raw); refFull.add(n); refBase.add(basename(n)); }
      }
    }

    const now = Date.now();
    const perBucket: Record<string, unknown> = {};
    let grandTotal = 0; let grandOrphans = 0;
    for (const bucket of CONTENT_BUCKETS) {
      const objs = await listBucket(svc, bucket);
      let referenced = 0; const orphanSample: string[] = []; let oldestDays = 0; let totalSize = 0;
      for (const o of objs) {
        totalSize += o.size;
        if (o.created > 0) oldestDays = Math.max(oldestDays, Math.floor((now - o.created) / 86400000));
        const norm = normalize(o.path);
        const isRef = refFull.has(norm) || refBase.has(basename(norm));
        if (isRef) referenced++; else if (orphanSample.length < 50) orphanSample.push(o.path);
      }
      const orphanCount = objs.length - referenced;
      grandTotal += objs.length; grandOrphans += orphanCount;
      perBucket[bucket] = { total: objs.length, referenced, orphan_candidates: orphanCount, total_size_bytes: totalSize, oldest_days: oldestDays, sample_orphans: orphanSample };
    }

    const finished = new Date();
    await svc.from('backup_log').update({ status: 'success', finished_at: finished.toISOString(), records_count: grandTotal, duration_ms: finished.getTime() - startedAt.getTime(), details: { mode: 'report-only', deletion_enabled: false, note: 'Exclusao desabilitada na v1 — requer TTLs definidos e mapeamento por bucket confirmado (preservacao de laudo).', total_objects: grandTotal, total_orphan_candidates: grandOrphans, per_bucket: perBucket } }).eq('id', logId);
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'prune-storage-retention', p_expected_max_age_minutes: 10800, p_status: 'ok', p_error: null, p_description: 'Relatorio de retencao dos buckets de conteudo (sem apagar)' });
    return json({ ok: true, mode: 'report-only', deletion_enabled: false, total_objects: grandTotal, total_orphan_candidates: grandOrphans, per_bucket: perBucket });
  } catch (e) {
    const f = new Date();
    await svc.from('backup_log').update({ status: 'failed', finished_at: f.toISOString(), duration_ms: f.getTime() - startedAt.getTime(), error_message: (e as Error).message }).eq('id', logId);
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'prune-storage-retention', p_expected_max_age_minutes: 10800, p_status: 'error', p_error: (e as Error).message, p_description: 'Relatorio de retencao dos buckets de conteudo (sem apagar)' });
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
