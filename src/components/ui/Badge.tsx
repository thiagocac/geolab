import type { ReactNode } from 'react';
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
// v237 (Concresoft DS): tom -> classe semantica (dot + bg + texto via tokens --tone-*). Nunca cor sozinha.
export function Badge({ children, tone='neutral' }: { children: ReactNode; tone?: Tone }) { return <span className={`badge badge-${tone}`}><span className="badge-dot" aria-hidden />{children}</span>; }
