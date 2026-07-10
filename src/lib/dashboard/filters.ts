import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Dashboard v2 (DASH-F1) — filtros persistidos exclusivamente na URL (RN-DV2-01).
 * localStorage é proibido pelo check-source; a querystring é a fonte da verdade,
 * o que também dá deep-link e histórico de navegação de graça.
 */

export type DashFilterState = {
  from: string;
  to: string;
  clientId: string;
  workId: string;
  painel: string;
  q: string;
};

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function startOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function startOfYearISO(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export const PERIOD_PRESETS: Array<{ id: string; label: string; from: () => string }> = [
  { id: '7d', label: '7 dias', from: () => isoDaysAgo(7) },
  { id: '30d', label: '30 dias', from: () => isoDaysAgo(30) },
  { id: '90d', label: '90 dias', from: () => isoDaysAgo(90) },
  { id: 'mes', label: 'Mês atual', from: startOfMonthISO },
  { id: 'ano', label: 'Ano', from: startOfYearISO },
];

const URL_KEYS: Record<keyof DashFilterState, string> = {
  from: 'from',
  to: 'to',
  clientId: 'client_id',
  workId: 'work_id',
  painel: 'painel',
  q: 'q',
};

export function useDashboardFilters(defaults: Partial<DashFilterState> = {}) {
  const [sp, setSp] = useSearchParams();
  const state: DashFilterState = {
    from: sp.get('from') ?? defaults.from ?? startOfMonthISO(),
    to: sp.get('to') ?? defaults.to ?? todayISO(),
    clientId: sp.get('client_id') ?? defaults.clientId ?? '',
    workId: sp.get('work_id') ?? defaults.workId ?? '',
    painel: sp.get('painel') ?? defaults.painel ?? '',
    q: sp.get('q') ?? defaults.q ?? '',
  };
  const set = useCallback((patch: Partial<DashFilterState>) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        const urlKey = URL_KEYS[k as keyof DashFilterState];
        if (!urlKey) continue;
        if (v == null || v === '') next.delete(urlKey);
        else next.set(urlKey, String(v));
      }
      return next;
    }, { replace: true });
  }, [setSp]);
  return { ...state, set };
}
