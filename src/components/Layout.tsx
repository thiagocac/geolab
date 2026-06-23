import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { Button } from './ui/Button';
import { Home, Truck, Flame, FileText, Import, Bell, Gauge, Boxes, ShieldAlert, LogOut, Sun, Moon } from './ui/icons';

type NavItem = { to: string; label: string; icon: typeof Home; end: boolean; roles?: string[] };
const nav: NavItem[] = [
  { to: '/', label: 'Painel', icon: Home, end: true },
  { to: '/concretagens', label: 'Concretagens', icon: Truck, end: false },
  { to: '/rompimentos', label: 'Rompimentos', icon: Flame, end: false },
  { to: '/laudos', label: 'Laudos', icon: FileText, end: false },
  { to: '/importacoes', label: 'Importacoes', icon: Import, end: false },
  { to: '/notificacoes', label: 'Notificacoes', icon: Bell, end: false },
  { to: '/preferencias', label: 'Preferencias', icon: Gauge, end: false, roles: ['admin', 'admin_consulte'] },
  { to: '/cadastros', label: 'Cadastros', icon: Boxes, end: false },
  { to: '/operacao', label: 'Operacao', icon: ShieldAlert, end: false, roles: ['admin', 'admin_consulte'] },
];

export function Layout({ children }: { children: ReactNode }) {
  const { member, signOut, hasRole } = useAuth();
  const { theme, toggle } = useTheme();
  const items = nav.filter((n) => !n.roles || hasRole(...n.roles));
  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <aside style={{ width: 220, borderRight: '1px solid #e5e7eb', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}><span style={{ color: '#182863' }}>Consulte </span><span style={{ color: '#C5117E' }}>GEO</span></div>
        <nav style={{ display: 'grid', gap: 4 }}>
          {items.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink key={n.to} to={n.to} end={n.end} style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, textDecoration: 'none', fontSize: 14, background: isActive ? '#182863' : 'transparent', color: isActive ? '#ffffff' : '#374151' })}>
                <Icon size={18} /> {n.label}
              </NavLink>
            );
          })}
        </nav>
        <div style={{ marginTop: 'auto', fontSize: 11, color: '#9ca3af' }}>GEOLAB - v18</div>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #e5e7eb', gap: 12 }}>
          <span style={{ fontWeight: 600 }}>{member?.tenant_name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => toggle()} aria-label="Alternar tema" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280', display: 'inline-flex' }}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{member?.email}</span>
            <Button variant="ghost" leftIcon={<LogOut size={16} />} onClick={() => void signOut()}>Sair</Button>
          </div>
        </header>
        <main id="conteudo" style={{ padding: 24, flex: 1, minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
