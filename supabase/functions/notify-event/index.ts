// notify-event (GEOLAB) - resolve destinatarios por papel (role_notification_types)
// e faz fan-out para send-notification (unico ponto Resend). Re-derivado do GEOMAT;
// resolucao INLINE (sem RPC resolve_event_recipients). Auth: x-notify-secret OU JWT.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// --- Observabilidade (M1, auditoria 2026-07-07): registra cada invocacao em ef_invocation_log ---
// (alimenta v_ef_metrics_hourly e o alarme de 5xx/p95 do telemetry-alarm). Best-effort: nunca
// bloqueia nem altera a resposta da EF. trace_id via ?trace_id= (sem preflight CORS).
const _obsSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _obsTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _obsActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const s = _obsSvc(); const { data: u, error } = await s.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await s.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _obsFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null }) { try { const s = _obsSvc(); const actor = await _obsActor(req); const tr = _obsTrace(req); await s.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(tr ? { trace_id: tr } : {}) } }); } catch { /* telemetria nunca bloqueia a EF */ } }
function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _obsFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }


const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-notify-secret', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const fail = (m: string, status = 400, details?: unknown) => json({ ok: false, error: m, details }, status);
const asStr = (v: unknown, f = '') => (typeof v === 'string' && v.trim() ? v.trim() : f);
const lower = (v: unknown) => asStr(v).toLowerCase();
const timingSafeEqualStr = (a: string, b: string): boolean => {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let r = 0; for (let i = 0; i < ea.length; i++) r |= ea[i] ^ eb[i];
  return r === 0;
};
const MAX_RECIPIENTS = 1000;

serveWithTelemetry('notify-event', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const tenantId = asStr(body.tenant_id);
    if (!tenantId) return fail('tenant_id obrigatorio');
    const eventType = asStr(body.event_type, 'system.event');

    const { data: settings, error: se } = await svc.from('notification_dispatch_settings').select('dispatch_secret').eq('id', true).maybeSingle();
    if (se) return fail(se.message, 500);
    const secret = req.headers.get('x-notify-secret') ?? '';
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const secretOk = !!settings?.dispatch_secret && timingSafeEqualStr(secret, String(settings.dispatch_secret));
    let callerAuthId = '';
    if (!secretOk && bearer) { const { data } = await svc.auth.getUser(bearer); callerAuthId = asStr(data.user?.id); }
    const jwtOk = !!callerAuthId;
    if (!secretOk && !jwtOk) return fail('nao autorizado', 401);
    // Via sessao (JWT): so dispara eventos no proprio laboratorio + rate limit anti-amplificacao.
    if (!secretOk) {
      const { data: cm } = await svc.from('members').select('tenant_id').eq('auth_id', callerAuthId).eq('active', true).is('deleted_at', null);
      const callerTenants = (cm ?? []).map((r: Record<string, unknown>) => asStr(r.tenant_id)).filter(Boolean);
      if (!callerTenants.includes(tenantId)) return fail('evento fora do seu laboratorio', 403);
      const bkt = new Date(); bkt.setMinutes(0, 0, 0);
      const { data: calls } = await svc.rpc('bump_notification_rate_limit', { p_actor_key: `notify:${tenantId}`, p_bucket_start: bkt.toISOString() });
      if (Number(calls ?? 0) > 120) return fail('limite de eventos por hora atingido', 429);
    }

    const { data: roleRows } = await svc.from('role_notification_types').select('role_code').eq('event_type', eventType).eq('enabled', true).eq('channel', 'email');
    const roleCodes = [...new Set((roleRows ?? []).map((r: Record<string, unknown>) => asStr(r.role_code)).filter(Boolean))];
    if (!roleCodes.length) {
      // CORRECAO: marca o outbox como processado mesmo sem destinatarios, para o alarme de
      // ops (telemetry_ops_alarm_run) nao contar eventos sem-papel como backlog preso.
      if (body.outbox_id) await svc.from('notify_event_outbox').update({ status: 'processed', processed_at: new Date().toISOString(), attempts: 1 }).eq('id', asStr(body.outbox_id));
      return json({ ok: true, event_type: eventType, recipients: 0, results: [], reason: 'sem papeis para o evento' });
    }

    const orFilter = `role.in.(${roleCodes.join(',')}),roles.ov.{${roleCodes.join(',')}}`;
    const { data: members, error: me } = await svc.from('members').select('id, email').eq('tenant_id', tenantId).eq('active', true).is('deleted_at', null).or(orFilter);
    if (me) return fail(me.message, 500);
    const base = (members ?? []).filter((m: Record<string, unknown>) => lower(m.email));
    const ids = base.map((m: Record<string, unknown>) => m.id);
    let optedOut = new Set<string>();
    if (ids.length) {
      const { data: prefs } = await svc.from('member_notification_prefs').select('member_id, channel').in('member_id', ids).eq('event_type', eventType);
      optedOut = new Set((prefs ?? []).filter((r: Record<string, unknown>) => ['off', 'none', 'disabled'].includes(asStr(r.channel))).map((r: Record<string, unknown>) => String(r.member_id)));
    }
    const seen = new Set<string>();
    const uniq = base.filter((m: Record<string, unknown>) => {
      if (optedOut.has(String(m.id))) return false;
      const e = lower(m.email); if (seen.has(e)) return false; seen.add(e); return true;
    }).slice(0, MAX_RECIPIENTS);

    const sendUrl = `${url}/functions/v1/send-notification`;
    const results: Array<{ email: string; status: number; ok: boolean }> = [];
    for (const r of uniq) {
      const payload = { ...body, tenant_id: tenantId, event_type: eventType, member_id: r.id, email: r.email, dedupe_key: asStr(body.dedupe_key, `${eventType}:${asStr(body.entity_type, 'generic')}:${asStr(body.entity_id, crypto.randomUUID())}:${r.id}`) };
      const res = await fetch(sendUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-notify-secret': settings?.dispatch_secret ?? '' }, body: JSON.stringify(payload) });
      results.push({ email: asStr(r.email), status: res.status, ok: res.ok });
    }
    if (body.outbox_id) await svc.from('notify_event_outbox').update({ status: 'processed', processed_at: new Date().toISOString(), attempts: 1 }).eq('id', asStr(body.outbox_id));
    return json({ ok: true, event_type: eventType, recipients: results.length, results });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
