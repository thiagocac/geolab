import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, SelectField } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { formatDate } from '../../lib/format';
import { listDocGateConformity, listLaudoGateBlocks, type DocGateConformityRow, type LaudoGateBlock } from '../../lib/api/docgate';

const SITUACOES = [
  { value: '', label: 'Todas' },
  { value: 'ausente', label: 'Ausente' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'recusado', label: 'Recusado' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'a_vencer', label: 'A vencer' },
  { value: 'conforme', label: 'Conforme' },
  { value: 'dispensado', label: 'Dispensado' },
];
const ANCHORS = [
  { value: '', label: 'Todos os escopos' },
  { value: 'lab', label: 'Laboratório' },
  { value: 'equipamento', label: 'Equipamento' },
  { value: 'colaborador', label: 'Colaborador' },
  { value: 'obra', label: 'Obra' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'concretagem', label: 'Concretagem' },
  { value: 'laudo', label: 'Laudo' },
];
const GATES = [
  { value: '', label: 'Todos' },
  { value: 'bloqueante', label: 'Bloqueante' },
  { value: 'aviso', label: 'Aviso' },
  { value: 'informativo', label: 'Informativo' },
];

function situationClass(s: string): string {
  if (s === 'vencido' || s === 'ausente' || s === 'recusado' || s === 'sem_validade') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (s === 'a_vencer' || s === 'pendente' || s === 'em_analise') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  if (s === 'conforme' || s === 'dispensado') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
}
function gateClass(g: string): string {
  if (g === 'bloqueante') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (g === 'aviso') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
}
function severityClass(s: string): string {
  return s === 'bloqueante' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
}
function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return <Card className="p-4"><p className="kicker">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p>{hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}</Card>;
}
function DocRow({ row }: { row: DocGateConformityRow }) {
  return (
    <tr>
      <td>
        <div className="font-bold text-slate-950 dark:text-slate-50">{row.document_type_name}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{row.document_type_code} · {row.categoria}</div>
      </td>
      <td><span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{row.anchor_scope}</span></td>
      <td><span className={'badge ' + gateClass(row.nivel_gate)}>{row.nivel_gate}</span></td>
      <td><span className={'badge ' + situationClass(row.situacao)}>{row.situacao}</span></td>
      <td>{row.data_validade ? formatDate(row.data_validade) : '-'}</td>
      <td className="tabular-nums">{row.dias_para_vencer ?? '-'}</td>
      <td>{row.aplica_em_emissao_laudo ? 'Sim' : 'Não'}</td>
    </tr>
  );
}
function GateBlockCard({ block }: { block: LaudoGateBlock }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className={'badge ' + severityClass(block.severity)}>{block.severity}</span>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{block.code}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{block.message}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{block.entity_type}{block.entity_id ? ' · ' + block.entity_id : ''}</p>
    </article>
  );
}

export function DocGatePage() {
  const [anchorScope, setAnchorScope] = useState('');
  const [situacao, setSituacao] = useState('');
  const [gate, setGate] = useState('');
  const [concretagemInput, setConcretagemInput] = useState('');
  const [checkedConcretagem, setCheckedConcretagem] = useState('');
  const conformity = useQuery({
    queryKey: ['docgate', 'conformity', anchorScope, situacao, gate],
    staleTime: 30_000,
    queryFn: () => listDocGateConformity({ anchorScope: anchorScope || undefined, situacoes: situacao ? [situacao] : undefined, gate: gate ? [gate] : undefined }),
  });
  const blocks = useQuery({
    queryKey: ['docgate', 'laudo-blocks', checkedConcretagem],
    enabled: checkedConcretagem.length > 0,
    staleTime: 15_000,
    queryFn: () => listLaudoGateBlocks(checkedConcretagem),
  });
  const rows = conformity.data ?? [];
  const summary = useMemo(() => ({
    bloqueantes: rows.filter((r) => r.nivel_gate === 'bloqueante' && ['ausente', 'vencido', 'recusado', 'sem_validade', 'pendente', 'em_analise'].includes(r.situacao)).length,
    vencidos: rows.filter((r) => r.situacao === 'vencido').length,
    aVencer: rows.filter((r) => r.situacao === 'a_vencer').length,
    conformes: rows.filter((r) => r.situacao === 'conforme').length,
  }), [rows]);
  const blockRows = blocks.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader kicker="Governança laboratorial" title="Documentos e gate de laudo" description="Matriz documental enxuta para calibração, certificações, acreditação e documentos de obra. A emissão de laudo passa a consultar o gate técnico da Onda 2." />
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Bloqueantes" value={summary.bloqueantes} hint="impactam emissão" />
        <StatCard label="Vencidos" value={summary.vencidos} />
        <StatCard label="A vencer" value={summary.aVencer} />
        <StatCard label="Conformes" value={summary.conformes} />
      </div>
      <Card>
        <CardHeader kicker="Conformidade" title="Matriz documental">Filtre por escopo, situação ou nível de gate.</CardHeader>
        <div className="grid gap-4 p-5 md:grid-cols-4">
          <SelectField label="Escopo" value={anchorScope} onChange={(e) => setAnchorScope(e.target.value)}>{ANCHORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value)}>{SITUACOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Gate" value={gate} onChange={(e) => setGate(e.target.value)}>{GATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <div className="flex items-end"><Button variant="secondary" onClick={() => { setAnchorScope(''); setSituacao(''); setGate(''); }}>Limpar filtros</Button></div>
        </div>
        <div className="p-5 pt-0">
          {conformity.isLoading ? <LoadingState /> : conformity.error ? <ErrorState message={(conformity.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
            <div className="table-scroll"><table className="table">
              <thead><tr><th>Documento</th><th>Escopo</th><th>Gate</th><th>Situação</th><th>Validade</th><th>Dias</th><th>Laudo</th></tr></thead>
              <tbody>{rows.map((row) => <DocRow key={row.requirement_id + '-' + (row.document_id ?? 'none')} row={row} />)}</tbody>
            </table></div>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader kicker="Pré-checagem" title="Gate de emissão do laudo">Informe uma concretagem para simular as pendências que bloqueiam ou alertam a emissão do PDF.</CardHeader>
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
          <Field label="Concretagem ID" placeholder="UUID da concretagem" value={concretagemInput} onChange={(e) => setConcretagemInput(e.target.value)} />
          <div className="flex items-end"><Button onClick={() => setCheckedConcretagem(concretagemInput.trim())}>Verificar</Button></div>
        </div>
        <div className="p-5 pt-0">
          {!checkedConcretagem ? <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma concretagem verificada nesta sessão.</p> : blocks.isLoading ? <LoadingState /> : blocks.error ? <ErrorState message={(blocks.error as Error).message} /> : blockRows.length === 0 ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">Sem bloqueios ou avisos para esta concretagem.</div> : <div className="grid gap-3 md:grid-cols-2">{blockRows.map((b) => <GateBlockCard key={b.code + '-' + (b.entity_id ?? '')} block={b} />)}</div>}
        </div>
      </Card>
    </div>
  );
}
