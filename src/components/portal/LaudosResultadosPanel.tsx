import { useMemo, useState } from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatusBadge } from '../ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../ui/State';
import { FileText, Download, Search } from '../ui/icons';
import { ParcialFinalBadge } from './ParcialFinalBadge';
import { consolidarExemplares, exportResultadosXlsx, filtraLaudos, filtraResultados } from '../../lib/portal/resultados';
import type { PortalLaudoView, PortalResultadoRow } from '../../lib/portal/types';

export type LaudosResultadosPanelProps = {
  works: { id: string; nome: string }[];
  laudos: PortalLaudoView[];
  resultados: PortalResultadoRow[];
  loading?: boolean;
  error?: string | null;
  onDownload: (reportId: string) => void | Promise<void>;
  fileLabel?: string;
};

const num = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d));

function ConformeBadge({ value }: { value: boolean | null }) {
  if (value == null) return <Badge tone="neutral">—</Badge>;
  return <Badge tone={value ? 'success' : 'danger'}>{value ? 'Conforme' : 'Não conforme'}</Badge>;
}

function ResultadosTable({ rows }: { rows: PortalResultadoRow[] }) {
  if (!rows.length) return <p className="px-3 py-4 text-sm text-slate-500">Nenhum resultado para os filtros atuais.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <tr><th className="px-3 py-2">Concretagem</th><th>NF / Exemplar</th><th>CP</th><th>Idade</th><th>Resultado</th><th>FCK</th><th>Conformidade</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cp_id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2"><div className="font-semibold text-slate-800 dark:text-slate-100">{r.concretagem_codigo ?? '—'}</div><div className="text-xs text-slate-500">{r.data_concretagem ?? '—'}{r.local_texto ? ' · ' + r.local_texto : ''}</div></td>
              <td>{(r.nota_fiscal ? 'NF ' + r.nota_fiscal : '—')}{r.amostra_codigo ? ' · ' + r.amostra_codigo : ''}</td>
              <td>{r.cp_codigo ?? r.numeracao_lab ?? '—'}</td>
              <td>{r.idade_dias ?? '—'}{r.idade_unidade === 'hora' ? 'h' : 'd'} {r.is_controle ? <Badge tone="info">controle</Badge> : null}</td>
              <td className="font-semibold">{num(r.resultado_valor)}{r.resultado_valor != null ? ' MPa' : ''}</td>
              <td>{num(r.fck_ref)}</td>
              <td>{r.is_controle ? <ConformeBadge value={r.conforme} /> : <span className="text-xs text-slate-400">acompanhamento</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LaudosResultadosPanel({ works, laudos, resultados, loading, error, onDownload, fileLabel = 'resultados' }: LaudosResultadosPanelProps) {
  const [workId, setWorkId] = useState('');
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'todos' | 'parcial' | 'final'>('todos');
  const [status, setStatus] = useState('');
  const [idade, setIdade] = useState<'todas' | 'controle' | 'acompanhamento'>('todas');
  const [conf, setConf] = useState<'todas' | 'conforme' | 'nao_conforme'>('todas');
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [baixando, setBaixando] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const statuses = useMemo(() => [...new Set(laudos.map((l) => l.status).filter(Boolean))], [laudos]);
  const laudosF = useMemo(() => filtraLaudos(laudos, { workId, texto, tipo, status }), [laudos, workId, texto, tipo, status]);
  const resF = useMemo(() => filtraResultados(resultados, { workId, texto, idade, conformidade: conf, somenteComResultado: true }), [resultados, workId, texto, idade, conf]);
  const resumo = useMemo(() => consolidarExemplares(resF), [resF]);
  const conformes = resumo.filter((e) => e.conforme === true).length;
  const naoConformes = resumo.filter((e) => e.conforme === false).length;

  function toggle(id: string) { setExpandido((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  async function baixar(id: string) { setBaixando(id); try { await onDownload(id); } finally { setBaixando(null); } }
  async function exportar() {
    setExportando(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      await exportResultadosXlsx(resF, fileLabel + '-' + hoje + '.xlsx');
    } finally { setExportando(false); }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Filtros">Refine por obra, tipo de laudo, idade e conformidade. O Excel respeita o filtro atual.</CardHeader>
        <div className="grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-6">
          <label className="text-xs font-semibold text-slate-500">Obra<select className="input mt-1" value={workId} onChange={(e) => setWorkId(e.target.value)}><option value="">Todas</option>{works.map((w) => <option key={w.id} value={w.id}>{w.nome}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500 lg:col-span-2">Busca<span className="relative mt-1 block"><Search size={15} className="pointer-events-none absolute left-2 top-2.5 text-slate-400" /><input className="input pl-7" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Laudo, concretagem, NF, local, CP..." /></span></label>
          <label className="text-xs font-semibold text-slate-500">Tipo de laudo<select className="input mt-1" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}><option value="todos">Todos</option><option value="parcial">Parcial</option><option value="final">Final</option></select></label>
          <label className="text-xs font-semibold text-slate-500">Status<select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500">Idade<select className="input mt-1" value={idade} onChange={(e) => setIdade(e.target.value as typeof idade)}><option value="todas">Todas</option><option value="controle">Idade de controle</option><option value="acompanhamento">Acompanhamento</option></select></label>
          <label className="text-xs font-semibold text-slate-500">Conformidade<select className="input mt-1" value={conf} onChange={(e) => setConf(e.target.value as typeof conf)}><option value="todas">Todas</option><option value="conforme">Conforme</option><option value="nao_conforme">Não conforme</option></select></label>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-slate-950 dark:text-slate-50">{l.numero}{l.revisao > 0 ? ' R' + l.revisao : ''}</span>
                        <ParcialFinalBadge value={l.parcial_final} />
                        <StatusBadge status={l.status} />
                      </div>
                      <div className="mt-1 text-slate-500">{l.work_nome ?? '—'} · {l.data_emissao ?? 'sem emissão'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" leftIcon={<FileText size={15} />} onClick={() => toggle(l.id)}>{aberto ? 'Ocultar resultados' : 'Ver resultados'}</Button>
                      {l.tem_pdf ? <Button variant="ghost" leftIcon={<Download size={15} />} disabled={baixando === l.id} onClick={() => void baixar(l.id)}>{baixando === l.id ? 'Abrindo...' : 'Baixar PDF'}</Button> : null}
                    </div>
                  </div>
                  {aberto ? <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700">{cps.length ? <ResultadosTable rows={cps} /> : <p className="px-3 py-4 text-sm text-slate-500">Sem resultados lançados para este laudo ainda.</p>}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4 dark:border-slate-800">
          <div><p className="kicker">Resultados</p><h2 className="mt-1 text-lg display text-slate-950 dark:text-slate-50">Corpos de prova ({resF.length})</h2><p className="mt-1 text-xs text-slate-500">Exemplares: {resumo.length} · {conformes} conformes · {naoConformes} não conformes</p></div>
          <Button leftIcon={<Download size={15} />} disabled={exportando || resF.length === 0} onClick={() => void exportar()}>{exportando ? 'Gerando...' : 'Exportar Excel'}</Button>
        </div>
        <ResultadosTable rows={resF.slice(0, 800)} />
        {resF.length > 800 ? <p className="px-3 py-2 text-xs text-slate-400">Mostrando 800 de {resF.length}. Refine o filtro ou use o Excel para o conjunto completo.</p> : null}
      </Card>
    </div>
  );
}
