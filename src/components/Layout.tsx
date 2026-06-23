import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { Home, Truck, Flame, FileText, Import, Bell, Gauge, Boxes, ShieldAlert, LogOut, Sun, Moon, Menu } from './ui/icons';

type Item = { to: string; label: string; icon: typeof Home; end?: boolean; roles?: string[] };
type Section = { title?: string; items: Item[] };
const sections: Section[] = [
  { items: [{ to: '/', label: 'Painel', icon: Home, end: true }] },
  { title: 'Concreto', items: [
    { to: '/concretagens', label: 'Concretagens', icon: Truck },
    { to: '/rompimentos', label: 'Rompimentos', icon: Flame },
    { to: '/laudos', label: 'Laudos', icon: FileText },
    { to: '/importacoes', label: 'Importacoes', icon: Import },
  ] },
  { title: 'Cadastros', items: [{ to: '/cadastros', label: 'Cadastros', icon: Boxes }] },
  { title: 'Gestao', items: [
    { to: '/notificacoes', label: 'Notificacoes', icon: Bell },
    { to: '/preferencias', label: 'Preferencias', icon: Gauge, roles: ['admin', 'admin_consulte'] },
  ] },
  { title: 'Operacao interna', items: [{ to: '/operacao', label: 'Operacao', icon: ShieldAlert, roles: ['admin', 'admin_consulte'] }] },
];

export function Layout({ children }: { children: ReactNode }) {
  const { member, signOut, hasRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const can = (it: Item) => !it.roles || hasRole(...it.roles);
  return (
    <div className="app-shell">
      {open ? <div className="nav-scrim" onClick={() => setOpen(false)} /> : null}
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="sidebar-brand">
          <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 800, opacity: 0.85 }}>Consulte GEO</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>GEOLAB</div>
        </div>
        <nav className="sidebar-nav">
          {sections.map((sec, i) => {
            const items = sec.items.filter(can);
            if (!items.length) return null;
            return (
              <div key={i}>
                {sec.title ? <div className="nav-sect">{sec.title}</div> : null}
                {items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <NavLink key={it.to} to={it.to} end={it.end} onClick={() => setOpen(false)} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                      <Icon size={18} /> {it.label}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--ink-faint)' }}>GEOLAB v25</div>
      </aside>
      <div className="content-col">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Menu" onClick={() => setOpen((o) => !o)}><Menu size={20} /></button>
          <span style={{ fontWeight: 700, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member?.tenant_name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <div className="theme-toggle">
              <button className={theme === 'light' ? 'on' : ''} aria-label="Tema claro" onClick={() => setTheme('light')}><Sun size={16} /></button>
              <button className={theme === 'dark' ? 'on' : ''} aria-label="Tema escuro" onClick={() => setTheme('dark')}><Moon size={16} /></button>
            </div>
            <span style={{ fontSize: 13, color: 'var(--ink-faint)' }} className="hide-sm">{member?.email}</span>
            <button className="icon-btn" aria-label="Sair" onClick={() => void signOut()}><LogOut size={18} /></button>
          </div>
        </header>
        <main id="conteudo" className="page-wrap">{children}</main>
      </div>
    </div>
  );
}
