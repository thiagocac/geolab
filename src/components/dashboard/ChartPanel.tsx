import type { ReactNode } from 'react';

/**
 * Dashboard v2 — painel de gráfico full-height (substitui o ChartBox de 280px fixos).
 * Altura responsiva: o gráfico principal ocupa ~52% da altura útil do viewport em desktop
 * (CA-DV2-02), com piso/teto para não degenerar em telas muito baixas/altas.
 * `size="half"` para pares empilhados (ex.: cartas X̄ e R juntas na tela).
 */
export function ChartPanel({ title, action, note, empty, size = 'main', children }: {
  title: string;
  action?: { label: string; onClick: () => void };
  note?: string;
  empty?: boolean;
  size?: 'main' | 'half';
  children: ReactNode;
}) {
  const height = size === 'half' ? 'clamp(260px, 38vh, 460px)' : 'clamp(340px, 52vh, 640px)';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="kicker">{title}</p>
        {action ? (
          <button type="button" onClick={action.onClick}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            {action.label}
          </button>
        ) : null}
      </div>
      {empty ? (
        <div className="flex items-center justify-center text-sm text-slate-500" style={{ height }}>
          Sem dados no período com os filtros atuais — ajuste o período ou limpe cliente/obra.
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
      {note ? <p className="mt-2 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}
