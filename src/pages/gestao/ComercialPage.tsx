import { useAuth } from '../../lib/auth';
import { TabShell } from '../../components/patterns/TabShell';
import { CrmPage } from './CrmPage';
import { PropostasPage } from './PropostasPage';
import { ContractsV2Page } from './ContractsV2Page';
import { CatalogoServicosPage } from './CatalogoServicosPage';
import { TemplatesDocumentosPage } from './TemplatesDocumentosPage';

// [v228] Hub Comercial — funil proposta→contrato (v222/v224) em abas. Contratos = v2 (canonico;
// ContratosFinanceiroPage v1 preservada no repo, sem rota).
export function ComercialPage({ inicial = 'crm' }: { inicial?: 'crm' | 'propostas' | 'contratos' | 'catalogo' | 'templates' }) {
  const { can } = useAuth();
  return (
    <TabShell inicial={inicial} vazio="Sem acesso ao comercial." tabs={[
      { key: 'crm', label: 'CRM', ok: can('crm.ver'), render: () => <CrmPage /> },
      { key: 'propostas', label: 'Propostas', ok: can('proposta.ver'), render: () => <PropostasPage /> },
      { key: 'contratos', label: 'Contratos', ok: can('contrato.gerenciar'), render: () => <ContractsV2Page /> },
      { key: 'catalogo', label: 'Catálogo', ok: can('servico_catalogo.ver'), render: () => <CatalogoServicosPage /> },
      { key: 'templates', label: 'Templates', ok: can('documento_template.ver'), render: () => <TemplatesDocumentosPage /> },
    ]} />
  );
}
