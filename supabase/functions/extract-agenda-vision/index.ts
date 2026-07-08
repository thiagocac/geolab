// extract-agenda-vision (GEOLAB) — OCR por IA da AGENDA DE ROMPIMENTOS impressa e preenchida A CANETA.
// Casa o CP pela NUMERACAO impressa (NNNNNN/AA, alta confianca) e le so os campos manuscritos
// (data/hora do rompimento + tensao MPa/carga + tipo de ruptura). FAIL-SAFE sem VISION_API_KEY.
// Modelado no extract-ficha-vision (v43). verify_jwt=true. Self-contained.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// --- Observabilidade (M1): registra cada invocacao em ef_invocation_log (best-effort, nunca bloqueia) ---
const _obsSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _obsTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _obsActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const s = _obsSvc(); const { data: u, error } = await s.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await s.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _obsFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null }) { try { const s = _obsSvc(); const actor = await _obsActor(req); const tr = _obsTrace(req); await s.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(tr ? { trace_id: tr } : {}) } }); } catch { /* telemetria nunca bloqueia a EF */ } }
function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _obsFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }

const corsHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const handleCors = (req: Request): Response | null => (req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null);
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders, ...(init.headers ?? {}) } });
const fail = (message: string, status = 400, details?: unknown) => json({ ok: false, error: message, details }, { status });
const userClient = (req: Request) => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } }, auth: { persistSession: false } });

type Rec = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v));

const PROMPT = [
  'Voce le uma AGENDA DE ROMPIMENTOS de corpos de prova (CP) de concreto (Consulte GEO / Concresoft), impressa e preenchida A CANETA.',
  'A grade tem UMA LINHA POR CP. Colunas IMPRESSAS: "Numeracao" (formato NNNNNN/AA), "Nota fiscal", "Idade", "Data prevista". Colunas EM BRANCO preenchidas a mao: "Data / hora rompimento" e "Tensao de ruptura (MPa)" (as vezes o cabecalho e "Carga de ruptura").',
  'Extraia UMA entrada por linha que tenha valor MANUSCRITO nas colunas de resultado (ignore linhas sem nada escrito a caneta). Para cada uma, leia a NUMERACAO impressa (chave de casamento — copie exatamente como impresso) e os valores escritos a mao.',
  'Responda APENAS um JSON valido, sem comentarios nem texto fora do JSON, exatamente neste formato:',
  '{"linhas":[{"numeracao":"","data_rompimento":"YYYY-MM-DD","hora":"HH:MM","resultado_mpa":0,"carga":null,"tipo_ruptura":null,"conf":0.0}],"confianca":0.0}',
  'Regras: "numeracao" = texto impresso da coluna Numeracao (ex.: 001234/25); "resultado_mpa" = numero manuscrito na coluna de tensao, em MPa, exatamente como escrito (ponto decimal); se a coluna for de CARGA, preencha "carga" (numero) e deixe "resultado_mpa" null; "data_rompimento" em ISO YYYY-MM-DD; "hora" em 24h HH:MM; "tipo_ruptura" e a letra A-F se anotada, senao null; use null quando ilegivel/ausente; NUNCA invente numeros; "conf" = legibilidade daquela LINHA (0 a 1) e "confianca" = legibilidade geral da folha (0 a 1).',
].join('\n');

serveWithTelemetry('extract-agenda-vision', async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const body = (await req.json().catch(() => ({}))) as Rec;
    const imageB64 = s(body.image_base64);
    const mime = s(body.mime) || 'image/jpeg';
    if (!imageB64) return fail('image_base64 e obrigatorio');

    const supa = userClient(req);
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return fail('nao autenticado', 401);

    const KEY = Deno.env.get('VISION_API_KEY') ?? '';
    if (!KEY) {
      return json({ ok: true, enabled: false, _source: 'disabled', reason: 'VISION_API_KEY ausente', dados: { linhas: [], confianca: null } });
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
      return json({ ok: true, enabled: true, _source: 'vision', reason: 'visao indisponivel (' + r.status + ')', detail: t.slice(0, 200), dados: { linhas: [], confianca: null } });
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
    const linhas = Array.isArray(parsed.linhas) ? (parsed.linhas as Rec[]) : [];
    return json({ ok: true, enabled: true, _source: 'vision', dados: { linhas, confianca: parsed.confianca ?? null } });
  } catch (e) {
    return fail((e as Error).message || 'erro ao ler agenda', 500);
  }
});
