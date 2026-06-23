import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listConcretagens, createConcretagem, invokeFicha, listTracosComFck } from '../../lib/api/concretagem';
import { listReference } from '../../lib/api/client';

function dl(blob: Blob, name: string) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }

export function ConcretagensPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ['concretagens'], queryFn: () => listConcretagens() });
  const clientes = useQuery({ queryKey: ['ref', 'lab_clients'], queryFn: () => listReference('lab_clients', 'razao_social') });
  const obras = useQuery({ queryKey: ['ref', 'client_works', form.client_id], queryFn: () => listReference('client_works', 'nome', form.client_id ? { client_id: String(form.client_id) } : undefined), enabled: !!form.client_id });
  const tracos = useQuery({ queryKey: ['tracos-fck'], queryFn: listTracosComFck });

  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      if (!form.client_id || !form.work_id) throw new Error('Cliente e obra sao obrigatorios.');
      await createConcretagem(member.tenant_id, form);
      await qc.invalidateQueries({ queryKey: ['concretagens'] });
      toast('Concretagem criada.', 'success'); setOpen(false); setForm({});
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function ficha(id: string) { try { dl(await invokeFicha(id), 'ficha-moldagem.pdf'); } catch (e) { toast((e as Error).message, 'error'); } }

  const rows = q.data ?? [];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Concreto" title="Concretagens" description="Programacoes e concretagens do laboratorio." />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Button variant="ghost" onClick={() => nav('/nova-obra')}>Nova obra</Button><Button onClick={() => { setForm({ origem: 'programada' }); setOpen(true); }}>Nova concretagem</Button></div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 14, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{c.codigo ?? '(sem codigo)'} <small style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>- {c.status}</small></div>
                <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{c.lab_clients?.razao_social ?? '-'} - {c.client_works?.nome ?? '-'} - {c.data_programada ?? c.data_real ?? '-'} - {c.fornecedor_texto ?? '-'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button variant="ghost" onClick={() => nav('/concretagens/' + c.id)}>Abrir</Button>
                <Button variant="secondary" onClick={() => void ficha(c.id)}>Ficha</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} title="Nova concretagem" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <SelectField label="Cliente" value={String(form.client_id ?? '')} onChange={(e) => setForm((s) => ({ ...s, client_id: e.target.value || null, work_id: null }))}><option value="">-</option>{(clientes.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Obra" value={String(form.work_id ?? '')} onChange={(e) => setForm((s) => ({ ...s, work_id: e.target.value || null }))}><option value="">-</option>{(obras.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Traco (opcional)" value={String(form.operational_material_id ?? '')} onChange={(e) => { const id = e.target.value || null; const t = (tracos.data ?? []).find((x) => x.value === id); setForm((s) => ({ ...s, operational_material_id: id, fck_previsto: (s.fck_previsto == null || s.fck_previsto === '') && t?.fck != null ? t.fck : s.fck_previsto })); }}><option value="">-</option>{(tracos.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}{o.fck != null ? ' (fck ' + o.fck + ')' : ''}</option>)}</SelectField>
          <Field label="Fornecedor (concreteira)" value={String(form.fornecedor_texto ?? '')} onChange={(e) => setForm((s) => ({ ...s, fornecedor_texto: e.target.value }))} />
          <Field label="Data programada" type="date" value={String(form.data_programada ?? '')} onChange={(e) => setForm((s) => ({ ...s, data_programada: e.target.value || null }))} />
          <Field label="fck previsto (MPa)" type="number" value={String(form.fck_previsto ?? '')} onChange={(e) => setForm((s) => ({ ...s, fck_previsto: e.target.value === '' ? null : Number(e.target.value) }))} />
          <Field label="Local/peca" value={String(form.local_texto ?? '')} onChange={(e) => setForm((s) => ({ ...s, local_texto: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
