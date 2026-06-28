import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listConcretagensPaged, createConcretagem, invokeFicha, listTracosComFck, invokeFichaBranco } from '../../lib/api/concretagem';
import { listPecasObra } from '../../lib/api/estrutura';
import { listReference } from '../../lib/api/client';

import { saveBlob as dl } from '../../lib/pdf';

export function ConcretagensPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [busca, setBusca] = useState('');
  const [buscaQ, setBuscaQ] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [obraFiltro, setObraFiltro] = useState('');
  const [page, setPage] = useState(0);
  const PAGE = 25;
  useEffect(() => { const t = setTimeout(() => { setBuscaQ(busca.trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [busca]);

  const q = useQuery({ queryKey: ['concretagens', member?.tenant_id, clienteFiltro, obraFiltro, buscaQ, page], queryFn: () => listConcretagensPaged({ tenantId: member?.tenant_id, clientId: clienteFiltro || undefined, workId: obraFiltro || undefined, search: buscaQ || undefined, page, pageSize: PAGE }), placeholderData: keepPreviousData });
  const clientes = useQuery({ queryKey: ['ref', 'lab_clients'], queryFn: () => listReference('lab_clients', 'razao_social') });
  const worksFiltro = useQuery({ queryKey: ['ref', 'client_works', 'all'], queryFn: () => listReference('client_works', 'nome') });
  const obras = useQuery({ queryKey: ['ref', 'client_works', form.client_id], queryFn: () => listReference('client_works', 'nome', form.client_id ? { client_id: String(form.client_id) } : undefined), enabled: !!form.client_id });
  const tracos = useQuery({ queryKey: ['tracos-fck'], queryFn: listTracosComFck });
  const pecas = useQuery({ queryKey: ['pecas-conc', form.work_id], queryFn: () => listPecasObra(String(form.work_id)), enabled: !!form.work_id });

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
  async function fichaBranco() { try { dl(await invokeFichaBranco(), 'ficha-moldagem-em-branco.pdf'); } catch (e) { toast((e as Error).message, 'error'); } }

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Concreto" title="Concretagens" description="Programacoes e concretagens do laboratorio." />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Button variant="ghost" onClick={() => void fichaBranco()}>Ficha em branco (PDF)</Button><Button variant="ghost" onClick={() => nav('/nova-obra')}>Nova obra</Button><Button onClick={() => { setForm({ origem: 'programada' }); setOpen(true); }}>Nova concretagem</Button></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="Buscar por Nº relatório, código ou fornecedor" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 360 }} />
        <select className="input" value={clienteFiltro} onChange={(e) => { setClienteFiltro(e.target.value); setPage(0); }} style={{ maxWidth: 220 }}><option value="">Todos os clientes</option>{(clientes.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select className="input" value={obraFiltro} onChange={(e) => { setObraFiltro(e.target.value); setPage(0); }} style={{ maxWidth: 220 }}><option value="">Todas as obras</option>{(worksFiltro.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      </div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 14, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>Relatório Nº {c.numero_relatorio ?? '-'} <small style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>· {c.codigo ?? '(sem codigo)'}</small><StatusBadge status={c.status} /></div>
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
      {!q.isLoading && !q.isError && total > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{total} concretagem(ns) · página {page + 1} de {pageCount}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
            <Button variant="ghost" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      ) : null}
      <Modal open={open} title="Nova concretagem" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <SelectField label="Tipo" value={String(form.origem ?? 'programada')} onChange={(e) => setForm((s) => ({ ...s, origem: e.target.value }))}><option value="programada">Programada</option><option value="retroativa">Retroativa (registro de evento passado)</option></SelectField>
          <SelectField label="Cliente" value={String(form.client_id ?? '')} onChange={(e) => setForm((s) => ({ ...s, client_id: e.target.value || null, work_id: null }))}><option value="">-</option>{(clientes.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Obra" value={String(form.work_id ?? '')} onChange={(e) => setForm((s) => ({ ...s, work_id: e.target.value || null, unit_id: null }))}><option value="">-</option>{(obras.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Traco (opcional)" value={String(form.operational_material_id ?? '')} onChange={(e) => { const id = e.target.value || null; const t = (tracos.data ?? []).find((x) => x.value === id); setForm((s) => ({ ...s, operational_material_id: id, fck_previsto: (s.fck_previsto == null || s.fck_previsto === '') && t?.fck != null ? t.fck : s.fck_previsto })); }}><option value="">-</option>{(tracos.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}{o.fck != null ? ' (fck ' + o.fck + ')' : ''}</option>)}</SelectField>
          {(pecas.data ?? []).length ? <SelectField label="Peca (estrutura)" value={String(form.unit_id ?? '')} onChange={(e) => { const id = e.target.value || null; const pc = (pecas.data ?? []).find((x) => x.id === id); setForm((s) => ({ ...s, unit_id: id, local_texto: pc ? pc.label : s.local_texto })); }}><option value="">- (ou digite o local abaixo)</option>{(pecas.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</SelectField> : null}
          <Field label="Fornecedor (concreteira)" value={String(form.fornecedor_texto ?? '')} onChange={(e) => setForm((s) => ({ ...s, fornecedor_texto: e.target.value }))} />
          <Field label="Data programada" type="date" value={String(form.data_programada ?? '')} onChange={(e) => setForm((s) => ({ ...s, data_programada: e.target.value || null }))} />
          <Field label="fck previsto (MPa)" type="number" value={String(form.fck_previsto ?? '')} onChange={(e) => setForm((s) => ({ ...s, fck_previsto: e.target.value === '' ? null : Number(e.target.value) }))} />
          <Field label="Local/peca" value={String(form.local_texto ?? '')} onChange={(e) => setForm((s) => ({ ...s, local_texto: e.target.value }))} />
          {form.origem === 'retroativa' ? <Field label="Justificativa (retroativa)" value={String(form.retroativa_justificativa ?? '')} onChange={(e) => setForm((s) => ({ ...s, retroativa_justificativa: e.target.value }))} /> : null}
        </div>
      </Modal>
    </div>
  );
}
