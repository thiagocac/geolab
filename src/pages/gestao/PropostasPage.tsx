import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listClientesRef } from '../../lib/api/obras';
import { getConfigLab } from '../../lib/api/preferencias';
import { TIPO_COBRANCA_OPCOES } from '../../lib/api/contractFinance';
import { listPropostas, getProposta, salvarProposta, converterPropostaContrato, softDeleteProposta, seedItensDaTabela, PROPOSTA_STATUS, type PropostaItem } from '../../lib/api/propostas';

const money = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => String(v ?? '').trim();
const statusLabel = (s: string) => PROPOSTA_STATUS.find((x) => x.value === s)?.label ?? s;
const statusCor = (s: string) => s === 'aceita' ? '#16a34a' : s === 'recusada' || s === 'expirada' ? 'var(--magenta)' : s === 'enviada' ? '#2563eb' : 'var(--ink-faint)';

export function PropostasPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, unknown>>({});
  const [itens, setItens] = useState<PropostaItem[]>([]);
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ['propostas', member?.tenant_id], queryFn: listPropostas });
  const clientes = useQuery({ queryKey: ['clientes-ref', member?.tenant_id], queryFn: listClientesRef });
  const detalhe = useQuery({ queryKey: ['proposta', editId], queryFn: () => getProposta(editId as string), enabled: !!editId && open });
  useEffect(() => { if (detalhe.data && editId) { const d = detalhe.data; setF({ client_id: d.client_id ?? '', numero: d.numero ?? '', titulo: d.titulo ?? '', validade: d.validade ?? '', status: d.status, condicao_pagamento: d.condicao_pagamento ?? '', observacoes: d.observacoes ?? '' }); setItens(d.itens); } }, [detalhe.data, editId]);

  const total = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);

  function novo() { setEditId(null); setF({ status: 'rascunho' }); setItens([]); setOpen(true); }
  function editar(id: string) { setEditId(id); setF({ status: 'rascunho' }); setItens([]); setOpen(true); }
  function setItem(i: number, patch: Partial<PropostaItem>) { setItens((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it))); }
  function addItem() { setItens((arr) => [...arr, { descricao: '', unidade: null, tipo_cobranca: null, quantidade: 1, preco_unitario: 0 }]); }
  function removeItem(i: number) { setItens((arr) => arr.filter((_, j) => j !== i)); }
  async function semear() { if (!member) return; const seed = await seedItensDaTabela(member.tenant_id); if (!seed.length) { toast('Nenhum item na tabela de preços do laboratório.', 'info'); return; } setItens((arr) => [...arr, ...seed]); }

  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      const payload = { id: editId ?? undefined, client_id: str(f.client_id) || null, numero: str(f.numero) || null, titulo: str(f.titulo) || null, validade: str(f.validade) || null, status: str(f.status) || 'rascunho', condicao_pagamento: str(f.condicao_pagamento) || null, observacoes: str(f.observacoes) || null, itens: itens.map((it, k) => ({ ...it, ordem: k })) };
      await salvarProposta(payload);
      await qc.invalidateQueries({ queryKey: ['propostas'] });
      toast('Proposta salva.', 'success'); setOpen(false);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  async function converter(id: string) {
    if (!(await confirm({ title: 'Converter em contrato', message: 'Criar um contrato a partir desta proposta? A proposta passa a "aceita" e os itens viram a tabela de preços do contrato.', confirmLabel: 'Converter' }))) return;
    try { await converterPropostaContrato(id); await qc.invalidateQueries({ queryKey: ['propostas'] }); toast('Contrato criado.', 'success'); nav('/financeiro?tab=contratos', { viewTransition: true }); } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function excluir(id: string) {
    if (!(await confirm({ title: 'Excluir proposta', message: 'Excluir esta proposta?', danger: true, confirmLabel: 'Excluir' }))) return;
    try { await softDeleteProposta(id); await qc.invalidateQueries({ queryKey: ['propostas'] }); toast('Excluída.', 'success'); } catch (e) { toast((e as Error).message, 'error'); }
  }

  async function imprimir(id: string) {
    // Aba aberta SINCRONA no clique (invariante do pdf.ts: 0 window.open(await…)). Sem 'noopener'
    // de propósito: com ele o window.open('') retorna null e o fluxo morre; o opener é anulado à mão.
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { toast('Permita pop-ups para imprimir a proposta.', 'info'); return; }
    try { w.opener = null; } catch { /* noop */ }
    try {
      const [p, cfg] = await Promise.all([getProposta(id), member ? getConfigLab(member.tenant_id) : Promise.resolve(null)]);
      const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
      const rows = p.itens.map((i) => `<tr><td>${esc(i.descricao)}</td><td style="text-align:center">${esc(i.unidade ?? '')}</td><td style="text-align:right">${i.quantidade}</td><td style="text-align:right">${money(i.preco_unitario)}</td><td style="text-align:right">${money(i.quantidade * i.preco_unitario)}</td></tr>`).join('');
      const totalP = p.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
      const rt = cfg?.responsavel_tecnico ? `${esc(cfg.responsavel_tecnico)}${cfg.crea_rt ? ' · CREA ' + esc(cfg.crea_rt) : ''}` : '';
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proposta ${esc(p.numero ?? '')}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;margin:32px;font-size:13px}h1{font-size:20px;margin:0}.muted{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #e2e8f0;padding:7px 8px;text-align:left}th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.03em}.tot{margin-top:14px;text-align:right;font-size:16px;font-weight:800}.box{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-top:14px}</style></head>
<body onload="window.print()">
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #182863;padding-bottom:10px">
<div><h1>${esc(member?.tenant_name ?? 'Laboratório')}</h1><div class="muted">Proposta comercial${p.numero ? ' Nº ' + esc(p.numero) : ''}</div></div>
<div class="muted" style="text-align:right">${p.validade ? 'Validade: ' + esc(p.validade.split('-').reverse().join('/')) : ''}${rt ? '<br>RT: ' + rt : ''}</div></div>
<div class="box"><b>Cliente:</b> ${esc(p.cliente ?? '—')}${p.titulo ? '<br><b>Objeto:</b> ' + esc(p.titulo) : ''}</div>
<table><thead><tr><th>Descrição</th><th style="text-align:center">Un.</th><th style="text-align:right">Qtd</th><th style="text-align:right">Preço</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot">Total: ${money(totalP)}</div>
${p.condicao_pagamento ? `<div class="box"><b>Condições de pagamento:</b> ${esc(p.condicao_pagamento)}</div>` : ''}
${p.observacoes ? `<div class="box">${esc(p.observacoes)}</div>` : ''}
</body></html>`;
      w.document.write(html); w.document.close();
    } catch (e) { try { w.close(); } catch { /* noop */ } toast((e as Error).message, 'error'); }
  }

  const rows = q.data ?? [];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Financeiro" title="Propostas / orçamentos" description="Antes do contrato: monte a proposta a partir da tabela de preços do laboratório, imprima em PDF e, quando aceita, converta em contrato." />
      <div className="flex justify-end"><Button onClick={novo}>Nova proposta</Button></div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
        <Card className="p-0">
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Número</th><th>Cliente / objeto</th><th>Validade</th><th style={{ textAlign: 'right' }}>Valor</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.numero ?? '—'}</td>
                    <td>{p.cliente ?? '—'}{p.titulo ? <div className="text-xs text-slate-500">{p.titulo}</div> : null}</td>
                    <td>{p.validade ? p.validade.split('-').reverse().join('/') : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(p.valor_total)}</td>
                    <td><span style={{ fontWeight: 700, fontSize: 12, color: statusCor(p.status) }}>{statusLabel(p.status)}</span>{p.contrato_id ? <div className="text-[11px] text-slate-400">contrato criado</div> : null}</td>
                    <td><span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                      <Button variant="ghost" onClick={() => editar(p.id)}>Editar</Button>
                      <Button variant="ghost" onClick={() => void imprimir(p.id)}>Imprimir</Button>
                      {!p.contrato_id ? <Button variant="ghost" onClick={() => void converter(p.id)}>Converter</Button> : null}
                      <Button variant="ghost" onClick={() => void excluir(p.id)}>Excluir</Button>
                    </span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Drawer wide open={open} title={editId ? 'Editar proposta' : 'Nova proposta'} onClose={() => setOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando…' : 'Salvar proposta'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <SelectField label="Cliente" value={String(f.client_id ?? '')} onChange={(e) => setF((s) => ({ ...s, client_id: e.target.value }))}><option value="">—</option>{(clientes.data ?? []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</SelectField>
            <Field label="Número" value={String(f.numero ?? '')} onChange={(e) => setF((s) => ({ ...s, numero: e.target.value }))} />
            <Field label="Validade" type="date" value={String(f.validade ?? '')} onChange={(e) => setF((s) => ({ ...s, validade: e.target.value }))} />
            <SelectField label="Status" value={String(f.status ?? 'rascunho')} onChange={(e) => setF((s) => ({ ...s, status: e.target.value }))}>{PROPOSTA_STATUS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          </div>
          <Field label="Objeto / título" value={String(f.titulo ?? '')} onChange={(e) => setF((s) => ({ ...s, titulo: e.target.value }))} />
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="mb-2 flex items-center justify-between gap-2"><strong style={{ fontSize: 13 }}>Itens</strong><span style={{ display: 'inline-flex', gap: 6 }}><Button variant="secondary" onClick={() => void semear()}>Semear da tabela de preços</Button><Button variant="secondary" onClick={addItem}>+ Item</Button></span></div>
            {itens.length === 0 ? <p className="text-xs text-slate-500">Sem itens. Use "Semear da tabela de preços" ou "+ Item".</p> : (
              <div className="table-scroll">
                <table className="table">
                  <thead><tr><th>Descrição</th><th>Un.</th><th>Cobrança</th><th style={{ textAlign: 'right' }}>Qtd</th><th style={{ textAlign: 'right' }}>Preço</th><th style={{ textAlign: 'right' }}>Subtotal</th><th /></tr></thead>
                  <tbody>
                    {itens.map((it, i) => (
                      <tr key={i}>
                        <td><input className="input !min-h-9" value={it.descricao} onChange={(e) => setItem(i, { descricao: e.target.value })} /></td>
                        <td><input className="input !min-h-9 w-16 px-2" value={it.unidade ?? ''} onChange={(e) => setItem(i, { unidade: e.target.value })} /></td>
                        <td><select className="input !min-h-9" value={it.tipo_cobranca ?? ''} onChange={(e) => setItem(i, { tipo_cobranca: e.target.value || null })}><option value="">—</option>{TIPO_COBRANCA_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                        <td><input className="input !min-h-9 w-16 px-2 text-right" type="number" value={it.quantidade} onChange={(e) => setItem(i, { quantidade: num(e.target.value) })} /></td>
                        <td><input className="input !min-h-9 w-24 px-2 text-right" type="number" value={it.preco_unitario} onChange={(e) => setItem(i, { preco_unitario: num(e.target.value) })} /></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(it.quantidade * it.preco_unitario)}</td>
                        <td><button type="button" className="text-xs font-bold" style={{ color: 'var(--magenta)' }} onClick={() => removeItem(i)}>x</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-2 text-right text-lg font-extrabold">Total: {money(total)}</div>
          </div>
          <Field label="Condições de pagamento" value={String(f.condicao_pagamento ?? '')} onChange={(e) => setF((s) => ({ ...s, condicao_pagamento: e.target.value }))} />
          <TextArea label="Observações" value={String(f.observacoes ?? '')} onChange={(e) => setF((s) => ({ ...s, observacoes: e.target.value }))} />
        </div>
      </Drawer>
    </div>
  );
}
