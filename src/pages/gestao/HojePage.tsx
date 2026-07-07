import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Field } from '../../components/ui/Field';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { getAgendaDoDia } from '../../lib/api/agenda';

const hojeStr = () => new Date().toISOString().slice(0, 10);
const br = (d: string) => d.split('-').reverse().join('/');

function Secao({ titulo, kicker, count, children }: { titulo: string; kicker: string; count: number; children: ReactNode }) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
        <div><p className="kicker">{kicker}</p><h2 className="text-lg display text-slate-950 dark:text-slate-50">{titulo}</h2></div>
        <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-sm font-black tabular-nums dark:border-slate-700">{count}</span>
      </div>
      <div className="p-4">{count === 0 ? <p className="text-sm text-slate-400">Nada para hoje.</p> : children}</div>
    </Card>
  );
}

const linha = 'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800';

export function HojePage() {
  const { member } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(hojeStr());
  const q = useQuery({ queryKey: ['agenda-dia', member?.tenant_id, data], enabled: !!member, queryFn: () => getAgendaDoDia(data) });
  const a = q.data;

  return (
    <div className="space-y-4">
      <PageHeader kicker="Operação" title="Hoje no lab" description="O dia do laboratório num lugar só: moldagens programadas, CPs a romper, coletas em rota e laudos aguardando o RT." />
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div style={{ maxWidth: 180 }}><Field label="Dia" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <span className="pb-2 text-sm text-slate-500">{br(data)}</span>
        </div>
      </Card>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : a ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Moldagens" value={a.moldagens.length} />
            <Stat label="CPs a romper" value={a.rompimentos.length} />
            <Stat label="Coletas em rota" value={a.coletas.length} />
            <Stat label="Laudos aguardando" value={a.laudos.length} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Secao kicker="Programação" titulo="Moldagens do dia" count={a.moldagens.length}>
              <div className="space-y-2">
                {a.moldagens.map((m) => (
                  <button type="button" key={m.id} className={linha + ' w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800/40'} onClick={() => nav('/concretagens/' + m.id, { viewTransition: true })}>
                    <span className="min-w-0"><b className="text-slate-950 dark:text-slate-50">{m.hora ?? '--:--'}</b> · {m.cliente ?? '—'} <span className="text-slate-500">/ {m.obra ?? '—'}</span>{m.local ? <span className="text-slate-400"> · {m.local}</span> : null}</span>
                    <span className="text-xs text-slate-500">{m.moldador ? 'Moldador: ' + m.moldador : <span style={{ color: 'var(--magenta)' }}>sem equipe</span>}{m.volume ? ' · ' + m.volume + ' m³' : ''}</span>
                  </button>
                ))}
              </div>
            </Secao>
            <Secao kicker="Bancada" titulo="CPs a romper" count={a.rompimentos.length}>
              <div className="space-y-2">
                {a.rompimentos.map((r) => (
                  <button type="button" key={r.id} className={linha + ' w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800/40'} onClick={() => nav('/rompimentos', { viewTransition: true })}>
                    <span><b>{r.numeracao || r.codigo || 'CP'}</b> <span className="text-slate-500">· {r.obra ?? '—'}</span></span>
                    <span className="text-xs text-slate-500">{r.idade ?? '—'} {r.idade_unidade}</span>
                  </button>
                ))}
              </div>
            </Secao>
            <Secao kicker="Logística" titulo="Coletas em rota" count={a.coletas.length}>
              <div className="space-y-2">
                {a.coletas.map((c) => (
                  <button type="button" key={c.id} className={linha + ' w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800/40'} onClick={() => nav('/coleta-formas', { viewTransition: true })}>
                    <span><b>Roteiro</b> <span className="text-slate-500">· {c.motorista ?? 'sem motorista'}</span></span>
                    <span className="text-xs text-slate-500">{c.paradas} parada(s) · {c.status}</span>
                  </button>
                ))}
              </div>
            </Secao>
            <Secao kicker="Qualidade" titulo="Laudos aguardando RT" count={a.laudos.length}>
              <div className="space-y-2">
                {a.laudos.map((l) => (
                  <button type="button" key={l.id} className={linha + ' w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800/40'} onClick={() => nav('/laudos', { viewTransition: true })}>
                    <span><b>{l.numero || 'Laudo'}</b> <span className="text-slate-500">· {l.obra ?? '—'}</span></span>
                    <span className="text-xs text-slate-500">{l.status}</span>
                  </button>
                ))}
              </div>
            </Secao>
          </div>
        </>
      ) : null}
    </div>
  );
}
