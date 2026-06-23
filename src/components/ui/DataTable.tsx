import { ArrowDown, ArrowUp } from './icons';
import type { Column, DomainRow, SortState } from '../../lib/api/types';
import { formatDate, formatNumber, safeText } from '../../lib/format';
export type { Column } from '../../lib/api/types';

export function DataTable<T extends DomainRow>({ rows, columns, rowKey, sort, onSort }: { rows: T[]; columns: Array<Column<T>>; rowKey: (row: T) => string; sort: SortState; onSort: (sort: SortState) => void }) {
  return (
    <>
      {/* Desktop / tablet: tabela */}
      <div className="card table-scroll hidden md:block">
        <table className="table">
          <thead><tr>{columns.map((c) => <th key={c.key}>{c.sortable ? <button type="button" className="inline-flex min-h-11 items-center gap-1" onClick={() => onSort({ column: c.key, direction: sort.column === c.key && sort.direction === 'asc' ? 'desc' : 'asc' })}>{c.header}{sort.column === c.key ? (sort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : null}</button> : c.header}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={rowKey(row)}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : render(row[c.key], c.type)}</td>)}</tr>)}</tbody>
        </table>
      </div>

      {/* Mobile: cada linha vira um cartão (label/valor empilhados) */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="card space-y-1.5 p-3">
            {columns.map((c) => {
              const content = c.render ? c.render(row) : render(row[c.key], c.type);
              if (c.key === '__actions') return <div key={c.key} className="flex flex-wrap gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">{content}</div>;
              return (
                <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">{c.header}</span>
                  <span className="min-w-0 break-words text-right font-medium text-slate-800 dark:text-slate-100">{content}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
function render(value: unknown, type?: 'date' | 'number' | 'text') { if (value === null || value === undefined || value === '') return '-'; if (type === 'date') return formatDate(String(value)); if (type === 'number') return formatNumber(Number(value)); return safeText(value); }
