import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

function ErrorText({ error, hint }: { error?: string; hint?: ReactNode }) {
  if (error) return <span className="block text-xs font-semibold" style={{ color: 'var(--magenta)' }}>{error}</span>;
  if (hint) return <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>;
  return null;
}

export function Field({ label, hint, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  return <label className="block min-w-0 space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span><input className="input" aria-invalid={error ? true : undefined} {...props} /><ErrorText error={error} hint={hint} /></label>;
}
export function TextArea({ label, error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  return <label className="block min-w-0 space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span><textarea className="input min-h-28" aria-invalid={error ? true : undefined} {...props} /><ErrorText error={error} /></label>;
}
export function SelectField({ label, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  return <label className="block min-w-0 space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span><select className="input" aria-invalid={error ? true : undefined} {...props}>{children}</select><ErrorText error={error} /></label>;
}
