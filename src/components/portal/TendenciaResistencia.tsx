import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { consolidarExemplares } from '../../lib/portal/resultados';
import type { PortalResultadoRow } from '../../lib/portal/types';

// Tendência: resistência dos exemplares (idade de controle) ao longo do tempo, com a linha do fck.
export function TendenciaResistencia({ rows }: { rows: PortalResultadoRow[] }) {
  const pts = consolidarExemplares(rows)
    .filter((e) => e.resistencia != null && e.data)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))
    .map((e) => ({ data: String(e.data).slice(5), resistencia: Number(e.resistencia), fck: e.fck ?? null, ex: e.exemplar ?? '' }));
  if (pts.length < 2) return null;
  const fck = pts.find((p) => p.fck != null)?.fck ?? null;
  return (
    <div className="h-52 w-full px-2 py-3">
      <p className="px-1 pb-1 text-xs font-semibold text-slate-500">Tendência da resistência por exemplar (idade de controle)</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 5, right: 14, bottom: 0, left: -14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="data" fontSize={11} />
          <YAxis fontSize={11} width={40} />
          <Tooltip />
          {fck != null ? <ReferenceLine y={fck} stroke="#C5117E" strokeDasharray="4 4" label={{ value: 'fck ' + fck, fontSize: 10, fill: '#C5117E', position: 'insideTopRight' }} /> : null}
          <Line type="monotone" dataKey="resistencia" stroke="#182863" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
