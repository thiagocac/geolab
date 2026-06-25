import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Button } from './Button';

type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));
export function useConfirm(): ConfirmFn { return useContext(ConfirmContext); }

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const confirm = useCallback<ConfirmFn>((o) => new Promise<boolean>((resolve) => { resolver.current = resolve; setOpts(o); }), []);
  const settle = useCallback((ok: boolean) => { const r = resolver.current; resolver.current = null; setOpts(null); r?.(ok); }, []);
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={opts !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="bui-backdrop-top" />
          <AlertDialog.Popup className="bui-popup card p-6">
            <AlertDialog.Title className="text-lg display text-slate-950 dark:text-slate-50">{opts?.title}</AlertDialog.Title>
            {opts?.message ? <AlertDialog.Description className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{opts.message}</AlertDialog.Description> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => settle(false)}>{opts?.cancelLabel ?? 'Cancelar'}</Button>
              <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>{opts?.confirmLabel ?? 'Confirmar'}</Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}
