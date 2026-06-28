import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Stat } from '../components/ui/Stat';
import { Button } from '../components/ui/Button';
import { LoadingState, ErrorState } from '../components/ui/State';
import { getKpis } from '../lib/api/dashboard';

const DashboardCharts = lazy(() => import('./DashboardCharts'));

export function DashboardPage() {
  const { member } = useAuth();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['kpis', member?.tenant_id], queryFn: () => getKpis(member?.tenant_id) });
  const k = q.data;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Concresoft" title="Painel" description={'Laboratorio: ' + (member?.tenant_name ?? '-')} />
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : k ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Stat label="Rompimentos atrasados" value={k.agenda.atrasados} detail="CPs pendentes vencidos" />
            <Stat label="Rompimentos hoje" value={k.agenda.hoje} />
            <Stat label="Proximos 7 dias" value={k.agenda.proximos} />
            <Stat label="Laudos emitidos" value={k.laudos.emitido} detail={k.laudos.rascunho + ' em rascunho/revisao'} />
            <Stat label="Calibracoes vencendo" value={k.calibracoesVencendo} detail="proximos 30 dias" />
          </div>
          <Suspense fallback={<Card><div className="p-6"><div className="skeleton h-5 w-2/5" style={{ marginBottom: 14 }} /><div className="skeleton" style={{ height: 220 }} /></div></Card>}>
            <DashboardCharts agenda={k.agenda} laudos={k.laudos} />
          </Suspense>
          <Card>
            <CardHeader kicker="Atalhos" title="Acoes rapidas" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 16 }}>
              <Button onClick={() => nav('/rompimentos')}>Agenda de rompimentos</Button>
              <Button variant="secondary" onClick={() => nav('/importacoes')}>Importar resultados</Button>
              <Button variant="secondary" onClick={() => nav('/laudos')}>Laudos</Button>
              <Button variant="ghost" onClick={() => nav('/nova-obra')}>Nova obra</Button>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
