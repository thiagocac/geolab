import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { Home, Truck, Flame, FileText, Import, Bell, Gauge, Boxes, Layers, Beaker, ClipboardCheck, ShieldAlert, LogOut, Sun, Moon, Menu, Building2, Clock } from './ui/icons';

type Item = { to: string; label: string; icon: typeof Home; end?: boolean; roles?: string[] };
type Section = { title?: string; items: Item[] };
const labRoles = ['admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista', 'operador_campo', 'financeiro'];
const adminRoles = ['admin', 'admin_consulte'];
const sections: Section[] = [
  { items: [{ to: '/', label: 'Painel', icon: Home, end: true }] },
  { title: 'Concreto', items: [
    { to: '/programacoes', label: 'Programações', icon: Clock, roles: labRoles },
    { to: '/concretagens', label: 'Concretagens', icon: Truck, roles: labRoles },
    { to: '/rompimentos', label: 'Rompimentos', icon: Flame, roles: labRoles },
    { to: '/laudos', label: 'Laudos', icon: FileText, roles: labRoles },
    { to: '/importacoes', label: 'Importações', icon: Import, roles: labRoles },
    { to: '/tracos', label: 'Traços', icon: Beaker, roles: labRoles },
  ] },
  { title: 'Cadastros', items: [
    { to: '/cadastros', label: 'Cadastros', icon: Boxes, roles: labRoles },
    { to: '/estrutura', label: 'Estrutura', icon: Layers, roles: labRoles },
    { to: '/portal/usuarios-clientes', label: 'Usuários de clientes', icon: Building2, roles: adminRoles },
  ] },
  { title: 'Portal', items: [
    { to: '/portal-cliente', label: 'Portal do cliente', icon: Building2, roles: ['cliente', 'admin', 'admin_consulte'] },
  ] },
  { title: 'Gestão', items: [
    { to: '/notificacoes', label: 'Notificações', icon: Bell, roles: labRoles },
    { to: '/preferencias', label: 'Preferências', icon: Gauge, roles: adminRoles },
    { to: '/gestao/controle-laudo', label: 'Campos do ensaio e laudo', icon: ClipboardCheck, roles: adminRoles },
    { to: '/gestao/campos-recebimento', label: 'Campos recebimento', icon: ClipboardCheck, roles: adminRoles },
    { to: '/gestao/campos-concretagem', label: 'Campos concretagem', icon: ClipboardCheck, roles: adminRoles },
  ] },
  { title: 'Operação interna', items: [{ to: '/operacao', label: 'Operação', icon: ShieldAlert, roles: adminRoles }] },
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
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg viewBox="0 0 104 100" width="30" height="29" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="0" y="0" width="104" height="24" rx="12" fill="#fff" />
            <rect x="0" y="38" width="62" height="24" rx="12" fill="#fff" />
            <rect x="0" y="76" width="104" height="24" rx="12" fill="#fff" />
          </svg>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 800, opacity: 0.85 }}>Consulte GEO</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, letterSpacing: '-.01em', lineHeight: 1 }}>GEOLAB</div>
          </div>
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
        <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--ink-faint)' }}>GEOLAB v31</div>
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
