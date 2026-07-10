import { useAuth } from '../../lib/auth';
import { TabShell } from '../../components/patterns/TabShell';
import { HojePage } from './HojePage';
import { WeeklyPlanningPage } from './WeeklyPlanningPage';
import { CapacityPage } from './CapacityPage';
import { RotaDiaPage } from './RotaDiaPage';

// [v228] Hub Agenda — o dia a dia do lab em abas: hoje, semana, capacidade e rota do moldador.
export function AgendaPage({ inicial = 'hoje' }: { inicial?: 'hoje' | 'semana' | 'capacidade' | 'rota' }) {
  const { hasRole, can } = useAuth();
  const lab = hasRole('admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista', 'operador_campo', 'financeiro');
  return (
    <TabShell inicial={inicial} vazio="Sem acesso à agenda." tabs={[
      { key: 'hoje', label: 'Hoje no lab', ok: lab, render: () => <HojePage /> },
      { key: 'semana', label: 'Planejamento semanal', ok: can('planejamento.ver'), render: () => <WeeklyPlanningPage /> },
      { key: 'capacidade', label: 'Capacidade', ok: can('capacidade.ver'), render: () => <CapacityPage /> },
      { key: 'rota', label: 'Rota do dia', ok: lab, render: () => <RotaDiaPage /> },
    ]} />
  );
}
