import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';
import type { PortalResultadoRow } from '../../lib/portal/types';

const COLORS = ['#182863', '#C5117E', '#0ea5e9', '#16a34a', '#f59e0b', '#7c3aed', '#dc2626', '#0d9488'];

// Curva de evolucao (idade x resistencia) por exemplar, com a linha de referencia do fck.
export function EvolucaoExemplares({ rows }: { rows: PortalResultadoRow[] }) {
  const comResultado = rows.filter((r) => r.resultado_valor != null && r.idade_dias != null);
  if (comResultado.length < 2) return null;
  const exemplares = [...new Set(comResultado.map((r) => r.amostra_codigo || r.amostra_id || 'CP'))];
  const idades = [...new Set(comResultado.map((r) => Number(r.idade_dias)))].sort((a, b) => a - b);
  const data = idades.map((idade) => {
    const point: Record<string, number | string> = { idade: idade + 'd' };
    for (const ex of exemplares) {
      const vals = comResultado.filter((r) => (r.amostra_codigo || r.amostra_id || 'CP') === ex && Number(r.idade_dias) === idade).map((r) => Number(r.resultado_valor));
      if (vals.length) point[ex] = Math.max(...vals);
    }
    return point;
  });
  const fck = comResultado.find((r) => r.fck_ref != null)?.fck_ref ?? null;
  return (
    <div className="h-56 w-full px-2 py-3">
      <p className="px-1 pb-1 text-xs font-semibold text-slate-500">Evolução da resistência (MPa) por idade</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 12, bottom: 0, left: -14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="idade" fontSize={11} />
          <YAxis fontSize={11} width={40} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {fck != null ? <ReferenceLine y={fck} stroke="#C5117E" strokeDasharray="4 4" label={{ value: 'fck ' + fck, fontSize: 10, fill: '#C5117E', position: 'insideTopRight' }} /> : null}
          {exemplares.map((ex, i) => <Line key={ex} type="monotone" dataKey={ex} stroke={COLORS[i % COLORS.length]} strokeWidth={2} connectNulls dot={{ r: 3 }} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
