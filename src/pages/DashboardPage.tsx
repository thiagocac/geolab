import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Legend } from 'recharts';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Stat } from '../components/ui/Stat';
import { Button } from '../components/ui/Button';
import { LoadingState, ErrorState } from '../components/ui/State';
import { getKpis } from '../lib/api/dashboard';

const tipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)', fontSize: 13 } as const;

export function DashboardPage() {
  const { member } = useAuth();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['kpis'], queryFn: getKpis });
  const k = q.data;
  const agendaData = k ? [
    { name: 'Atrasados', valor: k.agenda.atrasados, cor: '#ef4444' },
    { name: 'Hoje', valor: k.agenda.hoje, cor: '#C5117E' },
    { name: 'Próx. 7d', valor: k.agenda.proximos, cor: '#3b82f6' },
  ] : [];
  const laudosData = k ? [
    { name: 'Emitidos', value: k.laudos.emitido, cor: '#16a34a' },
    { name: 'Rascunho/revisão', value: k.laudos.rascunho, cor: '#f59e0b' },
  ] : [];

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
          <Card>
            <CardHeader kicker="Visão geral" title="Agenda e laudos" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, padding: 16 }}>
              <div>
                <div className="kicker" style={{ marginBottom: 8 }}>Rompimentos por situação</div>
                <div style={{ height: 230 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agendaData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'var(--ink-faint)', fontSize: 12 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: 'var(--ink-faint)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={tipStyle} />
                      <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={64}>
                        {agendaData.map((d) => <Cell key={d.name} fill={d.cor} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className="kicker" style={{ marginBottom: 8 }}>Laudos por status</div>
                <div style={{ height: 230 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={laudosData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82} paddingAngle={2} strokeWidth={0}>
                        {laudosData.map((d) => <Cell key={d.name} fill={d.cor} />)}
                      </Pie>
                      <Tooltip contentStyle={tipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </Card>
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
