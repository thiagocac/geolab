import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { Card } from '../../../components/ui/Card';

export const money = (value: unknown) => (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const number = (value: unknown, digits = 0) => (Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const dateBr = (value: unknown) => {
  const text = String(value ?? '');
  if (!text) return '—';
  const date = new Date(text.length === 10 ? `${text}T12:00:00` : text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString('pt-BR');
};

export function MetricCard({ label, value, hint, tone = 'neutral' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const toneClass = tone === 'good' ? 'border-emerald-300/70' : tone === 'warn' ? 'border-amber-300/70' : tone === 'bad' ? 'border-red-300/70' : '';
  return <Card className={`p-5 ${toneClass}`}><p className="kicker">{label}</p><p className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-50">{value}</p>{hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}</Card>;
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'warn' | 'bad' | 'info' | 'neutral' }) {
  const tones = {
    good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    bad: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  } as const;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <Card className="overflow-hidden"><div className="table-scroll"><table className="table">{children}</table></div></Card>;
}
export function Th({ children, className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) { return <th className={className} {...props}>{children}</th>; }
export function Td({ children, className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) { return <td className={className} {...props}>{children}</td>; }

export type TabItem = string | { key: string; label: string; count?: number };
export function Tabs({ items, active, onChange }: { items: readonly TabItem[]; active: string; onChange: (value: string) => void }) {
  return <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seções">{items.map((item) => {
    const key = typeof item === 'string' ? item : item.key;
    const label = typeof item === 'string' ? item : item.label;
    const count = typeof item === 'string' ? undefined : item.count;
    return <button key={key} type="button" role="tab" aria-selected={active === key} className={active === key ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => onChange(key)}>{label}{typeof count === 'number' ? ` (${count})` : ''}</button>;
  })}</div>;
}
