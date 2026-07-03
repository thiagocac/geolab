// Tipos próprios do xlsx-js-style (fork do SheetJS com estilos de célula).
// Antes este arquivo reexportava os tipos do pacote `xlsx` (type-only). Removido na v149:
// a dependência xlsx@0.18.5 carregava um HIGH permanente no npm audit (GHSA-4r6h-8v6p-xvw6 /
// GHSA-5pgg-2g8v-p4x9, sem fix no registry npm) e o runtime inteiro já usa xlsx-js-style.
// Declaramos aqui SÓ a superfície consumida pelo app (src/lib/export/xlsx.ts,
// src/lib/importacao/excelParser.ts, RompimentosPage). Ao usar API nova, ampliar este contrato.
declare module 'xlsx-js-style' {
  export interface CellAddress { r: number; c: number }
  export interface Range { s: CellAddress; e: CellAddress }
  export interface WorkSheet { [cell: string]: unknown }
  export interface WorkBook { SheetNames: string[]; Sheets: Record<string, WorkSheet> }
  export const utils: {
    encode_cell(a: CellAddress): string;
    encode_range(r: Range): string;
    book_new(): WorkBook;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name?: string): void;
    aoa_to_sheet(aoa: unknown[][]): WorkSheet;
    sheet_to_json<T = Record<string, unknown>>(ws: WorkSheet, opts?: { defval?: unknown; header?: unknown; raw?: boolean; range?: unknown }): T[];
  };
  export function read(data: unknown, opts?: { type?: string; cellDates?: boolean }): WorkBook;
  export function write(wb: WorkBook, opts?: { bookType?: string; type?: string; compression?: boolean }): unknown;
}
