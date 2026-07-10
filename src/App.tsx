import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { useRouteTelemetry } from './lib/telemetry';
import { LoginScreen } from './components/LoginScreen';
import { TenantSelectionPage } from './pages/TenantSelectionPage';
import { Layout } from './components/Layout';
import { LoadingState } from './components/ui/State';

// Páginas carregadas sob demanda (code-splitting por rota) — exports nomeados.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const CadastrosPage = lazy(() => import('./pages/cadastros/CadastrosPage').then((m) => ({ default: m.CadastrosPage })));
const NovaObraWizard = lazy(() => import('./pages/cadastros/NovaObraWizard').then((m) => ({ default: m.NovaObraWizard })));
const EstruturaPage = lazy(() => import('./pages/cadastros/EstruturaPage').then((m) => ({ default: m.EstruturaPage })));
const MateriaisPage = lazy(() => import('./pages/cadastros/MateriaisPage').then((m) => ({ default: m.MateriaisPage })));
const ProgramacoesPage = lazy(() => import('./pages/concreto/ProgramacoesPage').then((m) => ({ default: m.ProgramacoesPage })));
const NovaProgramacaoPage = lazy(() => import('./pages/concreto/NovaProgramacaoPage').then((m) => ({ default: m.NovaProgramacaoPage })));
const ConcretagensPage = lazy(() => import('./pages/concreto/ConcretagensPage').then((m) => ({ default: m.ConcretagensPage })));
const ConcretagemDetalhePage = lazy(() => import('./pages/concreto/ConcretagemDetalhePage').then((m) => ({ default: m.ConcretagemDetalhePage })));
const RompimentosPage = lazy(() => import('./pages/concreto/RompimentosPage').then((m) => ({ default: m.RompimentosPage })));
const ColetaFormasPage = lazy(() => import('./pages/concreto/ColetaFormasPage').then((m) => ({ default: m.ColetaFormasPage })));
const ImportacoesShell = lazy(() => import('./pages/concreto/ImportacoesShell').then((m) => ({ default: m.ImportacoesShell })));
const FinanceiroPage = lazy(() => import('./pages/gestao/FinanceiroPage').then((m) => ({ default: m.FinanceiroPage })));
const ConfiguracoesPage = lazy(() => import('./pages/gestao/ConfiguracoesPage').then((m) => ({ default: m.ConfiguracoesPage })));
const EtiquetasPage = lazy(() => import('./pages/concreto/EtiquetasPage').then((m) => ({ default: m.EtiquetasPage })));
const LaudosPage = lazy(() => import('./pages/concreto/LaudosPage').then((m) => ({ default: m.LaudosPage })));
const LabDashboardsPage = lazy(() => import('./pages/dashboards/LabDashboardsPage').then((m) => ({ default: m.LabDashboardsPage })));
const TemplatesDocumentosPage = lazy(() => import('./pages/gestao/TemplatesDocumentosPage').then((m) => ({ default: m.TemplatesDocumentosPage })));
// [v202] Aceitacao de lotes retirada do sistema (mantida implementada p/ religar). Reative: descomente este import, a Route /lotes (App.tsx) e o item de menu (Layout.tsx).
// const LotesPage = lazy(() => import('./pages/concreto/LotesPage').then((m) => ({ default: m.LotesPage })));
const NcPage = lazy(() => import('./pages/concreto/NcPage').then((m) => ({ default: m.NcPage })));
const PendenciasPage = lazy(() => import('./pages/gestao/PendenciasPage').then((m) => ({ default: m.PendenciasPage })));
const ProdutividadePage = lazy(() => import('./pages/gestao/ProdutividadePage').then((m) => ({ default: m.ProdutividadePage })));
const DiarioCuraPage = lazy(() => import('./pages/gestao/DiarioCuraPage').then((m) => ({ default: m.DiarioCuraPage })));
const HojePage = lazy(() => import('./pages/gestao/HojePage').then((m) => ({ default: m.HojePage })));
const RotaDiaPage = lazy(() => import('./pages/gestao/RotaDiaPage').then((m) => ({ default: m.RotaDiaPage })));
const FormasPage = lazy(() => import('./pages/gestao/FormasPage').then((m) => ({ default: m.FormasPage })));
const ClientePortalPage = lazy(() => import('./pages/portal/ClientePortalPage').then((m) => ({ default: m.ClientePortalPage })));
const ClienteUsuariosPage = lazy(() => import('./pages/portal/ClienteUsuariosPage').then((m) => ({ default: m.ClienteUsuariosPage })));
const OperacaoPage = lazy(() => import('./pages/operacao/OperacaoPage').then((m) => ({ default: m.OperacaoPage })));
const ObservabilidadePage = lazy(() => import('./pages/gestao/ObservabilidadePage').then((m) => ({ default: m.ObservabilidadePage })));
const BackupsPage = lazy(() => import('./pages/gestao/BackupsPage').then((m) => ({ default: m.BackupsPage })));
const EmailLogPage = lazy(() => import('./pages/gestao/EmailLogPage').then((m) => ({ default: m.EmailLogPage })));
const TimelinePage = lazy(() => import('./pages/gestao/TimelinePage').then((m) => ({ default: m.TimelinePage })));
const DocGatePage = lazy(() => import('./pages/gestao/DocGatePage').then((m) => ({ default: m.DocGatePage })));
const RbacPage = lazy(() => import('./pages/gestao/RbacPage').then((m) => ({ default: m.RbacPage })));
const DelegacoesPage = lazy(() => import('./pages/gestao/DelegacoesPage').then((m) => ({ default: m.DelegacoesPage })));
const SegurancaContaPage = lazy(() => import('./pages/gestao/SegurancaContaPage').then((m) => ({ default: m.SegurancaContaPage })));
const BroadcastsPage = lazy(() => import('./pages/gestao/BroadcastsPage').then((m) => ({ default: m.BroadcastsPage })));
const AdminBacklogPage = lazy(() => import('./pages/gestao/AdminBacklogPage').then((m) => ({ default: m.AdminBacklogPage })));
const WebhooksPage = lazy(() => import('./pages/gestao/WebhooksPage').then((m) => ({ default: m.WebhooksPage })));
const ValidarPage = lazy(() => import('./pages/ValidarPage').then((m) => ({ default: m.ValidarPage })));
const LaudoAprovarPage = lazy(() => import('./pages/LaudoAprovarPage').then((m) => ({ default: m.LaudoAprovarPage })));
const PortalPublicoPage = lazy(() => import('./pages/portal/PortalPublicoPage').then((m) => ({ default: m.PortalPublicoPage })));
const RedefinirSenhaPage = lazy(() => import('./pages/RedefinirSenhaPage').then((m) => ({ default: m.RedefinirSenhaPage })));

/**
 * Monta a correlação de rota da telemetria (v173). O hook useRouteTelemetry existia desde a
 * Camada 5 mas nunca foi montado — sem ele não há trace por rota, breadcrumb de navegação nem
 * métrica spa-nav-ms (a categoria 'metric' estava vazia no banco). Precisa viver DENTRO do Router.
 */
function RouteTelemetryMount() {
  useRouteTelemetry();
  return null;
}

export function App() {
  const { ready, session, needsTenantSelection, hasRole, can, recovery } = useAuth();

  // Rota PUBLICA de validacao (fora do gate de auth) — alvo do QR do laudo.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/validar')) {
    return (
      <BrowserRouter>
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/validar/:codigo" element={<ValidarPage />} />
            <Route path="*" element={<ValidarPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  // Rota PUBLICA de aprovacao de laudo por magic link (fora do gate de auth) — melhoria 3.2.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/laudo/aprovar')) {
    return (
      <BrowserRouter>
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/laudo/aprovar/:token" element={<LaudoAprovarPage />} />
            <Route path="*" element={<LaudoAprovarPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  // Rota PUBLICA do portal do cliente por magic link (fora do gate de auth).
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/portal/acesso')) {
    return (
      <BrowserRouter>
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/portal/acesso/:token" element={<PortalPublicoPage />} />
            <Route path="*" element={<PortalPublicoPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  if (!ready) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--ink-faint)' }}>Carregando...</div>;

  // Redefinicao de senha (T7): rota direta OU evento PASSWORD_RECOVERY (o link do e-mail pode
  // cair na raiz quando o redirect nao esta allowlisted no Auth — o evento cobre esse caminho).
  if (recovery || (typeof window !== 'undefined' && window.location.pathname.startsWith('/redefinir-senha'))) {
    return (
      <BrowserRouter>
        <Suspense fallback={<LoadingState />}>
          <Routes><Route path="*" element={<RedefinirSenhaPage />} /></Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  if (!session) return <LoginScreen />;
  if (needsTenantSelection) return <TenantSelectionPage />;
  const podeLab = hasRole('admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista', 'operador_campo', 'financeiro');
  return (
    <BrowserRouter>
      <RouteTelemetryMount />
      <Layout>
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/cadastros" element={<CadastrosPage />} />
            <Route path="/nova-obra" element={<NovaObraWizard />} />
            <Route path="/estrutura" element={<EstruturaPage />} />
            <Route path="/tracos" element={<MateriaisPage />} />
            <Route path="/programacoes" element={<ProgramacoesPage />} />
            <Route path="/programacoes/nova" element={<NovaProgramacaoPage />} />
            <Route path="/concretagens" element={<ConcretagensPage />} />
            <Route path="/concretagens/:id" element={<ConcretagemDetalhePage />} />
            <Route path="/rompimentos" element={<RompimentosPage />} />
            <Route path="/etiquetas" element={<EtiquetasPage />} />
            <Route path="/laudos" element={<LaudosPage />} />
            {/* [v202] Aceitacao de lotes retirada. Reative descomentando: <Route path="/lotes" element={<LotesPage />} /> */}
            <Route path="/nao-conformidades" element={<NcPage />} />
            <Route path="/gestao/nc-config" element={<ConfiguracoesPage inicial="nc" />} />
            <Route path="/importacoes" element={<ImportacoesShell />} />
            <Route path="/importacoes/excel" element={can('importacao.executar') ? <ImportacoesShell inicial="excel" /> : <Navigate to="/" replace />} />
            <Route path="/dashboards" element={can('dashboard.ver') ? <LabDashboardsPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/contratos-financeiro" element={<FinanceiroPage inicial="contratos" />} />
            <Route path="/notificacoes" element={<ConfiguracoesPage inicial="notificacoes" />} />
            <Route path="/gestao/pendencias" element={<PendenciasPage />} />
            <Route path="/gestao/templates-documentos" element={can('documento_template.ver') ? <TemplatesDocumentosPage /> : <Navigate to="/" replace />} />
            <Route path="/preferencias" element={<ConfiguracoesPage inicial="preferencias" />} />
            <Route path="/medicoes" element={<FinanceiroPage inicial="medicao" />} />
            <Route path="/produtividade" element={<ProdutividadePage />} />
            <Route path="/diario-cura" element={<DiarioCuraPage />} />
            <Route path="/hoje" element={<HojePage />} />
            <Route path="/rota-dia" element={<RotaDiaPage />} />
            <Route path="/propostas" element={<FinanceiroPage inicial="propostas" />} />
            <Route path="/faturas" element={<FinanceiroPage inicial="faturas" />} />
            <Route path="/formas" element={<FormasPage />} />
            <Route path="/coleta-formas" element={<ColetaFormasPage />} />
            <Route path="/gestao/config-campos" element={<ConfiguracoesPage inicial="campos" />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/portal-cliente" element={<ClientePortalPage />} />
            <Route path="/portal/usuarios-clientes" element={can('portal.gerenciar') ? <ClienteUsuariosPage /> : <Navigate to="/portal-cliente" replace />} />
            <Route path="/operacao" element={can('operacao.interna') ? <OperacaoPage /> : <Navigate to="/" replace />} />
            <Route path="/observabilidade" element={can('observabilidade.ver') ? <ObservabilidadePage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/backups" element={can('backup.executar') ? <BackupsPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/emails" element={can('email.gerenciar') ? <EmailLogPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/timeline" element={can('auditoria.ver') ? <TimelinePage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/documentos" element={can('docgate.ver') ? <DocGatePage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/rbac" element={can('rbac.gerenciar') ? <RbacPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/delegacoes" element={can('workflow.delegar') ? <DelegacoesPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/seguranca-conta" element={podeLab ? <SegurancaContaPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/comunicados" element={can('comunicado.gerenciar') ? <BroadcastsPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/backlog" element={can('operacao.interna') ? <AdminBacklogPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/webhooks" element={can('api.gerenciar') ? <WebhooksPage /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
