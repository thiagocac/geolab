import { useAuth } from '../../lib/auth';
import { TabShell } from '../../components/patterns/TabShell';
import { OperacaoPage } from './OperacaoPage';
import { RbacPage } from '../gestao/RbacPage';
import { DelegacoesPage } from '../gestao/DelegacoesPage';
import { BackupsPage } from '../gestao/BackupsPage';
import { EmailLogPage } from '../gestao/EmailLogPage';
import { TimelinePage } from '../gestao/TimelinePage';
import { DocGatePage } from '../gestao/DocGatePage';
import { BroadcastsPage } from '../gestao/BroadcastsPage';
import { AdminBacklogPage } from '../gestao/AdminBacklogPage';
import { WebhooksPage } from '../gestao/WebhooksPage';
import { ObservabilidadePage } from '../gestao/ObservabilidadePage';

// [v228] Hub Operação — toda a operacao interna num shell so (decisao do Thiago 10/07/2026).
// Observabilidade entra como aba (antes so por URL direta /observabilidade).
type Aba = 'usuarios' | 'rbac' | 'delegacoes' | 'backups' | 'emails' | 'timeline' | 'docgate' | 'comunicados' | 'backlog' | 'webhooks' | 'observabilidade';
export function OperacaoHubPage({ inicial = 'usuarios' }: { inicial?: Aba }) {
  const { can } = useAuth();
  return (
    <TabShell inicial={inicial} vazio="Sem acesso à operação interna." tabs={[
      { key: 'usuarios', label: 'Usuários e labs', ok: can('operacao.interna'), render: () => <OperacaoPage /> },
      { key: 'rbac', label: 'Permissões', ok: can('rbac.gerenciar'), render: () => <RbacPage /> },
      { key: 'delegacoes', label: 'Delegações', ok: can('workflow.delegar'), render: () => <DelegacoesPage /> },
      { key: 'backups', label: 'Backups', ok: can('backup.executar'), render: () => <BackupsPage /> },
      { key: 'emails', label: 'E-mails', ok: can('email.gerenciar'), render: () => <EmailLogPage /> },
      { key: 'timeline', label: 'Linha do tempo', ok: can('auditoria.ver'), render: () => <TimelinePage /> },
      { key: 'docgate', label: 'Documentos e gate', ok: can('docgate.ver'), render: () => <DocGatePage /> },
      { key: 'comunicados', label: 'Comunicados', ok: can('comunicado.gerenciar'), render: () => <BroadcastsPage /> },
      { key: 'backlog', label: 'Backlog', ok: can('operacao.interna'), render: () => <AdminBacklogPage /> },
      { key: 'webhooks', label: 'Webhooks/API', ok: can('api.gerenciar'), render: () => <WebhooksPage /> },
      { key: 'observabilidade', label: 'Observabilidade', ok: can('observabilidade.ver'), render: () => <ObservabilidadePage /> },
    ]} />
  );
}
