import { useMemo, useState, lazy, Suspense } from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatusBadge } from '../ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../ui/State';
import { FileText, Download, Search, AlertTriangle, Pencil } from '../ui/icons';
import { ParcialFinalBadge } from './ParcialFinalBadge';
import { CorrecaoModal } from './CorrecaoModal';
const EvolucaoExemplares = lazy(() => import('./EvolucaoExemplares').then((m) => ({ default: m.EvolucaoExemplares })));
import { consolidarExemplares, exportResultadosPdf, exportResultadosXlsx, filtraLaudos, filtraResultados, isAtrasado } from '../../lib/portal/resultados';
import type { PortalCorrecao, PortalCorrecaoConfig, PortalCorrecaoInput, PortalLaudoView, PortalResultadoRow } from '../../lib/portal/types';

export type LaudosResultadosPanelProps = {
  works: { id: string; nome: string }[];
  laudos: PortalLaudoView[];
  resultados: PortalResultadoRow[];
  loading?: boolean;
  error?: string | null;
  onDownload: (reportId: string) => void | Promise<void>;
  fileLabel?: string;
  onSolicitarCorrecao?: (input: PortalCorrecaoInput) => Promise<void>;
  correcaoConfig?: PortalCorrecaoConfig | null;
  meusPedidos?: PortalCorrecao[];
};

const fmt = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d));

function ConformeBadge({ value }: { value: boolean | null }) {
  if (value == null) return <Badge tone="neutral">—</Badge>;
  return <Badge tone={value ? 'success' : 'danger'}>{value ? 'Conforme' : 'Não conforme'}</Badge>;
}
function CorrStatusBadge({ status }: { status: string }) {
  const tone = status === 'aprovada' ? 'success' : status === 'rejeitada' ? 'danger' : status === 'em_analise' ? 'info' : status === 'cancelada' ? 'neutral' : 'warning';
  const label = status === 'aprovada' ? 'Aprovada' : status === 'rejeitada' ? 'Rejeitada' : status === 'em_analise' ? 'Em análise' : status === 'cancelada' ? 'Cancelada' : 'Pendente';
  return <Badge tone={tone as 'success' | 'danger' | 'info' | 'neutral' | 'warning'}>{label}</Badge>;
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: 'danger' | 'success' | 'warning' }) {
  const color = tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : 'text-slate-900 dark:text-slate-50';
  return <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><div className={'text-2xl display ' + color}>{value}</div><div className="text-xs text-slate-500">{label}</div></div>;
}

function ResultadosTable({ rows }: { rows: PortalResultadoRow[] }) {
  if (!rows.length) return <p className="px-3 py-4 text-sm text-slate-500">Nenhum resultado para este laudo ainda.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth: 760 }}>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <tr><th className="px-3 py-2">NF / Exemplar</th><th>CP</th><th>Idade</th><th>Resultado</th><th>FCK</th><th>Conformidade</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cp_id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2">{r.nota_fiscal ? 'NF ' + r.nota_fiscal : '—'}{r.amostra_codigo ? ' · ' + r.amostra_codigo : ''}</td>
              <td>{r.cp_codigo ?? r.numeracao_lab ?? '—'}</td>
              <td>{r.idade_dias ?? '—'}{r.idade_unidade === 'hora' ? 'h' : 'd'} {r.is_controle ? <Badge tone="info">controle</Badge> : isAtrasado(r) ? <Badge tone="danger">atrasado</Badge> : null}</td>
              <td className="font-semibold">{fmt(r.resultado_valor)}{r.resultado_valor != null ? ' MPa' : ''}</td>
              <td>{fmt(r.fck_ref)}</td>
              <td>{r.is_controle ? <ConformeBadge value={r.conforme} /> : <span className="text-xs text-slate-400">acompanhamento</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LaudosResultadosPanel({ works, laudos, resultados, loading, error, onDownload, fileLabel = 'resultados', onSolicitarCorrecao, correcaoConfig, meusPedidos }: LaudosResultadosPanelProps) {
  const [workId, setWorkId] = useState('');
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'todos' | 'parcial' | 'final'>('todos');
  const [status, setStatus] = useState('');
  const [idade, setIdade] = useState<'todas' | 'controle' | 'acompanhamento'>('todas');
  const [conf, setConf] = useState<'todas' | 'conforme' | 'nao_conforme'>('todas');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [baixando, setBaixando] = useState<string | null>(null);
  const [exp, setExp] = useState<'' | 'xlsx' | 'pdf'>('');
  const [correcaoLaudo, setCorrecaoLaudo] = useState<PortalLaudoView | null>(null);

  const podeCorrigir = !!onSolicitarCorrecao && correcaoConfig?.correcao_habilitada !== false;
  const statuses = useMemo(() => [...new Set(laudos.map((l) => l.status).filter(Boolean))], [laudos]);
  const laudosF = useMemo(() => filtraLaudos(laudos, { workId, texto, tipo, status, de, ate }), [laudos, workId, texto, tipo, status, de, ate]);
  const resStats = useMemo(() => filtraResultados(resultados, { workId, texto, idade, conformidade: conf, somenteComResultado: true, de, ate }), [resultados, workId, texto, idade, conf, de, ate]);
  const resExport = useMemo(() => filtraResultados(resultados, { workId, texto, idade, conformidade: conf, somenteComResultado: false, de, ate }), [resultados, workId, texto, idade, conf, de, ate]);
  const resumo = useMemo(() => consolidarExemplares(resStats), [resStats]);
  const atrasados = useMemo(() => resultados.filter((r) => isAtrasado(r) && (!workId || r.work_id === workId)), [resultados, workId]);
  const conformes = resumo.filter((e) => e.conforme === true).length;
  const naoConformes = resumo.filter((e) => e.conforme === false).length;
  const finais = laudos.filter((l) => l.parcial_final === 'final').length;
  const parciais = laudos.filter((l) => l.parcial_final === 'parcial').length;
  const [verAtrasados, setVerAtrasados] = useState(false);

  function toggle(id: string) { setExpandido((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  async function baixar(id: string) { setBaixando(id); try { await onDownload(id); } finally { setBaixando(null); } }
  async function exportarXlsx() { setExp('xlsx'); try { await exportResultadosXlsx(resExport, fileLabel + '-' + new Date().toISOString().slice(0, 10) + '.xlsx'); } finally { setExp(''); } }
  function exportarPdf() { setExp('pdf'); try { exportResultadosPdf(resExport, 'Resultados de ensaio — ' + fileLabel); } finally { setExp(''); } }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const cpsDoLaudo = correcaoLaudo?.concretagem_id ? resultados.filter((r) => r.concretagem_id === correcaoLaudo.concretagem_id) : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MiniStat label="Laudos finais" value={finais} tone="success" />
        <MiniStat label="Laudos parciais" value={parciais} tone="warning" />
        <MiniStat label="Exemplares conformes" value={conformes} tone="success" />
        <MiniStat label="Não conformes" value={naoConformes} tone={naoConformes ? 'danger' : undefined} />
        <MiniStat label="CPs atrasados" value={atrasados.length} tone={atrasados.length ? 'danger' : undefined} />
      </div>

      {atrasados.length ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle size={16} /> {atrasados.length} corpo(s) de prova atrasado(s) (rompimento vencido sem resultado)</div>
            <Button variant="ghost" onClick={() => setVerAtrasados((v) => !v)}>{verAtrasados ? 'Ocultar' : 'Ver'}</Button>
          </div>
          {verAtrasados ? <div className="border-t border-slate-100 px-4 py-2 text-sm dark:border-slate-800">{atrasados.slice(0, 60).map((r) => <div key={r.cp_id} className="flex flex-wrap justify-between gap-2 border-b border-slate-50 py-1 dark:border-slate-800/60"><span>{(r.concretagem_codigo ?? '—') + ' · ' + (r.cp_codigo ?? r.numeracao_lab ?? '') + ' · ' + (r.idade_dias ?? '') + 'd'}</span><span className="text-slate-500">previsto {r.data_prevista_rompimento ?? '—'}</span></div>)}</div> : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Filtros">Refine por obra, tipo de laudo, idade, conformidade e período. O export de resultados respeita estes filtros.</CardHeader>
        <div className="grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-4">
          <label className="text-xs font-semibold text-slate-500">Obra<select className="input mt-1" value={workId} onChange={(e) => setWorkId(e.target.value)}><option value="">Todas</option>{works.map((w) => <option key={w.id} value={w.id}>{w.nome}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500 lg:col-span-2">Busca<span className="relative mt-1 block"><Search size={15} className="pointer-events-none absolute left-2 top-2.5 text-slate-400" /><input className="input pl-7" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Laudo, concretagem, NF, local, CP..." /></span></label>
          <label className="text-xs font-semibold text-slate-500">Tipo de laudo<select className="input mt-1" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}><option value="todos">Todos</option><option value="parcial">Parcial</option><option value="final">Final</option></select></label>
          <label className="text-xs font-semibold text-slate-500">Status<select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500">Idade<select className="input mt-1" value={idade} onChange={(e) => setIdade(e.target.value as typeof idade)}><option value="todas">Todas</option><option value="controle">Idade de controle</option><option value="acompanhamento">Acompanhamento</option></select></label>
          <label className="text-xs font-semibold text-slate-500">Conformidade<select className="input mt-1" value={conf} onChange={(e) => setConf(e.target.value as typeof conf)}><option value="todas">Todas</option><option value="conforme">Conforme</option><option value="nao_conforme">Não conforme</option></select></label>
          <label className="text-xs font-semibold text-slate-500">De<input className="input mt-1" type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
          <label className="text-xs font-semibold text-slate-500">Até<input className="input mt-1" type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4 dark:border-slate-800">
          <div><p className="kicker">Controle tecnológico</p><h2 className="mt-1 text-lg display text-slate-950 dark:text-slate-50">Laudos ({laudosF.length})</h2></div>
        </div>
        {laudosF.length === 0 ? <EmptyState /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {laudosF.map((l) => {
              const aberto = expandido.has(l.id);
              const cps = l.concretagem_id ? resultados.filter((r) => r.concretagem_id === l.concretagem_id) : [];
              return (
                <div key={l.id} className="p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-black text-slate-950 dark:text-slate-50">{l.numero}{l.revisao > 0 ? ' R' + l.revisao : ''}</span><ParcialFinalBadge value={l.parcial_final} /><StatusBadge status={l.status} /></div>
                      <div className="mt-1 text-slate-500">{l.work_nome ?? '—'} · {l.data_emissao ?? 'sem emissão'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" leftIcon={<FileText size={15} />} onClick={() => toggle(l.id)}>{aberto ? 'Ocultar resultados' : 'Ver resultados'}</Button>
                      {l.tem_pdf ? <Button variant="ghost" leftIcon={<Download size={15} />} disabled={baixando === l.id} onClick={() => void baixar(l.id)}>{baixando === l.id ? 'Abrindo...' : 'Baixar PDF'}</Button> : null}
                      {podeCorrigir ? <Button variant="ghost" leftIcon={<Pencil size={15} />} onClick={() => setCorrecaoLaudo(l)}>Solicitar correção</Button> : null}
                    </div>
                  </div>
                  {aberto ? <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700">{cps.length ? <><Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />}><EvolucaoExemplares rows={cps} /></Suspense><ResultadosTable rows={cps} /></> : <p className="px-3 py-4 text-sm text-slate-500">Sem resultados lançados para este laudo ainda.</p>}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="kicker">Resultados</p><h2 className="mt-1 text-lg display text-slate-950 dark:text-slate-50">Exportar resultados detalhados</h2><p className="mt-1 text-xs text-slate-500">Planilha com <strong>todos os corpos de prova</strong> (uma linha por CP, inclui pendentes), respeitando os filtros acima. {resExport.length} CP(s).</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon={<Download size={15} />} disabled={exp !== '' || resExport.length === 0} onClick={() => exportarPdf()}>{exp === 'pdf' ? 'Gerando...' : 'PDF'}</Button>
            <Button leftIcon={<Download size={15} />} disabled={exp !== '' || resExport.length === 0} onClick={() => void exportarXlsx()}>{exp === 'xlsx' ? 'Gerando...' : 'Excel'}</Button>
          </div>
        </div>
      </Card>

      {meusPedidos && meusPedidos.length ? (
        <Card>
          <CardHeader title={'Meus pedidos de correção (' + meusPedidos.length + ')'}>Acompanhe as solicitações enviadas ao laboratório.</CardHeader>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {meusPedidos.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-800 dark:text-slate-100">{p.lab_report_numero ? 'Laudo ' + p.lab_report_numero : (p.concretagem_codigo ?? '—')}</span><CorrStatusBadge status={p.status} /><Badge tone="neutral">{p.tipo}</Badge>{p.nova_revisao != null ? <Badge tone="success">R{p.nova_revisao}</Badge> : null}</div>
                  <div className="mt-1 text-slate-500">{p.comentario_cliente ?? p.valor_proposto ?? '—'}{p.decisao_comentario ? ' · lab: ' + p.decisao_comentario : ''}</div>
                </div>
                <span className="text-xs text-slate-400">{(p.created_at ?? '').slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {onSolicitarCorrecao ? <CorrecaoModal open={!!correcaoLaudo} laudo={correcaoLaudo} cps={cpsDoLaudo} config={correcaoConfig} onClose={() => setCorrecaoLaudo(null)} onSubmit={onSolicitarCorrecao} /> : null}
    </div>
  );
}
