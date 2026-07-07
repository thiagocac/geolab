// geocode-obras (Concresoft) — geocodifica obras (e a origem do lab) via Nominatim/OSM e cacheia
// lat/lng em client_works / config_lab. Sem chave/custo. Throttle 1,1s + User-Agent (politica do OSM).
// Escreve pelo CLIENTE DO USUARIO (RLS: só writer do tenant grava). verify_jwt.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// --- Observabilidade (M1, auditoria 2026-07-07): registra cada invocacao em ef_invocation_log ---
// (alimenta v_ef_metrics_hourly e o alarme de 5xx/p95 do telemetry-alarm). Best-effort: nunca
// bloqueia nem altera a resposta da EF. trace_id via ?trace_id= (sem preflight CORS).
const _obsSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _obsTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _obsActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const s = _obsSvc(); const { data: u, error } = await s.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await s.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _obsFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null }) { try { const s = _obsSvc(); const actor = await _obsActor(req); const tr = _obsTrace(req); await s.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(tr ? { trace_id: tr } : {}) } }); } catch { /* telemetria nunca bloqueia a EF */ } }
function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _obsFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }


const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=' + encodeURIComponent(q);
  const resp = await fetch(u, { headers: { 'User-Agent': 'Concresoft-GEOLAB/1 (lab.consultegeo.org)', 'Accept': 'application/json' } });
  if (!resp.ok) return null;
  const arr = await resp.json().catch(() => []);
  if (!Array.isArray(arr) || !arr.length) return null;
  const lat = Number(arr[0].lat), lng = Number(arr[0].lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
const queryDe = (r: Record<string, unknown>) => [r.endereco, r.bairro, r.cidade, r.uf, r.cep, 'Brasil'].filter((x) => x && String(x).trim()).join(', ');

serveWithTelemetry('geocode-obras', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.work_ids) ? body.work_ids.map(String).slice(0, 20) : [];
    const wantOrigem = body.origem === true;
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return json({ error: 'nao autenticado' }, 401);
    const sb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ error: 'nao autenticado' }, 401);

    const geocoded: { work_id: string; lat: number; lng: number }[] = [];
    const erros: string[] = [];
    let first = true;

    if (ids.length) {
      const { data: works, error } = await sb.from('client_works')
        .select('id, endereco, bairro, cidade, uf, cep, lat, lng').in('id', ids).is('deleted_at', null);
      if (error) return json({ error: error.message }, 403);
      for (const w of (works ?? []) as Record<string, unknown>[]) {
        if (w.lat != null && w.lng != null) { geocoded.push({ work_id: String(w.id), lat: Number(w.lat), lng: Number(w.lng) }); continue; }
        const q = queryDe(w);
        if (!q || q === 'Brasil') { erros.push(String(w.id) + ': sem endereco'); continue; }
        if (!first) await sleep(1100); first = false;
        const g = await geocode(q);
        if (!g) { erros.push(String(w.id) + ': nao geocodificado'); continue; }
        const { error: ue } = await sb.from('client_works').update({ lat: g.lat, lng: g.lng, geocoded_at: new Date().toISOString() }).eq('id', String(w.id));
        if (ue) { erros.push(String(w.id) + ': ' + ue.message); continue; }
        geocoded.push({ work_id: String(w.id), lat: g.lat, lng: g.lng });
      }
    }

    let origem: { lat: number; lng: number } | null = null;
    if (wantOrigem) {
      const { data: cfg } = await sb.from('config_lab').select('endereco_origem, origem_lat, origem_lng').maybeSingle();
      if (cfg?.origem_lat != null && cfg?.origem_lng != null) origem = { lat: Number(cfg.origem_lat), lng: Number(cfg.origem_lng) };
      else if (cfg?.endereco_origem) {
        if (!first) await sleep(1100); first = false;
        const g = await geocode(String(cfg.endereco_origem) + ', Brasil');
        if (g) { await sb.from('config_lab').update({ origem_lat: g.lat, origem_lng: g.lng }).not('tenant_id', 'is', null); origem = g; }
        else erros.push('origem: nao geocodificada');
      }
    }

    return json({ ok: true, geocoded, origem, erros });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
