import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { LoginScreen } from './components/LoginScreen';
import { TenantSelectionPage } from './pages/TenantSelectionPage';
import { DashboardPage } from './pages/DashboardPage';
import { CadastrosPage } from './pages/cadastros/CadastrosPage';
import { ConcretagensPage } from './pages/concreto/ConcretagensPage';
import { ConcretagemDetalhePage } from './pages/concreto/ConcretagemDetalhePage';
import { RompimentosPage } from './pages/concreto/RompimentosPage';
import { LaudosPage } from './pages/concreto/LaudosPage';
import { Layout } from './components/Layout';

export function App() {
  const { ready, session, needsTenantSelection } = useAuth();
  if (!ready) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#6b7280' }}>Carregando...</div>;
  if (!session) return <LoginScreen />;
  if (needsTenantSelection) return <TenantSelectionPage />;
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/cadastros" element={<CadastrosPage />} />
          <Route path="/concretagens" element={<ConcretagensPage />} />
          <Route path="/concretagens/:id" element={<ConcretagemDetalhePage />} />
          <Route path="/rompimentos" element={<RompimentosPage />} />
          <Route path="/laudos" element={<LaudosPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
