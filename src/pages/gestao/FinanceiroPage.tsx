import { useAuth } from '../../lib/auth';
import { TabShell } from '../../components/patterns/TabShell';
import { MedicaoV2Page } from './MedicaoV2Page';
import { FaturasPage } from './FaturasPage';
import { CashflowPage } from './CashflowPage';
import { BankReconciliationPage } from './BankReconciliationPage';

// [v228] Financeiro consolidado (reescrita do C3/v168): Medições = v2 (canonico; MedicaoPage v1
// preservada no repo, sem rota). Propostas/Contratos/Catálogo migraram para o hub Comercial.
export function FinanceiroPage({ inicial = 'medicoes' }: { inicial?: 'medicoes' | 'faturas' | 'fluxo' | 'conciliacao' }) {
  const { hasRole, can } = useAuth();
  return (
    <TabShell inicial={inicial} vazio="Sem acesso ao financeiro." tabs={[
      { key: 'medicoes', label: 'Medições', ok: can('medicao.ver'), render: () => <MedicaoV2Page /> },
      { key: 'faturas', label: 'Faturas', ok: hasRole('admin', 'admin_consulte', 'financeiro'), render: () => <FaturasPage /> },
      { key: 'fluxo', label: 'Fluxo de caixa', ok: can('financeiro.ver'), render: () => <CashflowPage /> },
      { key: 'conciliacao', label: 'Conciliação', ok: can('conciliacao.ver'), render: () => <BankReconciliationPage /> },
    ]} />
  );
}
