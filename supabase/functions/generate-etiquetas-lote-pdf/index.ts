// generate-etiquetas-lote-pdf (Concresoft) — etiquetas adesivas em branco, PRÉ-NUMERADAS.
// Difere da generate-etiquetas-cp-pdf: aqui NÃO há CP nem concretagem obrigatória. O lote reserva
// uma faixa contígua NNNNNN/AA (RPC gerar_etiquetas / migration 140) e esta EF imprime a faixa como
// "estoque" que o moldador cola no molde em campo (o número vira depois o numeracao_lab do CP).
// Cada etiqueta: número grande NNNNNN/AA, QR vetorial do código (leitor USB digita o número),
// nome do laboratório; quando o lote é de uma concretagem, imprime também obra + nº do relatório.
// Dois layouts: 'rolo' (60x40mm, 1/pagina — termica) e 'a4' (21/folha, 63,5x38,1, 3x7 — Avery/Pimaco).
// Self-contained (padrao generate-etiquetas-cp-pdf): verify_jwt + client anon com Authorization (RLS decide).
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import QRCode from 'npm:qrcode@1.5.3';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const MM = 72 / 25.4;
const NAVY = rgb(0.094, 0.157, 0.388);
const INK = rgb(0.106, 0.137, 0.188);
const MUTED = rgb(0.361, 0.392, 0.451);
const FAINT = rgb(0.545, 0.576, 0.643);

type Fonte = Awaited<ReturnType<PDFDocument['embedFont']>>;
type Etq = { code: string; lab: string; obra: string; rel: string };

function fit(font: Fonte, text: string, size: number, maxW: number): string {
  let t = String(text ?? '');
  while (t.length > 2 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
  return t;
}

function drawLabel(page: ReturnType<PDFDocument['addPage']>, F: Fonte, FB: Fonte, x: number, y: number, w: number, h: number, d: Etq) {
  const m = 2 * MM;
  const qs = Math.min(19 * MM, h - 2 * m);
  const qx = x + w - m - qs;
  const qy = y + h - m - qs;
  try {
    const qr = QRCode.create(d.code, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size, data = qr.modules.data, mod = qs / n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (data[r * n + c]) page.drawRectangle({ x: qx + c * mod, y: qy + (n - 1 - r) * mod, width: mod + 0.15, height: mod + 0.15, color: INK });
  } catch { /* QR opcional */ }

  const lx = x + m;
  const lw = qx - lx - 1.5 * MM;
  // Nome do laboratorio no topo.
  const ty = y + h - m - 7;
  if (d.lab) { page.drawText(fit(FB, d.lab, 8, lw), { x: lx, y: ty, size: 8, font: FB, color: NAVY }); }
  // Numero grande NNNNNN/AA.
  const [nn, aa] = String(d.code).split('/');
  let ny = ty - 22;
  page.drawText(nn ?? '-', { x: lx, y: ny, size: 21, font: FB, color: INK });
  const nnw = FB.widthOfTextAtSize(nn ?? '-', 21);
  page.drawText('/' + (aa ?? ''), { x: lx + nnw + 1.5, y: ny, size: 11, font: FB, color: MUTED });
  // Obra + relatorio (so nos lotes de concretagem).
  if (d.obra) { ny -= 11; page.drawText(fit(FB, d.obra, 7.5, lw + qs), { x: lx, y: ny, size: 7.5, font: FB, color: NAVY }); }
  if (d.rel) { ny -= 9; page.drawText(fit(F, 'Relatorio ' + d.rel, 7, lw + qs), { x: lx, y: ny, size: 7, font: F, color: INK }); }
  // Codigo fraco no rodape (leitura de apoio).
  page.drawText(fit(F, d.code, 5.5, w - 2 * m), { x: lx, y: y + m - 1, size: 5.5, font: F, color: FAINT });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const loteId = String(body.lote_id ?? '');
    const layout = String(body.layout ?? 'rolo') === 'a4' ? 'a4' : 'rolo';
    if (!loteId) return json({ error: 'lote_id obrigatorio' }, 400);
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const authz = req.headers.get('Authorization') ?? '';
    if (!authz) return json({ error: 'nao autenticado' }, 401);
    const sb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authz } }, auth: { persistSession: false } });
    const { data: ures } = await sb.auth.getUser();
    if (!ures?.user) return json({ error: 'nao autenticado' }, 401);

    const { data: lote, error: e1 } = await sb.from('etiqueta_lotes')
      .select('id, tenant_id, origem, concretagem_id, ano, seq_inicial, seq_final, total, tenants(name)')
      .eq('id', loteId).is('deleted_at', null).maybeSingle();
    if (e1) return json({ error: e1.message }, 403);
    if (!lote) return json({ error: 'lote nao encontrado' }, 404);

    const ini = Number(lote.seq_inicial), fim = Number(lote.seq_final);
    if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim < ini) return json({ error: 'faixa invalida' }, 422);
    const yy = String(Number(lote.ano)).slice(-2);
    const labNome = String((lote.tenants as Record<string, unknown> | null)?.name ?? '');

    let obra = '', rel = '';
    if (lote.concretagem_id) {
      const { data: conc } = await sb.from('concretagens')
        .select('codigo, numero_relatorio, client_works(nome)')
        .eq('id', String(lote.concretagem_id)).is('deleted_at', null).maybeSingle();
      if (conc) {
        obra = String((conc.client_works as Record<string, unknown> | null)?.nome ?? '');
        rel = String(conc.numero_relatorio ?? conc.codigo ?? '');
      }
    }

    const etqs: Etq[] = [];
    for (let s = ini; s <= fim; s++) etqs.push({ code: String(s).padStart(6, '0') + '/' + yy, lab: labNome, obra, rel });

    const doc = await PDFDocument.create();
    doc.setTitle('Etiquetas ' + String(ini).padStart(6, '0') + '-' + String(fim).padStart(6, '0') + '/' + yy); doc.setProducer('Concresoft');
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
      for (let i = 0; i < etqs.length; i++) {
        const x = MXX + col * (LW + GAPX);
        const y = PH - MYY - (row + 1) * LH;
        drawLabel(page, F, FB, x, y, LW, LH, etqs[i]);
        col++; if (col === 3) { col = 0; row++; }
        if (row === 7 && i < etqs.length - 1) { page = doc.addPage([PW, PH]); row = 0; }
      }
    }

    const bytes = await doc.save();
    const fname = 'etiquetas-' + String(ini).padStart(6, '0') + '-' + String(fim).padStart(6, '0') + '-' + layout + '.pdf';
    return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="' + fname + '"', ...cors } });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
