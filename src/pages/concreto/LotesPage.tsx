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
import { listLotes, listObrasRef, criarLote, recalcularLote, excluirLote } from '../../lib/api/lotes';

const fmt = (n: number | null, d = 1) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));

export function LotesPage() {
  const { member, hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const podeEditar = hasRole('admin', 'admin_consulte', 'gestor_qualidade');
  const [filtroObra, setFiltroObra] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ work_id: '', fck_mpa: '', condicao_preparo: 'A', idade_controle_dias: '28', periodo_inicio: '', periodo_fim: '' });

  const obras = useQuery({ queryKey: ['lotes-obras'], queryFn: listObrasRef });
  const lotes = useQuery({ queryKey: ['lotes', filtroObra, member?.tenant_id], queryFn: () => listLotes(filtroObra || undefined, member?.tenant_id) });

  function abrir() { setForm({ work_id: filtroObra || '', fck_mpa: '', condicao_preparo: 'A', idade_controle_dias: '28', periodo_inicio: '', periodo_fim: '' }); setOpen(true); }

  async function criar() {
    if (!member) return;
    if (!form.work_id) { toast('Selecione a obra.', 'error'); return; }
    if (!Number(form.fck_mpa)) { toast('Informe o fck do lote.', 'error'); return; }
    setBusy(true);
    try {
      const r = await criarLote({ work_id: form.work_id, fck_mpa: form.fck_mpa, condicao_preparo: form.condicao_preparo, idade_controle_dias: form.idade_controle_dias, periodo_inicio: form.periodo_inicio || null, periodo_fim: form.periodo_fim || null });
      await qc.invalidateQueries({ queryKey: ['lotes'] });
      const n = Number(r?.n ?? 0);
      toast(n === 0 ? 'Lote criado, mas nenhum exemplar no fck/periodo informados.' : 'Lote ' + String(r?.numero ?? '') + ': ' + n + ' exemplar(es), fck,est ' + (r?.fck_est ?? '—') + ' MPa — ' + String(r?.status ?? ''), n === 0 ? 'error' : 'success');
      setOpen(false);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  async function recalcular(id: string) {
    try { const r = await recalcularLote(id); await qc.invalidateQueries({ queryKey: ['lotes'] }); toast('Recalculado: ' + Number(r?.n ?? 0) + ' exemplar(es), fck,est ' + (r?.fck_est ?? '—') + ' MPa.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function excluir(id: string) {
    if (!(await confirm({ title: 'Excluir lote', message: 'Excluir este lote?', danger: true, confirmLabel: 'Excluir' }))) return;
    try { await excluirLote(id); await qc.invalidateQueries({ queryKey: ['lotes'] }); toast('Lote excluido.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Controle tecnologico" title="Aceitacao de lotes" description="Aceitacao estatistica do concreto por lote (ABNT NBR 12655): fcm, desvio-padrao e fck,est na idade de controle. Exemplar = amostra (1 NF), resistencia = maior do par." />

      <Card className="p-5">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ minWidth: 240 }}>
            <SelectField label="Filtrar por obra" value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)}>
              <option value="">Todas as obras</option>
              {(obras.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </SelectField>
          </div>
          {podeEditar ? <Button onClick={abrir}>Novo lote</Button> : null}
        </div>
        {lotes.isLoading ? <LoadingState /> : lotes.isError ? <ErrorState message={(lotes.error as Error).message} /> : (lotes.data ?? []).length === 0 ? <EmptyState /> : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Numero</th><th>Obra</th><th style={{ textAlign: 'right' }}>fck</th><th style={{ textAlign: 'right' }}>Idade</th><th style={{ textAlign: 'right' }}>n</th><th style={{ textAlign: 'right' }}>fcm</th><th style={{ textAlign: 'right' }}>Sd</th><th style={{ textAlign: 'right' }}>fck,est</th><th>Status</th><th></th></tr></thead>
              <tbody>{(lotes.data ?? []).map((l) => {
                return (
                  <tr key={l.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{l.numero}</td>
                    <td>{l.obra}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(l.fck_mpa, 0)}</td>
                    <td style={{ textAlign: 'right' }}>{l.idade_controle_dias}d</td>
                    <td style={{ textAlign: 'right' }}>{l.n_exemplares}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(l.fcm)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(l.sd)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmt(l.fck_est)}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{podeEditar ? <><Button variant="ghost" onClick={() => void recalcular(l.id)}>Recalcular</Button><Button variant="ghost" onClick={() => void excluir(l.id)}>Excluir</Button></> : null}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
        <p className="text-sm" style={{ color: 'var(--ink-faint)', marginTop: 12 }}>n ≥ 20: controle total (fck,est = fcm − 1,65·Sd). 6 ≤ n &lt; 20: amostragem parcial. n &lt; 6: insuficiente para fck,est (depende de ψ6).</p>
      </Card>

      <Modal open={open} title="Novo lote de aceitacao" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void criar()} disabled={busy}>{busy ? 'Calculando...' : 'Criar e calcular'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <SelectField label="Obra" value={form.work_id} onChange={(e) => setForm((s) => ({ ...s, work_id: e.target.value }))}>
            <option value="">-</option>
            {(obras.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </SelectField>
          <Field label="fck do lote (MPa)" type="number" step="0.1" value={form.fck_mpa} onChange={(e) => setForm((s) => ({ ...s, fck_mpa: e.target.value }))} hint="Agrupa os exemplares das concretagens da obra com este fck." />
          <SelectField label="Condicao de preparo" value={form.condicao_preparo} onChange={(e) => setForm((s) => ({ ...s, condicao_preparo: e.target.value }))}>
            <option value="A">A</option><option value="B">B</option><option value="C">C</option>
          </SelectField>
          <Field label="Idade de controle (dias)" type="number" step="1" value={form.idade_controle_dias} onChange={(e) => setForm((s) => ({ ...s, idade_controle_dias: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Periodo inicio (opcional)" type="date" value={form.periodo_inicio} onChange={(e) => setForm((s) => ({ ...s, periodo_inicio: e.target.value }))} />
            <Field label="Periodo fim (opcional)" type="date" value={form.periodo_fim} onChange={(e) => setForm((s) => ({ ...s, periodo_fim: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
