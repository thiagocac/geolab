import { type ButtonHTMLAttributes, type MouseEvent, type ReactNode, useRef } from 'react';
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const map: Record<Variant, string> = { primary: 'btn btn-primary', secondary: 'btn btn-secondary', danger: 'btn bg-red-600 text-white', ghost: 'btn bg-transparent text-slate-700 dark:text-slate-200' };
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; leftIcon?: ReactNode; busy?: boolean };
export function Button({ variant='primary', leftIcon, busy, className='', children, onClick, ...props }: Props) {
  // `busy` substitui `disabled` durante a request: mantem o botao focavel (disabled joga o foco pro body)
  // e bloqueia o clique aqui. A trava de ref cobre so a janela entre o clique e o re-render que propaga
  // busy=true; libera no tick seguinte para nunca prender um handler que retorne antes de entrar em busy.
  const lock = useRef(false);
  function guarded(e: MouseEvent<HTMLButtonElement>) {
    if (busy || lock.current) return;
    lock.current = true;
    setTimeout(() => { lock.current = false; }, 0);
    onClick?.(e);
  }
  return <button type="button" aria-busy={busy || undefined} className={`${map[variant]} ${className}`} onClick={busy === undefined ? onClick : guarded} {...props}>{leftIcon}{children}</button>;
}
