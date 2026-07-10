// send-commercial-document (Concresoft, Onda A v222) — orquestra o envio de documento comercial:
// resolve o template PUBLICADO do escopo → chama a NOSSA generate-document-pdf (motor de BLOCOS;
// resposta = PDF binário + headers x-job-id/x-storage-path) → prepara token público (30 dias) →
// envia anexo via send-notification (x-notify-secret; ÚNICO ponto de saída Resend) → só marca
// enviada/registra evento quando o dispatcher retorna 'sent'; caso contrário desfaz o token.
// Adaptado do pacote GPT v213: contrato da geração, bucket único 'documentos' (bytes vêm da
// resposta, sem re-download), validade 30d (decisão 10/07).
import { serviceClient, userClient } from '../_shared/client.ts';
import { json, serverError } from '../_shared/response.ts';
import { logEf, serveWithTelemetry } from '../_shared/telemetry.ts';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-expose-headers': 'x-correlation-id',
};
const FN = 'send-commercial-document';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.concresoft.io';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const PUBLIC_LINK_DAYS = 30;

type Row = Record<string, unknown>;
type EntityType = 'proposta' | 'contrato' | 'medicao';
type Loaded = {
  entity: Row;
  tenantId: string;
  client: Row | null;
  permission: string;
  title: string;
  message: string;
  eventType: string;
  filename: string;
};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : String(value ?? '').trim();
const uuidLike = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const emailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const safeFile = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-');
function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunk, bytes.length)));
  return btoa(binary);
}
async function resolveIdentity(req: Request, tenantId: string) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const svc = serviceClient();
  const { data: authData, error: authError } = await svc.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: member, error } = await svc.from('members').select('id,tenant_id,role,roles,active').eq('auth_id', authData.user.id).eq('tenant_id', tenantId).eq('active', true).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  return member ? { member: member as Row, token } : null;
}
async function loadClient(clientId: unknown) {
  if (!clientId) return null;
  const { data, error } = await serviceClient().from('lab_clients').select('razao_social,nome_fantasia,email').eq('id', String(clientId)).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  return data as Row | null;
}
async function loadEntity(entityType: EntityType, entityId: string): Promise<Loaded> {
  const svc = serviceClient();
  if (entityType === 'proposta') {
    const { data: entity, error } = await svc.from('propostas').select('id,tenant_id,client_id,numero,titulo,status,revision,recipient_email,recipient_name,document_job_id,metadata').eq('id', entityId).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    if (!entity) throw new Error('Proposta nao encontrada.');
    return { entity: entity as Row, tenantId: String(entity.tenant_id), client: await loadClient(entity.client_id), permission: 'proposta.enviar', title: `Proposta ${entity.numero ?? ''}`, message: `A proposta ${entity.titulo ?? entity.numero ?? ''} esta disponivel para analise.`, eventType: 'proposta_enviada', filename: `proposta-${entity.numero ?? entity.id}.pdf` };
  }
  if (entityType === 'contrato') {
    const { data: entity, error } = await svc.from('lab_contracts').select('id,tenant_id,client_id,numero,descricao,status,document_job_id,metadata').eq('id', entityId).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    if (!entity) throw new Error('Contrato nao encontrado.');
    return { entity: entity as Row, tenantId: String(entity.tenant_id), client: await loadClient(entity.client_id), permission: 'contrato.emitir_documento', title: `Contrato ${entity.numero ?? ''}`, message: `Segue o contrato ${entity.descricao ?? entity.numero ?? ''} para conhecimento.`, eventType: 'contrato_enviado', filename: `contrato-${entity.numero ?? entity.id}.pdf` };
  }
  const { data: entity, error } = await svc.from('medicoes').select('id,tenant_id,client_id,numero,competencia,status,metadata,document_job_id,valor_total').eq('id', entityId).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  if (!entity) throw new Error('Medicao nao encontrada.');
  return { entity: entity as Row, tenantId: String(entity.tenant_id), client: await loadClient(entity.client_id), permission: 'medicao.enviar', title: `Medicao ${entity.numero ?? entity.competencia ?? ''}`, message: `A medicao da competencia ${entity.competencia ?? ''} esta disponivel para aprovacao.`, eventType: 'medicao_enviada', filename: `medicao-${entity.numero ?? entity.competencia ?? entity.id}.pdf` };
}
async function clearPreparedToken(entityType: EntityType, entityId: string, tenantId: string) {
  const svc = serviceClient();
  try {
    if (entityType === 'proposta') await svc.from('propostas').update({ token_hash: null, token_expires_at: null }).eq('id', entityId).eq('tenant_id', tenantId).neq('status', 'enviada');
    if (entityType === 'medicao') await svc.from('medicoes').update({ public_token_hash: null, public_token_expires_at: null }).eq('id', entityId).eq('tenant_id', tenantId).neq('status', 'enviada');
  } catch {
    // Best effort cleanup.
  }
}

serveWithTelemetry(FN, async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'Metodo nao permitido.' }, { status: 405, headers: cors });
  let body: Row = {};
  let entityType: EntityType | null = null;
  let entityId = '';
  let loaded: Loaded | null = null;
  try {
    body = await req.json().catch(() => ({})) as Row;
    const parsedType = text(body.entity_type);
    entityId = text(body.entity_id);
    if (!['proposta', 'contrato', 'medicao'].includes(parsedType) || !uuidLike(entityId)) return json({ ok: false, error: 'entity_type ou entity_id invalido.' }, { status: 400, headers: cors });
    entityType = parsedType as EntityType;
    loaded = await loadEntity(entityType, entityId);
    const identity = await resolveIdentity(req, loaded.tenantId);
    if (!identity) return json({ ok: false, error: 'Nao autorizado.' }, { status: 401, headers: cors });

    const user = userClient(req);
    const { data: allowed, error: permissionError } = await user.rpc('current_has_permission', { p_permission: loaded.permission });
    const roles = [text(identity.member.role), ...(Array.isArray(identity.member.roles) ? identity.member.roles.map(text) : [])];
    if (permissionError || (allowed !== true && !roles.some((role) => ['admin', 'admin_consulte'].includes(role)))) return json({ ok: false, error: 'Sem permissao para enviar este documento.' }, { status: 403, headers: cors });

    const svc = serviceClient();

    // Template PUBLICADO do escopo (o cliente escolhe o padrão em Gestão → Templates de documentos).
    const explicitTemplateVersion = text(body.template_version_id);
    let templateVersionId = uuidLike(explicitTemplateVersion) ? explicitTemplateVersion : '';
    if (!templateVersionId) {
      const { data: tplv, error: tplError } = await svc
        .from('document_template_versions')
        .select('id, document_templates!inner(escopo, ativo, deleted_at)')
        .eq('tenant_id', loaded.tenantId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .eq('document_templates.escopo', entityType)
        .eq('document_templates.ativo', true)
        .is('document_templates.deleted_at', null)
        .limit(1)
        .maybeSingle();
      if (tplError) throw tplError;
      templateVersionId = text((tplv as Row | null)?.id);
    }
    if (!uuidLike(templateVersionId)) return json({ ok: false, error: `Nenhum template publicado para ${entityType}. Publique um em Gestão → Templates de documentos.` }, { status: 422, headers: cors });

    // Geração pelo motor de blocos: resposta é o PDF; trilha vem nos headers.
    const trace = new URL(req.url).searchParams.get('trace_id');
    const generateUrl = new URL(`${SUPABASE_URL}/functions/v1/generate-document-pdf`);
    if (trace) generateUrl.searchParams.set('trace_id', trace);
    const generated = await fetch(generateUrl.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${identity.token}`, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
      body: JSON.stringify({ template_version_id: templateVersionId, entity_type: entityType, entity_id: entityId }),
    });
    if (!generated.ok) {
      const errBody = await generated.json().catch(() => ({})) as Row;
      let msg = text(errBody.error) || 'Falha na geracao do documento.';
      if (Array.isArray(errBody.campos) && errBody.campos.length) msg += ' Campos: ' + errBody.campos.join(', ');
      throw new Error(msg);
    }
    const bytes = new Uint8Array(await generated.arrayBuffer());
    const jobId = text(generated.headers.get('x-job-id'));
    const storagePath = text(generated.headers.get('x-storage-path'));
    if (!uuidLike(jobId)) throw new Error('Documento gerado sem job de trilha.');
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) return json({ ok: false, error: 'Documento excede o limite de 8 MB para envio por e-mail.' }, { status: 422, headers: cors });

    const metadata = loaded.entity.metadata && typeof loaded.entity.metadata === 'object' ? loaded.entity.metadata as Row : {};
    const explicitEmail = text(body.email).toLowerCase();
    const email = explicitEmail || text(loaded.entity.recipient_email || metadata.destinatario_email || loaded.client?.email).toLowerCase();
    if (!emailLike(email)) return json({ ok: false, error: 'E-mail do destinatario invalido ou ausente.' }, { status: 422, headers: cors });
    const recipientName = text(body.recipient_name || loaded.entity.recipient_name || metadata.destinatario_nome || loaded.client?.nome_fantasia || loaded.client?.razao_social);

    let publicUrl = '';
    if (entityType === 'proposta') {
      const { data: link, error } = await user.rpc('prepare_proposal_delivery', { p_proposal_id: entityId, p_email: email, p_name: recipientName || null, p_expires_days: PUBLIC_LINK_DAYS });
      if (error) throw error;
      const token = text((link as Row | null)?.token);
      if (token.length < 32) throw new Error('Token publico da proposta nao foi gerado.');
      publicUrl = `${APP_URL}/proposta/${token}`;
    } else if (entityType === 'medicao') {
      const { data: link, error } = await user.rpc('prepare_measurement_delivery', { p_medicao_id: entityId, p_email: email, p_nome: recipientName || null, p_expira_dias: PUBLIC_LINK_DAYS });
      if (error) throw error;
      const token = text((link as Row | null)?.token);
      if (token.length < 32) throw new Error('Token publico da medicao nao foi gerado.');
      publicUrl = `${APP_URL}/medicao/${token}`;
    }

    const { data: settings, error: settingsError } = await svc.from('notification_dispatch_settings').select('dispatch_secret').eq('id', true).maybeSingle();
    if (settingsError || !settings?.dispatch_secret) throw settingsError ?? new Error('Segredo interno de notificacao ausente.');
    const sendPayload = {
      tenant_id: loaded.tenantId,
      event_type: loaded.eventType,
      email,
      title: loaded.title,
      body: `${loaded.message}${publicUrl ? '\n\nUse o link seguro para registrar sua decisao.' : ''}`,
      cta_label: publicUrl ? 'Abrir documento' : 'Acessar Concresoft',
      deep_link: publicUrl || '/financeiro',
      entity_type: entityType,
      entity_id: entityId,
      dedupe_key: `${loaded.eventType}:${entityId}:${jobId}:${email}`,
      reference: text(loaded.entity.numero || loaded.entity.competencia || entityId),
      attachments: [{ filename: safeFile(loaded.filename), content: bytesToBase64(bytes) }],
    };
    const sendResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-notify-secret': String(settings.dispatch_secret) }, body: JSON.stringify(sendPayload) });
    const sendBody = await sendResponse.json().catch(() => ({})) as Row;
    if (!sendResponse.ok || sendBody.ok === false) throw new Error(text(sendBody.error) || 'Falha ao enviar documento.');
    const notificationStatus = text(sendBody.status) || 'queued';
    const delivered = notificationStatus === 'sent';

    if (delivered && entityType === 'proposta') {
      const now = new Date().toISOString();
      const { error: updateError } = await svc.from('propostas').update({ status: 'enviada', sent_at: now, followup_at: new Date(Date.now() + 3 * 86400000).toISOString(), recipient_email: email, recipient_name: recipientName || null, pdf_path: storagePath || null, document_job_id: jobId, updated_at: now }).eq('id', entityId).eq('tenant_id', loaded.tenantId);
      if (updateError) throw updateError;
      await svc.from('proposal_events').insert({ tenant_id: loaded.tenantId, proposal_id: entityId, event_type: 'sent', actor_member_id: identity.member.id, actor_label: text(identity.member.role), detail: { job_id: jobId, email, notification_status: notificationStatus } });
      await svc.from('proposal_revisions').update({ document_job_id: jobId, status: 'sent' }).eq('proposal_id', entityId).eq('revision', Number(loaded.entity.revision) || 0).is('deleted_at', null);
    } else if (delivered && entityType === 'medicao') {
      const now = new Date().toISOString();
      const { error: updateError } = await svc.from('medicoes').update({ status: 'enviada', enviada_at: now, pdf_storage_path: storagePath || null, document_job_id: jobId, metadata: { ...metadata, destinatario_email: email, destinatario_nome: recipientName || null } }).eq('id', entityId).eq('tenant_id', loaded.tenantId);
      if (updateError) throw updateError;
      await svc.from('medicao_events').insert({ tenant_id: loaded.tenantId, medicao_id: entityId, action: 'enviada', actor_member_id: identity.member.id, detail: { job_id: jobId, email, notification_status: notificationStatus } });
    } else if (delivered && entityType === 'contrato') {
      await svc.from('contract_events').insert({ tenant_id: loaded.tenantId, contract_id: entityId, event_type: 'document_sent', actor_member_id: identity.member.id, detail: { job_id: jobId, email, notification_status: notificationStatus } });
    } else if (!delivered && (entityType === 'proposta' || entityType === 'medicao')) {
      await clearPreparedToken(entityType, entityId, loaded.tenantId);
      publicUrl = '';
    }

    await logEf(req, delivered ? 'info' : 'warn', FN, delivered ? 'Documento comercial enviado.' : 'Documento comercial nao foi entregue pelo gate de notificacao.', { action: 'document.send', tenant_id: loaded.tenantId, entity_type: entityType, entity_id: entityId, job_id: jobId, email, notification_status: notificationStatus, delivered });
    return json({ ok: true, status: notificationStatus, delivered, public_url: delivered && publicUrl ? publicUrl : undefined, job_id: jobId }, { status: 200, headers: cors });
  } catch (error) {
    if (loaded && entityType && (entityType === 'proposta' || entityType === 'medicao')) await clearPreparedToken(entityType, entityId, loaded.tenantId);
    return serverError(error, { req, fnName: FN, action: 'document.send', status: 500, publicMessage: 'Nao foi possivel enviar o documento.', metadata: { entity_type: body.entity_type, entity_id: body.entity_id }, headers: cors });
  }
});
