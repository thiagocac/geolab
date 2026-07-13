// generate-cp-descarte-pdf (Concresoft) — Termo de Descarte de Corpos de Prova (Grupo A).
// Recebe { lote_id }, le cp_descarte_lotes + CPs do lote (RLS via Authorization) e imprime o termo:
// cabecalho do laboratorio, dados do lote (numero/data/responsavel/motivo), tabela dos CPs
// (numeracao, codigo, obra, concretagem, moldagem, laudo) e campos de assinatura.
// Self-contained (padrao generate-coleta-formas-pdf): verify_jwt + client anon com Authorization.
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { serverError } from '../_shared/response.ts';
import { RK, drawFooter } from '../_shared/report-kit.ts';

// --- Observabilidade (M1): registra cada invocacao em ef_invocation_log. Best-effort. ---
const _obsSvc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const _obsTrace = (req: Request): string | null => { try { const t = new URL(req.url).searchParams.get('trace_id'); return t ? t.slice(0, 128) : null; } catch { return null; } };
async function _obsActor(req: Request) { try { const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : ''; if (!tk || tk === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !tk.startsWith('eyJ')) return { actor_id: null, tenant_id: null }; const s = _obsSvc(); const { data: u, error } = await s.auth.getUser(tk); if (error || !u?.user) return { actor_id: null, tenant_id: null }; const { data: m } = await s.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); return m ? { actor_id: String(m.id), tenant_id: String(m.tenant_id) } : { actor_id: null, tenant_id: null }; } catch { return { actor_id: null, tenant_id: null }; } }
async function _obsFinalize(req: Request, o: { fnName: string; startedAt: string; durationMs: number; statusCode: number; errorMessage: string | null }) { try { const s = _obsSvc(); const actor = await _obsActor(req); const tr = _obsTrace(req); await s.rpc('log_ef_invocation', { p_fn_name: o.fnName, p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.errorMessage || null, p_actor_id: actor.actor_id, p_tenant_id: actor.tenant_id, p_request_id: req.headers.get('x-request-id') || req.headers.get('cf-ray') || crypto.randomUUID(), p_metadata: { method: req.method, path: new URL(req.url).pathname, ...(tr ? { trace_id: tr } : {}) } }); } catch { /* telemetria nunca bloqueia a EF */ } }
function serveWithTelemetry(fnName: string, handler: (req: Request) => Promise<Response> | Response) { Deno.serve(async (req: Request) => { const startedAt = new Date().toISOString(); const started = performance.now(); let statusCode = 500; let errorMessage: string | null = null; try { const res = await handler(req); statusCode = res.status; return res; } catch (e) { errorMessage = e instanceof Error ? e.message : String(e); statusCode = 500; throw e; } finally { const durationMs = performance.now() - started; const p = _obsFinalize(req, { fnName, startedAt, durationMs, statusCode, errorMessage }); try { const er = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void } | undefined; if (er?.waitUntil) er.waitUntil(p); else p.catch(() => {}); } catch { p.catch(() => {}); } } }); }

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const NAVY = rgb(0.094, 0.157, 0.388);
const INK = rgb(0.106, 0.137, 0.188);
const MUTED = rgb(0.361, 0.392, 0.451);
const LINE = rgb(0.85, 0.87, 0.90);

const dbr = (s: unknown) => { const t = String(s ?? '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '-'; const [y, m, d] = t.split('-'); return `${d}/${m}/${y}`; };
type Fonte = Awaited<ReturnType<PDFDocument['embedFont']>>;
function fit(font: Fonte, text: string, size: number, maxW: number): string {
  let t = String(text ?? '');
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
  return t;
}

serveWithTelemetry('generate-cp-descarte-pdf', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const loteId = String(body.lote_id ?? '');
    if (!loteId) return json({ error: 'lote_id obrigatorio' }, 400);
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return json({ error: 'nao autenticado' }, 401);
    const sb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ error: 'nao autenticado' }, 401);

    const { data: lote, error: e1 } = await sb.from('cp_descarte_lotes')
      .select('id, numero, data_descarte, motivo, total_cps, responsavel_id, created_at, tenants(name)')
      .eq('id', loteId).is('deleted_at', null).maybeSingle();
    if (e1) return json({ error: e1.message }, 403);
    if (!lote) return json({ error: 'lote nao encontrado' }, 404);

    let responsavel = '';
    if (lote.responsavel_id) {
      const { data: m } = await sb.from('members').select('full_name, email').eq('id', lote.responsavel_id).maybeSingle();
      responsavel = String((m as Record<string, unknown> | null)?.full_name ?? (m as Record<string, unknown> | null)?.email ?? '');
    }

    const { data: cps, error: e2 } = await sb.from('corpos_prova')
      .select('codigo, numeracao_lab, data_moldagem, localizacao, motivo_descarte, concretagens(codigo, client_works(nome))')
      .eq('descarte_lote_id', loteId).is('deleted_at', null).order('numeracao_lab');
    if (e2) return json({ error: e2.message }, 403);
    const rows = (cps ?? []) as Record<string, unknown>[];

    const labNome = String((lote.tenants as Record<string, unknown> | null)?.name ?? 'Laboratorio');

    const doc = await PDFDocument.create();
    doc.setTitle('Termo de descarte de corpos de prova'); doc.setProducer('Concresoft');
    const F = await doc.embedFont(StandardFonts.Helvetica);
    const FB = await doc.embedFont(StandardFonts.HelveticaBold);
    const PW = 595, PH = 842, MX = 40;
    let page = doc.addPage([PW, PH]);
    let y = PH - 46;
    let pageNo = 1;

    // Colunas: # | Numeracao | CP | Obra | Concretagem | Moldagem
    const cols = [
      { w: 22, t: '#' }, { w: 78, t: 'Numeracao' }, { w: 92, t: 'CP' },
      { w: 168, t: 'Obra' }, { w: 100, t: 'Concretagem' }, { w: 55, t: 'Moldagem' },
    ];
    const tableW = cols.reduce((s, c) => s + c.w, 0);

    const header = (comCabecalhoTabela: boolean) => {
      page.drawText(fit(FB, labNome, 13, PW - 2 * MX), { x: MX, y, size: 13, font: FB, color: NAVY }); y -= 20;
      page.drawText('TERMO DE DESCARTE DE CORPOS DE PROVA', { x: MX, y, size: 12, font: FB, color: INK }); y -= 15;
      page.drawText('Lote ' + String(lote.numero ?? '-') + '   ·   Data: ' + dbr(lote.data_descarte) + (responsavel ? '   ·   Responsavel: ' + responsavel : ''), { x: MX, y, size: 9, font: F, color: MUTED }); y -= 12;
      page.drawText(fit(F, 'Motivo: ' + String(lote.motivo ?? 'Descarte programado pos-laudo') + '   ·   ' + rows.length + ' corpo(s) de prova', 9, PW - 2 * MX), { x: MX, y, size: 9, font: F, color: MUTED }); y -= 8;
      page.drawLine({ start: { x: MX, y }, end: { x: PW - MX, y }, thickness: 1.2, color: RK.magenta }); y -= 14;
      if (comCabecalhoTabela) {
        let cx = MX;
        for (const c of cols) { page.drawText(c.t, { x: cx, y, size: 8, font: FB, color: NAVY }); cx += c.w; }
        y -= 5;
        page.drawLine({ start: { x: MX, y }, end: { x: MX + tableW, y }, thickness: 0.6, color: LINE }); y -= 11;
      }
    };
    header(true);

    rows.forEach((r, i) => {
      if (y < 120) {
        page = doc.addPage([PW, PH]); y = PH - 46; pageNo += 1; header(true);
      }
      const conc = (r.concretagens ?? {}) as Record<string, unknown>;
      const work = (conc.client_works ?? {}) as Record<string, unknown>;
      const vals = [
        String(i + 1), String(r.numeracao_lab ?? '-'), String(r.codigo ?? '-'),
        String(work.nome ?? '-'), String(conc.codigo ?? '-'), dbr(r.data_moldagem),
      ];
      let cx = MX;
      vals.forEach((v, ci) => { page.drawText(fit(F, v, 8, cols[ci].w - 6), { x: cx, y, size: 8, font: F, color: INK }); cx += cols[ci].w; });
      y -= 12;
      if ((i + 1) % 5 === 0) { page.drawLine({ start: { x: MX, y: y + 4 }, end: { x: MX + tableW, y: y + 4 }, thickness: 0.3, color: LINE }); }
    });

    // Bloco de declaracao + assinaturas na ultima pagina (quebra se nao couber).
    if (y < 150) { page = doc.addPage([PW, PH]); y = PH - 60; pageNo += 1; }
    y -= 14;
    const decl = 'Declaro que os corpos de prova relacionados acima, ja ensaiados e com resultados constantes em laudo emitido, foram descartados conforme o procedimento interno do laboratorio.';
    // wrap simples da declaracao em ~2 linhas
    const words = decl.split(' '); let linha = ''; const linhas: string[] = [];
    for (const w of words) { const cand = linha ? linha + ' ' + w : w; if (F.widthOfTextAtSize(cand, 9) > PW - 2 * MX) { linhas.push(linha); linha = w; } else { linha = cand; } }
    if (linha) linhas.push(linha);
    for (const l of linhas) { page.drawText(l, { x: MX, y, size: 9, font: F, color: INK }); y -= 12; }
    y -= 34;
    const half = (PW - 2 * MX - 30) / 2;
    page.drawLine({ start: { x: MX, y }, end: { x: MX + half, y }, thickness: 0.8, color: INK });
    page.drawLine({ start: { x: MX + half + 30, y }, end: { x: PW - MX, y }, thickness: 0.8, color: INK });
    y -= 11;
    page.drawText('Responsavel pelo descarte' + (responsavel ? ' — ' + fit(F, responsavel, 8, half - 130) : ''), { x: MX, y, size: 8, font: F, color: MUTED });
    page.drawText('Responsavel tecnico', { x: MX + half + 30, y, size: 8, font: F, color: MUTED });
    const pages = doc.getPages();
    drawFooter(pages, F, { x0: MX, x1: PW - MX, y: 16, nota: labNome, hoje: dbr(new Date().toISOString()) });
    const bytes = await doc.save();
    return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="termo-descarte-cps.pdf"', ...cors } });
  } catch (e) {
    return serverError(e, { req, fnName: 'generate-cp-descarte-pdf', action: 'relatorio.pdf:generate-cp-descarte-pdf' });
  }
});
