import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { relatorioProdutividade } from '../../lib/api/produtividade';

function mesAtual() { const d = new Date(); const iso = (x: Date) => x.toISOString().slice(0, 10); return { inicio: iso(new Date(d.getFullYear(), d.getMonth(), 1)), fim: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }; }

export function ProdutividadePage() {
  const m0 = useMemo(mesAtual, []);
  const [inicio, setInicio] = useState(m0.inicio);
  const [fim, setFim] = useState(m0.fim);
  const [params, setParams] = useState<{ inicio: string; fim: string } | null>(null);
  const q = useQuery({ queryKey: ['produtividade', params?.inicio, params?.fim], queryFn: () => relatorioProdutividade(params!.inicio, params!.fim), enabled: !!params });

  const linhas = q.data?.linhas ?? [];
  const tot = linhas.reduce((a, r) => ({ c: a.c + r.concretagens, cp: a.cp + r.cps_moldados, ro: a.ro + r.rompimentos }), { c: 0, cp: 0, ro: 0 });

  async function exportar() {
    if (!linhas.length) return;
    const { exportExcel } = await import('../../lib/export/xlsx');
    const br = (d?: string) => (d ? d.split('-').reverse().join('/') : '-');
    const rows = linhas.map((r) => ({ colaborador: r.nome, funcoes: r.funcoes.join(', '), concretagens: r.concretagens, cps: r.cps_moldados, rompimentos: r.rompimentos }));
    await exportExcel(
      { title: 'Produtividade por colaborador', filename: `produtividade-${params?.inicio ?? ''}-a-${params?.fim ?? ''}.xlsx`, fields: [{ label: 'Período', value: `${br(params?.inicio)} a ${br(params?.fim)}` }] },
      {
        name: 'Produtividade',
        totals: true,
        columns: [
          { key: 'colaborador', header: 'Colaborador', width: 28 },
          { key: 'funcoes', header: 'Funções', width: 24 },
          { key: 'concretagens', header: 'Concretagens', format: 'int', total: 'sum' },
          { key: 'cps', header: 'CPs moldados', format: 'int', total: 'sum' },
          { key: 'rompimentos', header: 'Rompimentos', format: 'int', total: 'sum' },
        ],
        rows,
      },
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Gestao" title="Produtividade" description="Producao por colaborador no periodo: concretagens e CPs moldados (como moldador) e rompimentos realizados (como operador)." />
      <Card className="p-5">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 160 }}><Field label="Inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
          <div style={{ minWidth: 160 }}><Field label="Fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
          <Button onClick={() => setParams({ inicio, fim })}>Calcular</Button>
          {linhas.length ? <Button variant="secondary" onClick={exportar}>Exportar Excel</Button> : null}
        </div>
      </Card>
      {params ? (
        <Card className="p-5">
          {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : linhas.length === 0 ? <EmptyState /> : (
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Colaborador</th><th>Funcoes</th><th style={{ textAlign: 'right' }}>Concretagens</th><th style={{ textAlign: 'right' }}>CPs moldados</th><th style={{ textAlign: 'right' }}>Rompimentos</th></tr></thead>
                <tbody>
                  {linhas.map((r) => (
                    <tr key={r.colaborador_id}>
                      <td style={{ fontWeight: 700 }}>{r.nome}</td>
                      <td style={{ color: 'var(--ink-faint)' }}>{r.funcoes.join(', ') || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{r.concretagens}</td>
                      <td style={{ textAlign: 'right' }}>{r.cps_moldados}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.rompimentos}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--line)' }}>
                    <td style={{ fontWeight: 800 }}>Total</td><td></td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{tot.c}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{tot.cp}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{tot.ro}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
