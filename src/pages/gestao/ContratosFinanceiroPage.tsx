import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { PageHeader } from '../../components/ui/PageHeader';
import { NumField } from '../../components/ui/NumField';
import { Card, CardHeader } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../lib/toast';
import { listCatalogItems } from '../../lib/api/serviceCatalog';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { exportExcel } from '../../lib/export/xlsx';
import { getContractFinanceSnapshot, listPriceItems, upsertPriceItem, TIPO_COBRANCA_OPCOES, type ContractFinanceRow, type ReceivableRow, type PriceItem } from '../../lib/api/contractFinance';
import { listEscopo } from '../../lib/api/medicao';
import { useAuth } from '../../lib/auth';

const tipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)', fontSize: 12 } as const;
const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)'];
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

function PrecosTab({ tenantId, podeEditar }: { tenantId: string; podeEditar: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [escopoSel, setEscopoSel] = useState<'laboratorio' | 'cliente' | 'obra'>('laboratorio');
  const [entId, setEntId] = useState('');
  const opcoes = useQuery({ queryKey: ['precos-escopo', escopoSel], enabled: escopoSel !== 'laboratorio', queryFn: () => listEscopo(escopoSel as 'cliente' | 'obra') });
  const escopoId = escopoSel === 'laboratorio' ? tenantId : entId;
  const q = useQuery({ queryKey: ['price-items', escopoSel, escopoId], enabled: !!escopoId, queryFn: () => listPriceItems(escopoSel, escopoId) });
  const novo = (): PriceItem => ({ escopo: escopoSel, escopo_id: escopoId, item_code: '', descricao: '', unidade: 'un', preco_unitario: 0, ativo: true, tipo_cobranca: 'por_cp_ensaiado' });
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<PriceItem>(novo);
  const [importOpen, setImportOpen] = useState(false);
  const [importSel, setImportSel] = useState<Record<string, boolean>>({});
  const catalogoQ = useQuery({ queryKey: ['service-catalog'], enabled: importOpen, queryFn: listCatalogItems });
  const items = q.data ?? [];
  const precisaEnt = escopoSel !== 'laboratorio' && !entId;
  function abrirNovo() { setEditando(false); setForm(novo()); setOpen(true); }
  function abrirEdit(it: PriceItem) { setEditando(true); setForm({ ...it }); setOpen(true); }
  function setTipo(v: string) { const o = TIPO_COBRANCA_OPCOES.find((x) => x.value === v); setForm((s) => ({ ...s, tipo_cobranca: v, unidade: s.unidade && s.unidade !== 'un' ? s.unidade : (o?.unidade ?? 'un'), item_code: s.item_code || v, descricao: s.descricao || (o?.label ?? '') })); }
  async function salvar() {
    if (!escopoId) { toast('Selecione o escopo.', 'info'); return; }
    if (!form.item_code.trim() || !form.descricao.trim()) { toast('Informe codigo e descricao.', 'info'); return; }
    try { await upsertPriceItem({ ...form, escopo: escopoSel, escopo_id: escopoId, preco_unitario: Number(form.preco_unitario) || 0 }); await qc.invalidateQueries({ queryKey: ['price-items', escopoSel, escopoId] }); setOpen(false); toast('Item salvo.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function importarDoCatalogo() {
    const sels = (catalogoQ.data ?? []).filter((c) => importSel[c.code]);
    if (!escopoId) { toast('Selecione o escopo.', 'info'); return; }
    if (!sels.length) { toast('Selecione ao menos um serviço.', 'info'); return; }
    try {
      for (const c of sels) {
        await upsertPriceItem({ escopo: escopoSel, escopo_id: escopoId, item_code: c.code, descricao: c.nome, unidade: c.unidade, tipo_cobranca: c.tipo_cobranca === 'avulso' ? 'por_cp_ensaiado' : c.tipo_cobranca, preco_unitario: Number(c.preco_sugerido) || 0, ativo: true });
      }
      await qc.invalidateQueries({ queryKey: ['price-items', escopoSel, escopoId] });
      setImportOpen(false);
      toast(sels.length + ' item(ns) importados do catálogo.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function toggleAtivo(it: PriceItem) {
    try { await upsertPriceItem({ ...it, ativo: !it.ativo }); await qc.invalidateQueries({ queryKey: ['price-items', escopoSel, escopoId] }); toast(it.ativo ? 'Item desativado.' : 'Item ativado.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  const labelTipo = (v: string) => TIPO_COBRANCA_OPCOES.find((x) => x.value === v)?.label ?? v;
  return (
    <Card>
      <CardHeader title="Tabela de preços" kicker="Catalogo por laboratorio / cliente / obra">A medicao automatica resolve o preco por precedencia: obra &gt; cliente &gt; laboratorio.</CardHeader>
      <div className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <SelectField label="Escopo" value={escopoSel} onChange={(e) => { setEscopoSel(e.target.value as 'laboratorio' | 'cliente' | 'obra'); setEntId(''); }}>
            <option value="laboratorio">Laboratório (padrao)</option><option value="cliente">Por cliente</option><option value="obra">Por obra</option>
          </SelectField>
          {escopoSel !== 'laboratorio' ? <label className="block space-y-1"><span className="text-sm font-bold">{escopoSel === 'cliente' ? 'Cliente' : 'Obra'}</span><select className="input" value={entId} onChange={(e) => setEntId(e.target.value)}><option value="">Selecione...</option>{(opcoes.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label> : null}
        </div>
        {precisaEnt ? <p className="text-sm text-slate-500">Selecione um {escopoSel} para ver/editar a tabela de preços especifica.</p> : (
          <>
            {podeEditar ? <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => { setImportSel({}); setImportOpen(true); }}>Importar do catálogo</Button><Button onClick={abrirNovo}>Adicionar item</Button></div> : <p className="text-sm text-slate-500">Apenas o admin do laboratório edita a tabela de preços.</p>}
            {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : items.length === 0 ? <EmptyState /> : (
              <div className="table-scroll"><table className="table"><thead><tr><th>Código</th><th>Descrição</th><th>Cobrança</th><th>Unidade</th><th>Preço</th><th>Status</th>{podeEditar ? <th>Ações</th> : null}</tr></thead><tbody>
                {items.map((it) => (
                  <tr key={it.id ?? it.item_code} className={it.ativo ? '' : 'opacity-50'}>
                    <td className="font-semibold">{it.item_code}</td><td>{it.descricao}</td><td>{labelTipo(it.tipo_cobranca)}</td><td>{it.unidade}</td><td>{money(Number(it.preco_unitario))}</td><td>{it.ativo ? 'Ativo' : 'Inativo'}</td>
                    {podeEditar ? <td><div className="flex gap-3"><button type="button" className="font-bold text-blue-700" onClick={() => abrirEdit(it)}>Editar</button><button type="button" className="font-bold text-blue-700" onClick={() => void toggleAtivo(it)}>{it.ativo ? 'Desativar' : 'Ativar'}</button></div></td> : null}
                  </tr>
                ))}
              </tbody></table></div>
            )}
          </>
        )}
      </div>
      <Modal open={importOpen} title="Importar serviços do catálogo" onClose={() => setImportOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setImportOpen(false)}>Cancelar</Button><Button onClick={() => void importarDoCatalogo()}>Importar selecionados</Button></>}>
        <div className="grid gap-2">
          <p className="text-sm text-slate-500">Cria itens de preço neste escopo a partir do catálogo (preço sugerido; ajuste depois). Itens com código já existente no escopo são atualizados.</p>
          {(catalogoQ.data ?? []).filter((c) => c.ativo).map((c) => (
            <label key={c.id ?? c.code} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
              <input type="checkbox" checked={!!importSel[c.code]} onChange={(e) => setImportSel((s2) => ({ ...s2, [c.code]: e.target.checked }))} className="rounded border-slate-300" />
              <span className="font-semibold">{c.code}</span>
              <span className="flex-1">{c.nome}</span>
              <span className="tabular-nums text-slate-500">{Number(c.preco_sugerido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </label>
          ))}
          {catalogoQ.isLoading ? <p className="text-sm text-slate-500">Carregando catálogo…</p> : (catalogoQ.data ?? []).length === 0 ? <p className="text-sm text-slate-500">Catálogo vazio — crie os itens em Financeiro → Catálogo.</p> : null}
        </div>
      </Modal>
      <Modal open={open} title={editando ? 'Editar item de preco' : 'Novo item de preco'} onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()}>Salvar</Button></>}>
        <div className="grid gap-3">
          <SelectField label="Tipo de cobranca" value={form.tipo_cobranca} onChange={(e) => setTipo(e.target.value)}>{TIPO_COBRANCA_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <Field label="Código (unico no escopo)" required value={form.item_code} onChange={(e) => setForm((s) => ({ ...s, item_code: e.target.value }))} disabled={editando} />
          <Field label="Descrição" required value={form.descricao} onChange={(e) => setForm((s) => ({ ...s, descricao: e.target.value }))} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Unidade" value={form.unidade} onChange={(e) => setForm((s) => ({ ...s, unidade: e.target.value }))} />
            <NumField label="Preço unitario (R$)" value={form.preco_unitario} onCommit={(n) => setForm((s) => ({ ...s, preco_unitario: n ?? 0 }))} min={0} max={9999999} dec={2} />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm((s) => ({ ...s, ativo: e.target.checked }))} /> Ativo</label>
        </div>
      </Modal>
    </Card>
  );
}

export function ContratosFinanceiroPage() {
  const { member, hasRole } = useAuth();
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
        {tab === 'precos' ? <PrecosTab tenantId={member?.tenant_id ?? ''} podeEditar={hasRole('admin', 'admin_consulte')} /> : null}
        {tab === 'riscos' ? <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader title="Risco financeiro" kicker="Priorização" /><div className="p-4"><ContractsTable rows={[...data.contratos].sort((a, b) => b.vencido - a.vencido).slice(0, 8)} /></div></Card><Card><CardHeader title="Aging de recebíveis" kicker="Cobrança" /><div className="h-80 p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={(data.series.aging ?? []) as Array<Record<string, unknown>>}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} /><XAxis dataKey="label" /><YAxis /><Tooltip contentStyle={tipStyle} formatter={(v) => money(Number(v))} /><Bar dataKey="valor" fill="#C5117E" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div></Card></div> : null}
      </> : null}
    </div>
  );
}
