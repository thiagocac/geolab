// approve-laudo-link (GEOLAB) — aprovação de laudo por MAGIC LINK. PÚBLICA (verify_jwt=false).
// Alvo: GEOLAB. Recebe { token, decision, comment } e chama consume_magic_link_laudo via SERVICE-ROLE.
// Segurança: a autorização é o token (sha256 no banco, one-time via consumed_at, expiry). A função SQL
// faz o `for update` + validações; aqui só repassamos. Sem auth de usuário (o aprovador não está logado).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const clean = (v: unknown) => String(v ?? '').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!url || !service) return json({ ok: false, error: 'config ausente' }, 500);
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const token = clean(body.token);
    const decision = clean(body.decision);
    const comment = clean(body.comment);
    if (!token) return json({ ok: false, error: 'token obrigatorio' }, 400);
    if (!['aprovar', 'devolver', 'reprovar'].includes(decision)) return json({ ok: false, error: 'decisao invalida' }, 400);

    const { data, error } = await admin.rpc('consume_magic_link_laudo', { p_token: token, p_decision: decision, p_comment: comment || null });
    if (error) return json({ ok: false, error: error.message }, 400);
    return json(data ?? { ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
