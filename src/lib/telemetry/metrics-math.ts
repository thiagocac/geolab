/**
 * telemetry/metrics-math — lógica PURA de métricas de observabilidade (V223).
 *
 * Sem dependências de browser nem de formatação: extraído de `vitals.ts`
 * (rating de Web Vitals, percentil de INP) e do dashboard (`dailySeries`) para
 * poder ser testado em node. Produção e testes usam exatamente este código.
 */

export type VitalRating = 'good' | 'needs-improvement' | 'poor';

/** Limiares Core Web Vitals (web.dev): [bom_até, ni_até]. Acima → poor. */
export const VITAL_THRESHOLDS: Record<string, [number, number]> = {
  TTFB: [800, 1800],
  FCP: [1800, 3000],
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
};

/** Classifica um valor de Web Vital. Métrica desconhecida → 'good' (neutro). */
export function rateVital(name: string, value: number): VitalRating {
  const t = VITAL_THRESHOLDS[name];
  if (!t) return 'good';
  if (value <= t[0]) return 'good';
  if (value <= t[1]) return 'needs-improvement';
  return 'poor';
}

/**
 * INP a partir das durações de interação (maior por interactionId) + a maior
 * duração de "primeiro input" sem id. Aplica correção de percentil (~P98):
 * 1 candidato descartável a cada 50 interações, espelhando o pacote web-vitals.
 */
export function inpFromDurations(durations: number[], firstInputDur = 0): number {
  const sorted = durations.slice().sort((a, b) => b - a);
  if (sorted.length === 0) return firstInputDur;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length / 50));
  return Math.max(sorted[idx], firstInputDur);
}

export interface DailySeriesRow { metric?: unknown; day?: unknown; [k: string]: unknown }

/**
 * Constrói uma série temporal por dia para uma métrica, a partir de linhas
 * `{ day, metric, [field] }` em qualquer ordem. Dias sem dado viram `null`
 * (gap), não 0 (que distorceria o gráfico). Retorna chaves ISO (YYYY-MM-DD)
 * para o chamador formatar como preferir.
 *
 * `today` é injetável para testes determinísticos (default: agora).
 */
export function buildDailySeries(
  rows: DailySeriesRow[],
  metric: string,
  field: string,
  days = 14,
  today: Date = new Date(),
): { keys: string[]; values: Array<number | null> } {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    if (r.metric !== metric) continue;
    const d = String(r.day).slice(0, 10);
    const v = Number(r[field]);
    if (Number.isFinite(v)) byDay.set(d, v);
  }
  const keys: string[] = [];
  const values: Array<number | null> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    keys.push(key);
    values.push(byDay.has(key) ? byDay.get(key)! : null);
  }
  return { keys, values };
}
