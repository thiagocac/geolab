import type { ReactNode } from 'react';

// actions (v220): botões primários da tela na linha do título (padrão Concretagens).
export function PageHeader({ kicker, title, description, actions }: { kicker?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0"><p className="kicker">{kicker}</p><h1 className="mt-1 text-2xl sm:text-3xl display text-slate-950 dark:text-slate-50">{title}</h1></div>
        {actions ? <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div> : null}
      </div>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
    </header>
  );
}
