import { describe, it, expect } from 'vitest';
import { rateVital, inpFromDurations, buildDailySeries } from './metrics-math';

describe('rateVital — classificação de Core Web Vitals', () => {
  it('LCP: bom / ni / ruim nos limiares', () => {
    expect(rateVital('LCP', 2500)).toBe('good');           // <= 2500
    expect(rateVital('LCP', 2501)).toBe('needs-improvement');
    expect(rateVital('LCP', 4000)).toBe('needs-improvement'); // <= 4000
    expect(rateVital('LCP', 4001)).toBe('poor');
  });

  it('CLS usa limiares fracionários', () => {
    expect(rateVital('CLS', 0.1)).toBe('good');
    expect(rateVital('CLS', 0.2)).toBe('needs-improvement');
    expect(rateVital('CLS', 0.26)).toBe('poor');
  });

  it('INP nos limiares 200/500', () => {
    expect(rateVital('INP', 200)).toBe('good');
    expect(rateVital('INP', 350)).toBe('needs-improvement');
    expect(rateVital('INP', 501)).toBe('poor');
  });

  it('métrica desconhecida → good (neutro)', () => {
    expect(rateVital('FOO', 99999)).toBe('good');
  });
});

describe('inpFromDurations — percentil de INP', () => {
  it('sem interações → usa firstInputDur', () => {
    expect(inpFromDurations([], 42)).toBe(42);
    expect(inpFromDurations([])).toBe(0);
  });

  it('poucas interações → maior duração (idx 0)', () => {
    expect(inpFromDurations([120, 80, 200, 50])).toBe(200);
  });

  it('correção de percentil: descarta ~1 a cada 50 (idx = floor(n/50))', () => {
    // 60 interações → idx = floor(60/50) = 1 → 2º maior valor.
    const durations = Array.from({ length: 60 }, (_, i) => i + 1); // 1..60
    // maiores: 60 (idx0), 59 (idx1) → retorna 59
    expect(inpFromDurations(durations)).toBe(59);
  });

  it('respeita firstInputDur quando maior que o candidato', () => {
    expect(inpFromDurations([100, 90], 250)).toBe(250);
  });

  it('não muta o array de entrada', () => {
    const arr = [3, 1, 2];
    inpFromDurations(arr);
    expect(arr).toEqual([3, 1, 2]);
  });
});

describe('buildDailySeries — série temporal com lacunas', () => {
  const today = new Date('2026-01-10T12:00:00Z');

  it('preenche dias sem dado com null (gap), não 0', () => {
    const rows = [
      { metric: 'LCP', day: '2026-01-10', p75: 2200 },
      { metric: 'LCP', day: '2026-01-08', p75: 2600 },
    ];
    const { keys, values } = buildDailySeries(rows, 'LCP', 'p75', 5, today);
    expect(keys).toEqual(['2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10']);
    expect(values).toEqual([null, null, 2600, null, 2200]);
  });

  it('ignora linhas de outra métrica', () => {
    const rows = [
      { metric: 'LCP', day: '2026-01-10', p75: 2200 },
      { metric: 'INP', day: '2026-01-10', p75: 180 },
    ];
    const { values } = buildDailySeries(rows, 'INP', 'p75', 1, today);
    expect(values).toEqual([180]);
  });

  it('extrai o campo informado e normaliza day para YYYY-MM-DD', () => {
    const rows = [{ metric: 'm', day: '2026-01-10T23:59:59Z', avg: 5 }];
    const { values } = buildDailySeries(rows, 'm', 'avg', 1, today);
    expect(values).toEqual([5]);
  });

  it('valores não-numéricos são tratados como ausência (null)', () => {
    const rows = [{ metric: 'm', day: '2026-01-10', v: 'abc' }];
    const { values } = buildDailySeries(rows, 'm', 'v', 1, today);
    expect(values).toEqual([null]);
  });

  it('o comprimento da série é exatamente `days`', () => {
    const { keys, values } = buildDailySeries([], 'm', 'v', 14, today);
    expect(keys).toHaveLength(14);
    expect(values).toHaveLength(14);
    expect(values.every((v: number | null) => v === null)).toBe(true);
  });
});
