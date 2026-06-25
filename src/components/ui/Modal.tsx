import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from './icons';

export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="bui-backdrop" />
        <Dialog.Popup className={'bui-modal card p-6' + (wide ? ' bui-modal-wide' : '')}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <Dialog.Title className="text-lg display text-slate-950 dark:text-slate-50">{title}</Dialog.Title>
            <button type="button" className="icon-btn !min-h-8 !min-w-8" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
          </div>
          {children}
          {footer ? <div className="mt-4 flex justify-end gap-2">{footer}</div> : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
