// portal-laudo-url (GEOLAB) - assina download de laudo APÓS verificar escopo do solicitante.
// Cliente: só obras vinculadas (member_can_access_work). Staff: qualquer obra do tenant.
// Necessário porque o bucket lab-reports não tem policy de storage p/ laudos (e policy não escopa por obra).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const clean = (v: unknown) => String(v ?? '').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authz = req.headers.get('authorization') ?? '';
    if (!authz) return json({ ok: false, error: 'nao autenticado' }, 401);
    const sb = createClient(url, anon, { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ ok: false, error: 'nao autenticado' }, 401);

    const body = await req.json().catch(() => ({}));
    const reportId = clean(body.lab_report_id);
    if (!reportId) return json({ ok: false, error: 'lab_report_id obrigatorio' }, 400);

    const { data: rep } = await admin.from('lab_reports')
      .select('id, work_id, storage_path, deleted_at').eq('id', reportId).is('deleted_at', null).maybeSingle();
    if (!rep || !rep.storage_path) return json({ ok: false, error: 'laudo nao encontrado' }, 404);
    if (!rep.work_id) return json({ ok: false, error: 'laudo sem obra; download indisponivel pelo portal' }, 422);

    // verificacao de escopo reaproveitando o helper de RLS sob a identidade do solicitante
    const { data: can, error: ce } = await sb.rpc('member_can_access_work', { p_work_id: rep.work_id });
    if (ce) return json({ ok: false, error: ce.message }, 403);
    if (can !== true) return json({ ok: false, error: 'sem acesso a este laudo' }, 403);

    const { data: signed, error: se } = await admin.storage.from('lab-reports').createSignedUrl(String(rep.storage_path), 120);
    if (se || !signed?.signedUrl) return json({ ok: false, error: se?.message ?? 'falha ao assinar' }, 500);
    return json({ ok: true, url: signed.signedUrl });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
