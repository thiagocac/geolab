import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { listEscopo, listTestTypes, salvarPrecos, computarMedicao, salvarMedicao, listMedicoes, pdfMedicaoUrl, type EscopoTipo, type MedicaoItem, type Adicional } from '../../lib/api/medicao';

const BRL = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FLAT: [string, string][] = [['forma', 'Formas (cobranca)'], ['laudo', 'Laudo'], ['visita', 'Visita do moldador'], ['fixo_mensal', 'Fixo mensal']];
function mesAtual() { const d = new Date(); const iso = (x: Date) => x.toISOString().slice(0, 10); return { inicio: iso(new Date(d.getFullYear(), d.getMonth(), 1)), fim: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }; }

export function MedicaoPage() {
  const { member, hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const podeEditar = hasRole('admin', 'admin_consulte', 'gestor_qualidade', 'financeiro');
  const [escopo, setEscopo] = useState<EscopoTipo>('contrato');
  const [escopoId, setEscopoId] = useState('');
  const opcoes = useQuery({ queryKey: ['escopo-medicao', escopo], queryFn: () => listEscopo(escopo) });
  const tipos = useQuery({ queryKey: ['test-types-medicao'], queryFn: listTestTypes });
  const [flat, setFlat] = useState<Record<string, string>>({});
  const [ens, setEns] = useState<Record<string, { ensaiado: string; moldado: string }>>({});
  const m0 = mesAtual();
  const [inicio, setInicio] = useState(m0.inicio);
  const [fim, setFim] = useState(m0.fim);
  const [itens, setItens] = useState<MedicaoItem[] | null>(null);
  const [valorItens, setValorItens] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [adicionais, setAdicionais] = useState<Adicional[]>([]);
  const [busy, setBusy] = useState(false);
  const medicoes = useQuery({ queryKey: ['medicoes', escopoId], queryFn: () => listMedicoes(escopoId || undefined), enabled: !!escopoId });

  function trocarEscopo(e: EscopoTipo) { setEscopo(e); setEscopoId(''); setItens(null); setAdicionais([]); setFlat({}); setEns({}); }
  function escolher(id: string) {
    setEscopoId(id); setItens(null); setAdicionais([]);
    const op = (opcoes.data ?? []).find((o) => o.id === id);
    const p = (op?.precos ?? {}) as Record<string, any>;
    setFlat({ forma: p.forma != null ? String(p.forma) : '', laudo: p.laudo != null ? String(p.laudo) : '', visita: p.visita != null ? String(p.visita) : '', fixo_mensal: p.fixo_mensal != null ? String(p.fixo_mensal) : '' });
    const pe = (p.ensaios ?? {}) as Record<string, any>; const next: Record<string, { ensaiado: string; moldado: string }> = {};
    for (const t of (tipos.data ?? [])) next[t.id] = { ensaiado: pe[t.id]?.ensaiado != null ? String(pe[t.id].ensaiado) : '', moldado: pe[t.id]?.moldado != null ? String(pe[t.id].moldado) : '' };
    setEns(next);
  }
  function buildPrecos(): Record<string, unknown> {
    const ensaios: Record<string, { ensaiado: number; moldado: number }> = {};
    for (const [tid, v] of Object.entries(ens)) { const e = Number(v.ensaiado) || 0, mo = Number(v.moldado) || 0; if (e || mo) ensaios[tid] = { ensaiado: e, moldado: mo }; }
    return { ensaios, forma: Number(flat.forma) || 0, laudo: Number(flat.laudo) || 0, visita: Number(flat.visita) || 0, fixo_mensal: Number(flat.fixo_mensal) || 0 };
  }
  const valorAdic = adicionais.reduce((s, a) => s + (Number(a.valor) || 0), 0);
  const total = valorItens + valorAdic;

  async function salvarPrecosFn() {
    if (!escopoId) return; setBusy(true);
    try { await salvarPrecos(escopo, escopoId, buildPrecos()); await qc.invalidateQueries({ queryKey: ['escopo-medicao', escopo] }); toast('Precos salvos.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function calcular() {
    if (!escopoId) { toast('Escolha um ' + escopo + '.', 'warning'); return; } setBusy(true);
    try { const r = await computarMedicao(escopo, escopoId, inicio, fim, buildPrecos()); setItens(r.itens); setValorItens(r.valorItens); setClientId(r.clientId); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function fechar() {
    if (!member || !itens) return; setBusy(true);
    try {
      await salvarMedicao(member.tenant_id, { escopo, escopo_id: escopoId, contract_id: escopo === 'contrato' ? escopoId : null, client_id: clientId, competencia: inicio.slice(0, 7), periodo_inicio: inicio, periodo_fim: fim, status: 'fechada', itens, adicionais, valor_itens: valorItens, valor_adicionais: valorAdic, valor_total: total, created_by: member.id });
      await qc.invalidateQueries({ queryKey: ['medicoes', escopoId] });
      toast('Medicao fechada.', 'success'); setItens(null); setAdicionais([]);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function gerarPdf(id: string) { setBusy(true); try { window.open(await pdfMedicaoUrl(id), '_blank', 'noopener,noreferrer'); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); } }
  async function exportar() {
    if (!itens) return;
    const XLSX = await import('xlsx');
    const rows: Record<string, unknown>[] = [
      ...itens.map((i) => ({ Item: i.label, Quantidade: i.quantidade, 'Preco unitario': i.preco_unit, Subtotal: i.subtotal })),
      ...adicionais.map((a) => ({ Item: 'Adicional: ' + a.descricao, Quantidade: 1, 'Preco unitario': a.valor, Subtotal: a.valor })),
      { Item: 'TOTAL', Quantidade: '', 'Preco unitario': '', Subtotal: total },
    ];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'medicao');
    XLSX.writeFile(wb, `medicao-${escopo}-${inicio.slice(0, 7)}.xlsx`);
  }

  return (
    <div className="space-y-5">
      <PageHeader kicker="Gestao" title="Medicao / faturamento" description="Mede os itens cobraveis por contrato, cliente ou obra no periodo. Preco por tipo de ensaio. Exporta Excel e PDF de pre-fatura." />
      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <SelectField label="Escopo" value={escopo} onChange={(e) => trocarEscopo(e.target.value as EscopoTipo)}>
            <option value="contrato">Por contrato</option><option value="cliente">Por cliente</option><option value="obra">Por obra</option>
          </SelectField>
          <label className="block space-y-1 md:col-span-1"><span className="text-sm font-bold">{escopo === 'contrato' ? 'Contrato' : escopo === 'cliente' ? 'Cliente' : 'Obra'}</span>
            <select className="input" value={escopoId} onChange={(e) => escolher(e.target.value)}><option value="">Selecione...</option>{(opcoes.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
          </label>
          <Field label="Periodo - inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          <Field label="Periodo - fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        {escopoId ? (
          <>
            <div className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">Precos por tipo de ensaio (R$)</div>
            <div className="mt-2 overflow-auto">
              <table className="w-full text-left text-sm"><thead><tr className="text-xs uppercase text-slate-500"><th className="py-1">Tipo de ensaio</th><th>CP ensaiado</th><th>CP moldado</th></tr></thead>
                <tbody>{(tipos.data ?? []).map((t) => <tr key={t.id}><td className="py-1 pr-3 font-medium">{t.nome}</td>
                  <td className="pr-3"><input className="input" type="number" value={ens[t.id]?.ensaiado ?? ''} onChange={(e) => setEns((s) => ({ ...s, [t.id]: { ensaiado: e.target.value, moldado: s[t.id]?.moldado ?? '' } }))} disabled={!podeEditar} /></td>
                  <td><input className="input" type="number" value={ens[t.id]?.moldado ?? ''} onChange={(e) => setEns((s) => ({ ...s, [t.id]: { ensaiado: s[t.id]?.ensaiado ?? '', moldado: e.target.value } }))} disabled={!podeEditar} /></td></tr>)}</tbody>
              </table>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">{FLAT.map(([k, l]) => <Field key={k} label={l} type="number" value={flat[k] ?? ''} onChange={(e) => setFlat((s) => ({ ...s, [k]: e.target.value }))} disabled={!podeEditar} />)}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void salvarPrecosFn()} disabled={busy || !podeEditar}>Salvar precos</Button>
              <Button onClick={() => void calcular()} disabled={busy}>Calcular medicao</Button>
            </div>
          </>
        ) : null}
      </Card>

      {itens ? (
        <Card>
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700"><th className="py-2">Item</th><th>Qtd</th><th>Preco unit.</th><th className="text-right">Subtotal</th></tr></thead>
            <tbody>
              {itens.map((i) => <tr key={i.key} className="border-b border-slate-100 dark:border-slate-800"><td className="py-2 font-medium">{i.label}</td><td>{i.quantidade}</td><td>{BRL(i.preco_unit)}</td><td className="text-right font-bold">{i.subtotal === 0 ? '-' : BRL(i.subtotal)}</td></tr>)}
              {adicionais.map((a, idx) => <tr key={'a' + idx} className="border-b border-slate-100 dark:border-slate-800"><td className="py-2"><input className="input" placeholder="Descricao do adicional" value={a.descricao} onChange={(e) => setAdicionais((s) => s.map((x, j) => j === idx ? { ...x, descricao: e.target.value } : x))} /></td><td colSpan={2}><input className="input" type="number" placeholder="Valor" value={a.valor || ''} onChange={(e) => setAdicionais((s) => s.map((x, j) => j === idx ? { ...x, valor: Number(e.target.value) } : x))} /></td><td className="text-right">{BRL(a.valor)} <button className="ml-2 font-bold text-red-600" onClick={() => setAdicionais((s) => s.filter((_, j) => j !== idx))}>x</button></td></tr>)}
            </tbody>
            <tfoot><tr><td colSpan={3} className="pt-3 text-right font-bold">TOTAL</td><td className="pt-3 text-right text-lg font-black" style={{ color: 'var(--magenta)' }}>{BRL(total)}</td></tr></tfoot>
          </table>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAdicionais((s) => [...s, { descricao: '', valor: 0 }])}>+ Adicional</Button>
            <Button variant="secondary" onClick={exportar}>Exportar Excel</Button>
            <Button onClick={() => void fechar()} disabled={busy || !podeEditar}>Fechar medicao</Button>
          </div>
        </Card>
      ) : null}

      {escopoId ? (
        <Card>
          <div className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">Medicoes fechadas</div>
          {medicoes.isLoading ? <LoadingState /> : medicoes.isError ? <ErrorState message={(medicoes.error as Error).message} /> : (medicoes.data ?? []).length === 0 ? <EmptyState /> : (
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2">Competencia</th><th>Periodo</th><th>Status</th><th className="text-right">Total</th><th></th></tr></thead>
              <tbody>{(medicoes.data ?? []).map((md) => <tr key={md.id} className="border-b border-slate-100 dark:border-slate-800"><td className="py-2">{md.competencia ?? '-'}</td><td>{md.periodo_inicio + ' a ' + md.periodo_fim}</td><td>{md.status}</td><td className="text-right font-bold">{BRL(md.valor_total)}</td><td className="text-right"><Button variant="secondary" onClick={() => void gerarPdf(md.id)} disabled={busy}>PDF</Button></td></tr>)}</tbody>
            </table>
          )}
        </Card>
      ) : null}
    </div>
  );
}
