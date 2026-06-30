import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { exportExcel } from '../../lib/export/xlsx';
import { getContractFinanceSnapshot, type ContractFinanceRow, type ReceivableRow } from '../../lib/api/contractFinance';
import { useAuth } from '../../lib/auth';

const tipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)', fontSize: 12 } as const;
const colors = ['#182863', '#C5117E', '#3E2D71', '#16a34a', '#f59e0b', '#dc2626'];
const startOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const today = () => new Date().toISOString().slice(0, 10);
const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Tab = 'visao' | 'contratos' | 'medicoes' | 'receber' | 'precos' | 'riscos';
const tabs: { key: Tab; label: string }[] = [
  { key: 'visao', label: 'Visão geral' }, { key: 'contratos', label: 'Contratos' }, { key: 'medicoes', label: 'Medições' }, { key: 'receber', label: 'Contas a receber' }, { key: 'precos', label: 'Tabela de preços' }, { key: 'riscos', label: 'Riscos' },
];

function FinanceChart({ data }: { data: Array<Record<string, unknown>> }) {
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} /><XAxis dataKey="label" tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} /><Tooltip contentStyle={tipStyle} formatter={(v) => money(Number(v))} /><Legend /><Line dataKey="medido" stroke="#182863" strokeWidth={2.5} dot={false} /><Line dataKey="faturado" stroke="#C5117E" strokeWidth={2.5} dot={false} /><Line dataKey="recebido" stroke="#16a34a" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer>;
}
function ContractsTable({ rows }: { rows: ContractFinanceRow[] }) {
  if (!rows.length) return <EmptyState />;
  return <div className="table-scroll"><table className="table"><thead><tr><th>Contrato</th><th>Cliente</th><th>Obra</th><th>Status</th><th>Valor</th><th>Medido</th><th>Aberto</th><th>Vencido</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td className="font-semibold">{r.numero}</td><td>{r.cliente}</td><td>{r.obra}</td><td>{r.status}</td><td>{money(r.valor_contratado)}</td><td>{money(r.medido)}</td><td>{money(r.aberto)}</td><td className={r.vencido > 0 ? 'font-bold text-red-600' : ''}>{money(r.vencido)}</td></tr>)}</tbody></table></div>;
}
function ReceivablesTable({ rows }: { rows: ReceivableRow[] }) {
  if (!rows.length) return <EmptyState />;
  return <div className="table-scroll"><table className="table"><thead><tr><th>Fatura</th><th>Cliente</th><th>Competência</th><th>Vencimento</th><th>Status</th><th>Dias atraso</th><th>Valor</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td className="font-semibold">{r.numero}</td><td>{r.cliente}</td><td>{r.competencia ?? '-'}</td><td>{r.vencimento ?? '-'}</td><td>{r.status}</td><td className={r.dias_atraso > 0 ? 'font-bold text-red-600' : ''}>{r.dias_atraso}</td><td>{money(r.valor)}</td></tr>)}</tbody></table></div>;
}

export function ContratosFinanceiroPage() {
  const { member } = useAuth();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [tab, setTab] = useState<Tab>('visao');
  const q = useQuery({ queryKey: ['contract-finance-snapshot', member?.tenant_id, from, to], enabled: !!member, queryFn: () => getContractFinanceSnapshot({ from, to }) });
  const data = q.data;
  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data?.contratos ?? []) map.set(c.status || 'sem status', (map.get(c.status || 'sem status') ?? 0) + 1);
    return [...map.entries()].map(([label, valor]) => ({ label, valor }));
  }, [data?.contratos]);
  async function exportar() {
    await exportExcel({ title: 'Contratos e financeiro do laboratório', subtitle: member?.tenant_name, filename: 'contratos-financeiro.xlsx', fields: [{ label: 'Período', value: `${from} a ${to}` }] }, [
      { name: 'Contratos', rows: data?.contratos ?? [], columns: [
        { key: 'numero', header: 'Contrato' }, { key: 'cliente', header: 'Cliente' }, { key: 'obra', header: 'Obra' }, { key: 'status', header: 'Status' },
        { key: 'valor_contratado', header: 'Valor contratado', format: 'money', total: 'sum' }, { key: 'medido', header: 'Medido', format: 'money', total: 'sum' }, { key: 'faturado', header: 'Faturado', format: 'money', total: 'sum' }, { key: 'recebido', header: 'Recebido', format: 'money', total: 'sum' }, { key: 'aberto', header: 'Aberto', format: 'money', total: 'sum' }, { key: 'vencido', header: 'Vencido', format: 'money', total: 'sum' },
      ], totals: true },
      { name: 'Recebiveis', rows: data?.recebiveis ?? [], columns: [
        { key: 'numero', header: 'Fatura' }, { key: 'cliente', header: 'Cliente' }, { key: 'competencia', header: 'Competência' }, { key: 'vencimento', header: 'Vencimento' }, { key: 'status', header: 'Status' }, { key: 'dias_atraso', header: 'Dias atraso', format: 'int' }, { key: 'valor', header: 'Valor', format: 'money', total: 'sum' },
      ], totals: true },
    ]);
  }

  return (
    <div className="space-y-4">
      <PageHeader kicker="Gestão" title="Contratos e financeiro" description="Central de contratos, tabelas de preço, medições, faturamento, recebíveis, reajustes e risco financeiro do laboratório." />
      <Card><div className="grid gap-3 p-5 md:grid-cols-[160px_160px_1fr_auto]"><Field label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Field label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} /><SelectField label="Visão" value={tab} onChange={(e) => setTab(e.target.value as Tab)}>{tabs.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</SelectField><div className="flex items-end"><Button onClick={() => void exportar()}>Exportar Excel</Button></div></div></Card>
      {q.isLoading ? <LoadingState /> : q.error ? <ErrorState message={(q.error as Error).message} /> : data ? <>
        <div className="grid gap-3 md:grid-cols-4"><Stat label="Contratos ativos" value={data.kpis.contratos} /><Stat label="Medido" value={money(data.kpis.medido)} /><Stat label="Aberto" value={money(data.kpis.aberto)} /><Stat label="Vencido" value={money(data.kpis.vencido)} /></div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Área financeira">{tabs.map((t) => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={'rounded-2xl px-4 py-2 text-sm font-black ' + (tab === t.key ? 'text-white shadow-md' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')} style={tab === t.key ? { background: 'var(--grad-brand)' } : undefined}>{t.label}</button>)}</div>
        {tab === 'visao' ? <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader title="Fluxo financeiro" kicker="Medição → faturamento → recebimento" /><div className="h-80 p-4"><FinanceChart data={(data.series.financeiro_mensal ?? []) as Array<Record<string, unknown>>} /></div></Card><Card><CardHeader title="Contratos por status" kicker="Carteira" /><div className="h-80 p-4"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="valor" nameKey="label" innerRadius={68} outerRadius={100}>{statusData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie><Tooltip contentStyle={tipStyle} /><Legend /></PieChart></ResponsiveContainer></div></Card></div> : null}
        {tab === 'contratos' ? <Card><CardHeader title="Carteira de contratos" kicker="Contratos" /><div className="p-4"><ContractsTable rows={data.contratos} /></div></Card> : null}
        {tab === 'medicoes' ? <Card><CardHeader title="Medições por período" kicker="Receita operacional" /><div className="h-80 p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={(data.series.medicoes_mensal ?? []) as Array<Record<string, unknown>>}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} /><XAxis dataKey="label" /><YAxis /><Tooltip contentStyle={tipStyle} formatter={(v) => money(Number(v))} /><Bar dataKey="valor" fill="#182863" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div></Card> : null}
        {tab === 'receber' ? <Card><CardHeader title="Contas a receber" kicker="Financeiro" /><div className="p-4"><ReceivablesTable rows={data.recebiveis} /></div></Card> : null}
        {tab === 'precos' ? <Card><CardHeader title="Estrutura de preços" kicker="Contratos" >Use a tabela de preços por contrato, cliente ou obra para automatizar medições. Itens típicos: moldagem, rompimento por CP, laudo, visita técnica, coleta adicional, fôrmas e deslocamento.</CardHeader><div className="grid gap-3 p-5 md:grid-cols-3"><Stat label="Preço médio por ensaio" value={money(Number(data.series.precos?.[0]?.valor ?? 0))} /><Stat label="Itens sem preço" value={Number(data.series.precos?.[0]?.pendentes ?? 0)} /><Stat label="Contratos sem reajuste" value={Number(data.series.precos?.[0]?.sem_reajuste ?? 0)} /></div></Card> : null}
        {tab === 'riscos' ? <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader title="Risco financeiro" kicker="Priorização" /><div className="p-4"><ContractsTable rows={[...data.contratos].sort((a, b) => b.vencido - a.vencido).slice(0, 8)} /></div></Card><Card><CardHeader title="Aging de recebíveis" kicker="Cobrança" /><div className="h-80 p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={(data.series.aging ?? []) as Array<Record<string, unknown>>}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} /><XAxis dataKey="label" /><YAxis /><Tooltip contentStyle={tipStyle} formatter={(v) => money(Number(v))} /><Bar dataKey="valor" fill="#C5117E" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div></Card></div> : null}
      </> : null}
    </div>
  );
}
