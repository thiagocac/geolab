import { emit } from './instrument';
import { rateVital } from './metrics-math';

/**
 * Coleta os Web Vitals canônicos (LCP, CLS, INP, FCP, TTFB) com baixo volume:
 * TTFB/FCP de imediato; LCP/CLS/INP uma vez quando a página fica oculta.
 * NÃO emite mais um evento por interação do DOM (era o ruído da v≤180).
 *
 * Observabilidade (Camada 5): emite no formato CANÔNICO — category 'web-vital' e
 * metadata.rating (good/needs-improvement/poor) calculado por rateVital. É o que
 * preenche as colunas good/needs_improvement/poor de v_client_vitals_daily. O `value`
 * vai no topo e a EF de ingestão o move para metadata.value (lido pelos percentis).
 */
export function installVitals() {
  if (!('PerformanceObserver' in window)) return;
  let lcp = 0;
  let cls = 0;
  let inp = 0;
  let flushed = false;

  const send = (name: string, value: number) =>
    emit({ category: 'web-vital', name, value, metadata: { kind: 'web-vital', rating: rateVital(name, value) } });

  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav && nav.responseStart > 0) send('TTFB', Math.round(nav.responseStart));
  } catch { /* sem navigation timing */ }

  const observe = (type: string, cb: (e: PerformanceEntry) => void) => {
    try {
      const o = new PerformanceObserver((list) => { for (const e of list.getEntries()) cb(e); });
      o.observe({ type, buffered: true } as PerformanceObserverInit);
      return o;
    } catch { return null; }
  };

  observe('paint', (e) => { if (e.name === 'first-contentful-paint') send('FCP', Math.round(e.startTime)); });
  observe('largest-contentful-paint', (e) => { lcp = Math.round(e.startTime); });
  observe('layout-shift', (e) => { const ls = e as PerformanceEntry & { value: number; hadRecentInput: boolean }; if (!ls.hadRecentInput) cls += ls.value; });
  try {
    const o = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) { const ev = e as PerformanceEntry & { interactionId?: number; duration: number }; if (ev.interactionId) inp = Math.max(inp, Math.round(ev.duration)); }
    });
    o.observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit & { durationThreshold: number });
  } catch { /* event timing sem suporte */ }

  const flushVitals = () => {
    if (flushed) return;
    flushed = true;
    if (lcp) send('LCP', lcp);
    send('CLS', Math.round(cls * 1000) / 1000);
    if (inp) send('INP', inp);
  };
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushVitals(); });
  window.addEventListener('pagehide', flushVitals);
}
