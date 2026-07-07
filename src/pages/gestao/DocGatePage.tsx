import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { FilePicker } from '../../components/ui/FilePicker';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { formatDate } from '../../lib/format';
import { openDeferredTab } from '../../lib/pdf';
import { listDocGateConformity, listLaudoGateBlocks, anexarDocumento, decidirDocumento, signedDocUrl, type DocGateConformityRow, type LaudoGateBlock } from '../../lib/api/docgate';

const SITUACOES = [
  { value: '', label: 'Todas' }, { value: 'ausente', label: 'Ausente' }, { value: 'pendente', label: 'Pendente' },
  { value: 'em_analise', label: 'Em análise' }, { value: 'recusado', label: 'Recusado' }, { value: 'vencido', label: 'Vencido' },
  { value: 'a_vencer', label: 'A vencer' }, { value: 'conforme', label: 'Conforme' }, { value: 'dispensado', label: 'Dispensado' },
];
const ANCHORS = [
  { value: '', label: 'Todos os escopos' }, { value: 'lab', label: 'Laboratório' }, { value: 'equipamento', label: 'Equipamento' },
  { value: 'colaborador', label: 'Colaborador' }, { value: 'obra', label: 'Obra' }, { value: 'cliente', label: 'Cliente' },
  { value: 'concretagem', label: 'Concretagem' }, { value: 'laudo', label: 'Laudo' },
];
const GATES = [{ value: '', label: 'Todos' }, { value: 'bloqueante', label: 'Bloqueante' }, { value: 'aviso', label: 'Aviso' }, { value: 'informativo', label: 'Informativo' }];

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
function GateBlockCard({ block }: { block: LaudoGateBlock }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-center gap-2"><span className={'badge ' + severityClass(block.severity)}>{block.severity}</span><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{block.code}</span></div>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{block.message}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{block.entity_type}{block.entity_id ? ' · ' + block.entity_id : ''}</p>
    </article>
  );
}

type RowActions = { onAnexar: (r: DocGateConformityRow) => void; onBaixar: (r: DocGateConformityRow) => void; onAprovar: (r: DocGateConformityRow) => void; onRecusar: (r: DocGateConformityRow) => void };
function DocRow({ row, podeGerenciar, act }: { row: DocGateConformityRow; podeGerenciar: boolean; act: RowActions }) {
  const emAnalise = row.document_status === 'em_analise' || row.document_status === 'pendente';
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
      {podeGerenciar ? (
        <td>
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" onClick={() => act.onAnexar(row)}>{row.document_id ? 'Substituir' : 'Anexar'}</Button>
            {row.document_id ? <Button variant="ghost" onClick={() => act.onBaixar(row)}>Baixar</Button> : null}
            {row.document_id && emAnalise ? <Button variant="ghost" onClick={() => act.onAprovar(row)}>Aprovar</Button> : null}
            {row.document_id && emAnalise ? <Button variant="ghost" onClick={() => act.onRecusar(row)}>Recusar</Button> : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

export function DocGatePage() {
  const { member, can, hasRole } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const podeGerenciar = can('docgate.gerenciar') || hasRole('admin', 'admin_consulte');

  const [anchorScope, setAnchorScope] = useState('');
  const [situacao, setSituacao] = useState('');
  const [gate, setGate] = useState('');
  const [concretagemInput, setConcretagemInput] = useState('');
  const [checkedConcretagem, setCheckedConcretagem] = useState('');

  const [anexarRow, setAnexarRow] = useState<DocGateConformityRow | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validade, setValidade] = useState('');
  const [titulo, setTitulo] = useState('');
  const [recusarRow, setRecusarRow] = useState<DocGateConformityRow | null>(null);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);

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

  function abrirAnexar(r: DocGateConformityRow) { setAnexarRow(r); setFile(null); setValidade(r.data_validade ?? ''); setTitulo(r.document_type_name); }
  async function confirmarAnexar() {
    if (!member || !anexarRow) return;
    if (!file) { toast('Selecione um arquivo.', 'error'); return; }
    setBusy(true);
    try {
      await anexarDocumento({ tenantId: member.tenant_id, memberId: member.id, requirementId: anexarRow.requirement_id, titulo, dataValidade: validade || null, file });
      await qc.invalidateQueries({ queryKey: ['docgate'] });
      toast('Documento anexado (em análise).', 'success'); setAnexarRow(null);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  function baixar(r: DocGateConformityRow) {
    if (!r.document_id) return;
    const tab = openDeferredTab('Abrindo documento…');
    void (async () => { try { const u = await signedDocUrl(r.document_id as string); tab.set(u); } catch (e) { tab.fail(); toast((e as Error).message, 'error'); } })();
  }
  async function aprovar(r: DocGateConformityRow) {
    if (!member || !r.document_id) return;
    if (!(await confirm({ title: 'Aprovar documento', message: 'Aprovar "' + row_label(r) + '"? Se for bloqueante, libera o gate de emissão.', confirmLabel: 'Aprovar' }))) return;
    try { await decidirDocumento({ tenantId: member.tenant_id, memberId: member.id, documentId: r.document_id, requirementId: r.requirement_id, aprovar: true, deStatus: r.document_status }); await qc.invalidateQueries({ queryKey: ['docgate'] }); toast('Documento aprovado.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  function abrirRecusar(r: DocGateConformityRow) { setRecusarRow(r); setMotivo(''); }
  async function confirmarRecusar() {
    if (!member || !recusarRow?.document_id) return;
    setBusy(true);
    try { await decidirDocumento({ tenantId: member.tenant_id, memberId: member.id, documentId: recusarRow.document_id, requirementId: recusarRow.requirement_id, aprovar: false, motivo, deStatus: recusarRow.document_status }); await qc.invalidateQueries({ queryKey: ['docgate'] }); toast('Documento recusado.', 'success'); setRecusarRow(null); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  const act: RowActions = { onAnexar: abrirAnexar, onBaixar: baixar, onAprovar: aprovar, onRecusar: abrirRecusar };

  return (
    <div className="space-y-6">
      <PageHeader kicker="Governança laboratorial" title="Documentos e gate de laudo" description="Matriz documental: anexe, aprove e controle a validade de calibrações, certificações, acreditação e documentos de obra. A emissão de laudo consulta este gate." />
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Bloqueantes" value={summary.bloqueantes} hint="impactam emissão" />
        <StatCard label="Vencidos" value={summary.vencidos} />
        <StatCard label="A vencer" value={summary.aVencer} />
        <StatCard label="Conformes" value={summary.conformes} />
      </div>
      <Card>
        <CardHeader kicker="Conformidade" title="Matriz documental">Filtre por escopo, situação ou nível de gate. {podeGerenciar ? 'Use as ações para anexar e revisar documentos.' : ''}</CardHeader>
        <div className="grid gap-4 p-5 md:grid-cols-4">
          <SelectField label="Escopo" value={anchorScope} onChange={(e) => setAnchorScope(e.target.value)}>{ANCHORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value)}>{SITUACOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Gate" value={gate} onChange={(e) => setGate(e.target.value)}>{GATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <div className="flex items-end"><Button variant="secondary" onClick={() => { setAnchorScope(''); setSituacao(''); setGate(''); }}>Limpar filtros</Button></div>
        </div>
        <div className="p-5 pt-0">
          {conformity.isLoading ? <LoadingState /> : conformity.error ? <ErrorState message={(conformity.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
            <div className="table-scroll"><table className="table">
              <thead><tr><th>Documento</th><th>Escopo</th><th>Gate</th><th>Situação</th><th>Validade</th><th>Dias</th><th>Laudo</th>{podeGerenciar ? <th>Ações</th> : null}</tr></thead>
              <tbody>{rows.map((row) => <DocRow key={row.requirement_id + '-' + (row.document_id ?? 'none')} row={row} podeGerenciar={podeGerenciar} act={act} />)}</tbody>
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

      <Modal open={!!anexarRow} title={anexarRow ? 'Anexar documento — ' + anexarRow.document_type_name : ''} onClose={() => setAnexarRow(null)} footer={<><Button variant="ghost" onClick={() => setAnexarRow(null)}>Cancelar</Button><Button onClick={() => void confirmarAnexar()} disabled={busy}>{busy ? 'Enviando...' : 'Anexar (em análise)'}</Button></>}>
        <div className="space-y-3">
          <Field label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <Field label="Validade (se aplicável)" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          <div className="block space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Arquivo</span><FilePicker onFiles={(fs) => setFile(fs[0] ?? null)} /></div>
          <p className="text-xs text-slate-500">O documento entra como <strong>em análise</strong>; um gestor/RT aprova ou recusa. Aprovado e dentro da validade, vira <strong>conforme</strong> e libera o gate.</p>
        </div>
      </Modal>

      <Modal open={!!recusarRow} title="Recusar documento" onClose={() => setRecusarRow(null)} footer={<><Button variant="ghost" onClick={() => setRecusarRow(null)}>Cancelar</Button><Button onClick={() => void confirmarRecusar()} disabled={busy}>{busy ? 'Salvando...' : 'Recusar'}</Button></>}>
        <div className="space-y-3">
          <TextArea label="Motivo da recusa" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

function row_label(r: DocGateConformityRow): string { return r.document_type_name; }
