// backup-health-check (Concresoft) v2 — confere que houve backup de banco E de storage recente.
// Aceita status 'success' E 'verified' (gotcha #39: um backup auto-verificado nao pode virar falso "faltou").
// Janela 36h. Heartbeat ok/warning. Fail-closed em CRON_SECRET. Self-contained. Agendado 30 8 * * *.
// v2 (auditoria de observabilidade 2026-07-06): expected_max_age 180→1560 min. O job e DIARIO;
// 180 min deixava o heartbeat "atrasado" ~21h/dia e gerava alerta critico falso todos os dias.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, x-cron-secret', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const HEARTBEAT_MAX_AGE_MIN = 1560; // job diario (30 8 * * *): 24h + 2h de folga

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return json({ ok: false, error: 'CRON_SECRET ausente: fail-closed' }, 500);
  if ((req.headers.get('x-cron-secret') ?? '') !== expected) return json({ ok: false, error: 'cron secret invalido' }, 401);

  const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  try {
    const cutoff = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const { data, error } = await svc.from('backup_log').select('backup_type,status,finished_at').in('status', ['success', 'verified']).gte('finished_at', cutoff).order('finished_at', { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const hasDatabase = rows.some((b) => b.backup_type === 'database');
    const hasStorage = rows.some((b) => b.backup_type === 'storage');
    const status = hasDatabase && hasStorage ? 'ok' : 'warning';
    const errorMessage = status === 'ok' ? null : `Backup ausente nas ultimas 36h (database=${hasDatabase}, storage=${hasStorage})`;
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'backup-health-check', p_expected_max_age_minutes: HEARTBEAT_MAX_AGE_MIN, p_status: status, p_error: errorMessage, p_description: 'Health-check de backup (database+storage, 36h)' });
    return json({ ok: true, status, has_database: hasDatabase, has_storage: hasStorage, recent: rows.length });
  } catch (e) {
    await svc.rpc('record_cron_heartbeat', { p_job_name: 'backup-health-check', p_expected_max_age_minutes: HEARTBEAT_MAX_AGE_MIN, p_status: 'error', p_error: (e as Error).message, p_description: 'Health-check de backup (database+storage, 36h)' });
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
