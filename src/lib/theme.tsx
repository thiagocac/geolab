import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeName = 'light' | 'dark';
type ThemeState = { theme: ThemeName; setTheme: (t: ThemeName) => void; toggle: () => void };
const Ctx = createContext<ThemeState | null>(null);

function prefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Tema da interface (claro/escuro).
 * Semeado pela preferência do sistema. Sem localStorage (regra do DS) — em produção,
 * persistir a escolha no perfil do membro (coluna/RPC) e semear a partir dela.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => (prefersDark() ? 'dark' : 'light'));
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return <Ctx.Provider value={{ theme, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme fora do provider');
  return c;
}
