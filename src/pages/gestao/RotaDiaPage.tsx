import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { RotaMap } from '../../components/RotaMap';
import { listEquipeColaboradores } from '../../lib/api/concretagem';
import { getOrigem, worksCoords, geocodificar, otimizarSequencia, mapsUrlDeParadas } from '../../lib/api/coletaFormas';
import { programacoesDoMoldador, type ParadaObra } from '../../lib/api/rotaDia';

const hojeStr = () => new Date().toISOString().slice(0, 10);

export function RotaDiaPage() {
  const { member } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(hojeStr());
  const [moldadorId, setMoldadorId] = useState('');
  const [ordem, setOrdem] = useState<string[] | null>(null);
  const [coords, setCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [busy, setBusy] = useState(false);

  const colabs = useQuery({ queryKey: ['equipe-colabs', member?.tenant_id], queryFn: listEquipeColaboradores });
  const origemQ = useQuery({ queryKey: ['coleta-origem'], queryFn: getOrigem });
  const q = useQuery({ queryKey: ['rota-dia', member?.tenant_id, data, moldadorId], enabled: !!member && !!moldadorId, queryFn: () => programacoesDoMoldador(data, moldadorId) });

  const paradas: ParadaObra[] = q.data ?? [];
  const origemCoord = origemQ.data?.lat != null && origemQ.data?.lng != null ? { lat: origemQ.data.lat, lng: origemQ.data.lng } : null;

  // Ordena as paradas pela sequência otimizada (quando houver), senão ordem natural.
  const ordenadas = useMemo(() => {
    if (!ordem) return paradas;
    const byId = new Map(paradas.map((p) => [p.work_id, p]));
    const out = ordem.map((id) => byId.get(id)).filter(Boolean) as ParadaObra[];
    for (const p of paradas) if (!ordem.includes(p.work_id)) out.push(p);
    return out;
  }, [ordem, paradas]);

  const paradasMapa = ordenadas.filter((p) => coords[p.work_id]).map((p, i) => ({ id: p.work_id, label: (i + 1) + '. ' + p.obra, lat: coords[p.work_id].lat, lng: coords[p.work_id].lng }));

  async function otimizar() {
    if (!paradas.length) return;
    setBusy(true);
    try {
      const ids = paradas.map((p) => p.work_id);
      const gc = await geocodificar(ids, true);
      const cds = await worksCoords(ids);
      setCoords(cds);
      const origem = gc.origem ?? origemCoord;
      const pts = ids.filter((id) => cds[id]).map((id) => ({ id, lat: cds[id].lat, lng: cds[id].lng }));
      const order = otimizarSequencia(origem, pts);
      setOrdem(order);
      const semGeo = ids.length - pts.length;
      toast('Rota otimizada.' + (semGeo ? ' ' + semGeo + ' obra(s) sem geocodificar.' : ''), 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  function abrirMaps() {
    const u = mapsUrlDeParadas(ordenadas.map((p) => ({ endereco: p.endereco, cidade: p.cidade, uf: p.uf })));
    if (!u) { toast('Sem endereços para montar a rota.', 'info'); return; }
    window.open(u, '_blank', 'noopener');
  }

  return (
    <div className="space-y-4">
      <PageHeader kicker="Operação" title="Rota do dia do moldador" description="As obras que o moldador atende no dia, na melhor ordem — reusa o motor de rota da coleta de fôrmas (ponto de partida do lab + otimização + mapa)." />
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div style={{ minWidth: 200 }}><SelectField label="Moldador" value={moldadorId} onChange={(e) => { setMoldadorId(e.target.value); setOrdem(null); }}><option value="">Selecione…</option>{(colabs.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectField></div>
          <div style={{ maxWidth: 170 }}><Field label="Dia" type="date" value={data} onChange={(e) => { setData(e.target.value); setOrdem(null); }} /></div>
          {paradas.length ? <Button busy={busy} onClick={() => void otimizar()}>{busy ? 'Otimizando…' : 'Otimizar rota'}</Button> : null}
          {ordenadas.length ? <Button variant="secondary" onClick={abrirMaps}>Abrir no Google Maps</Button> : null}
        </div>
        <p className="mt-2 text-xs text-slate-500">Ponto de partida: {origemQ.data?.endereco ? <b style={{ color: 'var(--ink)' }}>{origemQ.data.endereco}</b> : 'não definido (configure em Preferências)'}.</p>
      </Card>

      {!moldadorId ? <Card className="p-6 text-sm text-slate-500">Selecione um moldador para ver a rota do dia.</Card>
        : q.isLoading ? <LoadingState />
        : q.isError ? <ErrorState message={(q.error as Error).message} />
        : !paradas.length ? <Card className="p-6 text-sm text-slate-500">Nenhuma programação com este moldador no dia.</Card>
        : (
          <>
            {paradasMapa.length ? <Card className="p-3"><RotaMap origem={origemCoord} paradas={paradasMapa} /></Card>
              : <Card className="p-4 text-xs text-slate-500">Sem coordenadas ainda — use "Otimizar rota" para geocodificar as obras e montar o mapa.</Card>}
            <Card className="p-0">
              <div className="table-scroll">
                <table className="table">
                  <thead><tr><th style={{ width: 40 }}>#</th><th>Obra</th><th>Cliente</th><th>Endereço</th><th style={{ textAlign: 'right' }}>Concretagens</th></tr></thead>
                  <tbody>
                    {ordenadas.map((p, i) => (
                      <tr key={p.work_id}>
                        <td className="font-black tabular-nums">{i + 1}</td>
                        <td style={{ fontWeight: 700 }}>{p.obra}</td>
                        <td className="text-slate-500">{p.cliente ?? '—'}</td>
                        <td className="text-xs text-slate-500">{[p.endereco, p.cidade, p.uf].filter(Boolean).join(', ') || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{p.concretagens}{p.horas.length ? <span className="text-xs text-slate-400"> · {p.horas.sort().join(', ')}</span> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
    </div>
  );
}
