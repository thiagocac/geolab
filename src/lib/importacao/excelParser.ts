import { fieldsForResource, type ImportField, type ImportIssue, type ImportResource, type ParsedImport } from './excelModel';

function norm(v: unknown): string { return String(v ?? '').trim(); }
function parseBool(v: unknown): boolean | null {
  const s = norm(v).toLowerCase();
  if (!s) return null;
  if (['sim', 's', 'true', '1', 'x'].includes(s)) return true;
  if (['nao', 'não', 'n', 'false', '0'].includes(s)) return false;
  return null;
}
function parseNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(norm(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function parseDateLike(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = norm(v);
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function parseTimeLike(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const minutes = Math.round(v * 24 * 60);
    return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  const m = norm(v).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}
function coerce(field: ImportField, value: unknown, row: number, issues: ImportIssue[]): unknown {
  const raw = norm(value);
  if (!raw && field.required) issues.push({ row, field: field.header, severity: 'erro', message: 'Campo obrigatório não preenchido.' });
  if (!raw) return null;
  if (field.type === 'number') { const n = parseNum(value); if (n == null) issues.push({ row, field: field.header, severity: 'erro', message: 'Valor numérico inválido.' }); return n; }
  if (field.type === 'date') { const d = parseDateLike(value); if (!d) issues.push({ row, field: field.header, severity: 'erro', message: 'Data inválida. Use AAAA-MM-DD ou DD/MM/AAAA.' }); return d; }
  if (field.type === 'time') { const t = parseTimeLike(value); if (!t) issues.push({ row, field: field.header, severity: 'erro', message: 'Hora inválida. Use HH:MM.' }); return t; }
  if (field.type === 'boolean') { const b = parseBool(value); if (b == null) issues.push({ row, field: field.header, severity: 'erro', message: 'Use sim/não.' }); return b; }
  return raw;
}
function crossValidate(resource: ImportResource, row: Record<string, unknown>, rowNumber: number, issues: ImportIssue[]) {
  if (resource === 'resultados' && !row.carga_ruptura_kn && !row.resultado_mpa) issues.push({ row: rowNumber, field: 'carga_ruptura_kn/resultado_mpa', severity: 'erro', message: 'Informe carga de ruptura ou MPa calculado.' });
  if (resource === 'recebimentos' && row.rejeitado === true && !row.motivo_rejeicao) issues.push({ row: rowNumber, field: 'motivo_rejeicao', severity: 'erro', message: 'Motivo obrigatório quando o caminhão foi rejeitado.' });
  if (resource === 'tracos' && Number(row.fck_mpa ?? 0) <= 0) issues.push({ row: rowNumber, field: 'fck_mpa', severity: 'erro', message: 'FCK deve ser maior que zero.' });
}

export async function parseImportWorkbook(file: File, resource: ImportResource, cfg?: Record<string, unknown>): Promise<ParsedImport> {
  const XLSX = await import('xlsx');
  const bytes = await file.arrayBuffer();
  const wb = XLSX.read(bytes, { type: 'array', cellDates: false });
  const ws = wb.Sheets.Dados ?? wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const fields = fieldsForResource(resource, cfg as never);
  const fieldMap = new Map(fields.map((f) => [f.header, f] as const));
  const issues: ImportIssue[] = [];
  const rows = rawRows.map((raw, idx) => {
    const rowNumber = idx + 2;
    const row: Record<string, unknown> = {};
    for (const [header, field] of fieldMap) row[field.key] = coerce(field, raw[header], rowNumber, issues);
    for (const key of Object.keys(raw)) if (!fieldMap.has(key)) issues.push({ row: rowNumber, field: key, severity: 'aviso', message: 'Coluna ignorada pelo importador.' });
    crossValidate(resource, row, rowNumber, issues);
    return row;
  }).filter((r) => Object.values(r).some((v) => v !== null && v !== ''));
  const invalidRows = new Set(issues.filter((i) => i.severity === 'erro').map((i) => i.row)).size;
  return { resource, rows, issues, validRows: Math.max(rows.length - invalidRows, 0), invalidRows };
}
