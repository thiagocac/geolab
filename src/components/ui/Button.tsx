import type { ButtonHTMLAttributes, ReactNode } from 'react';
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const map: Record<Variant, string> = { primary: 'btn btn-primary', secondary: 'btn btn-secondary', danger: 'btn bg-red-600 text-white', ghost: 'btn bg-transparent text-slate-700 dark:text-slate-200' };
export function Button({ variant='primary', leftIcon, className='', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; leftIcon?: ReactNode }) { return <button type="button" className={`${map[variant]} ${className}`} {...props}>{leftIcon}{children}</button>; }
