import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { useAuth } from '../../lib/auth';
import { finishOnboarding, getOnboardingSnapshot, setOnboardingStep, type OnboardingStep } from '../../lib/api/onboarding';
import { useToast } from '../../lib/toast';
import { dateBr, Pill } from './product/ProductUi';

function tone(status: OnboardingStep['status']) { return status === 'concluido' ? 'good' as const : status === 'ignorado' ? 'neutral' as const : 'warn' as const; }

export function LabOnboardingPage() {
  const { member, can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['lab-onboarding', member?.tenant_id], enabled: !!member, queryFn: getOnboardingSnapshot });
  const data = query.data;
  async function update(step: OnboardingStep, status: OnboardingStep['status']) {
    try { await setOnboardingStep(step.key, status); await qc.invalidateQueries({ queryKey: ['lab-onboarding'] }); toast('Etapa atualizada.', 'success'); }
    catch (error) { toast((error as Error).message, 'error'); }
  }
  async function finish() {
    try { await finishOnboarding(); await qc.invalidateQueries({ queryKey: ['lab-onboarding'] }); toast('Onboarding concluído.', 'success'); }
    catch (error) { toast((error as Error).message, 'error'); }
  }
  return <div className="space-y-6">
    <PageHeader kicker="Configuração inicial" title="Onboarding do laboratório" description="Checklist guiado para deixar cadastros, operação, comercial e documentos prontos sem perder nenhuma configuração crítica." />
    {query.isLoading ? <LoadingState /> : query.error ? <ErrorState message={(query.error as Error).message} /> : !data ? <EmptyState /> : <>
      <Card className="overflow-hidden">
        <div className="p-6" style={{ background: 'var(--grad-brand)', color: '#fff' }}>
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] opacity-80">Progresso</p><p className="mt-2 text-4xl font-black">{data.progress}%</p><p className="mt-1 text-sm opacity-85">Iniciado em {dateBr(data.run.started_at)} · status {data.run.status}</p></div>{can('onboarding.gerenciar') ? <Button className="bg-white !text-slate-900" disabled={data.run.status === 'concluido'} onClick={() => void finish()}>Concluir onboarding</Button> : null}</div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min(100, Math.max(0, data.progress))}%` }} /></div>
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">{data.steps.map((step) => <Card key={step.id} className="p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="kicker">Etapa {step.position}{step.required ? ' · obrigatória' : ' · recomendada'}</p><h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{step.title}</h2></div><Pill tone={tone(step.status)}>{step.status}</Pill></div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{step.description}</p>
        <p className="mt-2 text-xs text-slate-500">Origem: {step.source === 'automatico' ? 'detectada automaticamente' : 'controle manual'}{step.completed_at ? ` · ${dateBr(step.completed_at)}` : ''}</p>
        <div className="mt-5 flex flex-wrap gap-2">{step.route ? <Button variant="secondary" onClick={() => navigate(step.route!)}>Abrir configuração</Button> : null}{can('onboarding.gerenciar') ? <>{step.status === 'pendente' ? <Button onClick={() => void update(step, 'concluido')}>Marcar concluída</Button> : <Button variant="ghost" onClick={() => void update(step, 'pendente')}>Reabrir</Button>}{step.status === 'pendente' ? <Button variant="ghost" onClick={() => void update(step, 'ignorado')}>Ignorar</Button> : null}</> : null}</div>
      </Card>)}</div>
    </>}
  </div>;
}
