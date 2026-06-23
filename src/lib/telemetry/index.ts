import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { emit, flushTelemetry, installTelemetry, captureException } from './instrument';
import { installVitals } from './vitals';
import { addBreadcrumb, newTrace, setContext, currentTraceId, type TelemetryLevel } from './core';

export { emit, captureException } from './instrument';
export { addBreadcrumb, setContext, newTrace, currentTraceId, type TelemetryLevel } from './core';
export const flush = flushTelemetry;

/** Logger estruturado por nível (category = subsistema). debug é amostrado e sai em produção. */
export const log = {
  debug: (category: string, message: string, metadata?: Record<string, unknown>) => emit({ category, name: message, severity: 'debug', sample: 0.2, metadata }),
  info: (category: string, message: string, metadata?: Record<string, unknown>) => emit({ category, name: message, severity: 'info', metadata }),
  warn: (category: string, message: string, metadata?: Record<string, unknown>) => emit({ category, name: message, severity: 'warn', metadata }),
  error: (category: string, message: string, metadata?: Record<string, unknown>) => emit({ category, name: message, severity: 'error', metadata }),
};

/** Métrica de performance arbitrária (category 'metric'). */
export function trackMetric(name: string, value: number, unit = 'ms', metadata?: Record<string, unknown>) {
  emit({ category: 'metric', name, value: Math.round(value), severity: 'info', metadata: { unit, ...(metadata ?? {}) } });
}

/** Evento genérico. */
export function trackEvent(category: string, message: string, metadata?: Record<string, unknown>, severity: TelemetryLevel = 'info') {
  emit({ category, name: message, severity, metadata });
}

/** Evento de DOMÍNIO (funil de uso): ex. 'medicao.salva', 'concretagem.confirmada'. Nunca amostrado. */
export function trackDomainEvent(event: string, metadata?: Record<string, unknown>) {
  const area = event.includes('.') ? event.split('.')[0] : 'geral';
  emit({ category: 'domain', name: event, severity: 'info', sample: 1, metadata: { event, area, ...(metadata ?? {}) } });
}

/** Inicialização única (main.tsx, antes do render). */
export function initTelemetry() {
  setContext({ app_started_at: new Date().toISOString() });
  installTelemetry();
  installVitals();
}

/** Correlação de rota: nova trace por rota + spa-nav-ms. Montar 1x dentro do Router. */
export function useRouteTelemetry() {
  const loc = useLocation();
  const first = useRef(true);
  useEffect(() => {
    newTrace();
    addBreadcrumb('navigation', { path: loc.pathname });
    if (first.current) { first.current = false; return; }
    const t0 = performance.now();
    let r1 = 0; let r2 = 0;
    r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => { trackMetric('spa-nav-ms', performance.now() - t0, 'ms', { path: loc.pathname }); }); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [loc.pathname]);
}
