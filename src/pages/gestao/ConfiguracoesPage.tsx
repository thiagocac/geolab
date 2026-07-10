import { useAuth } from '../../lib/auth';
import { TabShell } from '../../components/patterns/TabShell';
import { PreferenciasPage } from './PreferenciasPage';
import { ConfigCamposPage } from './ConfigCamposPage';
import { NcConfigPage } from './NcConfigPage';
import { NotificacoesPage } from './NotificacoesPage';
import { AssinaturaConfigPage } from './AssinaturaConfigPage';
import { LabOnboardingPage } from './LabOnboardingPage';
import { SegurancaContaPage } from './SegurancaContaPage';

// [v228] Configurações consolidadas (reescrita do C4/v168 sobre TabShell) + Onboarding do lab e
// Segurança da conta (antes itens soltos do menu). ConfigCamposPage usa ?aba= — sem colisao.
export function ConfiguracoesPage({ inicial = 'preferencias' }: { inicial?: 'preferencias' | 'campos' | 'assinatura' | 'nc' | 'notificacoes' | 'onboarding' | 'seguranca' }) {
  const { hasRole, can } = useAuth();
  const lab = hasRole('admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista', 'operador_campo', 'financeiro');
  return (
    <TabShell inicial={inicial} vazio="Sem acesso às configurações." tabs={[
      { key: 'preferencias', label: 'Preferências', ok: hasRole('admin', 'admin_consulte'), render: () => <PreferenciasPage /> },
      { key: 'campos', label: 'Campos', ok: hasRole('admin', 'admin_consulte'), render: () => <ConfigCamposPage /> },
      { key: 'assinatura', label: 'Assinatura', ok: hasRole('admin', 'admin_consulte', 'gestor_qualidade'), render: () => <AssinaturaConfigPage /> },
      { key: 'nc', label: 'Config de NC', ok: hasRole('admin', 'admin_consulte', 'gestor_qualidade'), render: () => <NcConfigPage /> },
      { key: 'notificacoes', label: 'Notificações', ok: lab, render: () => <NotificacoesPage /> },
      { key: 'onboarding', label: 'Onboarding do lab', ok: can('onboarding.ver'), render: () => <LabOnboardingPage /> },
      { key: 'seguranca', label: 'Segurança da conta', ok: lab, render: () => <SegurancaContaPage /> },
    ]} />
  );
}
