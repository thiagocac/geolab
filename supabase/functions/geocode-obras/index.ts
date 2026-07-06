// geocode-obras (Concresoft) — geocodifica obras (e a origem do lab) via Nominatim/OSM e cacheia
// lat/lng em client_works / config_lab. Sem chave/custo. Throttle 1,1s + User-Agent (politica do OSM).
// Escreve pelo CLIENTE DO USUARIO (RLS: só writer do tenant grava). verify_jwt.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

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

Deno.serve(async (req) => {
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
