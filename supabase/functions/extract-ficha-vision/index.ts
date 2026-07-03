// extract-ficha-vision (GEOLAB) - OCR por IA da FICHA DE MOLDAGEM (modelo A, paisagem) preenchida -> caminhoes.
// FAIL-SAFE sem VISION_API_KEY. verify_jwt=true. Self-contained.
// v27: extrai tambem hora_moldagem, qtde_cps e elementos_concretados (colunas da ficha) + confianca POR LINHA (conf),
// para a tela de conferencia editavel destacar linhas duvidosas e validar a qtde contra o padrao de moldagem.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const handleCors = (req: Request): Response | null => (req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null);
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders, ...(init.headers ?? {}) } });
const fail = (message: string, status = 400, details?: unknown) => json({ ok: false, error: message, details }, { status });
const userClient = (req: Request) => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } }, auth: { persistSession: false } });

type Rec = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v));

const PROMPT = [
  'Voce le uma FICHA DE MOLDAGEM de concreto (modelo Consulte GEO, paisagem) fotografada ou escaneada.',
  'A grade tem UMA LINHA POR CAMINHAO-BETONEIRA, com colunas: Serie no | Qtde CPs | Abat.(mm) | Nota Fiscal no | Horario moldagem | TRANSPORTE (Inicio da mistura | Chegada a obra) | DESCARGA (Inicio | Termino) | Tempo total | Concreto aplicado (Unit. | Acum.) | C.B. no | Amostragem/Elementos concretados | CP por idade.',
  'Extraia uma entrada por linha PREENCHIDA (ignore linhas totalmente em branco).',
  'Responda APENAS um JSON valido, sem comentarios nem texto fora do JSON, exatamente neste formato:',
  '{"caminhoes":[{"serie":1,"nota_fiscal":"","qtde_cps":null,"slump_medido_cm":0,"volume_m3":0,"hora_moldagem":"HH:MM","hora_saida_usina":"HH:MM","hora_chegada_obra":"HH:MM","hora_inicio_descarga":"HH:MM","hora_fim_descarga":"HH:MM","elementos_concretados":null,"placa":null,"motorista":null,"temperatura_concreto_c":null,"conf":0.0}],"confianca":0.0}',
  'Mapeamento de colunas -> campos JSON: "Abat.(mm)"->slump_medido_cm ; "Nota Fiscal no"->nota_fiscal ; "Qtde CPs"->qtde_cps ; "Horario moldagem"->hora_moldagem ; "Inicio da mistura"->hora_saida_usina ; "Chegada a obra"->hora_chegada_obra ; "Descarga Inicio"->hora_inicio_descarga ; "Descarga Termino"->hora_fim_descarga ; "Concreto aplicado Unit."->volume_m3 ; "Amostragem/Elementos concretados"->elementos_concretados ; "Serie no"->serie.',
  'Regras: use null quando o campo estiver ilegivel ou ausente; horarios em 24h "HH:MM"; numeros com ponto decimal; nunca invente valores; NAO confunda a coluna "CP por idade" (ex.: 2x7d 2x28d) com "Qtde CPs" (numero inteiro total); placa/motorista/temperatura normalmente nao existem nesta ficha (use null); "conf" e a legibilidade daquela LINHA (0 a 1) e "confianca" a legibilidade geral da ficha (0 a 1).',
].join('\n');

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const body = (await req.json().catch(() => ({}))) as Rec;
    const imageB64 = s(body.image_base64);
    const mime = s(body.mime) || 'image/jpeg';
    const concretagemId = s(body.concretagem_id) || null;
    if (!imageB64) return fail('image_base64 e obrigatorio');

    const supa = userClient(req);
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return fail('nao autenticado', 401);

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
      max_tokens: 2500,
      messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: dataUrl } }] }],
    };

    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return json({ ok: true, enabled: true, _source: 'vision', reason: 'visao indisponivel (' + r.status + ')', detail: t.slice(0, 200), dados: { concretagem_id: concretagemId, caminhoes: [] } });
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
