import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from './icons';

export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div ref={panelRef} tabIndex={-1} className={`w-full ${wide ? 'max-w-3xl max-h-[90vh] overflow-y-auto' : 'max-w-md'} rounded-2xl bg-white p-6 shadow-2xl outline-none dark:bg-slate-900`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">{title}</h2>
          <button type="button" className="icon-btn !min-h-8 !min-w-8" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        </div>
        {children}
        {footer ? <div className="mt-4 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
