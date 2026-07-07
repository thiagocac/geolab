import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Stat } from '../../components/ui/Stat';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { relatorioProdutividade } from '../../lib/api/produtividade';
import { dispersaoParResumo } from '../../lib/api/dispersao';

function mesAtual() { const d = new Date(); const iso = (x: Date) => x.toISOString().slice(0, 10); return { inicio: iso(new Date(d.getFullYear(), d.getMonth(), 1)), fim: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }; }

export function ProdutividadePage() {
  const m0 = useMemo(mesAtual, []);
  const [inicio, setInicio] = useState(m0.inicio);
  const [fim, setFim] = useState(m0.fim);
  const [params, setParams] = useState<{ inicio: string; fim: string } | null>(null);
  const q = useQuery({ queryKey: ['produtividade', params?.inicio, params?.fim], queryFn: () => relatorioProdutividade(params!.inicio, params!.fim), enabled: !!params });
  // B1 — indicador de dispersão do par (gêmeos) por moldador, no mesmo período.
  const dispQ = useQuery({ queryKey: ['dispersao-par', params?.inicio, params?.fim], queryFn: () => dispersaoParResumo(params!.inicio, params!.fim), enabled: !!params });
  const disp = dispQ.data;

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
      <PageHeader kicker="Gestão" title="Produtividade" description="Produção por colaborador no periodo: concretagens e CPs moldados (como moldador) e rompimentos realizados (como operador)." />
      <Card className="p-5">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 160 }}><Field label="Início" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
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
      {params ? (
        <Card className="p-5">
          <p className="kicker">Qualidade do ensaio · B1</p>
          <h2 className="mt-1 text-xl display text-slate-950 dark:text-slate-50">Dispersão do par (gêmeos)</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Diferença entre os 2 CPs do mesmo exemplar na mesma idade (Δ% = (maior−menor)/média). Acima de {disp?.limite_pct ?? 6}% aponta problema de moldagem, capeamento ou prensa. Limite ajustável em Preferências.</p>
          <div style={{ marginTop: 12 }}>
            {dispQ.isLoading ? <LoadingState /> : dispQ.isError ? <ErrorState message={(dispQ.error as Error).message} /> : disp && disp.geral.pares > 0 ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="grid gap-3 md:grid-cols-3">
                  <Stat label="Pares avaliados" value={disp.geral.pares} />
                  <Stat label={`Fora do limite (> ${disp.limite_pct}%)`} value={`${disp.geral.fora} (${disp.geral.pares ? Math.round((disp.geral.fora * 1000) / disp.geral.pares) / 10 : 0}%)`} />
                  <Stat label="Dispersão média" value={`${disp.geral.disp_media}%`} detail={`máximo ${disp.geral.disp_max}%`} />
                </div>
                {disp.por_moldador.length ? (
                  <div className="table-scroll">
                    <table className="table">
                      <thead><tr><th>Moldador</th><th style={{ textAlign: 'right' }}>Pares</th><th style={{ textAlign: 'right' }}>Fora</th><th style={{ textAlign: 'right' }}>% fora</th><th style={{ textAlign: 'right' }}>Δ média</th><th style={{ textAlign: 'right' }}>Δ máximo</th></tr></thead>
                      <tbody>
                        {disp.por_moldador.map((r) => (
                          <tr key={r.colaborador_id || r.nome}>
                            <td style={{ fontWeight: 700 }}>{r.nome}</td>
                            <td style={{ textAlign: 'right' }}>{r.pares}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: r.fora > 0 ? 'var(--magenta)' : undefined }}>{r.fora}</td>
                            <td style={{ textAlign: 'right' }}>{r.pct_fora}%</td>
                            <td style={{ textAlign: 'right' }}>{r.disp_media}%</td>
                            <td style={{ textAlign: 'right' }}>{r.disp_max}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-slate-500">Sem moldador atribuído nos pares do período — atribua a equipe na programação para o indicador por pessoa.</p>}
              </div>
            ) : <EmptyState />}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
