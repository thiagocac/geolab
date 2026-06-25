import { useRef, useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

// Tabela virtualizada e ordenável (TanStack Table headless + TanStack Virtual).
// Markup em divs (a virtualização por translateY quebra o layout nativo de <table>).
export function VirtualTable<T>({ data, columns, rowId, height = 560, estimateRow = 60, emptyLabel = 'Nenhum registro.' }: {
  data: T[]; columns: ColumnDef<T, unknown>[]; rowId: (row: T) => string; height?: number; estimateRow?: number; emptyLabel?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getRowId: rowId, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const rows = table.getRowModel().rows;
  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => estimateRow, overscan: 12 });
  const totalW = table.getTotalSize();
  const arrow: Record<string, string> = { asc: ' ↑', desc: ' ↓' };

  return (
    <div className="vt-scroll" ref={parentRef} style={{ height }}>
      <div className="vt" style={{ width: totalW, minWidth: '100%' }}>
        <div className="vt-head">
          {table.getHeaderGroups().map((hg) => hg.headers.map((h) => (
            <div key={h.id} className={'vt-th' + (h.column.getCanSort() ? ' vt-sortable' : '')} style={{ width: h.getSize() }} onClick={h.column.getToggleSortingHandler()}>
              {flexRender(h.column.columnDef.header, h.getContext())}{arrow[h.column.getIsSorted() as string] ?? ''}
            </div>
          )))}
        </div>
        {rows.length === 0 ? <div className="vt-empty">{emptyLabel}</div> : (
          <div className="vt-body" style={{ height: virt.getTotalSize() }}>
            {virt.getVirtualItems().map((vi) => {
              const row = rows[vi.index];
              return (
                <div key={row.id} className="vt-tr" data-index={vi.index} ref={virt.measureElement} style={{ transform: `translateY(${vi.start}px)` }}>
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
  );
}
