import { describe, it, expect } from 'vitest';
import { bumpNumeracao } from './concreto';

describe('bumpNumeracao', () => {
  it('incrementa numero simples', () => {
    expect(bumpNumeracao('1235689', 0)).toBe('1235689');
    expect(bumpNumeracao('1235689', 1)).toBe('1235690');
    expect(bumpNumeracao('1235689', 11)).toBe('1235700');
  });
  it('preserva zero-padding', () => {
    expect(bumpNumeracao('0001', 12)).toBe('0013');
    expect(bumpNumeracao('099', 1)).toBe('100');
    expect(bumpNumeracao('A-099', 1)).toBe('A-100');
  });
  it('incrementa o ultimo grupo de digitos preservando prefixo/sufixo', () => {
    expect(bumpNumeracao('CP-09', 1)).toBe('CP-10');
    expect(bumpNumeracao('2026/000010', 5)).toBe('2026/000015');
  });
  it('vazio e sem digitos', () => {
    expect(bumpNumeracao('', 3)).toBe('');
    expect(bumpNumeracao('   ', 3)).toBe('');
    expect(bumpNumeracao('ABC', 3)).toBe('ABC');
  });
  it('numeros longos (BigInt)', () => {
    expect(bumpNumeracao('999999999999999999', 1)).toBe('1000000000000000000');
  });
});
