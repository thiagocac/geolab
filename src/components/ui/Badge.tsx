import type { ReactNode } from 'react';
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
const tones: Record<Tone,string> = { neutral:'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200', success:'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300', warning:'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200', danger:'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300', info:'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200', brand:'bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-300' };
export function Badge({ children, tone='neutral' }: { children: ReactNode; tone?: Tone }) { return <span className={`badge ${tones[tone]}`}>{children}</span>; }
