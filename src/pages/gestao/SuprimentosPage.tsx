import { useAuth } from '../../lib/auth';
import { TabShell } from '../../components/patterns/TabShell';
import { InventoryPage } from './InventoryPage';
import { ProcurementPage } from './ProcurementPage';

// [v228] Hub Suprimentos — estoque de insumos e compras/reposicao (v223/v224) em abas.
export function SuprimentosPage({ inicial = 'estoque' }: { inicial?: 'estoque' | 'compras' }) {
  const { can } = useAuth();
  return (
    <TabShell inicial={inicial} vazio="Sem acesso a suprimentos." tabs={[
      { key: 'estoque', label: 'Estoque', ok: can('estoque.ver'), render: () => <InventoryPage /> },
      { key: 'compras', label: 'Compras e reposição', ok: can('compras.ver'), render: () => <ProcurementPage /> },
    ]} />
  );
}
