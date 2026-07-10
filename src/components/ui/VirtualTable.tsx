import { useRef, useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

// Tabela virtualizada e ordenável (TanStack Table headless + TanStack Virtual).
// Markup em divs (a virtualização por translateY quebra o layout nativo de <table>).
// Desktop/tablet (md+): tabela virtualizada. Mobile: cada linha vira um cartão rótulo/valor
// (espelha o DataTable), evitando rolagem horizontal de tabelas largas no celular.
const ACTION_IDS = new Set(['acoes', 'ações', 'actions', '__actions', 'abrir']);

export function VirtualTable<T>({ data, columns, rowId, height = 560, estimateRow = 60, emptyLabel = 'Nenhum registro.', rowClassName }: {
  data: T[]; columns: ColumnDef<T, unknown>[]; rowId: (row: T) => string; height?: number; estimateRow?: number; emptyLabel?: string; rowClassName?: (row: T) => string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [mLimit, setMLimit] = useState(40); // T24: mobile rende cartoes sem virtualizacao — limita e pagina
  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getRowId: rowId, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const rows = table.getRowModel().rows;
  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => estimateRow, overscan: 12 });
  const totalW = table.getTotalSize();
  const arrow: Record<string, string> = { asc: ' ↑', desc: ' ↓' };
  // Rótulos por coluna para o modo-cartão (mobile) e detecção da coluna de ações.
  const headerById = new Map(table.getFlatHeaders().map((h) => [h.column.id, flexRender(h.column.columnDef.header, h.getContext())]));
  const isActions = (id: string) => ACTION_IDS.has(id.toLowerCase());

  return (
    <>
      {/* Desktop / tablet: tabela virtualizada */}
      <div className="vt-scroll hidden md:block" ref={parentRef} style={{ height }}>
        <div className="vt" style={{ width: totalW, minWidth: '100%' }}>
          <div className="vt-head">
            {table.getHeaderGroups().map((hg) => hg.headers.map((h) => {
              const content = <>{flexRender(h.column.columnDef.header, h.getContext())}{arrow[h.column.getIsSorted() as string] ?? ''}</>;
              if (!h.column.getCanSort()) return <div key={h.id} className="vt-th" style={{ width: h.getSize() }}>{content}</div>;
              return (
                <button key={h.id} type="button" className="vt-th vt-sortable" style={{ width: h.getSize() }} onClick={h.column.getToggleSortingHandler()}>
                  {content}
                </button>
              );
            }))}
          </div>
          {rows.length === 0 ? <div className="vt-empty">{emptyLabel}</div> : (
            <div className="vt-body" style={{ height: virt.getTotalSize() }}>
              {virt.getVirtualItems().map((vi) => {
                const row = rows[vi.index];
                return (
                  <div key={row.id} className={'vt-tr' + (rowClassName ? ' ' + rowClassName(row.original) : '')} data-index={vi.index} ref={virt.measureElement} style={{ transform: `translateY(${vi.start}px)` }}>
                    {row.getVisibleCells().map((cell) => (
                      <div key={cell.id} className="vt-td" style={{ width: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: cada linha vira um cartão (rótulo/valor empilhados) */}
      <div className="space-y-2 md:hidden">
        {rows.length === 0 ? (
          <div className="vt-empty card">{emptyLabel}</div>
        ) : rows.slice(0, mLimit).map((row) => (
          <div key={row.id} className="card space-y-1.5 p-3">
            {row.getVisibleCells().map((cell, ci) => {
              const content = flexRender(cell.column.columnDef.cell, cell.getContext());
              if (isActions(cell.column.id)) return <div key={cell.id} className={ci > 0 ? 'flex flex-wrap gap-2 border-t border-slate-100 pt-2 dark:border-slate-800' : 'flex flex-wrap gap-2'}>{content}</div>;
              return (
                <div key={cell.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">{headerById.get(cell.column.id)}</span>
                  <span className="min-w-0 break-words text-right font-medium text-slate-800 dark:text-slate-100">{content}</span>
                </div>
              );
            })}
          </div>
        ))}
        {rows.length > mLimit ? <button type="button" className="btn btn-secondary w-full" onClick={() => setMLimit((v) => v + 80)}>Mostrar mais ({rows.length - mLimit} restantes)</button> : null}
      </div>
    </>
  );
}
