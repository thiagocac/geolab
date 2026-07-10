import { useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { AlertTriangle } from './icons';

// Marcador de campo obrigatorio: asterisco magenta ao lado do rotulo.
// Renderizado sempre que o controle recebe `required`. aria-hidden porque o
// proprio `required` no controle nativo ja expoe a obrigatoriedade ao leitor de tela;
// o title cobre o mouse. Ver ds.md > "Campos obrigatorios".
function RequiredMark() {
  return <span className="ml-0.5 font-bold" style={{ color: 'var(--magenta)' }} title="Campo obrigatório" aria-hidden>*</span>;
}

// Mensagem do campo: erro (com ícone — não depende só de cor) ou dica.
// Recebe `id` para ser referenciada pelo aria-describedby do controle.
function FieldMsg({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error) return <span id={id} className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--magenta)' }}><AlertTriangle size={13} className="shrink-0" aria-hidden />{error}</span>;
  if (hint) return <span id={id} className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>;
  return null;
}

export function Field({ label, hint, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string }) {
  const id = useId();
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}{props.required ? <RequiredMark /> : null}</span>
      <input className="input" aria-invalid={error ? true : undefined} aria-describedby={error || hint ? id : undefined} {...props} />
      <FieldMsg id={id} error={error} hint={hint} />
    </label>
  );
}
export function TextArea({ label, hint, error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string }) {
  const id = useId();
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}{props.required ? <RequiredMark /> : null}</span>
      <textarea className="input min-h-28" aria-invalid={error ? true : undefined} aria-describedby={error || hint ? id : undefined} {...props} />
      <FieldMsg id={id} error={error} hint={hint} />
    </label>
  );
}
export function SelectField({ label, hint, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode; error?: string }) {
  const id = useId();
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}{props.required ? <RequiredMark /> : null}</span>
      <select className="input" aria-invalid={error ? true : undefined} aria-describedby={error || hint ? id : undefined} {...props}>{children}</select>
      <FieldMsg id={id} error={error} hint={hint} />
    </label>
  );
}
