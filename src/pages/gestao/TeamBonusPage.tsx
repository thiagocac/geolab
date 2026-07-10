import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { useAuth } from '../../lib/auth';
import {
  approveBonusCycle, calculateBonusCycle, createBonusCycle, listBonusCycles, listBonusPlans, listBonusResults, listBonusRules,
  saveBonusPlan, saveBonusRule,
} from '../../lib/api/productEvolution';
import { useToast } from '../../lib/toast';
import { dateBr, MetricCard, money, number, Pill, TableShell, Td, Th } from './product/ProductUi';

const METRICS = [
  ['cps_moldados', 'CPs moldados'],
  ['rompimentos_no_prazo_pct', 'Rompimentos no prazo (%)'],
  ['laudos_emitidos', 'Laudos emitidos'],
  ['dispersao_fora_pct', 'Pares fora da dispersão (%)'],
  ['retrabalho_pct', 'Retrabalho (%)'],
  ['nc_graves', 'NCs graves'],
] as const;
const newRule = { metric_key: 'cps_moldados', nome: 'CPs moldados', peso: '1', meta: '20', direcao: 'maior_melhor', gate_qualidade: false };

export function TeamBonusPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState({ nome: 'Premiação mensal', descricao: 'Plano transparente com metas de produção e qualidade.', periodicidade: 'mensal', valor_base: '0', teto_multiplicador: '1' });
  const [rule, setRule] = useState(newRule);
  const [cycle, setCycle] = useState({ plan_id: '', periodo_inicio: new Date().toISOString().slice(0, 8) + '01', periodo_fim: new Date().toISOString().slice(0, 10) });
  const plans = useQuery({ queryKey: ['product', 'bonus-plans'], queryFn: listBonusPlans });
  const rules = useQuery({ queryKey: ['product', 'bonus-rules', selectedPlan], queryFn: () => listBonusRules(selectedPlan), enabled: Boolean(selectedPlan) });
  const cycles = useQuery({ queryKey: ['product', 'bonus-cycles'], queryFn: listBonusCycles });
  const results = useQuery({ queryKey: ['product', 'bonus-results', selected], queryFn: () => listBonusResults(selected), enabled: Boolean(selected) });
  const rows = cycles.data ?? [];
  const totals = useMemo(() => ({ pending: rows.filter((row) => !['aprovado', 'pago', 'cancelado'].includes(row.status)).length, approved: rows.filter((row) => row.status === 'aprovado').reduce((sum, row) => sum + row.valor_aprovado, 0), people: rows.reduce((sum, row) => Math.max(sum, row.colaboradores), 0) }), [rows]);
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['product', 'bonus-plans'] }),
        qc.invalidateQueries({ queryKey: ['product', 'bonus-cycles'] }),
        selectedPlan ? qc.invalidateQueries({ queryKey: ['product', 'bonus-rules', selectedPlan] }) : Promise.resolve(),
        selected ? qc.invalidateQueries({ queryKey: ['product', 'bonus-results', selected] }) : Promise.resolve(),
      ]);
      toast(message, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Operação não concluída.', 'error');
    } finally { setBusy(false); }
  }
  async function createPlan() {
    if (!member?.tenant_id || !plan.nome.trim()) return;
    await run(async () => {
      const id = await saveBonusPlan(member.tenant_id, { ...plan, valor_base: Number(plan.valor_base), teto_multiplicador: Number(plan.teto_multiplicador), elegibilidade_funcoes: [], ativo: true });
      await saveBonusRule(member.tenant_id, { plan_id: id, metric_key: rule.metric_key, nome: rule.nome, peso: Number(rule.peso), meta: Number(rule.meta), direcao: rule.direcao, gate_qualidade: rule.gate_qualidade, ordem: 1, ativo: true });
      setSelectedPlan(id);
      setCycle({ ...cycle, plan_id: id });
    }, 'Plano e primeira regra criados.');
  }
  async function addRule() {
    if (!member?.tenant_id || !selectedPlan) return toast('Selecione um plano para adicionar a regra.', 'warning');
    await run(async () => {
      await saveBonusRule(member.tenant_id, { plan_id: selectedPlan, metric_key: rule.metric_key, nome: rule.nome, peso: Number(rule.peso), meta: Number(rule.meta), direcao: rule.direcao, gate_qualidade: rule.gate_qualidade, ordem: (rules.data?.length ?? 0) + 1, ativo: true });
      setRule(newRule);
    }, 'Regra adicionada.');
  }
  async function createCycleAction() {
    if (!member?.tenant_id || !cycle.plan_id) return toast('Selecione um plano.', 'warning');
    await run(async () => {
      const id = await createBonusCycle(member.tenant_id, { ...cycle, status: 'rascunho' });
      setSelected(id);
    }, 'Ciclo criado.');
  }
  return <div className="space-y-6"><PageHeader kicker="Evolução do produto" title="Premiação de equipe" description="Regras explícitas, cálculo reproduzível, gates de qualidade, aprovação auditável e ranking por ciclo." />
    <div className="grid gap-3 md:grid-cols-3"><MetricCard label="Ciclos pendentes" value={totals.pending} /><MetricCard label="Valor aprovado" value={money(totals.approved)} /><MetricCard label="Pessoas avaliadas" value={totals.people} /></div>
    <div className="grid gap-4 xl:grid-cols-3">
      <Card><CardHeader kicker="Plano" title="Novo plano" /><div className="grid gap-4 p-5"><Field label="Nome" value={plan.nome} onChange={(e) => setPlan({ ...plan, nome: e.target.value })} /><SelectField label="Periodicidade" value={plan.periodicidade} onChange={(e) => setPlan({ ...plan, periodicidade: e.target.value })}>{['mensal', 'trimestral', 'semestral', 'anual'].map((value) => <option key={value}>{value}</option>)}</SelectField><Field label="Valor base por pessoa" type="number" min="0" step="0.01" value={plan.valor_base} onChange={(e) => setPlan({ ...plan, valor_base: e.target.value })} /><Field label="Teto multiplicador" type="number" min="0" step="0.1" value={plan.teto_multiplicador} onChange={(e) => setPlan({ ...plan, teto_multiplicador: e.target.value })} /><TextArea label="Descrição" value={plan.descricao} onChange={(e) => setPlan({ ...plan, descricao: e.target.value })} /><Button disabled={busy || !member?.tenant_id} onClick={() => void createPlan()}>Criar plano com regra</Button></div></Card>
      <Card><CardHeader kicker="Regras" title="Indicador do plano" /><div className="grid gap-4 p-5"><SelectField label="Plano" value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}><option value="">Selecione</option>{(plans.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.nome}</option>)}</SelectField><SelectField label="Métrica" value={rule.metric_key} onChange={(e) => { const selectedMetric = METRICS.find(([key]) => key === e.target.value); setRule({ ...rule, metric_key: e.target.value, nome: selectedMetric?.[1] ?? e.target.value }); }}>{METRICS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</SelectField><Field label="Nome da regra" value={rule.nome} onChange={(e) => setRule({ ...rule, nome: e.target.value })} /><div className="grid grid-cols-2 gap-3"><Field label="Peso" type="number" min="0.01" step="0.1" value={rule.peso} onChange={(e) => setRule({ ...rule, peso: e.target.value })} /><Field label="Meta" type="number" min="0" step="0.1" value={rule.meta} onChange={(e) => setRule({ ...rule, meta: e.target.value })} /></div><SelectField label="Direção" value={rule.direcao} onChange={(e) => setRule({ ...rule, direcao: e.target.value })}><option value="maior_melhor">Maior é melhor</option><option value="menor_melhor">Menor é melhor</option></SelectField><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={rule.gate_qualidade} onChange={(e) => setRule({ ...rule, gate_qualidade: e.target.checked })} />Gate de qualidade</label><Button disabled={busy || !selectedPlan} onClick={() => void addRule()}>Adicionar regra</Button></div></Card>
      <Card><CardHeader kicker="Ciclo" title="Abrir apuração" /><div className="grid gap-4 p-5"><SelectField label="Plano" value={cycle.plan_id} onChange={(e) => setCycle({ ...cycle, plan_id: e.target.value })}><option value="">Selecione</option>{(plans.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.nome}</option>)}</SelectField><Field label="Início" type="date" value={cycle.periodo_inicio} onChange={(e) => setCycle({ ...cycle, periodo_inicio: e.target.value })} /><Field label="Fim" type="date" value={cycle.periodo_fim} onChange={(e) => setCycle({ ...cycle, periodo_fim: e.target.value })} /><Button disabled={busy} onClick={() => void createCycleAction()}>Criar ciclo</Button></div></Card>
    </div>
    {selectedPlan ? <Card><CardHeader kicker="Regras do plano" title={(plans.data ?? []).find((row) => row.id === selectedPlan)?.nome ?? 'Plano'} /><div className="p-5">{rules.isLoading ? <LoadingState /> : rules.error ? <ErrorState message={(rules.error as Error).message} /> : !(rules.data?.length) ? <EmptyState title="Nenhuma regra" /> : <TableShell><thead><tr><Th>Métrica</Th><Th>Peso</Th><Th>Meta</Th><Th>Direção</Th><Th>Gate</Th></tr></thead><tbody>{rules.data.map((row) => <tr key={row.id}><Td><b>{row.nome}</b><div className="text-xs text-slate-500">{row.metric_key}</div></Td><Td>{number(row.peso, 2)}</Td><Td>{number(row.meta, 2)}</Td><Td>{row.direcao}</Td><Td><Pill tone={row.gate_qualidade ? 'warn' : 'neutral'}>{row.gate_qualidade ? 'sim' : 'não'}</Pill></Td></tr>)}</tbody></TableShell>}</div></Card> : null}
    {cycles.isLoading ? <LoadingState /> : cycles.error ? <ErrorState message={(cycles.error as Error).message} /> : !rows.length ? <EmptyState /> : <TableShell><thead><tr><Th>Plano / período</Th><Th>Pessoas</Th><Th>Score</Th><Th>Valor</Th><Th>Status</Th><Th>Ações</Th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className={selected === row.id ? 'bg-slate-50 dark:bg-slate-900/40' : ''}><Td><b>{row.plano || 'Plano'}</b><div className="text-xs text-slate-500">{dateBr(row.periodo_inicio)}–{dateBr(row.periodo_fim)}</div></Td><Td>{row.elegiveis}/{row.colaboradores}</Td><Td>{number(row.score_medio, 2)}</Td><Td>{money(row.valor_aprovado || row.valor_calculado)}</Td><Td><Pill tone={row.status === 'aprovado' ? 'good' : 'warn'}>{row.status}</Pill></Td><Td><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setSelected(row.id)}>Ranking</Button>{!['aprovado', 'pago', 'cancelado'].includes(row.status) ? <Button disabled={busy} onClick={() => void run(() => calculateBonusCycle(row.id), 'Ciclo calculado.')}>Calcular</Button> : null}{row.status === 'calculado' || row.status === 'em_aprovacao' ? <Button disabled={busy} onClick={() => void run(() => approveBonusCycle(row.id), 'Ciclo aprovado e congelado.')}>Aprovar</Button> : null}</div></Td></tr>)}</tbody></TableShell>}
    {selected ? <Card><CardHeader kicker="Transparência" title="Ranking e memória de cálculo" /><div className="p-5">{results.isLoading ? <LoadingState /> : results.error ? <ErrorState message={(results.error as Error).message} /> : !(results.data?.length) ? <EmptyState title="Ciclo ainda não calculado" /> : <TableShell><thead><tr><Th>Colaborador</Th><Th>Score</Th><Th>Multiplicador</Th><Th>Valor</Th><Th>Elegibilidade</Th></tr></thead><tbody>{results.data.map((row) => <tr key={row.id}><Td><b>{row.colaborador_nome || row.colaborador_id.slice(0, 8)}</b><div className="text-xs text-slate-500">{Object.entries(row.metricas).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</div></Td><Td>{number(row.score, 2)}</Td><Td>{number(row.multiplicador, 3)}</Td><Td>{money(row.aprovado_valor ?? row.valor)}</Td><Td><Pill tone={row.elegivel ? 'good' : 'bad'}>{row.elegivel ? 'elegível' : row.bloqueio_motivo || 'bloqueado'}</Pill></Td></tr>)}</tbody></TableShell>}</div></Card> : null}
  </div>;
}
