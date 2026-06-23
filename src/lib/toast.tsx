import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Bell, CheckCircle, X, XCircle } from '../components/ui/icons';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';
type Toast = { id: number; kind: ToastKind; message: string };
type ToastState = { push: (message: string, kind?: ToastKind) => void };
const Ctx = createContext<ToastState | null>(null);

const iconFor: Record<ToastKind, typeof Bell> = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Bell };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, kind, message }]);
    window.setTimeout(() => dismiss(id), 3600);
  }, [dismiss]);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = iconFor[t.kind];
          return (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <span className="toast-ic"><Icon size={18} /></span>
              <span className="toast-msg">{t.message}</span>
              <button type="button" className="toast-x" aria-label="Dispensar" onClick={() => dismiss(t.id)}><X size={15} /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast fora do provider');
  return c.push;
}
