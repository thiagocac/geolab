import type { CSSProperties } from 'react';

// onClick (v220): KPI clicável (aplica filtro na tela). active = filtro deste card aplicado.
export function Stat({ label, value, detail, onClick, active, valueStyle }: { label: string; value: string | number; detail?: string; onClick?: () => void; active?: boolean; valueStyle?: CSSProperties }) {
  const cls = `rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${active ? 'border-magenta' : 'border-slate-200 dark:border-slate-700'}`;
  const inner = (
    <>
      <p className="kicker">{label}</p>
      <strong className="mt-2 block text-2xl font-extrabold text-slate-950 dark:text-slate-50 tabular-nums" style={valueStyle}>{value}</strong>
      {detail && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p>}
    </>
  );
  if (onClick) return <button type="button" className={`${cls} w-full text-left transition hover:-translate-y-0.5 hover:shadow-md`} onClick={onClick} aria-pressed={active}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}
