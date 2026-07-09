// @ts-nocheck
// sign-laudo-pdf (GEOLAB) - Onda 1 (sincronos leves) + Onda 2 (a1_local PAdES AD-RB).
// Resolve lab_signature_settings.modo. nenhuma=no-op; qr_publico/imagem_rubrica=registro simples;
// a1_local=assinatura ICP qualificada com o .pfx custodiado no Vault; nuvem/govbr/gateway=nao_implementado.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { Buffer } from 'node:buffer';
import forge from 'npm:node-forge@1.3.1';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { pdflibAddPlaceholder } from 'npm:@signpdf/placeholder-pdf-lib@3.3.0';
import { SUBFILTER_ETSI_CADES_DETACHED } from 'npm:@signpdf/utils@3.3.0';
import { SignPdf } from 'npm:@signpdf/signpdf@3.3.0';
import { P12Signer } from 'npm:@signpdf/signer-p12@3.3.0';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const NIVEL = { nenhuma: 'simples', qr_publico: 'simples', imagem_rubrica: 'simples', a1_local: 'qualificada', nuvem_psc: 'qualificada', govbr: 'avancada', gateway_externo: 'avancada' };
const PROVIDER = { nenhuma: 'none', qr_publico: 'none', imagem_rubrica: 'none', a1_local: 'local_a1', nuvem_psc: 'integraicp', govbr: 'govbr', gateway_externo: 'none' };
const SINCRONO_LEVE = new Set(['qr_publico', 'imagem_rubrica']);
async function sha256Hex(bytes) { const d = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }

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
    const rev = Number(lr.revisao) || 0;

    if (modo === 'nenhuma') {
      await admin.from('lab_reports').update({ assinatura_status: 'nao_assinado', assinatura_atual_id: null, updated_at: now }).eq('id', lr.id);
      return json({ status: 'nao_assinado', modo });
    }

    if (SINCRONO_LEVE.has(modo)) {
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

    if (modo === 'a1_local') {
      if (!lr.storage_path) return json({ error: 'Laudo ainda nao gerado/persistido.' }, 422);
      const { data: cert } = await admin.from('lab_signing_certificates')
        .select('id, vault_secret_name, titular_nome, serial_hex, emissor_ac, nao_depois, status')
        .eq('tenant_id', lr.tenant_id).eq('status', 'ativo').is('deleted_at', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!cert) return json({ error: 'Nenhum certificado A1 ativo. Suba o certificado em Configuracoes > Assinatura.' }, 422);
      if (cert.nao_depois && new Date(cert.nao_depois) < new Date()) return json({ error: 'Certificado A1 vencido.' }, 422);

      const { data: secretJson, error: secErr } = await admin.rpc('read_signing_secret', { p_name: cert.vault_secret_name });
      if (secErr || !secretJson) return json({ error: 'Falha ao ler o certificado.' }, 500);
      let pfx_b64 = '', senha = '';
      try { const p = JSON.parse(secretJson); pfx_b64 = p.pfx_b64; senha = p.senha; } catch (_) { return json({ error: 'Segredo do certificado invalido.' }, 500); }

      const dl = await admin.storage.from('lab-reports').download(lr.storage_path);
      if (!dl.data) return json({ error: 'PDF do laudo nao encontrado.' }, 404);
      const pdfBytes = new Uint8Array(await dl.data.arrayBuffer());
      const hashAntes = await sha256Hex(pdfBytes);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      pdflibAddPlaceholder({ pdfDoc, reason: 'Assinatura do laudo (RT)', contactInfo: '', name: cert.titular_nome || 'RT', location: 'BR', signatureLength: 16384, subFilter: SUBFILTER_ETSI_CADES_DETACHED });
      const withPh = await pdfDoc.save({ useObjectStreams: false });
      const p12Buffer = Buffer.from(forge.util.decode64(pfx_b64), 'binary');
      const signer = new P12Signer(p12Buffer, { passphrase: senha });
      const signed = await new SignPdf().sign(Buffer.from(withPh), signer);
      const signedBytes = new Uint8Array(signed);
      const hashDepois = await sha256Hex(signedBytes);
      const signedPath = lr.storage_path.replace(/\.pdf$/i, '') + '-signed.pdf';
      const up = await admin.storage.from('lab-reports').upload(signedPath, signedBytes, { contentType: 'application/pdf', upsert: true });
      if (up.error) return json({ error: 'Falha ao gravar o PDF assinado.' }, 500);

      await admin.from('laudo_assinaturas').delete().eq('lab_report_id', lr.id).eq('revisao', rev).eq('status', 'assinado');
      const { data: ins, error: insErr } = await admin.from('laudo_assinaturas').insert({
        tenant_id: lr.tenant_id, lab_report_id: lr.id, revisao: rev, modo: 'a1_local', provider: 'local_a1', nivel: 'qualificada',
        signed_storage_path: signedPath, hash_documento: hashDepois, hash_antes: hashAntes,
        cert_serial_hex: cert.serial_hex, cert_titular: cert.titular_nome, cert_emissor: cert.emissor_ac,
        status: 'assinado', assinado_por: memberId, ip_address: ip, user_agent: ua,
      }).select('id').maybeSingle();
      if (insErr) return json({ error: insErr.message }, 500);
      await admin.from('lab_reports').update({ assinatura_status: 'assinado', assinatura_atual_id: ins?.id ?? null, updated_at: now }).eq('id', lr.id);
      return json({ status: 'assinado', modo: 'a1_local', nivel: 'qualificada', assinatura_id: ins?.id ?? null, signed_storage_path: signedPath });
    }

    return json({ status: 'nao_implementado', modo, message: 'Modo de assinatura sera aplicado em uma onda futura.' }, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
