import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Field, SelectField } from '../ui/Field';
import { PERIOD_PRESETS, todayISO } from '../../lib/dashboard/filters';
import { getDashboardFilterOptions, emptyFilterOptions } from '../../lib/api/dashboardV2';

/**
 * Dashboard v2 — shell full-viewport + barra de filtros padronizada (E.3).
 * A barra é sticky, escreve na URL (via useDashboardFilters do chamador) e carrega as opções
 * de cliente/obra numa única query (v_dashboard_filter_options, mig 205). Obra depende do cliente.
 */

export function DashboardShell({ filterBar, children }: { filterBar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4" style={{ minHeight: 'calc(100vh - 130px)' }}>
      <div className="sticky top-16 z-20 -mx-1 px-1">
        <div className="rounded-2xl border border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          {filterBar}
        </div>
      </div>
      <div className="flex-1 space-y-4">{children}</div>
    </div>
  );
}

export function DashboardFilterBar({ from, to, clientId, workId, onChange, extra }: {
  from: string;
  to: string;
  clientId: string;
  workId: string;
  onChange: (patch: { from?: string; to?: string; clientId?: string; workId?: string }) => void;
  extra?: ReactNode;
}) {
  const optsQ = useQuery({ queryKey: ['dashboard-filter-options'], queryFn: getDashboardFilterOptions, staleTime: 5 * 60_000 });
  const opts = optsQ.data ?? emptyFilterOptions;
  const obras = clientId ? opts.obras.filter((o) => o.parent_id === clientId) : opts.obras;
  return (
    <div className="flex flex-wrap items-end gap-3 p-4">
      <div className="flex items-end gap-1.5 pb-0.5">
        {PERIOD_PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => onChange({ from: p.from(), to: todayISO() })}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${from === p.from() ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="w-36"><Field label="De" type="date" value={from} onChange={(e) => onChange({ from: e.target.value })} /></div>
      <div className="w-36"><Field label="Até" type="date" value={to} onChange={(e) => onChange({ to: e.target.value })} /></div>
      <div className="min-w-44 flex-1">
        <SelectField label="Cliente" value={clientId} onChange={(e) => onChange({ clientId: e.target.value, workId: '' })}>
          <option value="">Todos os clientes</option>
          {opts.clientes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </SelectField>
      </div>
      <div className="min-w-44 flex-1">
        <SelectField label="Obra" value={workId} onChange={(e) => onChange({ workId: e.target.value })}>
          <option value="">Todas as obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </SelectField>
      </div>
      {extra}
    </div>
  );
}
