import { useQuery } from '@tanstack/react-query';
import { Card } from './ui/Card';
import { LoadingState, ErrorState } from './ui/State';
import { flowLabel, listInstancesForEntity, type WorkflowInstance } from '../lib/api/workflows';

// [W2] Timeline compartilhada das aprovações de uma entidade (laudo, medição, ciclo, pedido...).
// Some quando a entidade não tem instância — seguro de embutir em qualquer tela (Levas W3/W4).

export const WF_STEP_BADGE: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  aprovado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  devolvido: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
  reprovado: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
  ignorado: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  cancelado: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
};
const INST_LABEL: Record<string, string> = { aberto: 'em andamento', aprovado: 'aprovado', reprovado: 'reprovado', devolvido: 'devolvido', cancelado: 'cancelado' };

function fmtTs(v: string | null): string {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR');
}

export function InstanceTimeline({ instance }: { instance: WorkflowInstance }) {
  return (
    <div className="space-y-2">
      {instance.steps.map((s) => (
        <div key={s.id} className="flex flex-wrap items-start gap-2 rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
          <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{s.ordem}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{s.nome} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">· papel: {s.role_required}</span></p>
            {s.instrucoes ? <p className="text-xs text-slate-500 dark:text-slate-400">{s.instrucoes}</p> : null}
            {s.decided_at ? (
              <p className="text-xs text-slate-600 dark:text-slate-300">{fmtTs(s.decided_at)} · {s.decided_nome ?? '-'}{s.via_delegacao ? ' (por delegação)' : ''}{s.comment ? ` — ${s.comment}` : ''}</p>
            ) : s.due_at ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">SLA até {fmtTs(s.due_at)}</p>
            ) : null}
          </div>
          <span className={`badge ${WF_STEP_BADGE[s.status] ?? WF_STEP_BADGE.ignorado}`}>{s.status}</span>
        </div>
      ))}
    </div>
  );
}

export function ApprovalFlowPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const q = useQuery({ queryKey: ['wf-panel', entityType, entityId], queryFn: () => listInstancesForEntity(entityType, entityId), staleTime: 30_000 });
  if (q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorState message={(q.error as Error).message} />;
  const list = q.data ?? [];
  if (!list.length) return null;
  return (
    <div className="space-y-3">
      {list.map((i) => (
        <Card key={i.id} className="p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">{flowLabel(i.flow_key)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">· iniciado {fmtTs(i.started_at)}</span></p>
            <span className={`badge ${i.status === 'aberto' ? WF_STEP_BADGE.pendente : (WF_STEP_BADGE[i.status] ?? WF_STEP_BADGE.ignorado)}`}>{INST_LABEL[i.status] ?? i.status}</span>
          </div>
          <InstanceTimeline instance={i} />
          {i.finish_comment ? <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Desfecho: {i.finish_comment}</p> : null}
        </Card>
      ))}
    </div>
  );
}
