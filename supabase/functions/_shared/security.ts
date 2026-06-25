// _shared/security.ts — utilidades de segurança para Edge Functions (NOVO no GEOLAB).
// Portado do GEOCON, adaptado: members do GEOLAB tem role + roles[] (confirmado).
// Inclui só o necessário para a observabilidade:
//   - clientIp(req): IP de origem (rate-limit da ingestão).
//   - authorizeServiceOrAdmin(req, svc): autoriza service-role OU admin (usado pelo telemetry-alarm).
// NÃO porta requireTenantMember/HttpError/has_permission (o GEOLAB usa has_role/is_tenant_*; sem has_permission).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

/** IP de origem (atrás do proxy Supabase/CF). Usado como chave de rate-limit. */
export function clientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Autoriza a chamada como service-role (token == SERVICE_ROLE_KEY) OU como admin
 * (JWT de usuário cujo member tem role='admin' ou 'admin' ∈ roles). Fail-closed.
 * Usado pelo telemetry-alarm quando NÃO veio pelo cron (que usa o x-cron/secret).
 */
export async function authorizeServiceOrAdmin(
  req: Request,
  svc: SupabaseClient,
): Promise<
  | { ok: true; mode: 'service' | 'admin'; member?: { id: string; tenant_id: string; role: string } }
  | { ok: false; status: number; error: string }
> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return { ok: false, status: 401, error: 'missing_bearer' };
  const token = auth.slice(7).trim();

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (serviceKey && timingSafeEqual(token, serviceKey)) return { ok: true, mode: 'service' };

  if (!token.startsWith('eyJ')) return { ok: false, status: 401, error: 'invalid_token' };
  const { data: userResult, error } = await svc.auth.getUser(token);
  if (error || !userResult?.user) return { ok: false, status: 401, error: 'invalid_jwt' };

  const { data: member } = await svc
    .from('members')
    .select('id,tenant_id,role,roles')
    .eq('auth_id', userResult.user.id)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle();

  const roles = Array.isArray((member as { roles?: unknown })?.roles)
    ? (member as { roles: string[] }).roles
    : [];
  if (!member || (member.role !== 'admin' && !roles.includes('admin'))) {
    return { ok: false, status: 403, error: 'admin_required' };
  }
  return { ok: true, mode: 'admin', member: member as { id: string; tenant_id: string; role: string } };
}
