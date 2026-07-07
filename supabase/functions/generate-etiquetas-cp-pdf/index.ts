// generate-etiquetas-cp-pdf (Concresoft) — etiquetas adesivas com QR para identificar corpos de prova.
// Uma etiqueta por CP: numeracao_lab grande (sequencia lab+ano, RPC atribuir_numeracao_cp_lote/128-129),
// QR vetorial "CP:<uuid>" (mesmo metodo da ficha de moldagem), nº do relatorio, mold./romp. previsto,
// idade em destaque e codigo do CP. Dois layouts: 'rolo' (60x40mm, 1/pagina — termica) e
// 'a4' (21/folha, 63,5x38,1, 3x7 — Avery L7160/Pimaco A4260). Desenho validado visualmente no proto local.
// Self-contained (padrao generate-nc-report-pdf): verify_jwt + client anon com Authorization (RLS decide).
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import QRCode from 'npm:qrcode@1.5.3';

// --- Observabilidade (M1, auditoria 2026-07-07): registra cada invocacao em ef_invocation_log ---
// (alimenta v_ef_metrics_hourly e o alarme de 5xx/p95 do telemetry-alarm). Best-effort: nunca
// bloqueia nem altera a resposta da EF. trace_id via ?trace_id= (sem preflight CORS).
const _obsSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _obsTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _obsActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const s = _obsSvc(); const { data: u, error } = await s.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await s.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _obsFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null }) { try { const s = _obsSvc(); const actor = await _obsActor(req); const tr = _obsTrace(req); await s.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(tr ? { trace_id: tr } : {}) } }); } catch { /* telemetria nunca bloqueia a EF */ } }
function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _obsFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }


const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const MM = 72 / 25.4;
const NAVY = rgb(0.094, 0.157, 0.388);
const INK = rgb(0.106, 0.137, 0.188);
const MUTED = rgb(0.361, 0.392, 0.451);
const FAINT = rgb(0.545, 0.576, 0.643);

const dbr = (s: unknown) => { const t = String(s ?? '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '-'; const [, m, d] = t.split('-'); return `${d}/${m}`; };

type Fonte = Awaited<ReturnType<PDFDocument['embedFont']>>;
type Etq = { num: string; rel: string; mold: string; prev: string; idade: string; cod: string; qr: string };

function fit(font: Fonte, text: string, size: number, maxW: number): string {
  let t = String(text ?? '');
  while (t.length > 3 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
  return t;
}

function drawLabel(page: ReturnType<PDFDocument['addPage']>, F: Fonte, FB: Fonte, x: number, y: number, w: number, h: number, d: Etq) {
  const m = 2 * MM;
  const qs = Math.min(20 * MM, h - 2 * m);
  const qx = x + w - m - qs;
  const qy = y + h - m - qs;
  try {
    const qr = QRCode.create(d.qr, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size, data = qr.modules.data, mod = qs / n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (data[r * n + c]) page.drawRectangle({ x: qx + c * mod, y: qy + (n - 1 - r) * mod, width: mod + 0.15, height: mod + 0.15, color: INK });
  } catch { /* QR opcional */ }
  const idadeSize = 9;
  const iw = FB.widthOfTextAtSize(d.idade, idadeSize);
  page.drawText(d.idade, { x: qx + (qs - iw) / 2, y: y + m + 1, size: idadeSize, font: FB, color: NAVY });

  const lx = x + m;
  const lw = qx - lx - 1.5 * MM;
  const [nn, aa] = String(d.num).split('/');
  let ny = y + h - m - 14;
  page.drawText(nn ?? '-', { x: lx, y: ny, size: 19, font: FB, color: INK });
  const nnw = FB.widthOfTextAtSize(nn ?? '-', 19);
  page.drawText('/' + (aa ?? ''), { x: lx + nnw + 1, y: ny, size: 10, font: FB, color: MUTED });
  ny -= 10.5;
  page.drawText(fit(FB, d.rel, 7.5, lw), { x: lx, y: ny, size: 7.5, font: FB, color: NAVY });
  ny -= 8.5;
  page.drawText(fit(F, 'Mold. ' + d.mold, 7, lw), { x: lx, y: ny, size: 7, font: F, color: INK });
  ny -= 8;
  page.drawText(fit(F, 'Romp. prev. ' + d.prev, 7, lw), { x: lx, y: ny, size: 7, font: F, color: INK });
  page.drawText(fit(F, d.cod, 5, lw + 2 * MM), { x: lx, y: y + m - 1, size: 5, font: F, color: FAINT });
}

serveWithTelemetry('generate-etiquetas-cp-pdf', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const concId = String(body.concretagem_id ?? '');
    const layout = String(body.layout ?? 'rolo') === 'a4' ? 'a4' : 'rolo';
    const cpIds: string[] = Array.isArray(body.cp_ids) ? body.cp_ids.map(String) : [];
    if (!concId) return json({ error: 'concretagem_id obrigatorio' }, 400);
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return json({ error: 'nao autenticado' }, 401);
    const sb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ error: 'nao autenticado' }, 401);

    const { data: conc, error: e1 } = await sb.from('concretagens')
      .select('id, codigo, numero_relatorio, client_works(nome)')
      .eq('id', concId).is('deleted_at', null).maybeSingle();
    if (e1) return json({ error: e1.message }, 403);
    if (!conc) return json({ error: 'concretagem nao encontrada' }, 404);

    const { data: cps, error: e2 } = await sb.from('corpos_prova')
      .select('id, codigo, numeracao_lab, idade_dias, idade_unidade, data_moldagem, data_prevista_rompimento, created_at, amostras(created_at)')
      .eq('concretagem_id', concId).is('deleted_at', null);
    if (e2) return json({ error: e2.message }, 403);
    let rows = (cps ?? []) as Record<string, unknown>[];
    if (cpIds.length) rows = rows.filter((r) => cpIds.includes(String(r.id)));
    if (!rows.length) return json({ error: 'nenhum CP para etiquetar' }, 404);

    const semNum = rows.filter((r) => !String(r.numeracao_lab ?? '').trim());
    if (semNum.length) return json({ error: semNum.length + ' CP(s) sem numeracao do laboratorio. Atribua a numeracao antes de imprimir (atribuir_numeracao_cp_lote).' }, 422);

    const horas = (r: Record<string, unknown>) => Number(r.idade_dias ?? 0) * (String(r.idade_unidade ?? 'dia') === 'hora' ? 1 : 24);
    rows.sort((a, b) => {
      const aa = String((a.amostras as Record<string, unknown> | null)?.created_at ?? '');
      const bb = String((b.amostras as Record<string, unknown> | null)?.created_at ?? '');
      if (aa !== bb) return aa < bb ? -1 : 1;
      if (horas(a) !== horas(b)) return horas(a) - horas(b);
      return String(a.created_at) < String(b.created_at) ? -1 : 1;
    });

    const rel = String(conc.numero_relatorio ?? conc.codigo ?? '');
    const etqs: Etq[] = rows.map((r) => ({
      num: String(r.numeracao_lab),
      rel,
      mold: dbr(r.data_moldagem),
      prev: dbr(r.data_prevista_rompimento),
      idade: String(r.idade_dias ?? '-') + (String(r.idade_unidade ?? 'dia') === 'hora' ? 'h' : 'd'),
      cod: String(r.codigo ?? ''),
      qr: 'CP:' + String(r.id),
    }));

    const doc = await PDFDocument.create();
    doc.setTitle('Etiquetas CP ' + rel); doc.setProducer('Concresoft');
    const F = await doc.embedFont(StandardFonts.Helvetica);
    const FB = await doc.embedFont(StandardFonts.HelveticaBold);

    if (layout === 'rolo') {
      const W = 60 * MM, H = 40 * MM;
      for (const d of etqs) { const p = doc.addPage([W, H]); drawLabel(p, F, FB, 0, 0, W, H, d); }
    } else {
      const PW = 210 * MM, PH = 297 * MM;
      const LW = 63.5 * MM, LH = 38.1 * MM, GAPX = 2.5 * MM;
      const MXX = ((210 - 3 * 63.5 - 2 * 2.5) / 2) * MM;
      const MYY = ((297 - 7 * 38.1) / 2) * MM;
      let page = doc.addPage([PW, PH]); let col = 0, row = 0;
      for (const d of etqs) {
        const x = MXX + col * (LW + GAPX);
        const y = PH - MYY - (row + 1) * LH;
        drawLabel(page, F, FB, x, y, LW, LH, d);
        col++; if (col === 3) { col = 0; row++; }
        if (row === 7 && etqs.indexOf(d) < etqs.length - 1) { page = doc.addPage([PW, PH]); row = 0; }
      }
    }

    const bytes = await doc.save();
    return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="etiquetas-' + rel.replace(/[^\w.-]+/g, '_') + '-' + layout + '.pdf"', ...cors } });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
