import { useAuth } from '../../lib/auth';
import { TabShell } from '../../components/patterns/TabShell';
import { RecebimentoCpsPage } from './RecebimentoCpsPage';
import { EtiquetasPage } from './EtiquetasPage';
import { DescarteCpsPage } from './DescarteCpsPage';

// [v228] Hub CPs — cadeia fisica do corpo de prova (Grupo A/v227) em abas:
// check-in no lab, etiquetas de identificacao e descarte em lote com termo.
export function CpsHubPage({ inicial = 'recebimento' }: { inicial?: 'recebimento' | 'etiquetas' | 'descarte' }) {
  const { hasRole, can } = useAuth();
  const lab = hasRole('admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista', 'operador_campo', 'financeiro');
  return (
    <TabShell inicial={inicial} vazio="Sem acesso aos CPs." tabs={[
      { key: 'recebimento', label: 'Recebimento', ok: lab, render: () => <RecebimentoCpsPage /> },
      { key: 'etiquetas', label: 'Etiquetas', ok: can('etiqueta.ver'), render: () => <EtiquetasPage /> },
      { key: 'descarte', label: 'Descarte', ok: lab, render: () => <DescarteCpsPage /> },
    ]} />
  );
}
