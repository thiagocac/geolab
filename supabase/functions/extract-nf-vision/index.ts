// extract-nf-vision (GEOLAB) - OCR por IA da DANFE/NF do caminhao (ou NF-e XML) -> campos de material_receipts.
// Re-derivado do GEOMAT, adaptado ao GEOLAB: auth de member, env VISION_API_KEY/URL/MODEL, FAIL-SAFE sem chave.
// Saida 'dados' ja nomeada pelos campos do recebimento (nota_fiscal/serie/placa/motorista/volume_m3/horarios/slump/temperatura/fornecedor).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const fail = (m: string, status = 400) => json({ ok: false, error: m }, status);

function svc() { return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } }); }
async function isMember(req: Request): Promise<boolean> {
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!bearer) return false;
  const s = svc();
  const { data } = await s.auth.getUser(bearer);
  if (!data?.user) return false;
  const { data: m } = await s.from('members').select('id').eq('auth_id', data.user.id).eq('active', true).is('deleted_at', null).limit(1).maybeSingle();
  return !!m;
}

function tag(xml: string, name: string): string | null { const m = xml.match(new RegExp('<' + name + '>([^<]*)</' + name + '>', 'i')); return m ? m[1].trim() : null; }
function fromNfeXml(xml: string): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  const nNF = tag(xml, 'nNF'); if (nNF) d.nota_fiscal = nNF;
  const serie = tag(xml, 'serie'); if (serie) d.serie = serie;
  const qCom = tag(xml, 'qCom'); if (qCom) d.volume_m3 = Number(qCom);
  const xNome = tag(xml, 'xNome'); if (xNome) d.fornecedor = xNome;
  const placa = tag(xml, 'placa'); if (placa) d.placa = placa;
  return d;
}

const PROMPT = 'A imagem e uma DANFE / nota fiscal de concreto usinado (ou documento de recebimento do caminhao na obra). Extraia e retorne SOMENTE JSON com estas chaves quando legiveis: nota_fiscal (numero da NF), serie, placa (do caminhao/betoneira), motorista, volume_m3 (numero, m3), fornecedor (usina/concreteira), hora_saida_usina, hora_chegada_obra, hora_inicio_descarga, hora_fim_descarga (formato HH:MM), slump_medido_cm (numero), temperatura_concreto_c (numero). Omita as chaves que nao estiverem legiveis. Nao invente valores.';

async function fromVision(imageBase64: string, mime: string, apiUrl: string, apiKey: string, model: string): Promise<Record<string, unknown>> {
  const res = await fetch(apiUrl, { method: 'POST', headers: { authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' }, body: JSON.stringify({
    model, temperature: 0, response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + imageBase64, detail: 'high' } }] }],
  }) });
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) throw new Error('falha no provedor de visao');
  try {
    const msg = ((data.choices as unknown[])?.[0] as Record<string, unknown>)?.message as Record<string, unknown>;
    const parsed = JSON.parse(String(msg?.content ?? '{}')) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of ['nota_fiscal','serie','placa','motorista','volume_m3','fornecedor','hora_saida_usina','hora_chegada_obra','hora_inicio_descarga','hora_fim_descarga','slump_medido_cm','temperatura_concreto_c']) {
      const v = parsed[k]; if (v !== undefined && v !== null && v !== '') out[k] = v;
    }
    return out;
  } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('metodo nao suportado', 405);
  try {
    if (!(await isMember(req))) return fail('acesso negado - faca login no sistema', 401);
    const apiKey = Deno.env.get('VISION_API_KEY') ?? '';
    const apiUrl = Deno.env.get('VISION_API_URL') ?? 'https://api.openai.com/v1/chat/completions';
    const model = Deno.env.get('VISION_MODEL') ?? 'gpt-4o-mini';
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const xml = typeof body.xml === 'string' ? body.xml : null;
    if (xml && xml.includes('<')) return json({ ok: true, enabled: true, _source: 'nfe-xml', dados: fromNfeXml(xml) });
    if (!apiKey) return json({ ok: true, enabled: false, reason: 'Leitura por IA indisponivel: configure VISION_API_KEY no vault. (NF-e XML funciona sem chave.)' });
    const imageBase64 = typeof body.image_base64 === 'string' ? body.image_base64 : null;
    if (!imageBase64) return fail('Envie image_base64 (foto da DANFE) ou xml (NF-e).');
    const dados = await fromVision(imageBase64, String(body.mime ?? 'image/jpeg'), apiUrl, apiKey, model);
    return json({ ok: true, enabled: true, _source: 'vision', dados });
  } catch (e) { return fail(e instanceof Error ? e.message : 'falha na extracao', 500); }
});
