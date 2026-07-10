import { describe, expect, it } from 'vitest';
import { parseBankStatement } from './bankStatement';

describe('parseBankStatement', () => {
  it('interpreta OFX com crédito e débito', () => {
    const parsed = parseBankStatement('extrato.ofx', '<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20260701<TRNAMT>150.50<FITID>A1<MEMO>Recebimento</STMTTRN><STMTTRN><DTPOSTED>20260702<TRNAMT>-20.00<FITID>A2<MEMO>Tarifa</STMTTRN></BANKTRANLIST></OFX>');
    expect(parsed.format).toBe('ofx'); expect(parsed.rows).toHaveLength(2); expect(parsed.rows[1].amount).toBe(-20);
  });
  it('interpreta CSV brasileiro', () => {
    const parsed = parseBankStatement('extrato.csv', 'Data;Descrição;Valor\n01/07/2026;Cliente XPTO;1.234,56\n02/07/2026;Tarifa;-10,00');
    expect(parsed.format).toBe('csv'); expect(parsed.rows[0]).toMatchObject({ transaction_date: '2026-07-01', amount: 1234.56 });
  });
});
