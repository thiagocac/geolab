// send-notification (Concresoft) - UNICO ponto de saida Resend. Suporta anexos internos (via x-notify-secret) + dedupe idempotente por dedupe_key (status 'sent').
// Gates INLINE, branding Concresoft, fail-closed em RESEND_API_KEY.
// Gate: auth -> inativo -> preferencia -> papel -> QUIET HOURS (is_in_quiet_hours, fail-open) -> allowlist -> supressao -> dispatch/dry-run.
// QUIET HOURS (v11): eventos NAO-system respeitam o silencio do membro (fuso proprio); falha na checagem = envia (fail-open).
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

const TITLES: Record<string, string> = {
  laudo_pronto: 'Laudo pronto para conferencia',
  resultado_abaixo_fck: 'Resultado abaixo do fck na idade de controle',
  cp_atrasado: 'Corpo de prova atrasado',
  calibracao_vencendo: 'Calibracao de equipamento vencendo',
  laudo_disponivel_cliente: 'Laudo disponivel para o cliente',
  laudo_reprovado: 'Laudo devolvido para revisao',
  laudo_correcao_solicitada: 'Solicitacao de correcao do cliente',
  medicao_gerada: 'Medicao aguardando aprovacao',
  certificacao_vencendo: 'Certificacao de colaborador vencendo',
  programacao_recebida_cliente: 'Recebemos sua programacao',
  programacao_confirmada_cliente: 'Concretagem confirmada',
  laudo_reemitido_cliente: 'Laudo revisado disponivel',
  concretagem_programada: 'Concretagens do dia',
  digest_executivo: 'Resumo do dia',
  resultado_parcial_cliente: 'Novos resultados de ensaio',
  boas_vindas: 'Bem-vindo(a) a Concresoft',
  boas_vindas_cliente: 'Seu acesso ao portal esta pronto',
};
const KICKERS: Record<string, string> = {
  laudo_pronto: 'LAUDO',
  resultado_abaixo_fck: 'ALERTA DE RESULTADO',
  cp_atrasado: 'AGENDA DE ROMPIMENTO',
  calibracao_vencendo: 'CALIBRACAO',
  laudo_disponivel_cliente: 'LAUDO',
  laudo_reprovado: 'LAUDO',
  laudo_correcao_solicitada: 'LAUDO',
  medicao_gerada: 'MEDICAO',
  certificacao_vencendo: 'CERTIFICACAO',
  programacao_recebida_cliente: 'PROGRAMACAO',
  programacao_confirmada_cliente: 'PROGRAMACAO',
  laudo_reemitido_cliente: 'LAUDO',
  concretagem_programada: 'AGENDA DE CONCRETAGEM',
  digest_executivo: 'RESUMO EXECUTIVO',
  resultado_parcial_cliente: 'RESULTADO',
  boas_vindas: 'ACESSO',
  boas_vindas_cliente: 'ACESSO',
};
const GRAD = 'linear-gradient(135deg,#182863 0%,#3E2D71 55%,#C5117E 100%)';
const BRAND_LOGO = 'https://app.concresoft.io/brand/concresoft-lockup-white-2x.png';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
// Anexos: SO em chamada interna confiavel (x-notify-secret). Externos (JWT) nunca anexam. Limite 1 anexo / ~16MB base64.
const MAX_INTERNAL_ATTACHMENTS = 1;
const MAX_ATTACHMENT_BASE64_CHARS = 16_000_000;
type ResendAttachment = { filename: string; content: string };
function attachmentsFromPayload(p: Record<string, unknown>, trustedInternalCall: boolean): ResendAttachment[] {
  if (!trustedInternalCall || !Array.isArray(p.attachments)) return [];
  const out: ResendAttachment[] = [];
  for (const raw of p.attachments.slice(0, MAX_INTERNAL_ATTACHMENTS)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const filename = asStr(item.filename).replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 120);
    const content = asStr(item.content);
    if (!filename || !content || content.length > MAX_ATTACHMENT_BASE64_CHARS) continue;
    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(content)) continue;
    out.push({ filename, content });
  }
  return out;
}

// Template transacional "bulletproof" do Concresoft Email Kit. Valores ja escapados pelo chamador.
function emailShell(o: { preheader: string; kicker: string; titulo: string; corpoHtml: string; url?: string; botaoLabel?: string; referencia?: string; data?: string; motivoEnvio: string; urlPreferencias?: string }) {
  const btn = (o.url && o.botaoLabel) ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 4px;"><tr><td align="center" bgcolor="#182863" style="border-radius:6px;background-color:#182863;background-image:${GRAD};"><!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${o.url}" style="height:46px;v-text-anchor:middle;width:240px;" arcsize="13%" stroke="f" fillcolor="#3E2D71"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${o.botaoLabel}</center></v:roundrect><![endif]--><!--[if !mso]><!-- --><a class="btn-a" href="${o.url}" style="display:inline-block;height:46px;line-height:46px;padding:0 26px;border-radius:6px;font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;background:${GRAD};">${o.botaoLabel}</a><!--<![endif]--></td></tr></table>` : '';
  const detRows = `${o.referencia ? `<tr><td style="font-size:13px;color:#8a8275;padding-bottom:7px;">Referencia</td><td align="right" style="font-size:13px;font-family:'JetBrains Mono',monospace;color:#182863;padding-bottom:7px;">${o.referencia}</td></tr>` : ''}${o.data ? `<tr><td style="font-size:13px;color:#8a8275;">Data</td><td align="right" style="font-size:13px;font-family:'JetBrains Mono',monospace;color:#182863;">${o.data}</td></tr>` : ''}`;
  const details = (o.referencia || o.data) ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:#faf9f7;border:1px solid #e6e1d6;border-radius:8px;"><tr><td style="padding:16px 18px;font-family:-apple-system,'Segoe UI',Arial,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detRows}</table></td></tr></table>` : '';
  const urlFallback = o.url ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.55;color:#8a8275;">Se o botao nao funcionar, copie e cole no navegador:<br><span style="font-family:'JetBrains Mono',monospace;color:#182863;word-break:break-all;">${o.url}</span></p>` : '';
  const prefs = o.urlPreferencias ? ` &middot; <a href="${o.urlPreferencias}" style="color:#8a8275;text-decoration:underline;">Gerenciar notificacoes</a>` : '';
  return `<!DOCTYPE html><html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>Concresoft</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--><style>body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse!important}img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}a{text-decoration:none}@media only screen and (max-width:620px){.container{width:100%!important;border-radius:0!important}.px{padding-left:24px!important;padding-right:24px!important}.btn-a{display:block!important;text-align:center!important}}</style></head><body style="margin:0;padding:0;background:#faf9f7;"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#faf9f7;opacity:0;">${o.preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf9f7;"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e6e1d6;border-radius:8px;overflow:hidden;"><tr><td style="background-color:#182863;background-image:${GRAD};padding:22px 32px;"><img src="${BRAND_LOGO}" alt="Concresoft" height="24" style="height:24px;width:auto;display:block;border:0;"></td></tr><tr><td class="px" style="padding:36px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#16213e;"><p style="margin:0 0 12px;font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8275;">${o.kicker}</p><h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.01em;color:#16213e;">${o.titulo}</h1><p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#3a3528;">${o.corpoHtml}</p>${btn}${details}${urlFallback}</td></tr><tr><td style="padding:0 40px;"><div style="height:1px;background:#efe9dd;line-height:1px;font-size:0;">&nbsp;</div></td></tr><tr><td class="px" style="padding:24px 40px;background:#faf9f7;font-family:-apple-system,'Segoe UI',Arial,sans-serif;"><p style="margin:0;font-size:11px;line-height:1.6;color:#a89f8d;">${o.motivoEnvio}<br>Concresoft &middot; &copy; 2026${prefs}</p></td></tr></table></td></tr></table></body></html>`;
}

function render(eventType: string, p: Record<string, unknown>) {
  const title = asStr(p.title, TITLES[eventType] ?? 'Atualizacao na Concresoft');
  const appUrl = Deno.env.get('APP_URL') ?? 'https://app.concresoft.io';
  const dl = asStr(p.deep_link, '/laudos');
  const ctaUrl = /^https?:\/\//.test(dl) ? dl : `${appUrl}${dl.startsWith('/') ? dl : '/' + dl}`;
  const base = asStr(p.body, asStr(p.message, 'Ha uma atualizacao que requer sua atencao na Concresoft.'));
  const obra = p.obra_nome ? `\n\nObra: ${asStr(p.obra_nome)}` : '';
  const corpoHtml = esc(`${base}${obra}`).replace(/\n/g, '<br>');
  const html = emailShell({
    preheader: title,
    kicker: KICKERS[eventType] ?? 'CONCRESOFT',
    titulo: esc(title),
    corpoHtml,
    url: esc(ctaUrl),
    botaoLabel: esc(asStr(p.cta_label, 'Abrir na Concresoft')),
    referencia: p.reference ? esc(asStr(p.reference)) : '',
    data: p.data ? esc(asStr(p.data)) : '',
    motivoEnvio: `Voce recebeu este e-mail por causa das suas preferencias de notificacao na Concresoft.${(p.tenant_name || p.obra_nome) ? ' Laboratorio: ' + esc(asStr(p.tenant_name, asStr(p.obra_nome, '-'))) : ''}`,
    urlPreferencias: `${appUrl}/preferencias`,
  });
  const text = `${title}\n\n${base}${obra}\n\n${asStr(p.cta_label, 'Abrir')}: ${ctaUrl}`;
  return { subject: `[Concresoft] ${title}`, html, text };
}

serveWithTelemetry('send-notification', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const { data: settings, error: se } = await svc.from('notification_dispatch_settings').select('*').eq('id', true).maybeSingle();
    if (se) return fail(se.message, 500);

    const notifySecret = req.headers.get('x-notify-secret') ?? '';
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const secretOk = !!settings?.dispatch_secret && timingSafeEqualStr(notifySecret, String(settings.dispatch_secret));
    // Secret interno (notify-event, crons) passa sem restricao. Sessao (JWT) e amarrada ao lab do usuario.
    let callerAuthId = '';
    if (!secretOk && bearer) { const { data } = await svc.auth.getUser(bearer); callerAuthId = asStr(data.user?.id); }
    const jwtOk = !!callerAuthId;
    if (!secretOk && !jwtOk) return fail('nao autorizado', 401);
    let callerTenants: string[] = [];
    if (!secretOk) {
      const { data: cm } = await svc.from('members').select('tenant_id').eq('auth_id', callerAuthId).eq('active', true).is('deleted_at', null);
      callerTenants = (cm ?? []).map((r: Record<string, unknown>) => asStr(r.tenant_id)).filter(Boolean);
      if (!callerTenants.length) return fail('sem vinculo de laboratorio', 403);
    }

    const eventType = asStr(body.event_type, 'system.event');
    const memberId = asStr(body.member_id);
    let to = lower(body.email);
    let member: Record<string, unknown> | null = null;
    if (memberId) {
      const { data, error } = await svc.from('members').select('id, tenant_id, email, full_name, role, roles, active').eq('id', memberId).maybeSingle();
      if (error) return fail(error.message, 500);
      member = data as Record<string, unknown> | null;
      to = to || lower(member?.email);
      if (member && member.active === false) return json({ ok: true, status: 'skipped', reason: 'member_inactive' });
    }
    if (!to) return fail('email obrigatorio');
    const tenantId = asStr(body.tenant_id, asStr(member?.tenant_id));
    if (!secretOk) {
      // Via sessao: destinatario deve ser membro do MESMO laboratorio (sem e-mail livre) + rate limit.
      if (!memberId || !member) return fail('via sessao, informe member_id do destinatario', 403);
      if (!tenantId || !callerTenants.includes(tenantId)) return fail('destinatario fora do seu laboratorio', 403);
      if (asStr(member.tenant_id) !== tenantId) return fail('destinatario fora do seu laboratorio', 403);
      to = lower(member.email);
      if (!to) return fail('membro sem e-mail', 422);
      const bkt = new Date(); bkt.setMinutes(0, 0, 0);
      const { data: calls } = await svc.rpc('bump_notification_rate_limit', { p_actor_key: `send:${tenantId}`, p_bucket_start: bkt.toISOString() });
      if (Number(calls ?? 0) > 60) return fail('limite de envios por hora atingido', 429);
    }
    const dedupeKey = asStr(body.dedupe_key, `${eventType}:${asStr(body.entity_type, 'generic')}:${asStr(body.entity_id, crypto.randomUUID())}:${to}`);
    const { data: dedupePrev } = await svc.from('notification_dispatch_log').select('status, resend_id').eq('dedupe_key', dedupeKey).eq('status', 'sent').maybeSingle();
    if (dedupePrev) return json({ ok: true, status: 'sent', dedupe_key: dedupeKey, deduped: true, resend_id: dedupePrev.resend_id ?? null });
    const rendered = render(eventType, { ...body, email: to });
    const logBase = { tenant_id: tenantId || null, dedupe_key: dedupeKey, recipient_email: to, event_type: eventType, notification_type: eventType, payload: body, track_token: crypto.randomUUID() };
    const log = (extra: Record<string, unknown>) => svc.from('notification_dispatch_log').upsert({ ...logBase, ...extra }, { onConflict: 'dedupe_key' });
    const attachments = attachmentsFromPayload(body, secretOk);

    if (memberId) {
      const { data: prefs } = await svc.from('member_notification_prefs').select('channel').eq('member_id', memberId).eq('event_type', eventType);
      if ((prefs ?? []).some((r: Record<string, unknown>) => ['off', 'none', 'disabled'].includes(asStr(r.channel)))) {
        await log({ status: 'skipped', metadata: { reason: 'preference' } });
        return json({ ok: true, status: 'skipped', reason: 'preference' });
      }
    }
    if (memberId && member) {
      const { data: roleRows } = await svc.from('role_notification_types').select('role_code').eq('event_type', eventType).eq('enabled', true);
      const allowed = (roleRows ?? []).map((r: Record<string, unknown>) => asStr(r.role_code)).filter(Boolean);
      if (allowed.length) {
        const mine = [asStr(member.role), ...(Array.isArray(member.roles) ? (member.roles as unknown[]).map((x) => asStr(x)) : [])];
        if (!mine.some((r) => allowed.includes(r))) {
          await log({ status: 'skipped', metadata: { reason: 'role_gate' } });
          return json({ ok: true, status: 'skipped', reason: 'role_gate' });
        }
      }
    }
    // QUIET HOURS (v11): eventos NAO-system respeitam o silencio do membro (fuso proprio). Fail-open.
    if (memberId) {
      try {
        const { data: inQuiet } = await svc.rpc('is_in_quiet_hours', { p_member_id: memberId, p_event_type: eventType });
        if (inQuiet === true) {
          await log({ status: 'skipped', metadata: { reason: 'quiet_hours' } });
          return json({ ok: true, status: 'skipped', reason: 'quiet_hours' });
        }
      } catch (_e) { /* fail-open: silencio nao confiavel nao deve impedir o envio */ }
    }
    const allowlist = Array.isArray(settings?.email_allowlist) ? settings.email_allowlist.map((x: unknown) => lower(x)).filter(Boolean) : [];
    if (allowlist.length && !allowlist.includes(to)) {
      await log({ status: 'skipped', metadata: { reason: 'allowlist' } });
      return json({ ok: true, status: 'skipped', reason: 'allowlist' });
    }
    const { data: supp } = await svc.from('email_suppressions').select('email, reason').eq('email', to).maybeSingle();
    if (supp) { await log({ status: 'suppressed', metadata: { reason: supp.reason } }); return json({ ok: true, status: 'suppressed', reason: supp.reason }); }

    const dispatchEnabled = settings?.dispatch_enabled === true;
    const dryRun = settings?.dry_run !== false;
    if (!dispatchEnabled || dryRun) {
      await log({ status: 'queued', entity_type: asStr(body.entity_type), entity_id: asStr(body.entity_id), metadata: { dry_run: true, dispatch_enabled: dispatchEnabled, attachment_count: attachments.length } });
      return json({ ok: true, status: 'queued', dry_run: true, dedupe_key: dedupeKey });
    }
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('RESEND_FROM_EMAIL') ?? Deno.env.get('RESEND_FROM') ?? 'nao-responda@avisos.consultegeo.org';
    if (!apiKey) return fail('RESEND_API_KEY ausente: fail-closed', 500);
    const resendPayload: Record<string, unknown> = { from, to: [to], subject: rendered.subject, html: rendered.html, text: rendered.text, headers: { 'X-Entity-Ref-ID': dedupeKey } };
    if (attachments.length) resendPayload.attachments = attachments;
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(resendPayload) });
    const sent = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) { await log({ status: 'failed', error_message: JSON.stringify(sent) }); return fail('falha ao enviar pelo Resend', 502, sent); }
    await log({ status: 'sent', entity_type: asStr(body.entity_type), entity_id: asStr(body.entity_id), resend_id: asStr(sent.id), metadata: { provider: 'resend', attachment_count: attachments.length } });
    return json({ ok: true, status: 'sent', dedupe_key: dedupeKey, resend_id: sent.id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
