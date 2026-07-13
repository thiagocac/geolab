// _shared/report-kit.ts — Branding Concresoft para PDFs (pdf-lib). Paleta + cabeçalho/rodapé padrão.
// Fonte: Helvetica (StandardFonts) — Deno não decodifica WOFF2 (Brotli), então nada de fonte embarcada.
// Regra do kit: cabeçalho SEM fundo maciço — só uma régua magenta fina. Navy fica reservado ao thead de
// tabela e a faixas-âncora de total. Concresoft aparece só no rodapé (white-label: a marca do lab domina).
import { rgb, StandardFonts, PDFDocument, PDFPage, PDFFont } from 'npm:pdf-lib@1.17.1';

export const RK = {
  navy: rgb(0.094, 0.157, 0.388),
  magenta: rgb(0.773, 0.067, 0.494),
  ink: rgb(0.106, 0.137, 0.188),
  muted: rgb(0.36, 0.39, 0.45),
  faint: rgb(0.55, 0.58, 0.64),
  line: rgb(0.87, 0.89, 0.93),
  zebra: rgb(0.973, 0.98, 0.988),
  success: rgb(0.122, 0.651, 0.353),
  warn: rgb(0.909, 0.635, 0.122),
  white: rgb(1, 1, 1),
};

// Sanitiza para WinAnsi (Helvetica cobre Latin-1): setas/travessões viram equivalentes seguros; resto '?'.
export const sanWinAnsi = (s: unknown): string =>
  String(s ?? '').replace(/[→➔➜]/g, '->').replace(/[–—]/g, '-').replace(/[^\x20-\xFF\n]/g, '?');

export async function embedBase(doc: PDFDocument): Promise<{ F: PDFFont; B: PDFFont }> {
  return { F: await doc.embedFont(StandardFonts.Helvetica), B: await doc.embedFont(StandardFonts.HelveticaBold) };
}

// Cabeçalho institucional branco: marca do lab (texto navy) à esquerda, título+kicker à direita,
// régua magenta fina sob tudo. Retorna o y logo abaixo da régua (topo do corpo).
export function drawHeader(page: PDFPage, F: PDFFont, B: PDFFont, o: {
  x0: number; x1: number; yTop: number;
  labName: string; subtitle?: string;
  title: string; kicker?: string; rightLines?: string[];
}): number {
  const { x0, x1, yTop } = o;
  const w = (f: PDFFont, t: string, s: number) => f.widthOfTextAtSize(sanWinAnsi(t), s);
  const T = (x: number, y: number, t: string, s: number, f: PDFFont, c: ReturnType<typeof rgb>) => { if (t) page.drawText(sanWinAnsi(t), { x, y, size: s, font: f, color: c }); };
  const TR = (xr: number, y: number, t: string, s: number, f: PDFFont, c: ReturnType<typeof rgb>) => { if (t) page.drawText(sanWinAnsi(t), { x: xr - w(f, t, s), y, size: s, font: f, color: c }); };
  T(x0, yTop - 13, o.labName, 12, B, RK.navy);
  if (o.subtitle) T(x0, yTop - 24, o.subtitle, 7, F, RK.muted);
  if (o.kicker) TR(x1, yTop - 8, o.kicker.toUpperCase(), 6.6, B, RK.magenta);
  TR(x1, yTop - 22, o.title, 13, B, RK.navy);
  let ry = yTop - 31;
  for (const ln of (o.rightLines ?? [])) { TR(x1, ry, ln, 5.6, F, RK.faint); ry -= 7; }
  const ruleY = Math.min(yTop - 34, ry - 1);
  page.drawLine({ start: { x: x0, y: ruleY }, end: { x: x1, y: ruleY }, thickness: 1.2, color: RK.magenta });
  return ruleY - 10;
}

// Rodapé em todas as páginas: régua fina + nota do lab (esq) + assinatura discreta (centro) + "Página X de Y" (dir).
export function drawFooter(pages: PDFPage[], F: PDFFont, o: { x0: number; x1: number; y?: number; nota?: string; hoje?: string }): void {
  const y = o.y ?? 24;
  const w = (t: string, s: number) => F.widthOfTextAtSize(sanWinAnsi(t), s);
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawLine({ start: { x: o.x0, y: y + 12 }, end: { x: o.x1, y: y + 12 }, thickness: 0.5, color: RK.line });
    if (o.nota) p.drawText(sanWinAnsi(o.nota).slice(0, 120), { x: o.x0, y: y + 3, size: 6.5, font: F, color: RK.faint });
    const right = 'Página ' + (i + 1) + ' de ' + pages.length + (o.hoje ? ' · ' + o.hoje : '');
    p.drawText(sanWinAnsi(right), { x: o.x1 - w(right, 6.5), y: y + 3, size: 6.5, font: F, color: RK.faint });
    const sig = 'Emitido via Concresoft';
    p.drawText(sanWinAnsi(sig), { x: (o.x0 + o.x1) / 2 - w(sig, 6) / 2, y: y + 3, size: 6, font: F, color: RK.faint });
  }
}
