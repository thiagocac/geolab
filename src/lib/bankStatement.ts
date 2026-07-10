export type BankStatementRow = {
  external_id: string | null;
  transaction_date: string;
  description: string;
  amount: number;
  balance?: number | null;
  document_number: string | null;
};
export type ParsedBankStatement = { format: 'ofx' | 'csv'; rows: BankStatementRow[] };

function isoDate(value: string): string {
  const raw = value.trim();
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  throw new Error(`Data inválida no extrato: ${raw}`);
}
function decimal(value: string): number {
  const clean = value.trim().replace(/\s/g, '');
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const result = Number(normalized);
  if (!Number.isFinite(result)) throw new Error(`Valor inválido no extrato: ${value}`);
  return result;
}
function ofxTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
  return match?.[1]?.trim() ?? null;
}
function parseOfx(content: string): BankStatementRow[] {
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? content.split(/<STMTTRN>/i).slice(1);
  const rows = blocks.map((block) => {
    const date = ofxTag(block, 'DTPOSTED');
    const amount = ofxTag(block, 'TRNAMT');
    if (!date || !amount) return null;
    return {
      external_id: ofxTag(block, 'FITID'),
      transaction_date: isoDate(date),
      description: ofxTag(block, 'MEMO') ?? ofxTag(block, 'NAME') ?? 'Movimento bancário',
      amount: decimal(amount),
      document_number: ofxTag(block, 'CHECKNUM') ?? ofxTag(block, 'REFNUM'),
    } satisfies BankStatementRow;
  }).filter((row): row is BankStatementRow => !!row && row.amount !== 0);
  if (!rows.length) throw new Error('Nenhum movimento válido foi encontrado no arquivo OFX.');
  return rows;
}
function separator(header: string): string { return header.split(';').length >= header.split(',').length ? ';' : ','; }
function parseCsv(content: string): BankStatementRow[] {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('CSV sem linhas de movimento.');
  const sep = separator(lines[0]);
  const headers = lines[0].split(sep).map((v) => v.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const find = (...names: string[]) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const dateIndex = find('data', 'date'); const descIndex = find('descricao', 'historico', 'memo', 'description'); const amountIndex = find('valor', 'amount');
  const debitIndex = find('debito', 'debit'); const creditIndex = find('credito', 'credit'); const idIndex = find('id', 'fitid', 'documento'); const balanceIndex = find('saldo', 'balance');
  if (dateIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) throw new Error('CSV precisa de coluna de data e valor, débito ou crédito.');
  const rows: BankStatementRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ''));
    if (!cols[dateIndex]) continue;
    let amount = amountIndex >= 0 && cols[amountIndex] ? decimal(cols[amountIndex]) : 0;
    if (!amount && creditIndex >= 0 && cols[creditIndex]) amount = Math.abs(decimal(cols[creditIndex]));
    if (!amount && debitIndex >= 0 && cols[debitIndex]) amount = -Math.abs(decimal(cols[debitIndex]));
    if (!amount) continue;
    rows.push({ external_id: idIndex >= 0 ? cols[idIndex] || null : null, transaction_date: isoDate(cols[dateIndex]), description: descIndex >= 0 ? cols[descIndex] || 'Movimento bancário' : 'Movimento bancário', amount, balance: balanceIndex >= 0 && cols[balanceIndex] ? decimal(cols[balanceIndex]) : null, document_number: null });
  }
  if (!rows.length) throw new Error('Nenhum movimento válido foi encontrado no CSV.');
  return rows;
}
export function parseBankStatement(fileName: string, content: string): ParsedBankStatement {
  const format = fileName.toLowerCase().endsWith('.ofx') || /<OFX>|<STMTTRN>/i.test(content) ? 'ofx' : 'csv';
  return { format, rows: format === 'ofx' ? parseOfx(content) : parseCsv(content) };
}
export async function sha256Text(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
