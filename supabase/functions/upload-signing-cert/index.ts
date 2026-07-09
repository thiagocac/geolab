// @ts-nocheck
// upload-signing-cert (GEOLAB) - Onda 2 (A1 auto-custodia).
// Recebe .pfx (base64) + senha, valida com node-forge, extrai metadados, guarda no Vault e grava lab_signing_certificates.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import forge from 'npm:node-forge@1.3.1';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    const body = await req.json().catch(() => ({}));
    const pfxB64 = String(body.pfx_base64 ?? ''); const senha = String(body.senha ?? ''); const titularTipoIn = String(body.titular_tipo ?? '');
    if (!pfxB64 || !senha) return json({ error: 'pfx_base64 e senha sao obrigatorios' }, 400);
    const url = Deno.env.get('SUPABASE_URL') ?? ''; const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''; const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return json({ error: 'nao autenticado' }, 401);
    const sb = createClient(url, anon, { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ error: 'nao autenticado' }, 401);
    const { data: canCfg } = await sb.rpc('current_has_permission', { p_permission: 'laudo.assinar_config' });
    if (canCfg !== true) return json({ error: 'sem permissao para configurar assinatura' }, 403);
    const { data: mem } = await admin.from('members').select('id, tenant_id').eq('auth_id', ures.user.id).eq('active', true).is('deleted_at', null).maybeSingle();
    if (!mem) return json({ error: 'membro nao encontrado' }, 403);
    const tenantId = mem.tenant_id;
    let certObj = null;
    try { const der = forge.util.decode64(pfxB64); const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, senha); const bags = p12.getBags({ bagType: forge.pki.oids.certBag }); certObj = bags[forge.pki.oids.certBag]?.[0]?.cert ?? null; }
    catch (_) { return json({ error: 'Nao foi possivel abrir o certificado. Verifique a senha e o arquivo .pfx.' }, 400); }
    if (!certObj) return json({ error: 'Certificado sem cadeia utilizavel.' }, 400);
    const cn = certObj.subject.getField('CN')?.value ?? ''; const issuerCn = certObj.issuer.getField('CN')?.value ?? '';
    const nome = cn.includes(':') ? cn.split(':')[0] : cn; const doc = cn.includes(':') ? cn.split(':').slice(1).join(':') : '';
    const naf = certObj.validity.notAfter; const nbf = certObj.validity.notBefore; const serial = certObj.serialNumber ?? null;
    const titularTipo = (titularTipoIn === 'e-cpf' || titularTipoIn === 'e-cnpj') ? titularTipoIn : (doc.replace(/\D/g, '').length > 11 ? 'e-cnpj' : 'e-cpf');
    let fingerprint = null;
    try { const md = forge.md.sha256.create(); md.update(forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes()); fingerprint = md.digest().toHex(); } catch (_) { fingerprint = null; }
    const secretName = 'signing_cert_' + tenantId; const payload = JSON.stringify({ pfx_b64: pfxB64, senha });
    const { error: vErr } = await admin.rpc('store_signing_secret', { p_name: secretName, p_payload: payload });
    if (vErr) return json({ error: 'Falha ao guardar o certificado com seguranca.' }, 500);
    await admin.from('lab_signing_certificates').update({ status: 'revogado' }).eq('tenant_id', tenantId).eq('status', 'ativo');
    const { data: ins, error: insErr } = await admin.from('lab_signing_certificates').insert({
      tenant_id: tenantId, titular_tipo: titularTipo, titular_nome: nome || 'Titular', titular_doc: doc || '-',
      emissor_ac: issuerCn || null, serial_hex: serial, nao_antes: nbf ? nbf.toISOString().slice(0, 10) : null,
      nao_depois: naf.toISOString().slice(0, 10), fingerprint_sha256: fingerprint, vault_secret_name: secretName, status: 'ativo', criado_por: mem.id,
    }).select('id, titular_nome, titular_doc, titular_tipo, emissor_ac, nao_depois').maybeSingle();
    if (insErr) return json({ error: insErr.message }, 500);
    return json({ ok: true, certificado: ins });
  } catch (e) { return json({ error: 'Falha ao processar o certificado.' }, 500); }
});
