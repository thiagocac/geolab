import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { formatDate } from '../../lib/format';
import { createApprovalDelegation, listApprovalDelegations, listMembersForDelegation, listWorksForDelegation, revokeApprovalDelegation } from '../../lib/api/delegacoes';

const PERMISSIONS = [
  { value: 'laudo.aprovar', label: 'Aprovar laudo' },
  { value: 'resultado.aprovar', label: 'Aprovar resultado' },
  { value: 'docgate.gerenciar', label: 'Gerenciar documentos' },
];

function toLocalInput(date: Date): string {
  const z = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 16);
}
function fmtTs(value: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return formatDate(value);
  return d.toLocaleString('pt-BR');
}

export function DelegacoesPage() {
  const qc = useQueryClient();
  const [delegator, setDelegator] = useState('');
  const [delegatee, setDelegatee] = useState('');
  const [permission, setPermission] = useState('laudo.aprovar');
  const [workId, setWorkId] = useState('');
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 7 * 86400000)));
  const [reason, setReason] = useState('');
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeNote, setRevokeNote] = useState('Revogado manualmente');
  const [activeOnly, setActiveOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const delegations = useQuery({ queryKey: ['approval-delegations', activeOnly], queryFn: () => listApprovalDelegations(activeOnly), staleTime: 30_000 });
  const members = useQuery({ queryKey: ['approval-delegations', 'members'], queryFn: listMembersForDelegation, staleTime: 60_000 });
  const works = useQuery({ queryKey: ['approval-delegations', 'works'], queryFn: listWorksForDelegation, staleTime: 60_000 });
  const memberRows = members.data ?? [];
  const workRows = works.data ?? [];
  const activeCount = useMemo(() => (delegations.data ?? []).filter((d) => d.active).length, [delegations.data]);

  async function submit() {
    if (!delegator || !delegatee || !permission || !startsAt || !endsAt) { setMsg('Preencha delegante, delegado, permissão e janela.'); return; }
    setBusy(true); setMsg(null);
    try {
      await createApprovalDelegation({ delegatorMemberId: delegator, delegateeMemberId: delegatee, permissionKey: permission, workId: workId || null, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), reason });
      setReason('');
      await qc.invalidateQueries({ queryKey: ['approval-delegations'] });
      setMsg('Delegação criada. A trilha técnica registrará aprovado por delegado quando usada.');
    } finally { setBusy(false); }
  }

  function revoke(id: string) { setRevokeNote('Revogado manualmente'); setRevokeId(id); }

  async function confirmarRevogacao() {
    if (!revokeId) return;
    setBusy(true); setMsg(null);
    try {
      await revokeApprovalDelegation(revokeId, revokeNote.trim());
      await qc.invalidateQueries({ queryKey: ['approval-delegations'] });
      setMsg('Delegação revogada.');
      setRevokeId(null);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader kicker="Governança" title="Delegações de aprovação" description="RT/gestor pode delegar temporariamente a aprovação de laudo ou resultado, mantendo rastreabilidade do delegante e do delegado." />
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4"><p className="kicker">Ativas</p><p className="mt-1 text-2xl font-bold">{activeCount}</p></Card>
        <Card className="p-4"><p className="kicker">Permissão padrão</p><p className="mt-1 text-lg font-bold">laudo.aprovar</p></Card>
        <Card className="p-4"><p className="kicker">Escopo</p><p className="mt-1 text-lg font-bold">Tenant ou obra</p></Card>
      </div>
      <Card>
        <CardHeader kicker="Nova delegação" title="Delegar alçada técnica">Use janela curta e justificativa objetiva. Sem efeito fora da janela de validade.</CardHeader>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <SelectField label="Delegante" required value={delegator} onChange={(e) => setDelegator(e.target.value)}>
            <option value="">Selecione</option>{memberRows.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.role}</option>)}
          </SelectField>

          <SelectField label="Delegado" required value={delegatee} onChange={(e) => setDelegatee(e.target.value)}>
            <option value="">Selecione</option>{memberRows.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.role}</option>)}
          </SelectField>
          <SelectField label="Permissão" required value={permission} onChange={(e) => setPermission(e.target.value)}>{PERMISSIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</SelectField>
          <SelectField label="Obra (opcional)" value={workId} onChange={(e) => setWorkId(e.target.value)}><option value="">Todas as obras</option>{workRows.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</SelectField>
          <Field label="Início" required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <Field label="Fim" required type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          <div className="md:col-span-2"><TextArea label="Justificativa" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: férias do RT entre DD/MM e DD/MM" /></div>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3"><Button onClick={() => void submit()} disabled={busy}>{busy ? 'Salvando...' : 'Criar delegação'}</Button>{msg ? <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{msg}</span> : null}</div>
        </div>
      </Card>
      <Card>
        <CardHeader kicker="Delegações" title="Histórico e vigência">Lista tenant-scoped com soft-delete lógico.</CardHeader>
        <div className="flex items-center gap-2 p-5 pt-0 text-sm font-semibold"><input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Mostrar apenas ativas</div>
        <div className="p-5 pt-0">
          {delegations.isLoading ? <LoadingState /> : delegations.error ? <ErrorState message={(delegations.error as Error).message} /> : (delegations.data ?? []).length === 0 ? <EmptyState /> : (
            <div className="table-scroll"><table className="table"><thead><tr><th>Delegante</th><th>Delegado</th><th>Permissão</th><th>Obra</th><th>Janela</th><th>Status</th><th></th></tr></thead><tbody>{(delegations.data ?? []).map((d) => <tr key={d.id}><td>{d.delegator_name}</td><td>{d.delegatee_name}</td><td><span className="badge bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">{d.permission_key}</span></td><td>{d.work_nome ?? 'Todas'}</td><td>{fmtTs(d.starts_at)} → {fmtTs(d.ends_at)}</td><td>{d.active ? <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">ativa</span> : <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">inativa</span>}</td><td>{d.active ? <Button variant="secondary" onClick={() => revoke(d.id)} disabled={busy}>Revogar</Button> : null}</td></tr>)}</tbody></table></div>
          )}
        </div>
      </Card>

      <Modal open={revokeId !== null} title="Revogar delegação" onClose={() => setRevokeId(null)} footer={<><Button variant="ghost" onClick={() => setRevokeId(null)}>Cancelar</Button><Button variant="danger" disabled={busy} onClick={() => void confirmarRevogacao()}>{busy ? 'Revogando…' : 'Revogar'}</Button></>}>
        <TextArea label="Motivo da revogação" value={revokeNote} onChange={(e) => setRevokeNote(e.target.value)} />
      </Modal>
    </div>
  );
}
