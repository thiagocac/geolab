import { useMemo, useState } from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatusBadge } from '../ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../ui/State';
import { FileText, Download, Search, AlertTriangle } from '../ui/icons';
import { ParcialFinalBadge } from './ParcialFinalBadge';
import { EvolucaoExemplares } from './EvolucaoExemplares';
import { TendenciaResistencia } from './TendenciaResistencia';
import { ComentariosLaudo } from './ComentariosLaudo';
import { consolidarExemplares, exportResultadosPdf, exportResultadosXlsx, filtraLaudos, filtraResultados, isAtrasado } from '../../lib/portal/resultados';
import type { PortalLaudoView, PortalResultadoRow } from '../../lib/portal/types';

export type LaudosResultadosPanelProps = {
  works: { id: string; nome: string }[];
  laudos: PortalLaudoView[];
  resultados: PortalResultadoRow[];
  loading?: boolean;
  error?: string | null;
  onDownload: (reportId: string) => void | Promise<void>;
  fileLabel?: string;
  permiteComentarios?: boolean;
};

const PAGE = 50;
const fmt = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d));

function ConformeBadge({ value }: { value: boolean | null }) {
  if (value == null) return <Badge tone="neutral">—</Badge>;
  return <Badge tone={value ? 'success' : 'danger'}>{value ? 'Conforme' : 'Não conforme'}</Badge>;
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: 'danger' | 'success' | 'warning' }) {
  const color = tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : 'text-slate-900 dark:text-slate-50';
  return <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><div className={'text-2xl display ' + color}>{value}</div><div className="text-xs text-slate-500">{label}</div></div>;
}

function ResultadosTable({ rows, tech }: { rows: PortalResultadoRow[]; tech?: boolean }) {
  if (!rows.length) return <p className="px-3 py-4 text-sm text-slate-500">Nenhum resultado para os filtros atuais.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth: tech ? 980 : 760 }}>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <tr><th className="px-3 py-2">Concretagem</th><th>NF / Exemplar</th><th>CP</th><th>Idade</th><th>Resultado</th><th>FCK</th>{tech ? <><th>Carga (kN)</th><th>Ø×h (mm)</th><th>Ruptura</th></> : null}<th>Conformidade</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cp_id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2"><div className="font-semibold text-slate-800 dark:text-slate-100">{r.concretagem_codigo ?? '—'}</div><div className="text-xs text-slate-500">{r.data_concretagem ?? '—'}{r.local_texto ? ' · ' + r.local_texto : ''}</div></td>
              <td>{r.nota_fiscal ? 'NF ' + r.nota_fiscal : '—'}{r.amostra_codigo ? ' · ' + r.amostra_codigo : ''}</td>
              <td>{r.cp_codigo ?? r.numeracao_lab ?? '—'}</td>
              <td>{r.idade_dias ?? '—'}{r.idade_unidade === 'hora' ? 'h' : 'd'} {r.is_controle ? <Badge tone="info">controle</Badge> : isAtrasado(r) ? <Badge tone="danger">atrasado</Badge> : null}</td>
              <td className="font-semibold">{fmt(r.resultado_valor)}{r.resultado_valor != null ? ' MPa' : ''}</td>
              <td>{fmt(r.fck_ref)}</td>
              {tech ? <><td>{fmt(r.carga_ruptura_kn, 1)}</td><td>{fmt(r.cp_diametro_mm, 0)}×{fmt(r.cp_altura_mm, 0)}</td><td>{r.tipo_ruptura ?? '—'}</td></> : null}
              <td>{r.is_controle ? <ConformeBadge value={r.conforme} /> : <span className="text-xs text-slate-400">acompanhamento</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LaudosResultadosPanel({ works, laudos, resultados, loading, error, onDownload, fileLabel = 'resultados', permiteComentarios = false }: LaudosResultadosPanelProps) {
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
  const [tech, setTech] = useState(false);
  const [page, setPage] = useState(0);
  const [verAtrasados, setVerAtrasados] = useState(false);

  const statuses = useMemo(() => [...new Set(laudos.map((l) => l.status).filter(Boolean))], [laudos]);
  const laudosF = useMemo(() => filtraLaudos(laudos, { workId, texto, tipo, status, de, ate }), [laudos, workId, texto, tipo, status, de, ate]);
  const resF = useMemo(() => filtraResultados(resultados, { workId, texto, idade, conformidade: conf, somenteComResultado: true, de, ate }), [resultados, workId, texto, idade, conf, de, ate]);
  const resumo = useMemo(() => consolidarExemplares(resF), [resF]);
  const atrasados = useMemo(() => resultados.filter((r) => isAtrasado(r) && (!workId || r.work_id === workId)), [resultados, workId]);
  const concCodigo = useMemo(() => { const m = new Map<string, string>(); for (const r of resultados) { if (r.concretagem_id && r.concretagem_codigo) m.set(r.concretagem_id, r.concretagem_codigo); } return m; }, [resultados]);
  const revCount = useMemo(() => { const m = new Map<string, number>(); for (const l of laudos) m.set(l.numero, (m.get(l.numero) ?? 0) + 1); return m; }, [laudos]);
  const conformes = resumo.filter((e) => e.conforme === true).length;
  const naoConformes = resumo.filter((e) => e.conforme === false).length;
  const finais = laudosF.filter((l) => l.parcial_final === 'final').length;
  const parciais = laudosF.filter((l) => l.parcial_final === 'parcial').length;
  const totalPages = Math.max(1, Math.ceil(resF.length / PAGE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageRows = resF.slice(pageSafe * PAGE, pageSafe * PAGE + PAGE);

  function toggle(id: string) { setExpandido((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  async function baixar(id: string) { setBaixando(id); try { await onDownload(id); } finally { setBaixando(null); } }
  async function exportarXlsx() { setExp('xlsx'); try { await exportResultadosXlsx(resF, fileLabel + '-' + new Date().toISOString().slice(0, 10) + '.xlsx'); } finally { setExp(''); } }
  function exportarPdf() { setExp('pdf'); try { exportResultadosPdf(resF, 'Resultados de ensaio — ' + fileLabel); } finally { setExp(''); } }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MiniStat label="Laudos finais" value={finais} tone="success" />
        <MiniStat label="Laudos parciais" value={parciais} tone="warning" />
        <MiniStat label="Exemplares conformes" value={conformes} tone="success" />
        <MiniStat label="Não conformes" value={naoConformes} tone={naoConformes ? 'danger' : undefined} />
        <MiniStat label="CPs atrasados" value={atrasados.length} tone={atrasados.length ? 'danger' : undefined} />
      </div>

      {resF.length >= 2 ? <Card><TendenciaResistencia rows={resF} /></Card> : null}

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
        <CardHeader title="Filtros">Refine por obra, tipo de laudo, idade, conformidade e período. Excel/PDF respeitam o filtro atual.</CardHeader>
        <div className="grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-4">
          <label className="text-xs font-semibold text-slate-500">Obra<select className="input mt-1" value={workId} onChange={(e) => { setWorkId(e.target.value); setPage(0); }}><option value="">Todas</option>{works.map((w) => <option key={w.id} value={w.id}>{w.nome}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500 lg:col-span-2">Busca<span className="relative mt-1 block"><Search size={15} className="pointer-events-none absolute left-2 top-2.5 text-slate-400" /><input className="input pl-7" value={texto} onChange={(e) => { setTexto(e.target.value); setPage(0); }} placeholder="Laudo, concretagem, NF, local, CP..." /></span></label>
          <label className="text-xs font-semibold text-slate-500">Tipo de laudo<select className="input mt-1" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}><option value="todos">Todos</option><option value="parcial">Parcial</option><option value="final">Final</option></select></label>
          <label className="text-xs font-semibold text-slate-500">Status<select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500">Idade<select className="input mt-1" value={idade} onChange={(e) => { setIdade(e.target.value as typeof idade); setPage(0); }}><option value="todas">Todas</option><option value="controle">Idade de controle</option><option value="acompanhamento">Acompanhamento</option></select></label>
          <label className="text-xs font-semibold text-slate-500">Conformidade<select className="input mt-1" value={conf} onChange={(e) => { setConf(e.target.value as typeof conf); setPage(0); }}><option value="todas">Todas</option><option value="conforme">Conforme</option><option value="nao_conforme">Não conforme</option></select></label>
          <label className="text-xs font-semibold text-slate-500">De<input className="input mt-1" type="date" value={de} onChange={(e) => { setDe(e.target.value); setPage(0); }} /></label>
          <label className="text-xs font-semibold text-slate-500">Até<input className="input mt-1" type="date" value={ate} onChange={(e) => { setAte(e.target.value); setPage(0); }} /></label>
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
                      <div className="flex flex-wrap items-center gap-2"><span className="font-black text-slate-950 dark:text-slate-50">{l.numero}{l.revisao > 0 ? ' R' + l.revisao : ''}</span><ParcialFinalBadge value={l.parcial_final} /><StatusBadge status={l.status} />{(revCount.get(l.numero) ?? 0) > 1 ? <Badge tone="neutral">{revCount.get(l.numero)} revisões</Badge> : null}</div>
                      <div className="mt-1 text-slate-500">{l.work_nome ?? '—'} · {l.data_emissao ?? 'sem emissão'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" leftIcon={<FileText size={15} />} onClick={() => toggle(l.id)}>{aberto ? 'Ocultar resultados' : 'Ver resultados'}</Button>
                      {l.tem_pdf ? <Button variant="ghost" leftIcon={<Download size={15} />} disabled={baixando === l.id} onClick={() => void baixar(l.id)}>{baixando === l.id ? 'Abrindo...' : 'Baixar PDF'}</Button> : null}{concCodigo.get(l.concretagem_id ?? '') ? <Button variant="ghost" onClick={() => window.open((typeof window !== 'undefined' ? window.location.origin : '') + '/validar/' + concCodigo.get(l.concretagem_id ?? ''), '_blank', 'noopener,noreferrer')}>Validar</Button> : null}
                    </div>
                  </div>
                  {aberto ? <div className="mt-3 space-y-3"><div className="rounded-xl border border-slate-200 dark:border-slate-700">{cps.length ? <><EvolucaoExemplares rows={cps} /><ResultadosTable rows={cps} /></> : <p className="px-3 py-4 text-sm text-slate-500">Sem resultados lançados para este laudo ainda.</p>}</div>{permiteComentarios ? <div className="rounded-xl border border-slate-200 dark:border-slate-700"><div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">Comentários e contestações</div><ComentariosLaudo labReportId={l.id} workId={l.work_id} /></div> : null}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4 dark:border-slate-800">
          <div><p className="kicker">Resultados</p><h2 className="mt-1 text-lg display text-slate-950 dark:text-slate-50">Corpos de prova ({resF.length})</h2><p className="mt-1 text-xs text-slate-500">Exemplares: {resumo.length} · {conformes} conformes · {naoConformes} não conformes</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setTech((v) => !v)}>{tech ? 'Menos colunas' : 'Detalhes técnicos'}</Button>
            <Button variant="secondary" leftIcon={<Download size={15} />} disabled={exp !== '' || resF.length === 0} onClick={() => exportarPdf()}>{exp === 'pdf' ? 'Gerando...' : 'PDF'}</Button>
            <Button leftIcon={<Download size={15} />} disabled={exp !== '' || resF.length === 0} onClick={() => void exportarXlsx()}>{exp === 'xlsx' ? 'Gerando...' : 'Excel'}</Button>
          </div>
        </div>
        <ResultadosTable rows={pageRows} tech={tech} />
        {resF.length > PAGE ? (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-3 text-sm dark:border-slate-800">
            <span className="text-slate-500">{pageSafe * PAGE + 1}–{Math.min(resF.length, pageSafe * PAGE + PAGE)} de {resF.length}</span>
            <div className="flex gap-2"><Button variant="ghost" disabled={pageSafe === 0} onClick={() => setPage(pageSafe - 1)}>Anterior</Button><Button variant="ghost" disabled={pageSafe >= totalPages - 1} onClick={() => setPage(pageSafe + 1)}>Próxima</Button></div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
