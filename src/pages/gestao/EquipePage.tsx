import { useAuth } from '../../lib/auth';
import { TabShell } from '../../components/patterns/TabShell';
import { ProdutividadePage } from './ProdutividadePage';
import { TeamBonusPage } from './TeamBonusPage';

// [v228] Hub Equipe — produtividade dos colaboradores e premiacao 50/30/20 (v223) em abas.
export function EquipePage({ inicial = 'produtividade' }: { inicial?: 'produtividade' | 'premiacao' }) {
  const { hasRole, can } = useAuth();
  return (
    <TabShell inicial={inicial} vazio="Sem acesso à equipe." tabs={[
      { key: 'produtividade', label: 'Produtividade', ok: hasRole('admin', 'admin_consulte', 'gestor_qualidade'), render: () => <ProdutividadePage /> },
      { key: 'premiacao', label: 'Premiação', ok: can('premiacao.ver'), render: () => <TeamBonusPage /> },
    ]} />
  );
}
