import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { useRouteTelemetry } from './lib/telemetry';
import { LoginScreen } from './components/LoginScreen';
import { TenantSelectionPage } from './pages/TenantSelectionPage';
import { Layout } from './components/Layout';
import { LoadingState } from './components/ui/State';

// Páginas carregadas sob demanda (code-splitting por rota) — exports nomeados.
// [v228] Menu agrupado em hubs de abas: as paginas de cada dominio passam a ser importadas pelos
// hubs (AgendaPage, CpsHubPage, QualidadePage, ComercialPage, FinanceiroPage, SuprimentosPage,
// FormasHubPage, EquipePage, PortalHubPage, ConfiguracoesPage, OperacaoHubPage) — o App importa
// so os hubs e as paginas com rota propria. Rotas legadas apontam para o hub com a aba inicial.
// Medições/Contratos = v2 canonico (MedicaoPage/ContratosFinanceiroPage v1 preservadas, sem rota).
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
const LaudosPage = lazy(() => import('./pages/concreto/LaudosPage').then((m) => ({ default: m.LaudosPage })));
const ImportacoesShell = lazy(() => import('./pages/concreto/ImportacoesShell').then((m) => ({ default: m.ImportacoesShell })));
const LabDashboardsPage = lazy(() => import('./pages/dashboards/LabDashboardsPage').then((m) => ({ default: m.LabDashboardsPage })));
const PendenciasPage = lazy(() => import('./pages/gestao/PendenciasPage').then((m) => ({ default: m.PendenciasPage })));
const ProductOverviewPage = lazy(() => import('./pages/gestao/ProductOverviewPage').then((m) => ({ default: m.ProductOverviewPage })));
const CommercialPublicPage = lazy(() => import('./pages/CommercialPublicPage').then((m) => ({ default: m.CommercialPublicPage })));
// [v202] Aceitacao de lotes retirada do sistema (mantida implementada p/ religar). Reative: descomente este import, a Route /lotes (App.tsx) e o item de menu (Layout.tsx).
// const LotesPage = lazy(() => import('./pages/concreto/LotesPage').then((m) => ({ default: m.LotesPage })));
// Hubs de abas (v228):
const AgendaPage = lazy(() => import('./pages/gestao/AgendaPage').then((m) => ({ default: m.AgendaPage })));
const CpsHubPage = lazy(() => import('./pages/concreto/CpsHubPage').then((m) => ({ default: m.CpsHubPage })));
const QualidadePage = lazy(() => import('./pages/concreto/QualidadePage').then((m) => ({ default: m.QualidadePage })));
const ComercialPage = lazy(() => import('./pages/gestao/ComercialPage').then((m) => ({ default: m.ComercialPage })));
const FinanceiroPage = lazy(() => import('./pages/gestao/FinanceiroPage').then((m) => ({ default: m.FinanceiroPage })));
const ConfiguracoesPage = lazy(() => import('./pages/gestao/ConfiguracoesPage').then((m) => ({ default: m.ConfiguracoesPage })));
const ImplantacaoPage = lazy(() => import('./pages/implantacao/ImplantacaoPage').then((m) => ({ default: m.ImplantacaoPage })));
const SuprimentosPage = lazy(() => import('./pages/gestao/SuprimentosPage').then((m) => ({ default: m.SuprimentosPage })));
const FormasHubPage = lazy(() => import('./pages/gestao/FormasHubPage').then((m) => ({ default: m.FormasHubPage })));
const EquipePage = lazy(() => import('./pages/gestao/EquipePage').then((m) => ({ default: m.EquipePage })));
const PortalHubPage = lazy(() => import('./pages/portal/PortalHubPage').then((m) => ({ default: m.PortalHubPage })));
const OperacaoHubPage = lazy(() => import('./pages/operacao/OperacaoHubPage').then((m) => ({ default: m.OperacaoHubPage })));
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
  const { ready, session, needsTenantSelection, can, recovery } = useAuth();

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

  // Rotas PUBLICAS comerciais (Onda A v222): aceite de proposta e aprovacao de medicao por token opaco.
  if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/proposta/') || window.location.pathname.startsWith('/medicao/'))) {
    const kind = window.location.pathname.startsWith('/proposta/') ? 'proposal' as const : 'measurement' as const;
    return (
      <BrowserRouter>
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/proposta/:token" element={<CommercialPublicPage kind="proposal" />} />
            <Route path="/medicao/:token" element={<CommercialPublicPage kind="measurement" />} />
            <Route path="*" element={<CommercialPublicPage kind={kind} />} />
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
            <Route path="/laudos" element={<LaudosPage />} />
            {/* [v202] Aceitacao de lotes retirada. Reative descomentando: <Route path="/lotes" element={<LotesPage />} /> */}
            {/* Hub Agenda (v228) */}
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/hoje" element={<AgendaPage inicial="hoje" />} />
            <Route path="/planejamento-semanal" element={<AgendaPage inicial="semana" />} />
            <Route path="/gestao/capacidade" element={<AgendaPage inicial="capacidade" />} />
            <Route path="/rota-dia" element={<AgendaPage inicial="rota" />} />
            {/* Hub CPs (v228) — cadeia fisica do CP (Grupo A/v227) */}
            <Route path="/cps" element={<CpsHubPage />} />
            <Route path="/recebimento-cps" element={<CpsHubPage inicial="recebimento" />} />
            <Route path="/etiquetas" element={<CpsHubPage inicial="etiquetas" />} />
            <Route path="/descarte-cps" element={<CpsHubPage inicial="descarte" />} />
            {/* Hub Qualidade (v228) */}
            <Route path="/qualidade" element={<QualidadePage />} />
            <Route path="/nao-conformidades" element={<QualidadePage inicial="nc" />} />
            <Route path="/diario-cura" element={<QualidadePage inicial="cura" />} />
            <Route path="/gestao/iso-17025" element={<QualidadePage inicial="iso" />} />
            <Route path="/importacoes" element={<ImportacoesShell />} />
            <Route path="/importacoes/excel" element={can('importacao.executar') ? <ImportacoesShell inicial="excel" /> : <Navigate to="/" replace />} />
            <Route path="/dashboards" element={can('dashboard.ver') ? <LabDashboardsPage /> : <Navigate to="/" replace />} />
            {/* Hub Comercial (v228) — Contratos v2 canonico */}
            <Route path="/comercial" element={<ComercialPage />} />
            <Route path="/crm" element={<ComercialPage inicial="crm" />} />
            <Route path="/propostas" element={<ComercialPage inicial="propostas" />} />
            <Route path="/gestao/contratos-v2" element={<ComercialPage inicial="contratos" />} />
            <Route path="/gestao/contratos-financeiro" element={<ComercialPage inicial="contratos" />} />
            <Route path="/gestao/templates-documentos" element={<ComercialPage inicial="templates" />} />
            {/* Hub Financeiro (v228) — Medições v2 canonico */}
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/medicoes" element={<FinanceiroPage inicial="medicoes" />} />
            <Route path="/gestao/medicoes-v2" element={<FinanceiroPage inicial="medicoes" />} />
            <Route path="/faturas" element={<FinanceiroPage inicial="faturas" />} />
            <Route path="/gestao/fluxo-caixa" element={<FinanceiroPage inicial="fluxo" />} />
            <Route path="/gestao/conciliacao" element={<FinanceiroPage inicial="conciliacao" />} />
            {/* Hub Suprimentos (v228) */}
            <Route path="/suprimentos" element={<SuprimentosPage />} />
            <Route path="/gestao/estoque" element={<SuprimentosPage inicial="estoque" />} />
            <Route path="/gestao/compras" element={<SuprimentosPage inicial="compras" />} />
            {/* Hub Fôrmas (v228) */}
            <Route path="/formas" element={<FormasHubPage />} />
            <Route path="/coleta-formas" element={<FormasHubPage inicial="coleta" />} />
            {/* Hub Equipe (v228) */}
            <Route path="/equipe" element={<EquipePage />} />
            <Route path="/produtividade" element={<EquipePage inicial="produtividade" />} />
            <Route path="/gestao/premiacao" element={<EquipePage inicial="premiacao" />} />
            {/* Hub Portal (v228) */}
            <Route path="/portal-cliente" element={<PortalHubPage />} />
            <Route path="/portal/usuarios-clientes" element={<PortalHubPage inicial="usuarios" />} />
            {/* Configurações (v228: + onboarding e segurança da conta) */}
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/preferencias" element={<ConfiguracoesPage inicial="preferencias" />} />
            <Route path="/gestao/config-campos" element={<ConfiguracoesPage inicial="campos" />} />
            <Route path="/gestao/nc-config" element={<ConfiguracoesPage inicial="nc" />} />
            <Route path="/notificacoes" element={<ConfiguracoesPage inicial="notificacoes" />} />
            <Route path="/gestao/onboarding" element={<ConfiguracoesPage inicial="onboarding" />} />
            {/* [v238] Wizard de implantação self-service (gate de 1ª entrada no Layout) */}
            <Route path="/implantacao" element={<ImplantacaoPage />} />
            <Route path="/gestao/seguranca-conta" element={<ConfiguracoesPage inicial="seguranca" />} />
            {/* Hub Operação interna (v228) — shell unico */}
            <Route path="/operacao" element={<OperacaoHubPage />} />
            <Route path="/gestao/rbac" element={<OperacaoHubPage inicial="rbac" />} />
            <Route path="/gestao/delegacoes" element={<OperacaoHubPage inicial="delegacoes" />} />
            <Route path="/gestao/backups" element={<OperacaoHubPage inicial="backups" />} />
            <Route path="/gestao/emails" element={<OperacaoHubPage inicial="emails" />} />
            <Route path="/gestao/timeline" element={<OperacaoHubPage inicial="timeline" />} />
            <Route path="/gestao/documentos" element={<OperacaoHubPage inicial="docgate" />} />
            <Route path="/gestao/comunicados" element={<OperacaoHubPage inicial="comunicados" />} />
            <Route path="/gestao/backlog" element={<OperacaoHubPage inicial="backlog" />} />
            <Route path="/gestao/webhooks" element={<OperacaoHubPage inicial="webhooks" />} />
            <Route path="/observabilidade" element={<OperacaoHubPage inicial="observabilidade" />} />
            <Route path="/gestao/pendencias" element={<PendenciasPage />} />
            <Route path="/gestao/produto" element={<ProductOverviewPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
