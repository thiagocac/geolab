// notify-cliente-evento (GEOLAB) - e-mail ao CONTATO DO CLIENTE de um evento da obra (ex.: resultado < fck).
// verify_jwt=true (staff do tenant). Resolve o e-mail do cliente NO SERVIDOR (o browser nao escolhe destinatario)
// e roteia pela send-notification (UNICO ponto de saida Resend; aplica allowlist/supressao/dispatch/dry-run/dedupe).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const clean = (v: unknown) => String(v ?? '').trim();
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const workId = clean(body.work_id);
    if (!isUuid(workId)) return json({ ok: false, error: 'work_id invalido' }, 400);

    const { data: w } = await admin.from('client_works').select('id, tenant_id, client_id, nome').eq('id', workId).is('deleted_at', null).maybeSingle();
    if (!w) return json({ ok: false, error: 'obra nao encontrada' }, 404);
    const { data: mem } = await admin.from('members').select('id').eq('auth_id', ures.user.id).eq('tenant_id', w.tenant_id).eq('active', true).is('deleted_at', null).maybeSingle();
    if (!mem) return json({ ok: false, error: 'sem permissao neste laboratorio' }, 403);

    const { data: cli } = await admin.from('lab_clients').select('email').eq('id', w.client_id).eq('tenant_id', w.tenant_id).maybeSingle();
    const to = clean(cli?.email);
    if (!to) return json({ ok: true, sent: false, reason: 'cliente sem e-mail de contato cadastrado' });

    const dedupe = clean(body.dedupe_key) || ('cliente_evento:' + workId + ':' + (clean(body.event_type) || 'evento'));
    const { data: prev } = await admin.from('notification_dispatch_log').select('id').eq('dedupe_key', dedupe).eq('status', 'sent').limit(1).maybeSingle();
    if (prev) return json({ ok: true, sent: false, reason: 'evento ja enviado ao cliente' });

    const { data: st } = await admin.from('notification_dispatch_settings').select('dispatch_secret').limit(1).maybeSingle();
    const secret = clean(st?.dispatch_secret);

    const payload = {
      email: to,
      event_type: clean(body.event_type) || 'resultado_abaixo_fck',
      title: clean(body.titulo) || undefined,
      body: clean(body.corpo) || undefined,
      reference: clean(body.reference) || undefined,
      deep_link: clean(body.deep_link) || '/portal-cliente',
      cta_label: 'Abrir no portal',
      obra_nome: clean(w.nome) || undefined,
      tenant_id: w.tenant_id,
      entity_type: 'client_work',
      entity_id: workId,
      dedupe_key: dedupe,
    };
    const r = await fetch(url + '/functions/v1/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anon, 'x-notify-secret': secret },
      body: JSON.stringify(payload),
    });
    const out = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) return json({ ok: false, error: 'falha no envio', detail: out }, 502);
    return json({ ok: true, sent: out.status === 'sent', status: out.status ?? null, reason: out.reason ?? null, to });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
