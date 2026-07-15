import { useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { AlertTriangle } from './icons';

// Marcador de campo obrigatorio: asterisco magenta ao lado do rotulo.
// Renderizado sempre que o controle recebe `required`. aria-hidden porque o
// proprio `required` no controle nativo ja expoe a obrigatoriedade ao leitor de tela;
// o title cobre o mouse. Ver ds.md > "Campos obrigatorios".
// Auditoria craft v248: --magenta nao e re-tematizado no dark; --tone-brand-fg e o
// mesmo magenta com lightness por tema (light ~5.4:1, dark ~8.0:1 sobre --surface).
function RequiredMark() {
  return <span className="ml-0.5 font-bold" style={{ color: 'var(--tone-brand-fg)' }} title="Campo obrigatório" aria-hidden>*</span>;
}

// Mensagem do campo. Tres niveis, do mais forte ao mais fraco:
//   error   -> bloqueia; o controle recebe aria-invalid. Tom de marca + icone.
//   warning -> aviso NAO bloqueante (ex.: "fora da faixa usual"): tom de atencao + icone,
//              e SEM aria-invalid — o leitor nao deve anunciar o campo como invalido.
//   hint    -> texto neutro de apoio.
// Nunca depende so de cor: erro/aviso sempre acompanham o icone.
function FieldMsg({ id, error, warning, hint }: { id: string; error?: string; warning?: string; hint?: ReactNode }) {
  if (error) return <span id={id} className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--tone-brand-fg)' }}><AlertTriangle size={13} className="shrink-0" aria-hidden />{error}</span>;
  if (warning) return <span id={id} className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--tone-warning-fg)' }}><AlertTriangle size={13} className="shrink-0" aria-hidden />{warning}</span>;
  if (hint) return <span id={id} className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>;
  return null;
}

type Msg = { label: string; hint?: ReactNode; error?: string; warning?: string };

export function Field({ label, hint, error, warning, ...props }: InputHTMLAttributes<HTMLInputElement> & Msg) {
  const id = useId();
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}{props.required ? <RequiredMark /> : null}</span>
      <input className="input" autoComplete="off" aria-invalid={error ? true : undefined} aria-describedby={error || warning || hint ? id : undefined} {...props} />
      <FieldMsg id={id} error={error} warning={warning} hint={hint} />
    </label>
  );
}
export function TextArea({ label, hint, error, warning, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & Msg) {
  const id = useId();
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}{props.required ? <RequiredMark /> : null}</span>
      <textarea className="input min-h-28" autoComplete="off" aria-invalid={error ? true : undefined} aria-describedby={error || warning || hint ? id : undefined} {...props} />
      <FieldMsg id={id} error={error} warning={warning} hint={hint} />
    </label>
  );
}
export function SelectField({ label, hint, error, warning, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & Msg) {
  const id = useId();
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}{props.required ? <RequiredMark /> : null}</span>
      <select className="input" aria-invalid={error ? true : undefined} aria-describedby={error || warning || hint ? id : undefined} {...props}>{children}</select>
      <FieldMsg id={id} error={error} warning={warning} hint={hint} />
    </label>
  );
}
