import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Legend } from 'recharts';
import { Card, CardHeader } from '../components/ui/Card';

const tipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)', fontSize: 13 } as const;

export default function DashboardCharts({ agenda, laudos }: { agenda: { atrasados: number; hoje: number; proximos: number }; laudos: { emitido: number; rascunho: number } }) {
  const agendaData = [
    { name: 'Atrasados', valor: agenda.atrasados, cor: '#ef4444' },
    { name: 'Hoje', valor: agenda.hoje, cor: '#C5117E' },
    { name: 'Próx. 7d', valor: agenda.proximos, cor: '#3b82f6' },
  ];
  const laudosData = [
    { name: 'Emitidos', value: laudos.emitido, cor: '#16a34a' },
    { name: 'Rascunho/revisão', value: laudos.rascunho, cor: '#f59e0b' },
  ];
  return (
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
  );
}
