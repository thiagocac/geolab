// auth-password-hook (GEOLAB) — Onda 3 / MOD-ACCTSEC
// Registra tentativas de senha no auth_attempt_log via password_verification_hook(event jsonb).
// Fail-closed se AUTH_HOOK_SECRET não estiver configurado. Não decide senha: retorna decision=continue.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, x-hook-secret, x-client-info, apikey',
  'access-control-allow-methods': 'POST,OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

function bearer(req: Request): string {
  const h = req.headers.get('authorization') || '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
}
function clientIp(req: Request): string | null {
  const raw = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
  const first = raw.split(',')[0]?.trim();
  return first || null;
}
function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}
function text(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = Deno.env.get('AUTH_HOOK_SECRET') || '';
  if (!secret) return json({ error: 'auth_hook_secret_missing' }, 500);
  const supplied = req.headers.get('x-hook-secret') || bearer(req);
  if (supplied !== secret) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const user = (body.user && typeof body.user === 'object' ? body.user : {}) as Record<string, unknown>;
  const authId = text(body.user_id) || text(user.id) || null;
  const valid = bool(body.valid ?? body.password_valid ?? body.success ?? body.is_valid);
  const payload = {
    ...body,
    user_id: authId,
    valid,
    ip: clientIp(req),
    request: { ip: clientIp(req), user_agent: req.headers.get('user-agent') || null },
  };

  const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const { data, error } = await svc.rpc('password_verification_hook', { event: payload });
  if (error) return json({ error: error.message }, 500);

  return json(data ?? { decision: 'continue' });
});
