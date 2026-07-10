import { useMemo } from 'react';

export type HeatmapCell = { row: string; col: string; valor: number; detalhe?: string };

/**
 * Dashboard v2 — heatmap real em matriz (correção DB-009: antes era "heatmap" desenhado em barras).
 * Intensidade da célula na magenta da marca; grade rolável horizontalmente no mobile.
 */
export function HeatmapMatrix({ cells, rowLabel = 'Obra', valueFmt }: {
  cells: HeatmapCell[];
  rowLabel?: string;
  valueFmt?: (v: number) => string;
}) {
  const { rows, cols, byKey, max } = useMemo(() => {
    const rowsU = [...new Set(cells.map((c) => c.row))];
    const colsU = [...new Set(cells.map((c) => c.col))];
    const map = new Map<string, HeatmapCell>();
    let m = 0;
    for (const c of cells) {
      map.set(`${c.row} ${c.col}`, c);
      if (c.valor > m) m = c.valor;
    }
    return { rows: rowsU, cols: colsU, byKey: map, max: m || 1 };
  }, [cells]);
  const fmt = valueFmt ?? ((v: number) => v.toLocaleString('pt-BR'));
  if (!cells.length) return <p className="p-4 text-sm text-slate-500">Sem dados para montar o mapa no período.</p>;
  return (
    <div className="table-scroll">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-xs font-black uppercase text-slate-500">{rowLabel}</th>
            {cols.map((c) => <th key={c} className="px-2 py-1 text-center text-xs font-black uppercase text-slate-500">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td className="max-w-[220px] truncate px-2 py-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{r}</td>
              {cols.map((c) => {
                const cell = byKey.get(`${r} ${c}`);
                const ratio = cell ? Math.max(0.08, cell.valor / max) : 0;
                return (
                  <td key={c} className="rounded-lg px-2 py-2 text-center text-xs font-bold tabular-nums"
                    title={cell?.detalhe ?? (cell ? `${r} · ${c}: ${fmt(cell.valor)}` : `${r} · ${c}: sem dados`)}
                    style={cell
                      ? { background: `rgba(197, 17, 126, ${(0.08 + ratio * 0.78).toFixed(2)})`, color: ratio > 0.55 ? '#fff' : 'var(--ink)' }
                      : { background: 'var(--surface-2)', color: 'var(--ink-faint)' }}>
                    {cell ? fmt(cell.valor) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
