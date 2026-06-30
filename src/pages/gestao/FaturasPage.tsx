import { useState } from 'react';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { listFaturas, listMedicoesFaturaveis, emitirFatura, baixarFatura, cancelarFatura, type FaturaRow } from '../../lib/api/faturas';

const BRL = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (s: string | null) => (s && s.length === 10 ? s.split('-').reverse().join('/') : '—');
const hoje = () => new Date().toISOString().slice(0, 10);

export function FaturasPage() {
  const { can, member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const pode = can('fatura.gerar');
  const [status, setStatus] = useState('');
  const [emitir, setEmitir] = useState(false);
  const [baixar, setBaixar] = useState<FaturaRow | null>(null);

  const faturas = useQuery({ queryKey: ['faturas', status, member?.tenant_id], queryFn: () => listFaturas(status || undefined, member?.tenant_id) });
  const linhas = faturas.data ?? [];
  const aReceber = linhas.filter((f) => f.status === 'emitida').reduce((s, f) => s + f.valor, 0);
  const pago = linhas.filter((f) => f.status === 'paga').reduce((s, f) => s + f.valor, 0);

  async function cancelar(f: FaturaRow) {
    if (!(await confirm({ title: 'Cancelar fatura', message: 'Cancelar a fatura ' + f.numero + '?', danger: true, confirmLabel: 'Cancelar fatura', cancelLabel: 'Voltar' }))) return;
    try { await cancelarFatura(f.id); await qc.invalidateQueries({ queryKey: ['faturas'] }); toast('Fatura cancelada.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Financeiro" title="Faturas" description="Faturamento das medicoes fechadas: emissao, baixa (pagamento) e cancelamento." />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Card className="p-4" ><div className="text-sm" style={{ color: 'var(--ink-faint)' }}>A receber (emitidas)</div><div style={{ fontSize: 20, fontWeight: 800, color: '#d97706' }}>{BRL(aReceber)}</div></Card>
        <Card className="p-4"><div className="text-sm" style={{ color: 'var(--ink-faint)' }}>Pago no filtro</div><div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{BRL(pago)}</div></Card>
      </div>

      <Card className="p-5">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ minWidth: 180 }}>
            <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option><option value="emitida">Emitidas</option><option value="paga">Pagas</option><option value="cancelada">Canceladas</option>
            </SelectField>
          </div>
          {pode ? <Button onClick={() => setEmitir(true)}>Emitir fatura</Button> : null}
        </div>
        {faturas.isLoading ? <LoadingState /> : faturas.isError ? <ErrorState message={(faturas.error as Error).message} /> : linhas.length === 0 ? <EmptyState /> : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Numero</th><th>Cliente</th><th>Compet.</th><th style={{ textAlign: 'right' }}>Valor</th><th>Emissao</th><th>Vencim.</th><th>Status</th><th>Pagto</th><th></th></tr></thead>
              <tbody>{linhas.map((f) => {
                return (
                  <tr key={f.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{f.numero}</td>
                    <td>{f.cliente || '—'}</td>
                    <td>{f.competencia ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{BRL(f.valor)}</td>
                    <td>{dataBR(f.data_emissao)}</td>
                    <td>{dataBR(f.data_vencimento)}</td>
                    <td><StatusBadge status={f.status} /></td>
                    <td>{dataBR(f.data_pagamento)}{f.forma_pagamento ? ' · ' + f.forma_pagamento : ''}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{pode && f.status === 'emitida' ? <><Button variant="ghost" onClick={() => setBaixar(f)}>Baixar</Button><Button variant="ghost" onClick={() => void cancelar(f)}>Cancelar</Button></> : null}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>

      {emitir ? <EmitirModal onClose={() => setEmitir(false)} onSaved={() => { setEmitir(false); void qc.invalidateQueries({ queryKey: ['faturas'] }); }} /> : null}
      {baixar ? <BaixarModal fatura={baixar} onClose={() => setBaixar(null)} onSaved={() => { setBaixar(null); void qc.invalidateQueries({ queryKey: ['faturas'] }); }} /> : null}
    </div>
  );
}

function EmitirModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const meds = useQuery({ queryKey: ['medicoes-faturaveis'], queryFn: listMedicoesFaturaveis });
  const [medId, setMedId] = useState('');
  const [venc, setVenc] = useState('');
  const [busy, setBusy] = useState(false);
  async function salvar() {
    if (!medId) { toast('Escolha a medicao.', 'error'); return; }
    setBusy(true);
    try { await emitirFatura(medId, venc || null); toast('Fatura emitida.', 'success'); onSaved(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Modal open title="Emitir fatura" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Emitindo...' : 'Emitir'}</Button></>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <SelectField label="Medicao fechada" value={medId} onChange={(e) => setMedId(e.target.value)}>
          <option value="">{meds.isLoading ? 'Carregando...' : 'Selecione...'}</option>
          {(meds.data ?? []).map((m) => <option key={m.id} value={m.id}>{(m.competencia ?? '-') + ' · ' + m.cliente + ' · ' + BRL(m.valor_total)}</option>)}
        </SelectField>
        {(meds.data ?? []).length === 0 && !meds.isLoading ? <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>Nenhuma medicao fechada sem fatura. Feche uma medicao em Gestao - Medicao.</p> : null}
        <Field label="Vencimento (opcional)" type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
      </div>
    </Modal>
  );
}

function BaixarModal({ fatura, onClose, onSaved }: { fatura: FaturaRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [data, setData] = useState(hoje());
  const [forma, setForma] = useState('pix');
  const [busy, setBusy] = useState(false);
  async function salvar() {
    setBusy(true);
    try { await baixarFatura(fatura.id, data, forma); toast('Fatura baixada (paga).', 'success'); onSaved(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Modal open title={'Baixar fatura ' + fatura.numero} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Confirmar pagamento'}</Button></>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="text-sm">Valor: <b>{BRL(fatura.valor)}</b> · Cliente: {fatura.cliente || '—'}</div>
        <Field label="Data do pagamento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <SelectField label="Forma de pagamento" value={forma} onChange={(e) => setForma(e.target.value)}>
          <option value="pix">PIX</option><option value="boleto">Boleto</option><option value="transferencia">Transferencia</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartao</option>
        </SelectField>
      </div>
    </Modal>
  );
}
