import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { listObrasFormas, listColaboradoresRef, listSaldo, listMovimentos, addMovimento, removeMovimento } from '../../lib/api/formas';

const hoje = () => new Date().toISOString().slice(0, 10);
const VERDE = '#16a34a';
const dataBR = (s: string) => (s && s.length === 10 ? s.split('-').reverse().join('/') : s);

export function FormasPage() {
  const { member, hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const podeEditar = hasRole('admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista', 'operador_campo');
  const [filtroObra, setFiltroObra] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ work_id: '', tipo: 'entrega', quantidade: '', data: hoje(), colaborador_id: '', observacoes: '' });

  const obras = useQuery({ queryKey: ['formas-obras'], queryFn: listObrasFormas });
  const colabs = useQuery({ queryKey: ['formas-colabs'], queryFn: listColaboradoresRef });
  const saldo = useQuery({ queryKey: ['formas-saldo', obras.data?.length ?? 0], queryFn: () => listSaldo(obras.data ?? []), enabled: !!obras.data });
  const movs = useQuery({ queryKey: ['formas-movs', filtroObra], queryFn: () => listMovimentos(filtroObra || undefined) });

  function abrir() { setForm({ work_id: filtroObra || '', tipo: 'entrega', quantidade: '', data: hoje(), colaborador_id: '', observacoes: '' }); setOpen(true); }

  async function salvar() {
    if (!member) return;
    const qtd = Number(form.quantidade);
    if (!form.work_id) { toast('Selecione a obra.', 'error'); return; }
    if (!qtd || qtd <= 0) { toast('Quantidade deve ser maior que zero.', 'error'); return; }
    setBusy(true);
    try {
      await addMovimento(member.tenant_id, { work_id: form.work_id, tipo: form.tipo, quantidade: qtd, data: form.data, colaborador_id: form.colaborador_id || null, observacoes: form.observacoes || null });
      await qc.invalidateQueries({ queryKey: ['formas-saldo'] });
      await qc.invalidateQueries({ queryKey: ['formas-movs'] });
      toast('Movimento lancado.', 'success');
      setOpen(false);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir este movimento?')) return;
    try {
      await removeMovimento(id);
      await qc.invalidateQueries({ queryKey: ['formas-saldo'] });
      await qc.invalidateQueries({ queryKey: ['formas-movs'] });
      toast('Movimento excluido.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  const totalFora = (saldo.data ?? []).reduce((s, r) => s + r.saldo, 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Gestao" title="Formas" description="Controle logistico dos moldes de corpo de prova por obra: entregas, coletas e saldo em campo. Desvinculado da concretagem." />

      <Card className="p-5">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">Saldo por obra</h2>
          <span className="text-sm" style={{ color: 'var(--ink-faint)' }}>{totalFora} forma(s) em campo</span>
        </div>
        {obras.isLoading || saldo.isLoading ? <LoadingState /> : saldo.isError ? <ErrorState message={(saldo.error as Error).message} /> : (saldo.data ?? []).length === 0 ? <EmptyState /> : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Obra</th><th>Cliente</th><th style={{ textAlign: 'right' }}>Saldo em campo</th></tr></thead>
              <tbody>{(saldo.data ?? []).map((r) => (
                <tr key={r.work_id}>
                  <td style={{ fontWeight: 700 }}>{r.obra}</td>
                  <td style={{ color: 'var(--ink-faint)' }}>{r.cliente}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: r.saldo < 0 ? 'var(--magenta)' : undefined }}>{r.saldo}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ minWidth: 240 }}>
            <SelectField label="Filtrar por obra" value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)}>
              <option value="">Todas as obras</option>
              {(obras.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </SelectField>
          </div>
          {podeEditar ? <Button onClick={abrir}>Novo movimento</Button> : null}
        </div>
        {movs.isLoading ? <LoadingState /> : movs.isError ? <ErrorState message={(movs.error as Error).message} /> : (movs.data ?? []).length === 0 ? <EmptyState /> : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Data</th><th>Obra</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Qtd</th><th>Colaborador</th><th>Observacoes</th><th></th></tr></thead>
              <tbody>{(movs.data ?? []).map((m) => {
                const entrega = m.tipo === 'entrega';
                return (
                  <tr key={m.id}>
                    <td>{dataBR(m.data)}</td>
                    <td>{m.obra}</td>
                    <td style={{ fontWeight: 700, color: entrega ? VERDE : 'var(--ink-faint)' }}>{entrega ? 'Entrega' : 'Coleta'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: entrega ? VERDE : 'var(--ink-faint)' }}>{entrega ? '+' : '−'}{m.quantidade}</td>
                    <td>{m.colaborador ?? '—'}</td>
                    <td className="text-sm" style={{ color: 'var(--ink-faint)' }}>{m.observacoes ?? ''}</td>
                    <td style={{ textAlign: 'right' }}>{podeEditar ? <Button variant="ghost" onClick={() => void excluir(m.id)}>Excluir</Button> : null}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} title="Novo movimento de formas" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Lancar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <SelectField label="Obra" value={form.work_id} onChange={(e) => setForm((s) => ({ ...s, work_id: e.target.value }))}>
            <option value="">-</option>
            {(obras.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}{o.cliente ? ' — ' + o.cliente : ''}</option>)}
          </SelectField>
          <SelectField label="Tipo" value={form.tipo} onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value }))}>
            <option value="entrega">Entrega (formas para a obra)</option>
            <option value="coleta">Coleta (devolucao ao laboratorio)</option>
          </SelectField>
          <Field label="Quantidade" type="number" min={1} step={1} value={form.quantidade} onChange={(e) => setForm((s) => ({ ...s, quantidade: e.target.value }))} />
          <Field label="Data" type="date" value={form.data} onChange={(e) => setForm((s) => ({ ...s, data: e.target.value }))} />
          <SelectField label="Colaborador (opcional)" value={form.colaborador_id} onChange={(e) => setForm((s) => ({ ...s, colaborador_id: e.target.value }))}>
            <option value="">-</option>
            {(colabs.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </SelectField>
          <TextArea label="Observacoes" value={form.observacoes} onChange={(e) => setForm((s) => ({ ...s, observacoes: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
