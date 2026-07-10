import { useAuth } from '../../lib/auth';
import { TabShell } from '../../components/patterns/TabShell';
import { ClientePortalPage } from './ClientePortalPage';
import { ClienteUsuariosPage } from './ClienteUsuariosPage';

// [v228] Hub Portal — visao do portal do cliente + gestao dos usuarios de clientes em abas.
export function PortalHubPage({ inicial = 'portal' }: { inicial?: 'portal' | 'usuarios' }) {
  const { hasRole, can } = useAuth();
  return (
    <TabShell inicial={inicial} vazio="Sem acesso ao portal." tabs={[
      { key: 'portal', label: 'Portal do cliente', ok: hasRole('cliente', 'admin', 'admin_consulte'), render: () => <ClientePortalPage /> },
      { key: 'usuarios', label: 'Usuários de clientes', ok: can('portal.gerenciar'), render: () => <ClienteUsuariosPage /> },
    ]} />
  );
}
