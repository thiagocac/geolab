// enviar-laudo-cliente (GEOLAB) — melhoria 3.1. Envia o laudo EMITIDO ao contato do cliente
// (lab_clients.email) com o PDF do laudo ANEXADO. Staff (verify_jwt=true; confirma member do tenant).
//
// Autocontido e alinhado ao contrato do dispatch deployado:
//   • respeita notification_dispatch_settings (dispatch_enabled / dry_run / email_allowlist);
//   • loga em notification_dispatch_log (recipient_email, event_type, status, payload, metadata, dedupe_key);
//   • FAIL-SAFE: sem RESEND_API_KEY/RESEND_FROM_EMAIL -> registra e NÃO envia (status 'skipped').
//   • IDEMPOTENTE por revisão: se já houve envio 'sent' do mesmo laudo+revisão, não reenvia.
//
// Decisão de design (honesta): anexa o PDF em vez de mandar link, porque NÃO há rota pública /portal/m
// nem download anônimo do laudo no app (criar isso é decisão de segurança à parte). Se você preferir
// DELEGAR ao send-notification deployado, troque o bloco `fetch(https://api.resend.com/emails ...)` por
// uma chamada a ele — o gating/log aqui já seguem o mesmo modelo de notification_dispatch_settings/_log.
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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const reportId = clean(body.lab_report_id);
    if (!reportId) return json({ ok: false, error: 'lab_report_id obrigatorio' }, 400);

    const { data: rep } = await admin.from('lab_reports')
      .select('id, tenant_id, client_id, numero, revisao, status, storage_path, deleted_at')
      .eq('id', reportId).is('deleted_at', null).maybeSingle();
    if (!rep) return json({ ok: false, error: 'laudo nao encontrado' }, 404);

    // autorizacao: solicitante e member ativo do tenant do laudo
    const { data: mem } = await admin.from('members').select('id')
      .eq('auth_id', ures.user.id).eq('tenant_id', rep.tenant_id).eq('active', true).is('deleted_at', null).maybeSingle();
    if (!mem) return json({ ok: false, error: 'sem permissao neste laboratorio' }, 403);

    if (rep.status !== 'emitido') return json({ ok: false, error: 'o laudo precisa estar emitido para enviar ao cliente' }, 422);
    if (!rep.storage_path) return json({ ok: false, error: 'laudo sem PDF persistido' }, 422);

    const { data: cli } = await admin.from('lab_clients').select('email, razao_social')
      .eq('id', rep.client_id).eq('tenant_id', rep.tenant_id).maybeSingle();
    const to = clean(cli?.email);
    if (!to) return json({ ok: true, sent: false, reason: 'cliente sem e-mail de contato cadastrado' });

    const dedupe = 'laudo_cliente:' + rep.id + ':' + (rep.revisao ?? 0);
    const { data: prev } = await admin.from('notification_dispatch_log').select('id')
      .eq('dedupe_key', dedupe).eq('status', 'sent').limit(1).maybeSingle();
    if (prev) return json({ ok: true, sent: false, reason: 'laudo ja enviado ao cliente nesta revisao' });

    const { data: st } = await admin.from('notification_dispatch_settings')
      .select('dispatch_enabled, dry_run, email_allowlist').limit(1).maybeSingle();
    const enabled = st?.dispatch_enabled === true;
    const dryRun = (st?.dry_run as boolean | undefined) !== false;
    const allow = Array.isArray(st?.email_allowlist) ? (st!.email_allowlist as unknown[]).map((e) => String(e).toLowerCase()) : [];
    const allowed = allow.length === 0 || allow.includes(to.toLowerCase());

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? '';
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';

    const logRow = async (status: string, extra?: Record<string, unknown>) => {
      try {
        await admin.from('notification_dispatch_log').insert({
          tenant_id: rep.tenant_id, dedupe_key: dedupe, recipient_email: to, event_type: 'laudo_disponivel_cliente',
          status, notification_type: 'email', entity_type: 'lab_report', entity_id: rep.id,
          payload: { numero: rep.numero, revisao: rep.revisao }, metadata: extra ?? {},
        });
      } catch (_e) { /* log e best-effort */ }
    };

    if (!resendKey || !fromEmail) { await logRow('skipped', { reason: 'resend_nao_configurado' }); return json({ ok: true, sent: false, reason: 'envio de e-mail nao configurado (RESEND_API_KEY/RESEND_FROM_EMAIL)' }); }
    if (!enabled) { await logRow('skipped', { reason: 'dispatch_desabilitado' }); return json({ ok: true, sent: false, reason: 'envio desabilitado nas configuracoes (dispatch_enabled=false)' }); }
    if (dryRun || !allowed) { await logRow('dry_run', { reason: dryRun ? 'dry_run' : 'fora_da_allowlist' }); return json({ ok: true, sent: false, reason: dryRun ? 'dry-run: registrado, nao enviado' : 'destinatario fora da allowlist' }); }

    const dl = await admin.storage.from('lab-reports').download(rep.storage_path);
    if (dl.error || !dl.data) { await logRow('error', { reason: 'falha_download_pdf' }); return json({ ok: false, error: 'falha ao ler o PDF do laudo' }, 500); }
    const buf = new Uint8Array(await dl.data.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const fname = 'laudo-' + String(rep.numero).replace(/[^0-9A-Za-z]+/g, '-') + '.pdf';
    const subject = 'Laudo ' + rep.numero + (Number(rep.revisao) > 0 ? ' (R' + rep.revisao + ')' : '');
    const html = '<p>Ola,</p><p>Segue em anexo o laudo de ensaio <strong>' + rep.numero + '</strong> (revisao R' + (rep.revisao ?? 0) + ').</p><p>Atenciosamente,<br/>' + (clean(cli?.razao_social) ? clean(cli?.razao_social) + ' &middot; ' : '') + 'Laboratorio de controle tecnologico</p>';

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + resendKey },
      body: JSON.stringify({ from: fromEmail, to: [to], subject, html, attachments: [{ filename: fname, content: b64 }] }),
    });
    const out = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) { await logRow('error', { reason: 'resend_' + r.status, detail: JSON.stringify(out).slice(0, 200) }); return json({ ok: false, error: 'falha no envio (Resend ' + r.status + ')' }, 502); }
    await logRow('sent', { resend_id: out.id ?? null });
    return json({ ok: true, sent: true, to, resend_id: out.id ?? null });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
