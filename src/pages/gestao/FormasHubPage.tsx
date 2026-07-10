import { useAuth } from '../../lib/auth';
import { TabShell } from '../../components/patterns/TabShell';
import { FormasPage } from './FormasPage';
import { ColetaFormasPage } from '../concreto/ColetaFormasPage';

// [v228] Hub Fôrmas — inventario/ledger de formas e coleta em obra (rota otimizada) em abas.
export function FormasHubPage({ inicial = 'formas' }: { inicial?: 'formas' | 'coleta' }) {
  const { can } = useAuth();
  return (
    <TabShell inicial={inicial} vazio="Sem acesso a fôrmas." tabs={[
      { key: 'formas', label: 'Fôrmas', ok: can('forma.ver'), render: () => <FormasPage /> },
      { key: 'coleta', label: 'Coleta de fôrmas', ok: can('coleta.executar'), render: () => <ColetaFormasPage /> },
    ]} />
  );
}
