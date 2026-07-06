import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
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
const EtiquetasPage = lazy(() => import('./pages/concreto/EtiquetasPage').then((m) => ({ default: m.EtiquetasPage })));
const LaudosPage = lazy(() => import('./pages/concreto/LaudosPage').then((m) => ({ default: m.LaudosPage })));
const LabDashboardsPage = lazy(() => import('./pages/dashboards/LabDashboardsPage').then((m) => ({ default: m.LabDashboardsPage })));
const ImportacaoExcelPage = lazy(() => import('./pages/concreto/ImportacaoExcelPage').then((m) => ({ default: m.ImportacaoExcelPage })));
const ContratosFinanceiroPage = lazy(() => import('./pages/gestao/ContratosFinanceiroPage').then((m) => ({ default: m.ContratosFinanceiroPage })));
const ImportacoesPage = lazy(() => import('./pages/concreto/ImportacoesPage').then((m) => ({ default: m.ImportacoesPage })));
const LotesPage = lazy(() => import('./pages/concreto/LotesPage').then((m) => ({ default: m.LotesPage })));
const NcPage = lazy(() => import('./pages/concreto/NcPage').then((m) => ({ default: m.NcPage })));
const NcConfigPage = lazy(() => import('./pages/gestao/NcConfigPage').then((m) => ({ default: m.NcConfigPage })));
const NotificacoesPage = lazy(() => import('./pages/gestao/NotificacoesPage').then((m) => ({ default: m.NotificacoesPage })));
const PendenciasPage = lazy(() => import('./pages/gestao/PendenciasPage').then((m) => ({ default: m.PendenciasPage })));
const PreferenciasPage = lazy(() => import('./pages/gestao/PreferenciasPage').then((m) => ({ default: m.PreferenciasPage })));
const MedicaoPage = lazy(() => import('./pages/gestao/MedicaoPage').then((m) => ({ default: m.MedicaoPage })));
const ProdutividadePage = lazy(() => import('./pages/gestao/ProdutividadePage').then((m) => ({ default: m.ProdutividadePage })));
const FaturasPage = lazy(() => import('./pages/gestao/FaturasPage').then((m) => ({ default: m.FaturasPage })));
const FormasPage = lazy(() => import('./pages/gestao/FormasPage').then((m) => ({ default: m.FormasPage })));
const ConfigCamposPage = lazy(() => import('./pages/gestao/ConfigCamposPage').then((m) => ({ default: m.ConfigCamposPage })));
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

export function App() {
  const { ready, session, needsTenantSelection, hasRole } = useAuth();

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
  if (!session) return <LoginScreen />;
  if (needsTenantSelection) return <TenantSelectionPage />;
  const podeOperacao = hasRole('admin', 'admin_consulte');
  const podeLab = hasRole('admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista', 'operador_campo', 'financeiro');
  const podeGerirClientes = hasRole('admin', 'admin_consulte');
  return (
    <BrowserRouter>
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
            <Route path="/lotes" element={<LotesPage />} />
            <Route path="/nao-conformidades" element={<NcPage />} />
            <Route path="/gestao/nc-config" element={<NcConfigPage />} />
            <Route path="/importacoes" element={<ImportacoesPage />} />
            <Route path="/importacoes/excel" element={podeLab ? <ImportacaoExcelPage /> : <Navigate to="/" replace />} />
            <Route path="/dashboards" element={podeLab ? <LabDashboardsPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/contratos-financeiro" element={podeOperacao ? <ContratosFinanceiroPage /> : <Navigate to="/" replace />} />
            <Route path="/notificacoes" element={<NotificacoesPage />} />
            <Route path="/gestao/pendencias" element={<PendenciasPage />} />
            <Route path="/preferencias" element={<PreferenciasPage />} />
            <Route path="/medicoes" element={<MedicaoPage />} />
            <Route path="/produtividade" element={<ProdutividadePage />} />
            <Route path="/faturas" element={<FaturasPage />} />
            <Route path="/formas" element={<FormasPage />} />
            <Route path="/gestao/config-campos" element={<ConfigCamposPage />} />
            <Route path="/gestao/controle-laudo" element={<Navigate to="/gestao/config-campos?aba=laudo" replace />} />
            <Route path="/gestao/campos-recebimento" element={<Navigate to="/gestao/config-campos?aba=recebimento" replace />} />
            <Route path="/gestao/campos-concretagem" element={<Navigate to="/gestao/config-campos?aba=concretagem" replace />} />
            <Route path="/portal-cliente" element={<ClientePortalPage />} />
            <Route path="/portal/usuarios-clientes" element={podeGerirClientes ? <ClienteUsuariosPage /> : <Navigate to="/portal-cliente" replace />} />
            <Route path="/operacao" element={podeOperacao ? <OperacaoPage /> : <Navigate to="/" replace />} />
            <Route path="/observabilidade" element={podeOperacao ? <ObservabilidadePage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/backups" element={podeOperacao ? <BackupsPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/emails" element={podeOperacao ? <EmailLogPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/timeline" element={podeOperacao ? <TimelinePage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/documentos" element={podeOperacao ? <DocGatePage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/rbac" element={podeOperacao ? <RbacPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/delegacoes" element={podeOperacao ? <DelegacoesPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/seguranca-conta" element={podeLab ? <SegurancaContaPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/comunicados" element={podeOperacao ? <BroadcastsPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/backlog" element={podeOperacao ? <AdminBacklogPage /> : <Navigate to="/" replace />} />
            <Route path="/gestao/webhooks" element={podeOperacao ? <WebhooksPage /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
