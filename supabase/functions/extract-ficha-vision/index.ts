// extract-ficha-vision (GEOLAB) — OCR por IA da FICHA DE MOLDAGEM preenchida (foto) -> caminhões detectados.
// Alvo: GEOLAB (implementado do zero, sem GEOMAT). FAIL-SAFE sem VISION_API_KEY. verify_jwt=true (auth de member).
// Contrato espelha extract-nf-vision: { ok, enabled, _source, reason?, dados }.
// IMPORTANTE: o corpo de extract-nf-vision está deployado via MCP (fora do source). A chamada HTTP de visão aqui
// segue o padrão documentado VISION_API_KEY / VISION_API_URL / VISION_API_MODEL (OpenAI-compatível, chat/completions
// com content multimodal text+image_url). Se a sua extract-nf-vision deployada usa outro provedor/shape, reconcilie
// apenas o bloco `fetch(apiUrl, ...)` + o parse de `out.choices[0].message.content` — o restante (auth, fail-safe,
// contrato de saída) já está alinhado com o frontend (lerFichaImagem).

import { handleCors } from '../_shared/cors.ts';
import { json, fail } from '../_shared/response.ts';
import { userClient } from '../_shared/client.ts';

type Rec = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v));

const PROMPT = [
  'Você lê uma FICHA DE MOLDAGEM de concreto fotografada (laboratório de controle tecnológico).',
  'Extraia a lista de caminhões/betoneiras lançados na ficha.',
  'Responda APENAS um JSON válido, sem comentários nem texto fora do JSON, exatamente neste formato:',
  '{"caminhoes":[{"serie":1,"nota_fiscal":"","placa":"","motorista":"","volume_m3":0,"slump_medido_cm":0,"temperatura_concreto_c":0,"hora_saida_usina":"HH:MM","hora_chegada_obra":"HH:MM","hora_inicio_descarga":"HH:MM","hora_fim_descarga":"HH:MM"}],"confianca":0.0}',
  'Regras: use null quando o campo estiver ilegível ou ausente; horários em 24h "HH:MM"; números com ponto decimal; nunca invente valores; "confianca" é um número entre 0 e 1.',
].join('\n');

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const body = (await req.json().catch(() => ({}))) as Rec;
    const imageB64 = s(body.image_base64);
    const mime = s(body.mime) || 'image/jpeg';
    const concretagemId = s(body.concretagem_id) || null;
    if (!imageB64) return fail('image_base64 é obrigatório');

    // Auth de member (verify_jwt=true já valida o token; confirmamos a identidade).
    const supa = userClient(req);
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return fail('não autenticado', 401);

    const KEY = Deno.env.get('VISION_API_KEY') ?? '';
    if (!KEY) {
      return json({ ok: true, enabled: false, _source: 'disabled', reason: 'VISION_API_KEY ausente', dados: { concretagem_id: concretagemId, caminhoes: [] } });
    }

    const apiUrl = Deno.env.get('VISION_API_URL') ?? 'https://api.openai.com/v1/chat/completions';
    const model = Deno.env.get('VISION_API_MODEL') ?? 'gpt-4o-mini';
    const dataUrl = 'data:' + mime + ';base64,' + imageB64;
    const payload = {
      model,
      temperature: 0,
      max_tokens: 1500,
      messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: dataUrl } }] }],
    };

    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return json({ ok: true, enabled: true, _source: 'vision', reason: 'visão indisponível (' + r.status + ')', detail: t.slice(0, 200), dados: { concretagem_id: concretagemId, caminhoes: [] } });
    }

    const out = (await r.json().catch(() => ({}))) as Rec;
    const choices = Array.isArray(out.choices) ? (out.choices as Rec[]) : [];
    const msg = (choices[0]?.message ?? {}) as Rec;
    const content = s(msg.content);
    let parsed: Rec = {};
    try {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]) as Rec;
    } catch {
      parsed = {};
    }
    const cams = Array.isArray(parsed.caminhoes) ? (parsed.caminhoes as Rec[]) : [];
    return json({ ok: true, enabled: true, _source: 'vision', dados: { concretagem_id: concretagemId, caminhoes: cams, confianca: parsed.confianca ?? null } });
  } catch (e) {
    return fail((e as Error).message || 'erro ao ler ficha', 500);
  }
});
