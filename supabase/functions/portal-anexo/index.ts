// portal-anexo (GEOLAB) - anexos de arquivos (NF/DANFE/docs) numa programacao/concretagem pelo cliente.
// verify_jwt=true. Valida o membro pelo JWT e o acesso a obra da concretagem (cliente: member_obras).
// Grava no bucket privado 'anexos' (service-role) e referencia em concretagens.metadata.anexos[]. Self-contained.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const clean = (v: unknown) => String(v ?? '').trim();
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
function b64ToBytes(b64: string): Uint8Array { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'metodo nao suportado' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authz = req.headers.get('authorization') ?? '';
    if (!authz) return json({ ok: false, error: 'nao autenticado' }, 401);
    const sb = createClient(url, anon, { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ ok: false, error: 'nao autenticado' }, 401);
    const { data: member } = await sb.from('members').select('id, tenant_id, role, roles').eq('auth_id', ures.user.id).eq('active', true).is('deleted_at', null).order('is_selected', { ascending: false }).limit(1).maybeSingle();
    if (!member) return json({ ok: false, error: 'membro nao encontrado' }, 403);
    const roles = Array.isArray(member.roles) ? member.roles as string[] : [];
    const isCliente = member.role === 'cliente' || roles.includes('cliente');

    async function podeAcessarObra(workId: string): Promise<boolean> {
      if (!isCliente) return true;
      const { data: mo } = await admin.from('member_obras').select('id').eq('member_id', member.id).eq('work_id', workId).is('deleted_at', null).maybeSingle();
      return !!mo;
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = clean(body.action) || 'upload';

    if (action === 'download') {
      const path = clean(body.path);
      const parts = path.split('/');
      if (parts.length < 2 || parts[0] !== member.tenant_id) return json({ ok: false, error: 'caminho invalido' }, 400);
      const { data: conc } = await admin.from('concretagens').select('id, work_id, tenant_id').eq('id', parts[1]).eq('tenant_id', member.tenant_id).is('deleted_at', null).maybeSingle();
      if (!conc) return json({ ok: false, error: 'concretagem nao encontrada' }, 404);
      if (!(await podeAcessarObra(String(conc.work_id)))) return json({ ok: false, error: 'sem acesso' }, 403);
      const { data: signed, error: se } = await admin.storage.from('anexos').createSignedUrl(path, 120);
      if (se || !signed?.signedUrl) return json({ ok: false, error: se?.message ?? 'falha ao assinar' }, 500);
      return json({ ok: true, url: signed.signedUrl });
    }

    const concretagemId = clean(body.concretagem_id);
    if (!isUuid(concretagemId)) return json({ ok: false, error: 'concretagem invalida' }, 400);
    const { data: conc } = await admin.from('concretagens').select('id, work_id, tenant_id, metadata').eq('id', concretagemId).is('deleted_at', null).maybeSingle();
    if (!conc) return json({ ok: false, error: 'concretagem nao encontrada' }, 404);
    if (conc.tenant_id !== member.tenant_id) return json({ ok: false, error: 'fora do laboratorio' }, 403);
    if (!(await podeAcessarObra(String(conc.work_id)))) return json({ ok: false, error: 'sem acesso a esta obra' }, 403);
    const md = (conc.metadata && typeof conc.metadata === 'object') ? conc.metadata as Record<string, unknown> : {};
    const anexos = Array.isArray(md.anexos) ? md.anexos as Record<string, unknown>[] : [];

    if (action === 'list') return json({ ok: true, anexos });

    // upload
    const filename = clean(body.filename) || 'anexo';
    const mime = clean(body.mime) || 'application/octet-stream';
    const content = typeof body.content_base64 === 'string' ? body.content_base64 : '';
    if (content.length < 10) return json({ ok: false, error: 'arquivo ausente' }, 400);
    const bytes = b64ToBytes(content);
    if (bytes.length > 8 * 1024 * 1024) return json({ ok: false, error: 'arquivo acima de 8MB' }, 413);
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const path = `${conc.tenant_id}/${conc.id}/${crypto.randomUUID()}_${safe}`;
    const { error: ue } = await admin.storage.from('anexos').upload(path, bytes, { contentType: mime, upsert: false });
    if (ue) return json({ ok: false, error: ue.message }, 500);
    const anexo = { path, filename: safe, mime, size: bytes.length, uploaded_at: new Date().toISOString(), uploaded_by: member.id };
    anexos.push(anexo);
    const { error: ue2 } = await admin.from('concretagens').update({ metadata: { ...md, anexos } }).eq('id', conc.id);
    if (ue2) return json({ ok: false, error: ue2.message }, 500);
    return json({ ok: true, anexo });
  } catch (e) { return json({ ok: false, error: (e as Error).message }, 500); }
});
