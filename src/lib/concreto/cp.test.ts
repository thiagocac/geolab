import { describe, expect, it } from 'vitest';
import { cargaParaKn, cargaParaMpa, fatorHD } from './cp';

// Trava no CI os valores normativos da ABNT NBR 5739:2018 (auditoria de matemática 12/07/2026).
describe('fatorHD (ABNT NBR 5739:2018, Tabela 2)', () => {
  it('âncoras da tabela', () => {
    expect(fatorHD(100, 200)).toBe(1.0); // h/d 2,00
    expect(fatorHD(100, 175)).toBe(0.98); // 1,75
    expect(fatorHD(100, 150)).toBe(0.96); // 1,50
    expect(fatorHD(100, 125)).toBe(0.93); // 1,25
    expect(fatorHD(100, 100)).toBe(0.86); // 1,00
  });
  it('sem correção entre 1,94 e 2,06 (itens 4.5/6.1.2)', () => {
    expect(fatorHD(100, 194)).toBe(1.0);
    expect(fatorHD(100, 199)).toBe(1.0);
    expect(fatorHD(100, 206)).toBe(1.0);
  });
  it('interpolação linear com aproximação de centésimos', () => {
    expect(fatorHD(100, 162.5)).toBe(0.97); // meio do trecho 1,50–1,75
    expect(fatorHD(100, 110)).toBe(0.89); // 0,86 + 0,4·0,07 = 0,888 → 0,89
  });
  it('abaixo de h/d 1,00 usa o piso da tabela', () => {
    expect(fatorHD(100, 90)).toBe(0.86);
  });
});

describe('cargaParaKn / cargaParaMpa (NBR 5739 6.1.1)', () => {
  it('conversões de unidade de carga', () => {
    expect(cargaParaKn(1, 'tf')).toBeCloseTo(9.80665, 10);
    expect(cargaParaKn(1000, 'kgf')).toBeCloseTo(9.80665, 10);
    expect(cargaParaKn(400, 'kn')).toBe(400);
  });
  it('400 kN em CP 10x20 (fator 1,0) → 50,9 MPa', () => {
    expect(cargaParaMpa(400, 'kn', 100, 200)).toBe(50.9);
  });
  it('400 kN em CP 10x15 (h/d 1,5, fator 0,96) → 48,9 MPa', () => {
    expect(cargaParaMpa(400, 'kn', 100, 150)).toBe(48.9);
  });
  it('carga inválida retorna 0', () => {
    expect(cargaParaMpa(0, 'kn', 100, 200)).toBe(0);
    expect(cargaParaMpa(Number.NaN, 'kn', 100, 200)).toBe(0);
  });
});
