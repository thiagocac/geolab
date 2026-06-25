// lab-client-portal (GEOLAB) - portal do cliente por MAGIC LINK (sem conta Auth). Publica (verify_jwt=false):
// o token E a credencial. Valida pelo hash sha256 em magic_links (purpose 'portal', nao expirado), entao serve
// READ-ONLY os dados do cliente (obras/concretagens/laudos/resultados) e assina o PDF do laudo. Service-role, escopo = entity_id.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
async function sha256Hex(t: string) { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join(''); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'metodo nao suportado' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token || token.length < 16) return json({ ok: false, error: 'token ausente' }, 400);
    const hash = await sha256Hex(token);
    const { data: link } = await admin.from('magic_links').select('tenant_id, purpose, entity_table, entity_id, expires_at, consumed_at').eq('token_hash', hash).maybeSingle();
    if (!link || link.purpose !== 'portal' || link.entity_table !== 'lab_clients' || link.consumed_at || new Date(String(link.expires_at)) < new Date()) {
      return json({ ok: false, error: 'Link invalido ou expirado.' }, 401);
    }
    const tenant = String(link.tenant_id); const clientId = String(link.entity_id);

    // Download de laudo (escopo: a obra precisa ser do cliente do link)
    const reportId = typeof body.lab_report_id === 'string' ? body.lab_report_id : '';
    if (reportId) {
      const { data: rep } = await admin.from('lab_reports').select('id, work_id, storage_path').eq('id', reportId).eq('tenant_id', tenant).is('deleted_at', null).maybeSingle();
      if (!rep || !rep.storage_path) return json({ ok: false, error: 'laudo nao encontrado' }, 404);
      const { data: w } = await admin.from('client_works').select('id').eq('id', rep.work_id).eq('client_id', clientId).is('deleted_at', null).maybeSingle();
      if (!w) return json({ ok: false, error: 'sem acesso a este laudo' }, 403);
      const { data: signed, error: se } = await admin.storage.from('lab-reports').createSignedUrl(String(rep.storage_path), 120);
      if (se || !signed?.signedUrl) return json({ ok: false, error: se?.message ?? 'falha ao assinar' }, 500);
      return json({ ok: true, url: signed.signedUrl });
    }

    const { data: cli } = await admin.from('lab_clients').select('razao_social, nome_fantasia').eq('id', clientId).eq('tenant_id', tenant).maybeSingle();
    const { data: tnt } = await admin.from('tenants').select('name').eq('id', tenant).maybeSingle();
    const { data: obras } = await admin.from('client_works').select('id, nome, codigo, cidade, uf').eq('client_id', clientId).eq('tenant_id', tenant).is('deleted_at', null);
    const workIds = (obras ?? []).map((o: Record<string, unknown>) => o.id);
    let concretagens: unknown[] = []; let laudos: unknown[] = []; let resultados: unknown[] = [];
    if (workIds.length) {
      const { data: cs } = await admin.from('concretagens').select('id, codigo, work_id, status, data_real, data_programada, local_texto, volume_lancado_m3, fck_previsto').in('work_id', workIds).is('deleted_at', null).order('data_programada', { ascending: false }).limit(500);
      concretagens = cs ?? [];
      // Laudos com classificacao Parcial/Final por exemplar (RPC compartilhada, migration 063).
      const { data: ls } = await admin.rpc('fn_laudos_por_obras', { p_work_ids: workIds });
      laudos = ls ?? [];
      // Resultados consolidados (1 linha por CP) para a aba de resultados/Excel do portal publico.
      const { data: rs } = await admin.rpc('fn_resultados_por_obras', { p_work_ids: workIds });
      resultados = rs ?? [];
    }
    return json({ ok: true, laboratorio: tnt?.name ?? null, cliente: cli ?? null, obras: obras ?? [], concretagens, laudos, resultados });
  } catch (e) { return json({ ok: false, error: (e as Error).message }, 500); }
});
