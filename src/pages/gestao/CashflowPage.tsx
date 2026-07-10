import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, SelectField } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { createFinanceInstallments, listFinanceCashflow, listFinanceEntries, saveFinanceEntry, settleFinanceEntry, type FinanceEntry } from '../../lib/api/productEvolution';
import { useToast } from '../../lib/toast';
import { dateBr, MetricCard, money, Pill, TableShell, Td, Th } from './product/ProductUi';

const initial = { tipo: 'receita', descricao: '', data_emissao: new Date().toISOString().slice(0, 10), data_vencimento: '', valor: '0', contraparte: '', parcelas: '1', intervalo_meses: '1' };
export function CashflowPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const entries = useQuery({ queryKey: ['product', 'finance-entries'], queryFn: () => listFinanceEntries(500) });
  const cashflow = useQuery({ queryKey: ['product', 'cashflow'], queryFn: listFinanceCashflow });
  const rows = entries.data ?? [];
  const totals = useMemo(() => ({ receivable: rows.filter((row) => row.tipo === 'receita' && !['liquidado', 'cancelado'].includes(row.status)).reduce((sum, row) => sum + row.valor - row.valor_liquidado, 0), payable: rows.filter((row) => row.tipo === 'despesa' && !['liquidado', 'cancelado'].includes(row.status)).reduce((sum, row) => sum + row.valor - row.valor_liquidado, 0), overdue: rows.filter((row) => row.data_vencimento && row.data_vencimento < new Date().toISOString().slice(0, 10) && !['liquidado', 'cancelado'].includes(row.status)).length }), [rows]);
  async function refresh() {
    await Promise.all([qc.invalidateQueries({ queryKey: ['product', 'finance-entries'] }), qc.invalidateQueries({ queryKey: ['product', 'cashflow'] })]);
  }
  async function save() {
    const value = Number(form.valor);
    const installments = Math.max(1, Math.min(60, Number(form.parcelas) || 1));
    const intervalMonths = Math.max(1, Math.min(24, Number(form.intervalo_meses) || 1));
    if (!form.descricao.trim() || value <= 0) return toast('Informe descrição e valor.', 'warning');
    if (installments > 1 && !form.data_vencimento) return toast('Informe o primeiro vencimento para parcelar.', 'warning');
    setBusy(true);
    try {
      const payload = { tipo: form.tipo, descricao: form.descricao, data_emissao: form.data_emissao, data_vencimento: form.data_vencimento || null, valor: value, status: 'aberto', metadata: { contraparte: form.contraparte } };
      if (installments > 1) await createFinanceInstallments(payload, installments, intervalMonths);
      else await saveFinanceEntry(payload);
      setForm(initial);
      await refresh();
      toast(installments > 1 ? `${installments} parcelas criadas.` : 'Lançamento criado.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao criar lançamento.', 'error');
    } finally { setBusy(false); }
  }
  async function settle(row: FinanceEntry) {
    const remaining = Math.max(0, row.valor - row.valor_liquidado);
    const value = window.prompt('Valor da baixa:', String(remaining));
    if (value == null) return;
    setBusy(true);
    try {
      await settleFinanceEntry(row.id, Number(value), new Date().toISOString().slice(0, 10));
      await refresh();
      toast('Baixa registrada.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao liquidar.', 'error');
    } finally { setBusy(false); }
  }
  return <div className="space-y-6"><PageHeader kicker="Evolução do produto" title="Contas a receber, pagar e fluxo de caixa" description="Financeiro simples integrado a faturas, com parcelamento, baixas parciais, vencimentos e visão mensal." />
    <div className="grid gap-3 md:grid-cols-3"><MetricCard label="A receber" value={money(totals.receivable)} /><MetricCard label="A pagar" value={money(totals.payable)} /><MetricCard label="Títulos vencidos" value={totals.overdue} tone={totals.overdue ? 'bad' : 'good'} /></div>
    <Card><CardHeader kicker="Lançamento" title="Nova conta" /><div className="grid gap-4 p-5 md:grid-cols-4"><SelectField label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="receita">Receita</option><option value="despesa">Despesa</option></SelectField><Field label="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /><Field label="Contraparte" value={form.contraparte} onChange={(e) => setForm({ ...form, contraparte: e.target.value })} /><Field label="Valor total" type="number" min="0.01" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /><Field label="Emissão" type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} /><Field label="Primeiro vencimento" type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /><Field label="Parcelas" type="number" min="1" max="60" value={form.parcelas} onChange={(e) => setForm({ ...form, parcelas: e.target.value })} /><Field label="Intervalo (meses)" type="number" min="1" max="24" value={form.intervalo_meses} onChange={(e) => setForm({ ...form, intervalo_meses: e.target.value })} /><div className="md:col-span-4"><Button disabled={busy} onClick={() => void save()}>Salvar lançamento</Button></div></div></Card>
    <Card><CardHeader kicker="Projeção" title="Fluxo mensal" /><div className="p-5">{cashflow.isLoading ? <LoadingState /> : cashflow.error ? <ErrorState message={(cashflow.error as Error).message} /> : <div className="grid gap-3 md:grid-cols-3">{(cashflow.data ?? []).slice(-6).map((row) => <Card key={row.mes} className="p-4"><p className="text-sm font-bold">{dateBr(row.mes)}</p><p className="mt-2 text-xs text-slate-500">Previsto: {money(row.receitas_previstas - row.despesas_previstas)}</p><p className="text-lg font-extrabold">Realizado: {money(row.saldo_realizado)}</p></Card>)}</div>}</div></Card>
    {entries.isLoading ? <LoadingState /> : entries.error ? <ErrorState message={(entries.error as Error).message} /> : !rows.length ? <EmptyState /> : <TableShell><thead><tr><Th>Conta</Th><Th>Vencimento</Th><Th>Parcela</Th><Th>Valor</Th><Th>Liquidado</Th><Th>Status</Th><Th>Ações</Th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><Td><b>{row.descricao}</b><div className="text-xs text-slate-500">{row.contraparte || row.tipo}</div></Td><Td>{dateBr(row.data_vencimento)}</Td><Td>{row.installment_number && row.installment_total ? `${row.installment_number}/${row.installment_total}` : '—'}</Td><Td>{money(row.valor)}</Td><Td>{money(row.valor_liquidado)}</Td><Td><Pill tone={row.status === 'liquidado' ? 'good' : row.data_vencimento && row.data_vencimento < new Date().toISOString().slice(0, 10) ? 'bad' : 'warn'}>{row.status}</Pill></Td><Td>{!['liquidado', 'cancelado'].includes(row.status) ? <Button disabled={busy} variant="secondary" onClick={() => void settle(row)}>Baixar</Button> : null}</Td></tr>)}</tbody></TableShell>}
  </div>;
}
