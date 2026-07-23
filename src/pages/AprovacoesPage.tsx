import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { TextArea } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/State';
import { useToast } from '../lib/toast';
import { ApprovalFlowPanel, WF_STEP_BADGE } from '../components/ApprovalFlowPanel';
import { decideWorkflowStep, flowLabel, listDecisionHistory, listPendingForMe, type PendingApproval } from '../lib/api/workflows';

// [W2] Inbox central do motor de aprovação (Leva W1): pendências que EU posso decidir
// (nominal, papel ou delegação) + histórico de decisões do laboratório.

function fmtTs(v: string | null): string {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR');
}
function slaVencido(due: string | null): boolean {
  return !!due && new Date(due).getTime() < Date.now();
}

const ACAO_LABEL: Record<string, string> = { aprovar: 'Aprovar', devolver: 'Devolver', reprovar: 'Reprovar' };

export function AprovacoesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [aba, setAba] = useState<'pendentes' | 'historico'>('pendentes');
  const [decidir, setDecidir] = useState<{ item: PendingApproval; acao: 'aprovar' | 'devolver' | 'reprovar' } | null>(null);
  const [comentario, setComentario] = useState('');
  const [busy, setBusy] = useState(false);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const pend = useQuery({ queryKey: ['wf-pending'], queryFn: listPendingForMe, staleTime: 30_000, refetchInterval: 60_000 });
  const hist = useQuery({ queryKey: ['wf-history'], queryFn: () => listDecisionHistory(100), staleTime: 60_000, enabled: aba === 'historico' });
  const vencidas = useMemo(() => (pend.data ?? []).filter((p) => slaVencido(p.due_at)).length, [pend.data]);

  async function confirmarDecisao() {
    if (!decidir) return;
    if ((decidir.acao === 'devolver' || decidir.acao === 'reprovar') && !comentario.trim()) {
      toast('Comentário é obrigatório ao devolver ou reprovar.', 'error');
      return;
    }
    setBusy(true);
    try {
      const r = await decideWorkflowStep(decidir.item.instance_id, decidir.acao, comentario);
      toast(r.instance_status === 'aberto' ? `Etapa decidida — próxima: ${r.proxima_etapa ?? '-'}` : `Workflow ${r.instance_status}.`, 'success');
      setDecidir(null);
      setComentario('');
      await qc.invalidateQueries({ queryKey: ['wf-pending'] });
      await qc.invalidateQueries({ queryKey: ['wf-badge'] });
      await qc.invalidateQueries({ queryKey: ['wf-panel'] });
      await qc.invalidateQueries({ queryKey: ['wf-history'] });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const pendentes = pend.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader kicker="Workflows" title="Minhas aprovações" description="Etapas de workflow aguardando a sua decisão — por responsabilidade nominal, papel ou delegação ativa. Comentário é obrigatório ao devolver ou reprovar." />
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4"><p className="kicker">Pendentes para mim</p><p className="mt-1 text-2xl font-bold">{pendentes.length}</p></Card>
        <Card className="p-4"><p className="kicker">Com SLA vencido</p><p className={`mt-1 text-2xl font-bold ${vencidas > 0 ? 'text-rose-600 dark:text-rose-300' : ''}`}>{vencidas}</p></Card>
        <Card className="p-4"><p className="kicker">Configuração</p><p className="mt-1 text-sm font-semibold">Templates e gatilhos em Operação → Workflows e delegações</p></Card>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant={aba === 'pendentes' ? 'primary' : 'ghost'} onClick={() => setAba('pendentes')}>Pendentes</Button>
        <Button variant={aba === 'historico' ? 'primary' : 'ghost'} onClick={() => setAba('historico')}>Histórico</Button>
      </div>

      {aba === 'pendentes' ? (
        pend.isLoading ? <LoadingState /> : pend.error ? <ErrorState message={(pend.error as Error).message} /> : pendentes.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300">Nenhuma aprovação pendente para você. As pendências aparecem aqui quando um fluxo com gatilho ligado é iniciado.</Card>
        ) : (
          <div className="space-y-3">
            {pendentes.map((p) => (
              <Card key={p.step_id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{p.flow_label}{p.ref ? <span className="font-normal text-slate-500 dark:text-slate-400"> · ref. {p.ref}</span> : null}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Etapa {p.etapa_ordem} de {p.total_etapas}: <strong>{p.etapa_nome}</strong> · papel {p.role_required}</p>
                    {p.instrucoes ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{p.instrucoes}</p> : null}
                    {typeof p.context?.motivo === 'string' && p.context.motivo ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Motivo: {String(p.context.motivo)}</p> : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`badge ${slaVencido(p.due_at) ? WF_STEP_BADGE.reprovado : WF_STEP_BADGE.pendente}`}>{slaVencido(p.due_at) ? 'SLA vencido' : `SLA até ${fmtTs(p.due_at)}`}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">iniciado {fmtTs(p.started_at)}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {p.actions.includes('aprovar') ? <Button onClick={() => { setComentario(''); setDecidir({ item: p, acao: 'aprovar' }); }}>Aprovar</Button> : null}
                  {p.actions.includes('devolver') ? <Button variant="secondary" onClick={() => { setComentario(''); setDecidir({ item: p, acao: 'devolver' }); }}>Devolver</Button> : null}
                  {p.actions.includes('reprovar') ? <Button variant="danger" onClick={() => { setComentario(''); setDecidir({ item: p, acao: 'reprovar' }); }}>Reprovar</Button> : null}
                  <Button variant="ghost" onClick={() => setDetalhe(detalhe === p.instance_id ? null : p.instance_id)}>{detalhe === p.instance_id ? 'Ocultar detalhes' : 'Detalhes'}</Button>
                </div>
                {detalhe === p.instance_id ? <div className="mt-3"><ApprovalFlowPanel entityType={p.entity_type} entityId={p.entity_id} /></div> : null}
              </Card>
            ))}
          </div>
        )
      ) : null}

      {aba === 'historico' ? (
        <Card>
          <CardHeader kicker="Histórico" title="Decisões do laboratório">Últimas decisões de workflow (todas as áreas), com rastreabilidade de delegação.</CardHeader>
          <div className="p-5 pt-0">
            {hist.isLoading ? <LoadingState /> : hist.error ? <ErrorState message={(hist.error as Error).message} /> : (hist.data ?? []).length === 0 ? <EmptyState /> : (
              <div className="table-scroll"><table className="table"><thead><tr><th>Quando</th><th>Fluxo</th><th>Ref.</th><th>Etapa</th><th>Decisão</th><th>Decisor</th><th>Comentário</th></tr></thead><tbody>
                {(hist.data ?? []).map((h) => (
                  <tr key={h.id}>
                    <td>{fmtTs(h.decided_at)}</td>
                    <td>{flowLabel(h.flow_key)}</td>
                    <td>{h.ref ?? '-'}</td>
                    <td>{h.ordem}. {h.etapa}</td>
                    <td><span className={`badge ${WF_STEP_BADGE[h.status] ?? WF_STEP_BADGE.ignorado}`}>{h.status}</span></td>
                    <td>{h.decided_nome}{h.via_delegacao ? ' (delegação)' : ''}</td>
                    <td className="max-w-xs truncate" title={h.comment ?? ''}>{h.comment ?? '-'}</td>
                  </tr>
                ))}
              </tbody></table></div>
            )}
          </div>
        </Card>
      ) : null}

      <Modal open={decidir !== null} title={decidir ? `${ACAO_LABEL[decidir.acao]} — ${decidir.item.flow_label}` : ''} onClose={() => setDecidir(null)}
        footer={<><Button variant="ghost" onClick={() => setDecidir(null)}>Cancelar</Button><Button variant={decidir?.acao === 'reprovar' ? 'danger' : 'primary'} disabled={busy} onClick={() => void confirmarDecisao()}>{busy ? 'Enviando…' : (decidir ? ACAO_LABEL[decidir.acao] : 'Confirmar')}</Button></>}>
        {decidir ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">Etapa {decidir.item.etapa_ordem} de {decidir.item.total_etapas} — {decidir.item.etapa_nome}{decidir.item.ref ? ` · ref. ${decidir.item.ref}` : ''}</p>
            <TextArea label={decidir.acao === 'aprovar' ? 'Comentário (opcional)' : 'Comentário (obrigatório)'} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder={decidir.acao === 'aprovar' ? 'Observações da aprovação' : 'Explique o motivo — o solicitante verá este texto'} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
