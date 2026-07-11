import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeName = 'light' | 'dark';
type ThemeState = { theme: ThemeName; setTheme: (t: ThemeName) => void; toggle: () => void };
const Ctx = createContext<ThemeState | null>(null);

const COOKIE = 'cg_theme';

function prefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Lê a preferência persistida em cookie. O DS proíbe localStorage/sessionStorage; cookie é permitido
 *  e é lido também por um script inline no index.html, matando o flash de tema errado no boot. */
function readCookieTheme(): ThemeName | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)cg_theme=(light|dark)\b/);
  return m ? (m[1] as ThemeName) : null;
}

function persist(theme: ThemeName) {
  if (typeof document === 'undefined') return;
  // 1 ano; SameSite=Lax; caminho raiz. Não é dado sensível — só a preferência visual.
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Tema da interface (claro/escuro). Semeadura: cookie persistido → preferência do sistema.
 * A escolha do usuário grava no cookie e sobrevive ao reload (antes reiniciava no tema do SO).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => readCookieTheme() ?? (prefersDark() ? 'dark' : 'light'));
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0E1B40' : '#182863');
    persist(theme);
  }, [theme]);
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return <Ctx.Provider value={{ theme, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme fora do provider');
  return c;
}
