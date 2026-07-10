// generate-ficha-moldagem-pdf (GEOLAB) - FICHA DE MOLDAGEM (modelo A, paisagem) para preenchimento em campo.
// Modelo melhorado: logo dinamica do laboratorio (config_lab.logo_path), cabecalho branco, "Numero do relatorio",
// faixa "Plano de moldagem por caminhao" (do traco), coluna "CP por idade" (qtd x idade), dosagem simplificada
// (linha detalhada do traco so com concretagem_campos.ficha_dosagem; Contato/Equipe/Ref so com ficha_contato_equipe).
// Self-contained. pdf-lib (Helvetica, sem WOFF2). QR do concretagem_id (casamento deterministico no OCR). verify_jwt=true.
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import QRCode from 'npm:qrcode@1.5.3';
import { serverError } from '../_shared/response.ts';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const fail = (m: string, st = 400) => new Response(JSON.stringify({ ok: false, error: m }), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });
const userClient = (req: Request) => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } }, auth: { persistSession: false } });
const svc = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v));
const sane = (v: unknown) => s(v).replace(/[→➔➜]/g, '->').replace(/[–—]/g, '-').replace(/[^\x20-\xFF\n]/g, '?');
const ddmm = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const emb = (v: unknown): Row => (v && typeof v === 'object' ? v as Row : {});
const onOff = (cfg: Row, key: string, def: boolean) => (cfg[key] === undefined ? def : cfg[key] !== false);

// --- agregadores de CP por idade (qtd x idade) e plano de moldagem ---
const cpPorIdade = (cps: Row[]): string => {
  const norm = cps.map((c) => ({ d: Number(c.idade_dias) || 0, u: String(c.idade_unidade || 'dia').startsWith('hora') ? 'h' : 'd' }));
  norm.sort((a, b) => (a.u === b.u ? a.d - b.d : (a.u === 'h' ? -1 : 1)));
  const m: Array<[string, number]> = [];
  for (const { d, u } of norm) { const k = d + u; const e = m.find((x) => x[0] === k); if (e) e[1]++; else m.push([k, 1]); }
  return m.map(([k, c]) => c + String.fromCharCode(215) + k).join(' ');
};
const planoFromPadrao = (p: unknown): { txt: string; total: number } | null => {
  if (!Array.isArray(p) || !p.length) return null;
  const parts: string[] = []; let total = 0;
  for (const e0 of p) {
    const e = emb(e0);
    const q = Number(e.quantidadeCp ?? e.quantidade ?? e.qtd ?? 0) || 0;
    const idade = Number(e.idadeControle ?? e.idade ?? e.idade_dias ?? 0) || 0;
    const u = String(e.unidadeIdade ?? e.unidade ?? 'dias');
    if (!idade) continue;
    parts.push(q + String.fromCharCode(215) + idade + (u.startsWith('hora') ? 'h' : 'd'));
    total += q;
  }
  return parts.length ? { txt: parts.join('  '), total } : null;
};
const planoFromCps = (map: Map<string, Row[]>): { txt: string; total: number } | null => {
  for (const arr of map.values()) { if (arr && arr.length) return { txt: cpPorIdade(arr), total: arr.length }; }
  return null;
};

// ============================ DESENHO (puro) ============================
export async function buildFichaPdf(input: {
  blank: boolean; labName: string; rt: string; crea: string; qrData: string;
  logoBytes: Uint8Array | null; logoPng: boolean;
  conc: Row | null; om: Row; cams: Row[]; cpsByReceipt: Map<string, Row[]>;
  showContatoEquipe: boolean; showDosagemDet: boolean;
}): Promise<Uint8Array> {
  const { blank, labName, rt, crea, qrData, logoBytes, logoPng, conc, om, cams, cpsByReceipt, showContatoEquipe, showDosagemDet } = input;

  const pdf = await PDFDocument.create();
  const F = await pdf.embedFont(StandardFonts.Helvetica);
  const B = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 15;
  const page = pdf.addPage([W, H]);
  const navy = rgb(0.094, 0.157, 0.388), grid = rgb(0.13, 0.17, 0.23);
  const lbl = rgb(0.36, 0.42, 0.5), ink = rgb(0.06, 0.09, 0.13), band = rgb(0.93, 0.945, 0.965), nl = rgb(0.45, 0.52, 0.72);
  const refc = rgb(0.5, 0.55, 0.62);
  const lw = 0.8;
  const x0 = M, x1 = W - M, Wu = x1 - x0;

  const tW = (f: typeof F, t: string, sz: number) => f.widthOfTextAtSize(t, sz);
  const hl = (xa: number, xb: number, y: number, c = grid, w = lw) => page.drawLine({ start: { x: xa, y }, end: { x: xb, y }, thickness: w, color: c });
  const vl = (x: number, ya: number, yb: number, c = grid, w = lw) => page.drawLine({ start: { x, y: ya }, end: { x, y: yb }, thickness: w, color: c });
  const rect = (x: number, ytop: number, w: number, h: number, c = grid) => { hl(x, x + w, ytop, c); hl(x, x + w, ytop - h, c); vl(x, ytop - h, ytop, c); vl(x + w, ytop - h, ytop, c); };
  const fill = (x: number, ytop: number, w: number, h: number, c: ReturnType<typeof rgb>) => page.drawRectangle({ x, y: ytop - h, width: w, height: h, color: c });
  const txt = (x: number, y: number, t: string, sz: number, f = F, c = ink) => { if (t) page.drawText(sane(t), { x, y, size: sz, font: f, color: c }); };
  const txtC = (cx: number, y: number, t: string, sz: number, f = F, c = ink) => { if (t) page.drawText(sane(t), { x: cx - tW(f, sane(t), sz) / 2, y, size: sz, font: f, color: c }); };
  const wrap = (f: typeof F, t: string, sz: number, maxw: number) => { const ws = t.split(' '); const out: string[] = []; let cur = ''; for (const w of ws) { const tt = (cur + ' ' + w).trim(); if (tW(f, tt, sz) <= maxw - 3) cur = tt; else { if (cur) out.push(cur); cur = w; } } if (cur) out.push(cur); return out.length ? out : [t]; };
  const lbox = (x: number, ytop: number, w: number, h: number, label: string, value = '', vsize = 8.5) => {
    rect(x, ytop, w, h); txt(x + 3, ytop - 6.6, label.toUpperCase(), 5.6, F, lbl);
    if (value) for (const ln of wrap(F, value, vsize, w)) { txt(x + 4, ytop - h + 5, ln, vsize, F, ink); break; }
  };
  // desenha uma linha de celulas e devolve a geometria de cada celula (para overlays)
  const rowCells = (x: number, ytop: number, w: number, h: number, items: [string, number, string?][]) => {
    const tot = items.reduce((a, it) => a + it[1], 0); let cx = x; const geo: { x: number; w: number }[] = [];
    for (const [label, wt, val] of items) { const cw = w * wt / tot; lbox(cx, ytop, cw, h, label, val ?? ''); geo.push({ x: cx, w: cw }); cx += cw; }
    return geo;
  };
  const checkbox = (x: number, y: number, label: string, on = false, sz = 7, fs = 6) => { rect(x, y + sz, sz, sz); if (on) { txt(x + 1.1, y + 1.0, 'X', 6.4, B, ink); } txt(x + sz + 3, y + 1.1, label, fs, F, ink); return x + sz + 3 + tW(F, label, fs) + 9; };

  let logoImg: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  if (logoBytes) { try { logoImg = logoPng ? await pdf.embedPng(logoBytes) : await pdf.embedJpg(logoBytes); } catch { logoImg = null; } }

  let y = H - M;
  // ---------- cabecalho (branco) ----------
  if (logoImg) { const iw = logoImg.width, ih = logoImg.height; const sc = Math.min(150 / iw, 30 / ih); page.drawImage(logoImg, { x: x0, y: y - 4 - ih * sc, width: iw * sc, height: ih * sc }); }
  else { txt(x0, y - 18, labName, 12, B, navy); }
  txtC(x0 + Wu / 2, y - 14, 'CONTROLE DE MOLDAGEM DE CORPOS DE PROVA', 13.5, B, navy);
  txtC(x0 + Wu / 2, y - 25, 'Ficha de moldagem de corpos de prova cilindricos - ABNT NBR 5739', 7, F, lbl);
  // QR (canto sup. direito) + bloco Cod./NBR a esquerda do QR
  const qb = 40; const qx = x1 - qb;
  if (!blank && qrData) {
    try { const qr = QRCode.create(qrData, { errorCorrectionLevel: 'M' }); const nn = qr.modules.size, d = qr.modules.data, qsz = qb, mod = qsz / nn, ox = qx, oy = y - qsz; for (let r = 0; r < nn; r++) for (let c2 = 0; c2 < nn; c2++) if (d[r * nn + c2]) page.drawRectangle({ x: ox + c2 * mod, y: oy + (nn - 1 - r) * mod, width: mod + 0.2, height: mod + 0.2, color: ink }); } catch { /* QR opcional */ }
  } else { rect(qx, y, qb, qb, nl); txtC(qx + qb / 2, y - 16, 'QR', 5.2, F, lbl); txtC(qx + qb / 2, y - 24, 'concretagem', 4.4, F, lbl); }
  const codLines = ['Cod.: FO-CIV ____  Rev. ___', 'NBR 5738 / 5739 / 16886 / 16889', 'NBR 12655 / 16868-2'];
  let cyc = y - 7; for (const ln of codLines) { page.drawText(ln, { x: qx - 8 - tW(F, ln, 5.4), y: cyc, size: 5.4, font: F, color: refc }); cyc -= 8; }
  y -= 44;
  hl(x0, x1, y, navy, 1.5); y -= 7;

  // ---------- valores ----------
  const cli = emb(conc?.lab_clients), obra = emb(conc?.client_works);
  const v_interessado = blank ? '' : (s(cli.razao_social) || s(cli.nome_fantasia));
  const v_obra = blank ? '' : s(obra.nome);
  const v_serv = blank ? '' : 'Moldagem e ensaio a compressao (NBR 5739)';
  const v_data = blank ? '' : ddmm(s(conc?.data_real || conc?.data_programada));
  const v_hora = blank ? '' : s(conc?.hora_programada);
  const v_rel = blank ? '' : s(conc?.numero_relatorio);
  const v_central = blank ? '' : s(conc?.fornecedor_texto);
  const v_lanc = blank ? '' : (conc?.bombeado ? 'Bombeado' : conc?.bombeado === false ? 'Convencional' : '');
  const v_fck = blank ? '' : (s(om.fck_mpa) || '');
  const v_vol = blank ? '' : s(conc?.volume_programado_m3);
  const v_slump = (om.slump_previsto_cm != null) ? (s(om.slump_previsto_cm) + ' ' + String.fromCharCode(177) + ' ' + s(om.slump_tolerancia_cm ?? 0)) : ('________  ' + String.fromCharCode(177) + '  ________');

  const rh = 24;
  if (showContatoEquipe) rowCells(x0, y, Wu, rh, [['Interessado (cliente)', 3.0, v_interessado], ['Contato', 1.5], ['Equipe', 1.0], ['Ref.', 1.0], ['Data da moldagem', 1.5, v_data]]);
  else rowCells(x0, y, Wu, rh, [['Interessado (cliente)', 4.5, v_interessado], ['Data da moldagem', 1.5, v_data]]);
  y -= rh;
  rowCells(x0, y, Wu, rh, [['Obra', 3.0, v_obra], ['Hora agendada', 1.2, v_hora], ['Horario do acompanhamento:  das ______ as ______ h', 3.0], ['Numero do relatorio', 1.8, v_rel]]);
  y -= rh;
  rowCells(x0, y, Wu, rh, [['Servicos / normas', 3.0, v_serv], ['Laboratorio', 2.0, labName], ['Responsavel tecnico / CREA', 2.5, (rt ? rt + (crea ? ' - ' + crea : '') : '')]]);
  y -= rh;

  // ---------- dados da dosagem (linha simples) ----------
  const bh = 13; fill(x0, y, Wu, bh, band); rect(x0, y, Wu, bh); txt(x0 + 5, y - bh + 3.6, 'DADOS DA DOSAGEM', 6.6, B, navy); y -= bh;
  const g = rowCells(x0, y, Wu, rh, [['Central', 1.8, v_central], ['Lancamento', 1.3, v_lanc], ['Tipo', 1.7], ['Resist. caract. (MPa)', 1.3, v_fck], ['Abatimento espec. (mm)', 1.6], ['Volume total (m3)', 1.2, v_vol], ['Amostragem', 1.5]]);
  { const c = g[2]; let cxk = checkbox(c.x + 3, y - rh + 5.5, 'FCK concreto', !blank, 7, 5.8); cxk = checkbox(cxk - 3, y - rh + 5.5, 'FAK arg.', false, 7, 5.8); checkbox(cxk - 3, y - rh + 5.5, 'FGK graute', false, 7, 5.8); }
  { const c = g[4]; txt(c.x + 6, y - rh + 6, v_slump, 8.5, F, ink); }
  { const c = g[6]; let cxa = checkbox(c.x + 4, y - rh + 6, 'Total', false, 7, 6.0); checkbox(cxa - 2, y - rh + 6, 'Parcial', false, 7, 6.0); }
  y -= rh;

  // ---------- dosagem detalhada (so com ficha_dosagem) ----------
  if (showDosagemDet) {
    const v_cim = blank ? '' : s(om.cimento_tipo);
    const v_cons = (om.consumo_cimento_kg_m3 != null) ? s(om.consumo_cimento_kg_m3) + ' kg/m3' : '';
    const v_ac = (om.fator_ac != null) ? s(om.fator_ac) : '';
    const v_brita = blank ? '' : s(om.brita);
    const v_dmax = (om.dmax_agregado_mm != null) ? s(om.dmax_agregado_mm) + ' mm' : '';
    const v_adit = blank ? '' : s(om.aditivo_tipo);
    rowCells(x0, y, Wu, rh, [['Cimento (marca/tipo)', 2.0, v_cim], ['Consumo cimento', 1.4, v_cons], ['Fator a/c', 1.0, v_ac], ['Brita / agregado', 1.4, v_brita], ['D. max. agreg.', 1.2, v_dmax], ['Aditivo', 1.6, v_adit], ['Cura', 1.4]]);
    y -= rh;
  }

  // ---------- plano de moldagem por caminhao ----------
  const plano = planoFromPadrao(om.padrao_moldagem) ?? planoFromCps(cpsByReceipt);
  const planoTxt = plano ? ('PLANO DE MOLDAGEM POR CAMINHAO (CP por idade):   ' + plano.txt + '    =    ' + plano.total + ' CP/caminhao') : 'PLANO DE MOLDAGEM POR CAMINHAO (CP por idade):   definido pelo traco / a preencher';
  const pbh = 13; fill(x0, y, Wu, pbh, band); rect(x0, y, Wu, pbh); txt(x0 + 5, y - pbh + 3.8, planoTxt, 7, B, navy); y -= pbh;

  // ---------- grade ----------
  type GNode = { label: string; w?: number | null; children?: GNode[] };
  const lf = (l: string, w: number): GNode => ({ label: l, w });
  const tree: GNode[] = [
    { label: 'CARACTERISTICAS DAS AMOSTRAS', children: [lf('Serie no', 26), lf('Qtde CPs', 30), lf('Abat. (mm)', 34), lf('Nota Fiscal no', 74), lf('Horario moldagem', 54)] },
    { label: 'DADOS DA MOLDAGEM', children: [
      { label: 'TRANSPORTE', children: [lf('Inicio da mistura', 50), lf('Chegada a obra', 50)] },
      { label: 'DESCARGA', children: [lf('Inicio', 46), lf('Termino', 46)] },
      lf('Tempo total (h:min)', 46),
      { label: 'Concreto aplicado (m3)', children: [lf('Unit.', 38), lf('Acum.', 38)] }] },
    lf('C.B. no', 36),
    { label: 'Amostragem ( ) Total ( ) Parcial - Elementos concretados', w: null },
    lf('CP por idade', 62),
  ];
  const leavesOf = (n: GNode): GNode[] => (n.children ? n.children.flatMap(leavesOf) : [n]);
  const depthOf = (n: GNode, l = 0): number => (n.children ? Math.max(...n.children.map((c) => depthOf(c, l + 1))) : l + 1);
  const allLeaves = tree.flatMap(leavesOf);
  const fixed = allLeaves.reduce((a, l) => a + (l.w || 0), 0); const nflex = allLeaves.filter((l) => !l.w).length;
  const flexW = nflex ? (Wu - fixed) / nflex : 0;
  for (const l of allLeaves) (l as Row)._w = l.w || flexW;
  const setW = (n: GNode): number => { (n as Row)._w = n.children ? n.children.reduce((a, c) => a + setW(c), 0) : (n as Row)._w as number; return (n as Row)._w as number; };
  for (const n of tree) setW(n);
  const depth = Math.max(...tree.map((n) => depthOf(n)));
  const bandH = 12.5; const hdrH = depth * bandH;
  const drawNode = (n: GNode, x: number, ytop: number, lvl: number) => {
    const w = (n as Row)._w as number;
    if (n.children) { fill(x, ytop, w, bandH, navy); rect(x, ytop, w, bandH, nl); for (const ln of wrap(B, n.label, 6, w)) { txtC(x + w / 2, ytop - bandH / 2 - 1.5, ln, 6, B, rgb(1, 1, 1)); break; } let cx = x; for (const c of n.children) { drawNode(c, cx, ytop - bandH, lvl + 1); cx += (c as Row)._w as number; } }
    else { const h = (depth - lvl) * bandH; fill(x, ytop, w, h, navy); rect(x, ytop, w, h, nl); const ls = wrap(B, n.label, 6, w); let yy = ytop - h / 2 + (ls.length * 7) / 2 - 5.4; for (const ln of ls) { txtC(x + w / 2, yy, ln, 6, B, rgb(1, 1, 1)); yy -= 7; } }
  };
  let cxn = x0; for (const n of tree) { drawNode(n, cxn, y, 0); cxn += (n as Row)._w as number; }
  const yRows = y - hdrH;
  const leafX = [x0]; let acc = x0; for (const l of allLeaves) { acc += (l as Row)._w as number; leafX.push(acc); }
  const rows = showDosagemDet ? 12 : 14, rowh = 20.5;
  let accVol = 0;
  const rowVals: string[][] = [];
  for (let i = 0; i < cams.length && i < rows; i++) {
    const cm = cams[i]; const cps = cpsByReceipt.get(s(cm.id)) ?? [];
    const qtde = cps.length ? String(cps.length) : '';
    const cppi = cps.length ? cpPorIdade(cps) : '';
    const vol = cm.volume_m3 != null ? Number(cm.volume_m3) : null; if (vol != null) accVol += vol;
    rowVals.push([s(cm.serie), qtde, s(cm.slump_medido_cm), s(cm.nota_fiscal), s(cm.hora_moldagem), s(cm.hora_saida_usina), s(cm.hora_chegada_obra), s(cm.hora_inicio_descarga), s(cm.hora_fim_descarga), '', vol != null ? String(vol) : '', vol != null ? accVol.toFixed(1) : '', s(cm.serie), s(cm.elementos_concretados), cppi]);
  }
  let yb = yRows;
  for (let i = 0; i < rows; i++) { rect(x0, yb, Wu, rowh); const rv = rowVals[i]; if (rv) for (let k = 0; k < allLeaves.length; k++) { const v = rv[k]; if (v) txt(leafX[k] + 2.5, yb - rowh + 5.5, v, 7, F, ink); } yb -= rowh; }
  for (const xx of leafX) vl(xx, yb, yRows);
  if (blank) txtC((leafX[leafX.length - 2] + leafX[leafX.length - 1]) / 2, yRows - rowh + 3.0, 'ex.: 2x7d 2x28d 2x63d', 5.0, F, lbl);
  y = yb;

  // ---------- rodape ----------
  const fh = 50;
  const obsw = Wu * 0.40; lbox(x0, y, obsw, fh, 'Observacoes');
  const dimx = x0 + obsw, dimw = Wu * 0.34; rect(dimx, y, dimw, fh); txt(dimx + 4, y - 9, 'DIMENSOES DOS CORPOS DE PROVA (mm)', 5.8, F, lbl);
  const dims = ['100 x 200', '150 x 300', '100 x 100 x 400', '150 x 150 x 500', '50 x 100', '40 x 40 x 40'];
  for (let col = 0; col < 2; col++) for (let r = 0; r < 3; r++) { const idx = col * 3 + r; if (idx < dims.length) checkbox(dimx + 8 + col * (dimw / 2), (y - 20 - r * 11) - 0, dims[idx], false, 8, 6.6); }
  const sigx = dimx + dimw, sigw = Wu - (sigx - x0), sh = fh / 2;
  lbox(sigx, y, sigw, sh, 'Responsavel (nome / funcao)'); txt(sigx + sigw - 5 - tW(F, 'Visto: __________________', 5.6), y - sh + 4, 'Visto: __________________', 5.6, F, lbl);
  lbox(sigx, y - sh, sigw, sh, 'Moldador (nome)'); txt(sigx + sigw - 5 - tW(F, 'Visto: __________________', 5.6), y - fh + 4, 'Visto: __________________', 5.6, F, lbl);

  txt(x0, M - 5, sane(labName + ' - app.concresoft.io - ' + (blank ? 'ficha em branco' : 'ficha pre-preenchida') + ' (preenchimento em campo, leitura por OCR).'), 4.8, F, lbl);
  page.drawText('Modelo A (Classica)', { x: x1 - tW(F, 'Modelo A (Classica)', 4.8), y: M - 5, size: 4.8, font: F, color: lbl });

  return await pdf.save();
}

// telemetria inline (best-effort)
async function logEf(req: Request, o: { startedAt: string; durationMs: number; statusCode: number; err: string | null }) {
  try {
    const a = req.headers.get('Authorization') || ''; const tk = a.startsWith('Bearer ') ? a.slice(7).trim() : '';
    const sb = svc(); let actor: string | null = null, tenant: string | null = null;
    if (tk && tk.startsWith('eyJ')) { const { data: u } = await sb.auth.getUser(tk); if (u?.user) { const { data: m } = await sb.from('members').select('id,tenant_id').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); if (m) { actor = String(m.id); tenant = String(m.tenant_id); } } }
    await sb.rpc('log_ef_invocation', { p_fn_name: 'generate-ficha-moldagem-pdf', p_started_at: o.startedAt, p_duration_ms: Math.max(0, Math.round(o.durationMs)), p_status_code: o.statusCode, p_error: o.err, p_actor_id: actor, p_tenant_id: tenant, p_request_id: req.headers.get('x-request-id') || crypto.randomUUID(), p_metadata: { path: '/generate-ficha-moldagem-pdf' } });
  } catch { /* nunca bloqueia */ }
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const startedAt = new Date().toISOString(); const t0 = performance.now();
  const done = (res: Response, err: string | null = null) => { const p = logEf(req, { startedAt, durationMs: performance.now() - t0, statusCode: res.status, err }); try { (globalThis as Record<string, unknown>).EdgeRuntime && ((globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (x: Promise<unknown>) => void }).waitUntil?.(p); } catch { p.catch(() => {}); } return res; };
  try {
    const body = await req.json().catch(() => ({})) as Row;
    const concId = s(body.concretagem_id);
    const blank = !concId || s(body.mode) === 'blank';
    const db = userClient(req);

    let conc: Row | null = null; let cams: Row[] = []; const cpsByReceipt = new Map<string, Row[]>();
    let labName = 'LABORATORIO'; let rt = ''; let crea = ''; let qrData = ''; let om: Row = {};
    let concCampos: Row = {}; let logoBytes: Uint8Array | null = null; let logoPng = true;

    const loadCfg = async (tenantId: string) => {
      const { data: cfg } = await db.from('config_lab').select('responsavel_tecnico, crea_rt, logo_path, concretagem_campos').eq('tenant_id', tenantId).maybeSingle();
      rt = s(cfg?.responsavel_tecnico); crea = s(cfg?.crea_rt); concCampos = emb(cfg?.concretagem_campos);
      if (cfg?.logo_path) { try { const dl = await svc().storage.from('lab-reports').download(String(cfg.logo_path)); if (dl.data) { logoBytes = new Uint8Array(await dl.data.arrayBuffer()); const lp = String(cfg.logo_path).toLowerCase(); logoPng = !(lp.endsWith('.jpg') || lp.endsWith('.jpeg')); } } catch { logoBytes = null; } }
    };

    if (!blank) {
      const { data: c, error } = await db.from('concretagens')
        .select('id, tenant_id, codigo, numero_relatorio, data_real, data_programada, hora_programada, fornecedor_texto, traco_texto, local_texto, bombeado, volume_programado_m3, dimensao_cp, tenants(name), client_works(nome, codigo), lab_clients(razao_social, nome_fantasia), operational_materials(nome, fck_mpa, padrao_moldagem, cimento_tipo, consumo_cimento_kg_m3, fator_ac, brita, dmax_agregado_mm, aditivo_tipo, slump_previsto_cm, slump_tolerancia_cm)')
        .eq('id', concId).is('deleted_at', null).maybeSingle();
      if (error) return done(fail(error.message, 500));
      if (!c) return done(fail('Concretagem nao encontrada (ou sem acesso).', 404));
      conc = c as Row; labName = s(emb(conc.tenants).name) || labName; qrData = s(conc.id); om = emb(conc.operational_materials);
      await loadCfg(s(conc.tenant_id));
      const { data: mr } = await db.from('material_receipts').select('id, serie, nota_fiscal, slump_medido_cm, volume_m3, hora_moldagem, hora_saida_usina, hora_chegada_obra, hora_inicio_descarga, hora_fim_descarga, elementos_concretados').eq('concretagem_id', concId).is('deleted_at', null).order('serie');
      cams = (mr ?? []) as Row[];
      const { data: cps } = await db.from('corpos_prova').select('receipt_id, idade_dias, idade_unidade').eq('concretagem_id', concId).is('deleted_at', null);
      for (const cp of (cps ?? []) as Row[]) { const k = s(cp.receipt_id); const a = cpsByReceipt.get(k) ?? []; a.push(cp); cpsByReceipt.set(k, a); }
    } else {
      const { data: u } = await db.auth.getUser();
      if (u?.user) { const { data: m } = await db.from('members').select('tenant_id, tenants(name)').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); if (m) { labName = s(emb(m.tenants).name) || labName; await loadCfg(s(m.tenant_id)); } }
    }

    const bytes = await buildFichaPdf({
      blank, labName, rt, crea, qrData, logoBytes, logoPng, conc, om, cams, cpsByReceipt,
      showContatoEquipe: onOff(concCampos, 'ficha_contato_equipe', false),
      showDosagemDet: onOff(concCampos, 'ficha_dosagem', false),
    });
    return done(new Response(bytes, { headers: { 'access-control-allow-origin': '*', 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="ficha-moldagem.pdf"' } }));
  } catch (e) {
    return done(serverError(e, { req, fnName: 'generate-ficha-moldagem-pdf', action: 'relatorio.pdf:generate-ficha-moldagem-pdf' }), e instanceof Error ? e.message : 'erro desconhecido');
  }
}

Deno.serve(handler);
