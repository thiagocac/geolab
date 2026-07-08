// @ts-nocheck
// sign-laudo-pdf (GEOLAB) - Onda 1 da assinatura do laudo.
// Registra o ATO de assinatura conforme lab_signature_settings.modo e atualiza lab_reports.assinatura_status.
// Sincronos leves nesta onda: nenhuma (no-op), qr_publico e imagem_rubrica (registro simples).
// Modos a1_local/nuvem_psc/govbr/gateway_externo retornam 'nao_implementado' (ondas futuras) sem falhar.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const NIVEL = { nenhuma: 'simples', qr_publico: 'simples', imagem_rubrica: 'simples', a1_local: 'qualificada', nuvem_psc: 'qualificada', govbr: 'avancada', gateway_externo: 'avancada' };
const PROVIDER = { nenhuma: 'none', qr_publico: 'none', imagem_rubrica: 'none', a1_local: 'local_a1', nuvem_psc: 'integraicp', govbr: 'govbr', gateway_externo: 'none' };
const SINCRONO_LEVE = new Set(['qr_publico', 'imagem_rubrica']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    const body = await req.json().catch(() => ({}));
    const labReportId = String(body.lab_report_id ?? '');
    if (!labReportId) return json({ error: 'lab_report_id obrigatorio' }, 400);

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return json({ error: 'nao autenticado' }, 401);
    const sb = createClient(url, anon, { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ error: 'nao autenticado' }, 401);

    const { data: canSign } = await sb.rpc('current_has_permission', { p_permission: 'laudo.assinar' });
    if (canSign !== true) return json({ error: 'sem permissao para assinar laudo' }, 403);

    const { data: lr, error: lrErr } = await sb.from('lab_reports')
      .select('id, tenant_id, revisao, hash_sha256, storage_path, status')
      .eq('id', labReportId).is('deleted_at', null).maybeSingle();
    if (lrErr) return json({ error: lrErr.message }, 403);
    if (!lr) return json({ error: 'laudo nao encontrado' }, 404);

    const { data: st } = await sb.from('lab_signature_settings').select('modo').maybeSingle();
    const modo = String(st?.modo ?? 'qr_publico');

    const { data: mem } = await admin.from('members').select('id').eq('auth_id', ures.user.id).eq('active', true).is('deleted_at', null).maybeSingle();
    const memberId = mem?.id ?? null;
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
    const ua = req.headers.get('user-agent') || null;
    const now = new Date().toISOString();

    if (modo === 'nenhuma') {
      await admin.from('lab_reports').update({ assinatura_status: 'nao_assinado', assinatura_atual_id: null, updated_at: now }).eq('id', lr.id);
      return json({ status: 'nao_assinado', modo });
    }

    if (SINCRONO_LEVE.has(modo)) {
      const rev = Number(lr.revisao) || 0;
      let assinaturaId = null;
      const { data: ex } = await admin.from('laudo_assinaturas').select('id').eq('lab_report_id', lr.id).eq('revisao', rev).eq('status', 'assinado').maybeSingle();
      if (ex?.id) assinaturaId = ex.id;
      else {
        const { data: ins, error: insErr } = await admin.from('laudo_assinaturas').insert({
          tenant_id: lr.tenant_id, lab_report_id: lr.id, revisao: rev,
          modo, provider: PROVIDER[modo] ?? 'none', nivel: NIVEL[modo] ?? 'simples',
          signed_storage_path: lr.storage_path ?? null, hash_documento: lr.hash_sha256 ?? null,
          status: 'assinado', assinado_por: memberId, ip_address: ip, user_agent: ua,
        }).select('id').maybeSingle();
        if (insErr) return json({ error: insErr.message }, 500);
        assinaturaId = ins?.id ?? null;
      }
      await admin.from('lab_reports').update({ assinatura_status: 'assinado', assinatura_atual_id: assinaturaId, updated_at: now }).eq('id', lr.id);
      return json({ status: 'assinado', modo, nivel: NIVEL[modo], assinatura_id: assinaturaId });
    }

    return json({ status: 'nao_implementado', modo, message: 'Modo de assinatura sera aplicado em uma onda futura.' }, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
