import { describe, it, expect } from 'vitest';
import { validacaoLaudoSchema } from './validar';

describe('validacaoLaudoSchema', () => {
  it('aceita resposta valida', () => {
    const r = validacaoLaudoSchema.safeParse({ found: true, numero: '000412/2026', status: 'emitido', revisao: 0, data_emissao: null });
    expect(r.success).toBe(true);
  });
  it('rejeita found nao-booleano', () => {
    expect(validacaoLaudoSchema.safeParse({ found: 'sim' }).success).toBe(false);
  });
  it('aceita laudo ausente (found=false)', () => {
    expect(validacaoLaudoSchema.safeParse({ found: false }).success).toBe(true);
  });
});
