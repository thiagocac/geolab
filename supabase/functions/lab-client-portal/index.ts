// lab-client-portal (GEOLAB) - portal do cliente por MAGIC LINK (sem conta Auth). Publica (verify_jwt=false):
// o token E a credencial. Valida pelo hash sha256 em magic_links (purpose 'portal', nao expirado), entao serve
// READ-ONLY os dados do cliente (obras/concretagens/laudos/resultados) + a UNICA acao de escrita do magic link:
// 'solicitar_correcao' (pedido de correcao de laudo), sempre escopada ao client_id do token. Service-role.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
async function sha256Hex(t: string) { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join(''); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'metodo nao suportado' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token || token.length < 16) return json({ ok: false, error: 'token ausente' }, 400);
    const hash = await sha256Hex(token);
    const { data: link } = await admin.from('magic_links').select('tenant_id, purpose, entity_table, entity_id, expires_at, consumed_at').eq('token_hash', hash).maybeSingle();
    if (!link || link.purpose !== 'portal' || link.entity_table !== 'lab_clients' || link.consumed_at || new Date(String(link.expires_at)) < new Date()) {
      return json({ ok: false, error: 'Link invalido ou expirado.' }, 401);
    }
    const tenant = String(link.tenant_id); const clientId = String(link.entity_id);
    try { await admin.rpc('bump_magic_link_access', { p_hash: hash }); } catch (_e) { /* nao bloqueia */ }

    // Acao de ESCRITA: solicitar correcao de laudo (peca/resultado). Escopo = client do token.
    if (body.action === 'solicitar_correcao') {
      const workId = typeof body.work_id === 'string' ? body.work_id : '';
      const tipo = typeof body.tipo === 'string' ? body.tipo : '';
      if (!workId || !tipo) return json({ ok: false, error: 'work_id e tipo obrigatorios' }, 400);
      const { data: w } = await admin.from('client_works').select('id').eq('id', workId).eq('client_id', clientId).eq('tenant_id', tenant).is('deleted_at', null).maybeSingle();
      if (!w) return json({ ok: false, error: 'sem acesso a esta obra' }, 403);
      const { data: cfg } = await admin.from('config_lab').select('portal_campos').eq('tenant_id', tenant).maybeSingle();
      const pc = (cfg?.portal_campos ?? {}) as Record<string, unknown>;
      if (pc.correcao_habilitada === false) return json({ ok: false, error: 'correcao desabilitada' }, 403);
      if (tipo === 'resultado' && pc.correcao_resultado === false) return json({ ok: false, error: 'contestacao de resultado desabilitada' }, 403);
      let proposto = typeof body.valor_proposto === 'string' ? body.valor_proposto : null;
      if ((tipo === 'local_peca' || tipo === 'elementos_caminhao') && pc.correcao_auto_edicao_peca !== true) proposto = null;
      const { data: novoId, error: ce } = await admin.rpc('fn_portal_correcao_criar', {
        p_tenant_id: tenant, p_client_id: clientId, p_work_id: workId, p_tipo: tipo,
        p_lab_report_id: (typeof body.lab_report_id === 'string' ? body.lab_report_id : null),
        p_concretagem_id: (typeof body.concretagem_id === 'string' ? body.concretagem_id : null),
        p_receipt_id: (typeof body.receipt_id === 'string' ? body.receipt_id : null),
        p_corpo_prova_id: (typeof body.corpo_prova_id === 'string' ? body.corpo_prova_id : null),
        p_material_test_id: (typeof body.material_test_id === 'string' ? body.material_test_id : null),
        p_valor_proposto: proposto, p_comentario: (typeof body.comentario === 'string' ? body.comentario : null),
        p_origem: 'portal_magic', p_created_by: null,
      });
      if (ce) return json({ ok: false, error: ce.message }, 400);
      return json({ ok: true, id: novoId });
    }

    // Download de laudo (escopo: a obra precisa ser do cliente do link)
    const reportId = typeof body.lab_report_id === 'string' ? body.lab_report_id : '';
    if (reportId) {
      const { data: rep } = await admin.from('lab_reports').select('id, work_id, storage_path').eq('id', reportId).eq('tenant_id', tenant).is('deleted_at', null).maybeSingle();
      if (!rep || !rep.storage_path) return json({ ok: false, error: 'laudo nao encontrado' }, 404);
      const { data: w } = await admin.from('client_works').select('id').eq('id', rep.work_id).eq('client_id', clientId).is('deleted_at', null).maybeSingle();
      if (!w) return json({ ok: false, error: 'sem acesso a este laudo' }, 403);
      const { data: signed, error: se } = await admin.storage.from('lab-reports').createSignedUrl(String(rep.storage_path), 120);
      if (se || !signed?.signedUrl) return json({ ok: false, error: se?.message ?? 'falha ao assinar' }, 500);
      return json({ ok: true, url: signed.signedUrl });
    }

    // Download de anexo da concretagem (escopo: a concretagem precisa ser de uma obra do cliente)
    const anexoPath = typeof body.anexo_path === 'string' ? body.anexo_path : '';
    if (anexoPath) {
      const parts = anexoPath.split('/');
      if (parts.length < 2 || parts[0] !== tenant) return json({ ok: false, error: 'caminho invalido' }, 400);
      const { data: cc } = await admin.from('concretagens').select('id, work_id').eq('id', parts[1]).eq('tenant_id', tenant).is('deleted_at', null).maybeSingle();
      if (!cc) return json({ ok: false, error: 'anexo nao encontrado' }, 404);
      const { data: w2 } = await admin.from('client_works').select('id').eq('id', cc.work_id).eq('client_id', clientId).is('deleted_at', null).maybeSingle();
      if (!w2) return json({ ok: false, error: 'sem acesso a este anexo' }, 403);
      const { data: asg, error: ae } = await admin.storage.from('anexos').createSignedUrl(anexoPath, 120);
      if (ae || !asg?.signedUrl) return json({ ok: false, error: ae?.message ?? 'falha ao assinar' }, 500);
      return json({ ok: true, url: asg.signedUrl });
    }

    const { data: cli } = await admin.from('lab_clients').select('razao_social, nome_fantasia').eq('id', clientId).eq('tenant_id', tenant).maybeSingle();
    const { data: tnt } = await admin.from('tenants').select('name').eq('id', tenant).maybeSingle();
    const { data: obras } = await admin.from('client_works').select('id, nome, codigo, cidade, uf').eq('client_id', clientId).eq('tenant_id', tenant).is('deleted_at', null);
    const workIds = (obras ?? []).map((o: Record<string, unknown>) => o.id);
    let concretagens: unknown[] = []; let laudos: unknown[] = []; let resultados: unknown[] = []; let correcoes: unknown[] = [];
    if (workIds.length) {
      const { data: cs } = await admin.from('concretagens').select('id, codigo, work_id, status, data_real, data_programada, local_texto, volume_lancado_m3, fck_previsto, metadata').in('work_id', workIds).is('deleted_at', null).order('data_programada', { ascending: false }).limit(500);
      concretagens = cs ?? [];
      const { data: ls } = await admin.rpc('fn_laudos_por_obras', { p_work_ids: workIds });
      laudos = ls ?? [];
      const { data: rs } = await admin.rpc('fn_resultados_por_obras', { p_work_ids: workIds });
      resultados = rs ?? [];
      const { data: pc } = await admin.from('portal_correcao_pedidos').select('id, tipo, status, campo_alvo, valor_atual, valor_proposto, comentario_cliente, decisao_comentario, created_at, decided_at, nova_revisao, work_id, lab_report_id, concretagem_id').in('work_id', workIds).is('deleted_at', null).order('created_at', { ascending: false }).limit(500);
      correcoes = pc ?? [];
    }
    const { data: cfg0 } = await admin.from('config_lab').select('portal_campos').eq('tenant_id', tenant).maybeSingle();
    return json({ ok: true, laboratorio: tnt?.name ?? null, cliente: cli ?? null, obras: obras ?? [], concretagens, laudos, resultados, correcoes, portal_config: (cfg0?.portal_campos ?? {}) });
  } catch (e) { return json({ ok: false, error: (e as Error).message }, 500); }
});
