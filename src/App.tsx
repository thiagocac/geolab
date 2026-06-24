import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { LoginScreen } from './components/LoginScreen';
import { TenantSelectionPage } from './pages/TenantSelectionPage';
import { DashboardPage } from './pages/DashboardPage';
import { CadastrosPage } from './pages/cadastros/CadastrosPage';
import { ConcretagensPage } from './pages/concreto/ConcretagensPage';
import { ProgramacoesPage } from './pages/concreto/ProgramacoesPage';
import { ConcretagemDetalhePage } from './pages/concreto/ConcretagemDetalhePage';
import { RompimentosPage } from './pages/concreto/RompimentosPage';
import { LaudosPage } from './pages/concreto/LaudosPage';
import { ImportacoesPage } from './pages/concreto/ImportacoesPage';
import { NotificacoesPage } from './pages/gestao/NotificacoesPage';
import { PreferenciasPage } from './pages/gestao/PreferenciasPage';
import { MedicaoPage } from './pages/gestao/MedicaoPage';
import { ProdutividadePage } from './pages/gestao/ProdutividadePage';
import { FaturasPage } from './pages/gestao/FaturasPage';
import { FormasPage } from './pages/gestao/FormasPage';
import { LotesPage } from './pages/concreto/LotesPage';
import { NcPage } from './pages/concreto/NcPage';
import { NcConfigPage } from './pages/gestao/NcConfigPage';
import { NovaObraWizard } from './pages/cadastros/NovaObraWizard';
import { EstruturaPage } from './pages/cadastros/EstruturaPage';
import { MateriaisPage } from './pages/cadastros/MateriaisPage';
import { ControleLaudoPage } from './pages/gestao/ControleLaudoPage';
import { CamposRecebimentoPage } from './pages/gestao/CamposRecebimentoPage';
import { CamposConcretagemPage } from './pages/gestao/CamposConcretagemPage';
import { ClientePortalPage } from './pages/portal/ClientePortalPage';
import { ClienteUsuariosPage } from './pages/portal/ClienteUsuariosPage';
import { OperacaoPage } from './pages/operacao/OperacaoPage';
import { ValidarPage } from './pages/ValidarPage';
import { Layout } from './components/Layout';

export function App() {
  const { ready, session, needsTenantSelection, hasRole } = useAuth();

  // Rota PUBLICA de validacao (fora do gate de auth) — alvo do QR do laudo.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/validar')) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/validar/:codigo" element={<ValidarPage />} />
          <Route path="*" element={<ValidarPage />} />
        </Routes>
      </BrowserRouter>
    );
  }

  if (!ready) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--ink-faint)' }}>Carregando...</div>;
  if (!session) return <LoginScreen />;
  if (needsTenantSelection) return <TenantSelectionPage />;
  const podeOperacao = hasRole('admin', 'admin_consulte');
  const podeGerirClientes = hasRole('admin', 'admin_consulte');
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/cadastros" element={<CadastrosPage />} />
          <Route path="/nova-obra" element={<NovaObraWizard />} />
          <Route path="/estrutura" element={<EstruturaPage />} />
          <Route path="/tracos" element={<MateriaisPage />} />
          <Route path="/programacoes" element={<ProgramacoesPage />} />
          <Route path="/concretagens" element={<ConcretagensPage />} />
          <Route path="/concretagens/:id" element={<ConcretagemDetalhePage />} />
          <Route path="/rompimentos" element={<RompimentosPage />} />
          <Route path="/laudos" element={<LaudosPage />} />
          <Route path="/lotes" element={<LotesPage />} />
          <Route path="/nao-conformidades" element={<NcPage />} />
          <Route path="/gestao/nc-config" element={<NcConfigPage />} />
          <Route path="/importacoes" element={<ImportacoesPage />} />
          <Route path="/notificacoes" element={<NotificacoesPage />} />
          <Route path="/preferencias" element={<PreferenciasPage />} />
          <Route path="/medicoes" element={<MedicaoPage />} />
          <Route path="/produtividade" element={<ProdutividadePage />} />
          <Route path="/faturas" element={<FaturasPage />} />
          <Route path="/formas" element={<FormasPage />} />
          <Route path="/gestao/controle-laudo" element={<ControleLaudoPage />} />
          <Route path="/gestao/campos-recebimento" element={<CamposRecebimentoPage />} />
          <Route path="/gestao/campos-concretagem" element={<CamposConcretagemPage />} />
          <Route path="/portal-cliente" element={<ClientePortalPage />} />
          <Route path="/portal/usuarios-clientes" element={podeGerirClientes ? <ClienteUsuariosPage /> : <Navigate to="/portal-cliente" replace />} />
          <Route path="/operacao" element={podeOperacao ? <OperacaoPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
