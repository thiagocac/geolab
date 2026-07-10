import { serviceClient } from '../_shared/client.ts';
import { json, serverError } from '../_shared/response.ts';
import { logEf, serveWithTelemetry } from '../_shared/telemetry.ts';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-expose-headers': 'x-correlation-id',
};
const FN = 'commercial-public-action';
type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : String(value ?? '').trim();
const safeComment = (value: unknown) => text(value).slice(0, 2000);
async function tokenFingerprint(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].slice(0, 12).map((value) => value.toString(16).padStart(2, '0')).join('');
}

serveWithTelemetry(FN, async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'Metodo nao permitido.' }, { status: 405, headers: cors });
  let body: Row = {};
  try {
    body = await req.json().catch(() => ({})) as Row;
    const kind = text(body.kind);
    const token = text(body.token);
    const action = text(body.action || 'read');
    const comment = safeComment(body.comment);
    if (!['proposta', 'medicao'].includes(kind) || token.length < 32 || token.length > 256 || !['read', 'accept', 'reject', 'contest'].includes(action)) return json({ ok: false, error: 'Solicitacao invalida.' }, { status: 400, headers: cors });

    const svc = serviceClient();
    const bucket = new Date();
    bucket.setMinutes(0, 0, 0);
    const actorKey = `public-document:${await tokenFingerprint(token)}`;
    const { data: calls, error: rateError } = await svc.rpc('bump_notification_rate_limit', { p_actor_key: actorKey, p_bucket_start: bucket.toISOString() });
    if (rateError) throw rateError;
    if (Number(calls ?? 0) > 120) return json({ ok: false, error: 'Limite de consultas atingido. Tente novamente mais tarde.' }, { status: 429, headers: cors });

    if (kind === 'proposta') {
      if (action === 'read') {
        const { data, error } = await svc.rpc('proposal_public_read', { p_token: token });
        if (error) throw error;
        const document = (data ?? {}) as Row;
        if (document.ok === false) return json(document, { status: 404, headers: cors });
        return json({ ok: true, kind, document }, { status: 200, headers: cors });
      }
      if (!['accept', 'reject'].includes(action)) return json({ ok: false, error: 'Acao invalida para proposta.' }, { status: 400, headers: cors });
      const decision = action === 'accept' ? 'aceita' : 'recusada';
      const { data, error } = await svc.rpc('proposal_public_decide', { p_token: token, p_decision: decision, p_comment: comment || null });
      if (error) throw error;
      const result = (data ?? {}) as Row;
      if (result.ok === false) return json(result, { status: 409, headers: cors });
      await logEf(req, 'info', FN, 'Decisao publica de proposta registrada.', { action: `proposal.${action}`, proposal_id: result.proposal_id, status: result.status });
      return json({ ok: true, kind, ...result }, { status: 200, headers: cors });
    }

    if (action === 'read') {
      const { data, error } = await svc.rpc('measurement_public_read', { p_token: token });
      if (error) {
        if (String(error.code ?? '') === 'P0002') return json({ ok: false, error: 'Link invalido ou expirado.' }, { status: 404, headers: cors });
        throw error;
      }
      return json({ ok: true, kind, document: (data ?? {}) as Row }, { status: 200, headers: cors });
    }
    if (!['accept', 'contest'].includes(action)) return json({ ok: false, error: 'Acao invalida para medicao.' }, { status: 400, headers: cors });
    const decision = action === 'accept' ? 'aceita' : 'contestada';
    const { data, error } = await svc.rpc('measurement_public_decide', { p_token: token, p_decisao: decision, p_comentario: comment || null });
    if (error) {
      if (String(error.code ?? '') === 'P0002') return json({ ok: false, error: 'Link invalido ou expirado.' }, { status: 404, headers: cors });
      throw error;
    }
    const result = (data ?? {}) as Row;
    if (result.ok === false) return json(result, { status: 409, headers: cors });
    await logEf(req, 'info', FN, 'Decisao publica de medicao registrada.', { action: `measurement.${action}`, medicao_id: result.medicao_id, decisao: result.decisao });
    return json({ ok: true, kind, ...result }, { status: 200, headers: cors });
  } catch (error) {
    return serverError(error, { req, fnName: FN, action: 'commercial.public_action', status: 500, publicMessage: 'Nao foi possivel processar a solicitacao.', metadata: { kind: body.kind, action: body.action }, headers: cors });
  }
});
