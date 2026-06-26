// src/lib/export/xlsx.ts
// Helper ÚNICO e de marca para TODAS as exportações Excel do Concresoft (GEOLAB).
// Biblioteca: xlsx-js-style (fork do SheetJS com estilos de célula).
//
// Dois modos:
//  - Relatório (default): banda Concresoft + título + metadados (laboratório, período, filtros,
//    gerado em, registros) + tabela estilizada (cabeçalho navy, zebra, bordas, formatos BR) + TOTAL opcional.
//  - Modelo/template (sheet.template = true): cabeçalho na LINHA 1 (round-trip com sheet_to_json na
//    reimportação), tabela estilizada, sem banda/metadados.
//
// API genérica: descreva colunas tipadas (formato BR, alinhamento, total) e passe as linhas; o visual é padrão.
// Uso: await exportExcel({ title, subtitle, fields }, { name, columns, rows, totals }).

import type { WorkBook, WorkSheet } from 'xlsx';

export type XlsxFormat = 'text' | 'int' | 'dec1' | 'dec2' | 'money' | 'percent' | 'date' | 'datetime';
export type XlsxAlign = 'left' | 'center' | 'right';
export type XlsxTotal = 'sum' | 'avg' | 'count';

export interface XlsxColumn<T = Record<string, unknown>> {
  key?: keyof T | string; // opcional quando se usa `map`
  header: string;
  width?: number; // largura em caracteres (default: derivada do conteúdo)
  format?: XlsxFormat; // default 'text'
  align?: XlsxAlign; // default por formato
  total?: XlsxTotal; // agrega na linha de TOTAL (precisa de sheet.totals)
  map?: (row: T) => unknown; // acessor opcional (default: row[key])
}
export interface XlsxSheet<T = Record<string, unknown>> {
  name: string; // nome da aba (sanitizado p/ <=31 chars, sem []:*?/\)
  columns: XlsxColumn<T>[];
  rows: T[];
  title?: string; // título acima da tabela (default: meta.title)
  totals?: boolean; // imprime a linha de TOTAL
  template?: boolean; // true = modo modelo (cabeçalho na linha 1, sem banda) p/ reimportação
}
export interface XlsxMeta {
  title: string; // título do relatório
  subtitle?: string; // ex.: nome do laboratório
  fields?: { label: string; value: string }[]; // metadados (período, filtros, obra…)
  filename?: string; // default: slug(title)-AAAA-MM-DD.xlsx
  generatedAt?: Date; // default: agora
}

// xlsx-js-style espelha a API do xlsx.
type XlsxModule = typeof import('xlsx');
type Style = Record<string, unknown>;
type Cell = { v: string | number | boolean | null; t: 's' | 'n' | 'b'; z?: string; s: Style };

// ---- Marca Concresoft (navy/magenta) + tokens ----
const C = {
  navy: '182863',
  magenta: 'C5117E',
  white: 'FFFFFF',
  ink: '1B2330',
  muted: '5C636F',
  line: 'D9DEE7',
  zebra: 'F4F6FA',
  totalBg: 'EAEDF3',
};
const FONT = 'Calibri';
const NUMFMT: Record<XlsxFormat, string> = {
  text: '@',
  int: '#,##0',
  dec1: '#,##0.0',
  dec2: '#,##0.00',
  money: 'R$ #,##0.00',
  percent: '0.0%',
  date: 'dd/mm/yyyy',
  datetime: 'dd/mm/yyyy hh:mm',
};
const DEF_ALIGN: Record<XlsxFormat, XlsxAlign> = {
  text: 'left', int: 'right', dec1: 'right', dec2: 'right', money: 'right', percent: 'right', date: 'center', datetime: 'center',
};

const thin = (rgb = C.line) => ({ style: 'thin', color: { rgb } });
const boxBorder = (rgb = C.line) => ({ top: thin(rgb), bottom: thin(rgb), left: thin(rgb), right: thin(rgb) });

const styBand = (): Style => ({ font: { name: FONT, sz: 13, bold: true, color: { rgb: C.white } }, fill: { patternType: 'solid', fgColor: { rgb: C.navy } }, alignment: { horizontal: 'left', vertical: 'center' } });
const styTitle = (): Style => ({ font: { name: FONT, sz: 14, bold: true, color: { rgb: C.navy } }, alignment: { horizontal: 'left', vertical: 'center' } });
const styMeta = (): Style => ({ font: { name: FONT, sz: 9, color: { rgb: C.muted } }, alignment: { horizontal: 'left', vertical: 'center' } });
const styHeader = (): Style => ({ font: { name: FONT, sz: 10, bold: true, color: { rgb: C.white } }, fill: { patternType: 'solid', fgColor: { rgb: C.navy } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: boxBorder(C.navy) });
const styData = (align: XlsxAlign, zebra: boolean): Style => ({ font: { name: FONT, sz: 10, color: { rgb: C.ink } }, alignment: { horizontal: align, vertical: 'center' }, border: boxBorder(C.line), ...(zebra ? { fill: { patternType: 'solid', fgColor: { rgb: C.zebra } } } : {}) });
const styTotal = (align: XlsxAlign): Style => ({ font: { name: FONT, sz: 10, bold: true, color: { rgb: C.navy } }, fill: { patternType: 'solid', fgColor: { rgb: C.totalBg } }, alignment: { horizontal: align, vertical: 'center' }, border: { ...boxBorder(C.line), top: { style: 'medium', color: { rgb: C.navy } } } });

const txt = (v: unknown, s: Style): Cell => ({ v: v == null ? '' : String(v), t: 's', s });

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
// Serial do Excel (epoch 1899-12-30) calculado em UTC — sem deriva de fuso.
function dateSerial(y: number, m: number, d: number, hh = 0, mm = 0): number {
  const ms = Date.UTC(y, m - 1, d, hh, mm) - Date.UTC(1899, 11, 30);
  return ms / 86400000;
}
function parseDateSerial(v: unknown, withTime: boolean): number | null {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return dateSerial(+m[1], +m[2], +m[3], withTime ? +(m[4] ?? 0) : 0, withTime ? +(m[5] ?? 0) : 0);
}

function makeCell(value: unknown, fmt: XlsxFormat, style: Style): Cell {
  if (fmt === 'text') return txt(value, style);
  if (fmt === 'date' || fmt === 'datetime') {
    const serial = parseDateSerial(value, fmt === 'datetime');
    if (serial == null) return txt(value, style);
    return { v: serial, t: 'n', z: NUMFMT[fmt], s: style };
  }
  const n = toNumber(value);
  if (n == null) return { v: '', t: 's', s: style };
  return { v: n, t: 'n', z: NUMFMT[fmt], s: style };
}

function colValue<T>(col: XlsxColumn<T>, row: T): unknown {
  if (col.map) return col.map(row);
  return col.key == null ? '' : (row as Record<string, unknown>)[col.key as string];
}
function computeTotal<T>(rows: T[], col: XlsxColumn<T>): number {
  if (col.total === 'count') return rows.length;
  let sum = 0; let cnt = 0;
  for (const r of rows) { const n = toNumber(colValue(col, r)); if (n != null) { sum += n; cnt += 1; } }
  return col.total === 'avg' ? (cnt ? sum / cnt : 0) : sum;
}
function previewLen<T>(col: XlsxColumn<T>, rows: T[]): number {
  let w = String(col.header).length;
  const lim = Math.min(rows.length, 250);
  for (let i = 0; i < lim; i += 1) {
    const v = colValue(col, rows[i]);
    const s = v == null ? '' : col.format === 'money' ? `R$ ${v}` : String(v);
    if (s.length > w) w = s.length;
  }
  return Math.min(Math.max(w + 2, 9), 46);
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtDateTime = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtDate = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
// biome-ignore lint/suspicious/noControlCharactersInRegex: faixa ASCII 0x00-0x7F intencional para slugificar nome de arquivo
const slug = (s: string) => s.normalize('NFD').replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export';
const safeName = (s: string) => (s || 'Planilha').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Planilha';

// Monta uma aba (worksheet) já estilizada e a anexa ao workbook.
function buildSheet<T>(XLSX: XlsxModule, wb: WorkBook, meta: XlsxMeta, sh: XlsxSheet<T>, genAt: Date): void {
  const cols = sh.columns;
  const ncol = cols.length;
  const grid: Cell[][] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const rowHpt: number[] = [];
  const band = !sh.template;

  const fullRow = (lead: Cell, fillStyle: Style | null): Cell[] => {
    const arr: Cell[] = [lead];
    for (let c = 1; c < ncol; c += 1) arr.push({ v: '', t: 's', s: fillStyle ?? {} });
    return arr;
  };

  if (band) {
    // Banda de marca (navy, largura total).
    grid.push(fullRow(txt('Concresoft  ·  Controle Tecnológico de Materiais', styBand()), styBand())); merges.push({ s: { r: grid.length - 1, c: 0 }, e: { r: grid.length - 1, c: ncol - 1 } }); rowHpt.push(22);
    // Título.
    grid.push(fullRow(txt(sh.title ?? meta.title, styTitle()), null)); merges.push({ s: { r: grid.length - 1, c: 0 }, e: { r: grid.length - 1, c: ncol - 1 } }); rowHpt.push(20);
    // Metadados.
    const fields = [
      ...(meta.subtitle ? [{ label: 'Laboratório', value: meta.subtitle }] : []),
      ...(meta.fields ?? []),
      { label: 'Gerado em', value: fmtDateTime(genAt) },
      { label: 'Registros', value: String(sh.rows.length) },
    ];
    for (const f of fields) { grid.push(fullRow(txt(`${f.label}: ${f.value}`, styMeta()), null)); merges.push({ s: { r: grid.length - 1, c: 0 }, e: { r: grid.length - 1, c: ncol - 1 } }); rowHpt.push(14); }
    // Espaçador.
    grid.push(fullRow(txt('', {}), null)); rowHpt.push(6);
  }

  const headerRow = grid.length;
  grid.push(cols.map((c) => txt(c.header, styHeader()))); rowHpt.push(band ? 18 : 20);

  sh.rows.forEach((row, i) => {
    const zebra = i % 2 === 1;
    grid.push(cols.map((c) => makeCell(colValue(c, row), c.format ?? 'text', styData(c.align ?? DEF_ALIGN[c.format ?? 'text'], zebra))));
    rowHpt.push(15);
  });

  if (sh.totals && sh.rows.length) {
    grid.push(cols.map((c, ci) => {
      const align = c.align ?? DEF_ALIGN[c.format ?? 'text'];
      if (c.total) return makeCell(computeTotal(sh.rows, c), c.total === 'count' ? 'int' : (c.format ?? 'dec2'), styTotal(align));
      if (ci === 0) return txt('TOTAL', styTotal('left'));
      return { v: '', t: 's', s: styTotal(align) };
    }));
    rowHpt.push(16);
  }

  // Monta o worksheet endereçando cada célula (controle total de t/v/z/s).
  const ws: Record<string, unknown> = {};
  for (let r = 0; r < grid.length; r += 1) {
    for (let c = 0; c < grid[r].length; c += 1) {
      ws[XLSX.utils.encode_cell({ r, c })] = grid[r][c];
    }
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(grid.length - 1, 0), c: Math.max(ncol - 1, 0) } });
  ws['!cols'] = cols.map((c) => ({ wch: c.width ?? previewLen(c, sh.rows) }));
  ws['!rows'] = rowHpt.map((hpt) => ({ hpt }));
  if (merges.length) ws['!merges'] = merges;
  // Autofiltro no cabeçalho (sort/filter no Excel). Freeze não é suportado pela lib.
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow, c: Math.max(ncol - 1, 0) } }) };

  XLSX.utils.book_append_sheet(wb, ws as unknown as WorkSheet, safeName(sh.name));
}

// Compõe o workbook (puro/testável; recebe o módulo já carregado).
// Abas são heterogêneas por design (cada uma com seu tipo de linha) → XlsxSheet<any>.
// biome-ignore lint/suspicious/noExplicitAny: lista de abas com tipos de linha distintos
export function composeWorkbook(XLSX: XlsxModule, meta: XlsxMeta, sheetsIn: XlsxSheet<any> | XlsxSheet<any>[]): WorkBook {
  const sheets = Array.isArray(sheetsIn) ? sheetsIn : [sheetsIn];
  const wb = XLSX.utils.book_new();
  const genAt = meta.generatedAt ?? new Date();
  if (!sheets.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[meta.title]]), 'Planilha');
  for (const sh of sheets) buildSheet(XLSX, wb, meta, sh, genAt);
  return wb;
}

function triggerDownload(bytes: ArrayBuffer, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Ponto de entrada público: monta e baixa o .xlsx no navegador.
// biome-ignore lint/suspicious/noExplicitAny: lista de abas com tipos de linha distintos
export async function exportExcel(meta: XlsxMeta, sheets: XlsxSheet<any> | XlsxSheet<any>[]): Promise<void> {
  const XLSX = (await import('xlsx-js-style')) as unknown as XlsxModule;
  const wb = composeWorkbook(XLSX, meta, sheets);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const fname = (meta.filename && meta.filename.trim()) || `${slug(meta.title)}-${fmtDate(meta.generatedAt ?? new Date()).split('/').reverse().join('-')}.xlsx`;
  triggerDownload(out, fname.endsWith('.xlsx') ? fname : `${fname}.xlsx`);
}
