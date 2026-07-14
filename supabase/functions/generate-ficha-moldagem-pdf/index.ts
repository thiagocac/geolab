// generate-ficha-moldagem-pdf (GEOLAB) - FICHA DE MOLDAGEM (modelo A, paisagem) para preenchimento em campo.
// Modelo melhorado: logo dinamica do laboratorio (config_lab.logo_path), cabecalho branco, "Numero do relatorio",
// faixa "Plano de moldagem por caminhao" (do traco), coluna "CP por idade" (qtd x idade), dosagem simplificada
// (linha detalhada do traco so com concretagem_campos.ficha_dosagem; Contato/Equipe/Ref so com ficha_contato_equipe).
// Self-contained. pdf-lib (Helvetica, sem WOFF2). QR do topo removido (sem utilidade na ficha). verify_jwt=true.
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
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
// --- faixa de numeracao fisica dos CPs de uma amostra (min-max) ---
const cpTail = (code: string): string => { let i = code.length; while (i > 0 && code[i - 1] >= '0' && code[i - 1] <= '9') i--; return code.slice(i); };
const isNum = (v: string): boolean => v.length > 0 && Array.from(v).every((ch) => ch >= '0' && ch <= '9');
const cpRange = (cps: Row[]): string => {
  const labs = cps.map((c) => s(c.numeracao_lab).trim()).filter((v) => v);
  const srcv = labs.length ? labs : cps.map((c) => cpTail(s(c.codigo))).filter((v) => v);
  if (!srcv.length) return '';
  const uniq = Array.from(new Set(srcv));
  if (uniq.every(isNum)) { const so = uniq.slice().sort((a, b) => Number(a) - Number(b)); return so[0] === so[so.length - 1] ? so[0] : so[0] + '-' + so[so.length - 1]; }
  const ss = uniq.slice().sort();
  return ss.length === 1 ? ss[0] : ss[0] + '-' + ss[ss.length - 1];
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

const FICHA_DEF: Record<string, boolean> = { logo:true, subtitulo_nbr:true, codigo_formulario:true, normas_ref:true, numero_relatorio:true, numero_ficha:true, hora_agendada:true, horario_acompanhamento:true, servicos_normas:true, traco:true, responsavel_tecnico:true, contato_equipe:false, bloco_dosagem:true, central:true, lancamento:true, tipo:true, resist_caract:true, abatimento_espec:true, volume_total:true, amostragem:true, dosagem_detalhada:false, plano_moldagem:true, col_numeracao_cp:true, col_abatimento:true, col_transporte:true, col_descarga:true, col_tempo_total:true, col_qtd_concreto:true, col_cb:true, col_elementos:true, rodape_dimensoes:true, rodape_observacoes:true, rodape_vistos:true };

// ============================ DESENHO (puro) ============================
export async function buildFichaPdf(input: {
  blank: boolean; labName: string; rt: string; crea: string;
  logoBytes: Uint8Array | null; logoPng: boolean;
  conc: Row | null; om: Row; cams: Row[]; cpsByReceipt: Map<string, Row[]>;
  fc: Row;
}): Promise<Uint8Array> {
  const { blank, labName, rt, crea, logoBytes, logoPng, conc, om, cams, cpsByReceipt, fc } = input;
  const on = (k: string): boolean => { const v = fc[k]; return v === undefined ? (FICHA_DEF[k] ?? true) : v !== false; };

  const pdf = await PDFDocument.create();
  const F = await pdf.embedFont(StandardFonts.Helvetica);
  const B = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 15;
  const page = pdf.addPage([W, H]);
  const navy = rgb(0.094, 0.157, 0.388), grid = rgb(0.13, 0.17, 0.23);
  const lbl = rgb(0.36, 0.42, 0.5), ink = rgb(0.06, 0.09, 0.13), band = rgb(0.93, 0.945, 0.965), nl = rgb(0.45, 0.52, 0.72);
  const refc = rgb(0.5, 0.55, 0.62), hdrbg = rgb(0.86, 0.9, 0.96);
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
  if (logoImg && on('logo')) { const iw = logoImg.width, ih = logoImg.height; const sc = Math.min(150 / iw, 30 / ih); page.drawImage(logoImg, { x: x0, y: y - 4 - ih * sc, width: iw * sc, height: ih * sc }); }
  else { txt(x0, y - 18, labName, 12, B, navy); }
  txtC(x0 + Wu / 2, y - 14, 'CONTROLE DE MOLDAGEM DE CORPOS DE PROVA', 13.5, B, navy);
  if (on('subtitulo_nbr')) txtC(x0 + Wu / 2, y - 25, 'Ficha de moldagem de corpos de prova cilindricos - ABNT NBR 5739', 7, F, lbl);
  const codLines: string[] = [];
  if (on('codigo_formulario')) codLines.push('Cod.: FO-CIV ____  Rev. ___');
  if (on('normas_ref')) { codLines.push('NBR 5738 / 5739 / 16886 / 16889'); codLines.push('NBR 12655 / 16868-2'); }
  let cyc = y - 7; for (const ln of codLines) { page.drawText(ln, { x: x1 - tW(F, ln, 5.4), y: cyc, size: 5.4, font: F, color: refc }); cyc -= 8; }
  y -= 44;
  hl(x0, x1, y, navy, 1.5); y -= 7;

  const cli = emb(conc?.lab_clients), obra = emb(conc?.client_works);
  const v_interessado = blank ? '' : (s(cli.razao_social) || s(cli.nome_fantasia));
  const v_obra = blank ? '' : s(obra.nome);
  const v_serv = blank ? '' : 'Moldagem e ensaio a compressao (NBR 5739)';
  const v_traco = blank ? '' : (s(om.nome) || s(conc?.traco_texto));
  const v_data = blank ? '' : ddmm(s(conc?.data_real || conc?.data_programada));
  const v_hora = blank ? '' : s(conc?.hora_programada);
  const v_rel = blank ? '' : s(conc?.numero_relatorio);
  const v_ficha = blank ? '' : s(conc?.codigo);
  const v_central = blank ? '' : s(conc?.fornecedor_texto);
  const v_lanc = blank ? '' : (conc?.bombeado ? 'Bombeado' : conc?.bombeado === false ? 'Convencional' : '');
  const v_fck = blank ? '' : (s(om.fck_mpa) || '');
  const v_vol = blank ? '' : s(conc?.volume_programado_m3);
  const v_slump = (om.slump_previsto_mm != null) ? (s(om.slump_previsto_mm) + ' ' + String.fromCharCode(177) + ' ' + s(om.slump_tolerancia_mm ?? 0)) : ('________  ' + String.fromCharCode(177) + '  ________');

  const rh = 24;
  if (on('contato_equipe')) rowCells(x0, y, Wu, rh, [['Interessado (cliente)', 3.0, v_interessado], ['Contato', 1.5], ['Equipe', 1.0], ['Ref.', 1.0], ['Data da moldagem', 1.5, v_data]]);
  else rowCells(x0, y, Wu, rh, [['Interessado (cliente)', 4.5, v_interessado], ['Data da moldagem', 1.5, v_data]]);
  y -= rh;
  const r2: [string, number, string?][] = [['Obra', 3.0, v_obra]];
  if (on('hora_agendada')) r2.push(['Hora agendada', 1.2, v_hora]);
  if (on('horario_acompanhamento')) r2.push(['Horario do acompanhamento:  das ______ as ______ h', 3.0]);
  if (on('numero_relatorio')) r2.push(['Numero do relatorio', 1.8, v_rel]);
  if (on('numero_ficha')) r2.push(['Ficha No', 1.4, v_ficha]);
  rowCells(x0, y, Wu, rh, r2); y -= rh;
  const r3: [string, number, string?][] = [];
  if (on('servicos_normas')) r3.push(['Servicos / normas', 2.4, v_serv]);
  if (on('traco')) r3.push(['Traço', 2.4, v_traco]);
  r3.push(['Laboratorio', 1.5, labName]);
  if (on('responsavel_tecnico')) r3.push(['Responsavel tecnico / CREA', 2.0, (rt ? rt + (crea ? ' - ' + crea : '') : '')]);
  rowCells(x0, y, Wu, rh, r3); y -= rh;

  if (on('bloco_dosagem')) {
    const bh = 13; fill(x0, y, Wu, bh, band); rect(x0, y, Wu, bh); txt(x0 + 5, y - bh + 3.6, 'DADOS DA DOSAGEM', 6.6, B, navy); y -= bh;
    const dcells: [string, number, string, string][] = [];
    if (on('central')) dcells.push(['Central', 1.8, v_central, 'central']);
    if (on('lancamento')) dcells.push(['Lancamento', 1.3, v_lanc, 'lanc']);
    if (on('tipo')) dcells.push(['Tipo', 1.7, '', 'tipo']);
    if (on('resist_caract')) dcells.push(['Resist. caract. (MPa)', 1.3, v_fck, 'fck']);
    if (on('abatimento_espec')) dcells.push(['Abatimento espec. (mm)', 1.6, '', 'abat']);
    if (on('volume_total')) dcells.push(['Volume total (m³)', 1.2, v_vol, 'vol']);
    if (on('amostragem')) dcells.push(['Amostragem', 1.5, '', 'amost']);
    if (dcells.length) {
      const g = rowCells(x0, y, Wu, rh, dcells.map((c) => [c[0], c[1], c[2]] as [string, number, string]));
      const gi = (kind: string) => dcells.findIndex((c) => c[3] === kind);
      { const i = gi('tipo'); if (i >= 0) { const c = g[i]; let cxk = checkbox(c.x + 3, y - rh + 5.5, 'FCK concreto', !blank, 7, 5.8); cxk = checkbox(cxk - 3, y - rh + 5.5, 'FAK arg.', false, 7, 5.8); checkbox(cxk - 3, y - rh + 5.5, 'FGK graute', false, 7, 5.8); } }
      { const i = gi('abat'); if (i >= 0) { const c = g[i]; txt(c.x + 6, y - rh + 6, v_slump, 8.5, F, ink); } }
      { const i = gi('amost'); if (i >= 0) { const c = g[i]; let cxa = checkbox(c.x + 4, y - rh + 6, 'Total', false, 7, 6.0); checkbox(cxa - 2, y - rh + 6, 'Parcial', false, 7, 6.0); } }
      y -= rh;
    }
    if (on('dosagem_detalhada')) {
      const v_cim = blank ? '' : s(om.cimento_tipo);
      const v_cons = (om.consumo_cimento_kg_m3 != null) ? s(om.consumo_cimento_kg_m3) + ' kg/m³' : '';
      const v_ac = (om.fator_ac != null) ? s(om.fator_ac) : '';
      const v_brita = blank ? '' : s(om.brita);
      const v_dmax = (om.dmax_agregado_mm != null) ? s(om.dmax_agregado_mm) + ' mm' : '';
      const v_adit = blank ? '' : s(om.aditivo_tipo);
      rowCells(x0, y, Wu, rh, [['Cimento (marca/tipo)', 2.0, v_cim], ['Consumo cimento', 1.4, v_cons], ['Fator a/c', 1.0, v_ac], ['Brita / agregado', 1.4, v_brita], ['D. max. agreg.', 1.2, v_dmax], ['Aditivo', 1.6, v_adit], ['Cura', 1.4]]);
      y -= rh;
    }
  }

  if (on('plano_moldagem')) {
    const plano = planoFromPadrao(om.padrao_moldagem) ?? planoFromCps(cpsByReceipt);
    const planoTxt = plano ? ('PLANO DE MOLDAGEM POR CAMINHAO (CP por idade):   ' + plano.txt + '    =    ' + plano.total + ' CP/caminhao') : 'PLANO DE MOLDAGEM POR CAMINHAO (CP por idade):   definido pelo traco / a preencher';
    const pbh = 13; fill(x0, y, Wu, pbh, band); rect(x0, y, Wu, pbh); txt(x0 + 5, y - pbh + 3.8, planoTxt, 7, B, navy); y -= pbh;
  }

  type GNode = { label: string; w?: number | null; children?: GNode[] };
  const lf = (l: string, w: number): GNode => ({ label: l, w });
  const showNum = on('col_numeracao_cp'), showAbat = on('col_abatimento'), showTransp = on('col_transporte'), showDesc = on('col_descarga'), showTempo = on('col_tempo_total'), showQtd = on('col_qtd_concreto'), showCB = on('col_cb'), showElem = on('col_elementos');
  const caract: GNode[] = [lf('Serie Nº', 24), lf('Qtde CPs', 26)];
  if (showNum) caract.push(lf('Numeracao CP', 74));
  if (showAbat) caract.push(lf('Abat. (mm)', 30));
  caract.push(lf('Nota Fiscal Nº', 66)); caract.push(lf('Horario moldagem', 50));
  const dmc: GNode[] = [];
  if (showTransp) dmc.push({ label: 'TRANSPORTE', children: [lf('Início mistura', 50), lf('Chegada a obra', 50)] });
  if (showDesc) dmc.push({ label: 'DESCARGA', children: [lf('Inicio', 46), lf('Termino', 46)] });
  if (showTempo) dmc.push(lf('Tempo total (h:min)', 46));
  if (showQtd) dmc.push(lf('Qtd Concreto (m³)', 62));
  const tree: GNode[] = [{ label: 'CARACTERISTICAS DAS AMOSTRAS', children: caract }];
  if (dmc.length) { if (showTransp || showDesc) tree.push({ label: 'DADOS DA MOLDAGEM', children: dmc }); else for (const c of dmc) tree.push(c); }
  if (showCB) tree.push(lf('C.B. Nº', 36));
  if (showElem) tree.push({ label: 'Amostragem ( ) Total ( ) Parcial - Elementos concretados', w: null });
  tree.push(lf('CP por idade', 62));
  const leavesOf = (n: GNode): GNode[] => (n.children ? n.children.flatMap(leavesOf) : [n]);
  const depthOf = (n: GNode, l = 0): number => (n.children ? Math.max(...n.children.map((c) => depthOf(c, l + 1))) : l + 1);
  const allLeaves = tree.flatMap(leavesOf);
  const fixed = allLeaves.reduce((a, l) => a + (l.w || 0), 0); const nflex = allLeaves.filter((l) => !l.w).length;
  const flexW = nflex ? (Wu - fixed) / nflex : 0;
  for (const l of allLeaves) (l as Row)._w = l.w || flexW;
  const sumW0 = allLeaves.reduce((a, l) => a + ((l as Row)._w as number), 0);
  if (sumW0 > 0.5 && Math.abs(sumW0 - Wu) > 0.5) { const scl = Wu / sumW0; for (const l of allLeaves) (l as Row)._w = ((l as Row)._w as number) * scl; }
  const setW = (n: GNode): number => { (n as Row)._w = n.children ? n.children.reduce((a, c) => a + setW(c), 0) : (n as Row)._w as number; return (n as Row)._w as number; };
  for (const n of tree) setW(n);
  const depth = Math.max(...tree.map((n) => depthOf(n)));
  const bandH = 12.5; const hdrH = depth * bandH;
  const drawNode = (n: GNode, x: number, ytop: number, lvl: number) => {
    const w = (n as Row)._w as number;
    if (n.children) { fill(x, ytop, w, bandH, hdrbg); rect(x, ytop, w, bandH, nl); for (const ln of wrap(B, n.label, 6, w)) { txtC(x + w / 2, ytop - bandH / 2 - 1.5, ln, 6, B, navy); break; } let cx = x; for (const c of n.children) { drawNode(c, cx, ytop - bandH, lvl + 1); cx += (c as Row)._w as number; } }
    else { const h = (depth - lvl) * bandH; fill(x, ytop, w, h, hdrbg); rect(x, ytop, w, h, nl); const ls = wrap(B, n.label, 6, w); let yy = ytop - h / 2 + (ls.length * 7) / 2 - 5.4; for (const ln of ls) { txtC(x + w / 2, yy, ln, 6, B, navy); yy -= 7; } }
  };
  let cxn = x0; for (const n of tree) { drawNode(n, cxn, y, 0); cxn += (n as Row)._w as number; }
  const yRows = y - hdrH;
  const leafX = [x0]; let acc = x0; for (const l of allLeaves) { acc += (l as Row)._w as number; leafX.push(acc); }
  const showObs = on('rodape_observacoes'), showDim = on('rodape_dimensoes'), showVis = on('rodape_vistos');
  const footH = (showObs || showDim || showVis) ? 50 : 0;
  const rowh = 20.5;
  const rows = Math.min(30, Math.max(3, Math.floor((yRows - (M + 8 + footH)) / rowh)));
  const rowVals: string[][] = [];
  for (let i = 0; i < cams.length && i < rows; i++) {
    const cm = cams[i]; const cps = cpsByReceipt.get(s(cm.id)) ?? [];
    const qtde = cps.length ? String(cps.length) : '';
    const cppi = cps.length ? cpPorIdade(cps) : '';
    const vol = cm.volume_m3 != null ? Number(cm.volume_m3) : null;
    const rv: string[] = [s(cm.serie), qtde];
    if (showNum) rv.push(cpRange(cps));
    if (showAbat) rv.push(s(cm.slump_medido_mm));
    rv.push(s(cm.nota_fiscal)); rv.push(s(cm.hora_moldagem));
    if (showTransp) { rv.push(s(cm.hora_saida_usina)); rv.push(s(cm.hora_chegada_obra)); }
    if (showDesc) { rv.push(s(cm.hora_inicio_descarga)); rv.push(s(cm.hora_fim_descarga)); }
    if (showTempo) rv.push('');
    if (showQtd) rv.push(vol != null ? String(vol) : '');
    if (showCB) rv.push(s(cm.serie));
    if (showElem) rv.push(s(cm.elementos_concretados));
    rv.push(cppi);
    rowVals.push(rv);
  }
  let yb = yRows;
  for (let i = 0; i < rows; i++) { rect(x0, yb, Wu, rowh); const rv = rowVals[i]; if (rv) for (let k = 0; k < allLeaves.length; k++) { const v = rv[k]; if (v) txt(leafX[k] + 2.5, yb - rowh + 5.5, v, 7, F, ink); } yb -= rowh; }
  for (const xx of leafX) vl(xx, yb, yRows);
  if (blank) txtC((leafX[leafX.length - 2] + leafX[leafX.length - 1]) / 2, yRows - rowh + 3.0, 'ex.: 2x7d 2x28d 2x63d', 5.0, F, lbl);
  y = yb;

  const rparts: [string, number][] = [];
  if (showObs) rparts.push(['obs', 0.40]);
  if (showDim) rparts.push(['dim', 0.34]);
  if (showVis) rparts.push(['vis', 0.26]);
  if (rparts.length) {
    const fh = 50; const wsum = rparts.reduce((a, p) => a + p[1], 0); let fx = x0;
    for (const [kind, wt] of rparts) {
      const cw = Wu * wt / wsum;
      if (kind === 'obs') { lbox(fx, y, cw, fh, 'Observacoes'); }
      else if (kind === 'dim') {
        rect(fx, y, cw, fh); txt(fx + 4, y - 9, 'DIMENSOES DOS CORPOS DE PROVA (mm)', 5.8, F, lbl);
        const dims = ['100 x 200', '150 x 300', '100 x 100 x 400', '150 x 150 x 500', '50 x 100', '40 x 40 x 40'];
        for (let col = 0; col < 2; col++) for (let r = 0; r < 3; r++) { const idx = col * 3 + r; if (idx < dims.length) checkbox(fx + 8 + col * (cw / 2), (y - 20 - r * 11), dims[idx], false, 8, 6.6); }
      } else {
        const sh = fh / 2;
        lbox(fx, y, cw, sh, 'Responsavel (nome / funcao)'); txt(fx + cw - 5 - tW(F, 'Visto: __________________', 5.6), y - sh + 4, 'Visto: __________________', 5.6, F, lbl);
        lbox(fx, y - sh, cw, sh, 'Moldador (nome)'); txt(fx + cw - 5 - tW(F, 'Visto: __________________', 5.6), y - fh + 4, 'Visto: __________________', 5.6, F, lbl);
      }
      fx += cw;
    }
  }

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
    let labName = 'LABORATORIO'; let rt = ''; let crea = ''; let om: Row = {};
    let concCampos: Row = {}; let fichaCampos: Row = {}; let logoBytes: Uint8Array | null = null; let logoPng = true;

    const loadCfg = async (tenantId: string) => {
      const { data: cfg } = await db.from('config_lab').select('responsavel_tecnico, crea_rt, logo_path, concretagem_campos, ficha_campos').eq('tenant_id', tenantId).maybeSingle();
      rt = s(cfg?.responsavel_tecnico); crea = s(cfg?.crea_rt); concCampos = emb(cfg?.concretagem_campos); fichaCampos = emb(cfg?.ficha_campos);
      if (cfg?.logo_path) { try { const dl = await svc().storage.from('lab-reports').download(String(cfg.logo_path)); if (dl.data) { logoBytes = new Uint8Array(await dl.data.arrayBuffer()); const lp = String(cfg.logo_path).toLowerCase(); logoPng = !(lp.endsWith('.jpg') || lp.endsWith('.jpeg')); } } catch { logoBytes = null; } }
    };

    if (!blank) {
      const { data: c, error } = await db.from('concretagens')
        .select('id, tenant_id, codigo, numero_relatorio, data_real, data_programada, hora_programada, fornecedor_texto, traco_texto, local_texto, bombeado, volume_programado_m3, dimensao_cp, tenants(name), client_works(nome, codigo), lab_clients(razao_social, nome_fantasia), operational_materials(nome, fck_mpa, padrao_moldagem, cimento_tipo, consumo_cimento_kg_m3, fator_ac, brita, dmax_agregado_mm, aditivo_tipo, slump_previsto_mm, slump_tolerancia_mm)')
        .eq('id', concId).is('deleted_at', null).maybeSingle();
      if (error) return done(fail(error.message, 500));
      if (!c) return done(fail('Concretagem nao encontrada (ou sem acesso).', 404));
      conc = c as Row; labName = s(emb(conc.tenants).name) || labName; om = emb(conc.operational_materials);
      await loadCfg(s(conc.tenant_id));
      const { data: mr } = await db.from('material_receipts').select('id, serie, nota_fiscal, slump_medido_mm, volume_m3, hora_moldagem, hora_saida_usina, hora_chegada_obra, hora_inicio_descarga, hora_fim_descarga, elementos_concretados').eq('concretagem_id', concId).is('deleted_at', null).order('serie');
      cams = (mr ?? []) as Row[];
      const { data: cps } = await db.from('corpos_prova').select('receipt_id, idade_dias, idade_unidade, codigo, numeracao_lab').eq('concretagem_id', concId).is('deleted_at', null);
      for (const cp of (cps ?? []) as Row[]) { const k = s(cp.receipt_id); const a = cpsByReceipt.get(k) ?? []; a.push(cp); cpsByReceipt.set(k, a); }
    } else {
      const { data: u } = await db.auth.getUser();
      if (u?.user) { const { data: m } = await db.from('members').select('tenant_id, tenants(name)').eq('auth_id', u.user.id).eq('active', true).is('deleted_at', null).maybeSingle(); if (m) { labName = s(emb(m.tenants).name) || labName; await loadCfg(s(m.tenant_id)); } }
    }

    const fc: Row = { ...fichaCampos };
    if (fc.contato_equipe === undefined && concCampos.ficha_contato_equipe !== undefined) fc.contato_equipe = concCampos.ficha_contato_equipe;
    if (fc.dosagem_detalhada === undefined && concCampos.ficha_dosagem !== undefined) fc.dosagem_detalhada = concCampos.ficha_dosagem;
    const bytes = await buildFichaPdf({ blank, labName, rt, crea, logoBytes, logoPng, conc, om, cams, cpsByReceipt, fc });
    return done(new Response(bytes, { headers: { 'access-control-allow-origin': '*', 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="ficha-moldagem.pdf"' } }));
  } catch (e) {
    return done(serverError(e, { req, fnName: 'generate-ficha-moldagem-pdf', action: 'relatorio.pdf:generate-ficha-moldagem-pdf' }), e instanceof Error ? e.message : 'erro desconhecido');
  }
}

Deno.serve(handler);
