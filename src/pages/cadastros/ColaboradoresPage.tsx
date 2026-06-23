import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listColaboradores, saveColaborador, softDeleteColaborador, addCert, softDeleteCert, type ColaboradorRow } from '../../lib/api/colaboradores';

const TIPOS = ['NBR 15146-1 (Moldagem)', 'NBR 15146-2 (Rompimento)', 'CREA', 'CRQ', 'TER', 'Outro'];
const str = (v: unknown) => String(v ?? '').trim();
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
function certStatus(validade: string | null): { label: string; cor: string } {
  if (!validade) return { label: 'sem validade', cor: 'var(--ink-faint)' };
  const hoje = ymd(Date.now()), in30 = ymd(Date.now() + 30 * 86400000);
  if (validade < hoje) return { label: 'vencida', cor: 'var(--magenta)' };
  if (validade <= in30) return { label: 'vence em breve', cor: '#d97706' };
  return { label: 'valida', cor: '#16a34a' };
}

export function ColaboradoresPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, unknown>>({});
  const [cf, setCf] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ['colaboradores'], queryFn: listColaboradores });
  const atual = editId ? (q.data ?? []).find((c) => c.id === editId) : null;

  function novo() { setEditId(null); setF({}); setCf({}); setOpen(true); }
  function editar(c: ColaboradorRow) { setEditId(c.id); setF({ nome: c.nome, documento: c.documento ?? '', registro_profissional: c.registro_profissional ?? '' }); setCf({}); setOpen(true); }

  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      if (!str(f.nome)) throw new Error('Nome e obrigatorio.');
      const id = await saveColaborador(member.tenant_id, editId, { nome: str(f.nome), documento: str(f.documento) || null, registro_profissional: str(f.registro_profissional) || null });
      await qc.invalidateQueries({ queryKey: ['colaboradores'] });
      setEditId(id); toast('Colaborador salvo.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function adicionarCert() {
    if (!member || !editId) return;
    try {
      if (!str(cf.tipo)) throw new Error('Selecione o tipo da certificacao.');
      await addCert(member.tenant_id, editId, { tipo: str(cf.tipo), numero: str(cf.numero) || undefined, validade: str(cf.validade) || undefined });
      await qc.invalidateQueries({ queryKey: ['colaboradores'] });
      setCf({}); toast('Certificacao adicionada.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function removerCert(id: string) {
    try { await softDeleteCert(id); await qc.invalidateQueries({ queryKey: ['colaboradores'] }); } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function excluir(c: ColaboradorRow) {
    if (!window.confirm('Excluir o colaborador ' + c.nome + '?')) return;
    try { await softDeleteColaborador(c.id); await qc.invalidateQueries({ queryKey: ['colaboradores'] }); toast('Excluido.', 'success'); } catch (e) { toast((e as Error).message, 'error'); }
  }

  const rows = q.data ?? [];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Cadastros" title="Colaboradores" description="Moldadores, laboratoristas e RT, com certificacoes e validade." />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={novo}>Novo colaborador</Button></div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
        <Card><div style={{ display: 'grid', gap: 6 }}>
          {rows.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{c.nome} {c.registro_profissional ? <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-faint)' }}>· {c.registro_profissional}</span> : null}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {c.certs.length === 0 ? <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>sem certificacoes</span> : c.certs.map((ct) => { const s = certStatus(ct.validade); return <span key={ct.id} style={{ fontSize: 11, fontWeight: 700, color: s.cor, border: '1px solid var(--line)', borderRadius: 999, padding: '2px 8px' }}>{ct.tipo.split(' ')[0]} · {s.label}{ct.validade ? ' ' + ct.validade : ''}</span>; })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button variant="ghost" onClick={() => editar(c)}>Editar</Button>
                <Button variant="ghost" onClick={() => void excluir(c)}>Excluir</Button>
              </div>
            </div>
          ))}
        </div></Card>
      )}

      <Modal open={open} title={editId ? 'Editar colaborador' : 'Novo colaborador'} onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar dados'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Nome*" value={String(f.nome ?? '')} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="CPF" value={String(f.documento ?? '')} onChange={(e) => setF((s) => ({ ...s, documento: e.target.value }))} />
            <Field label="Registro (CREA/CRQ/TER)" value={String(f.registro_profissional ?? '')} onChange={(e) => setF((s) => ({ ...s, registro_profissional: e.target.value }))} />
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <strong style={{ fontSize: 13, color: 'var(--ink)' }}>Certificacoes</strong>
            {!editId ? <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '6px 0 0' }}>Salve os dados primeiro para adicionar certificacoes.</p> : (
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {(atual?.certs ?? []).map((ct) => { const s = certStatus(ct.validade); return (
                  <div key={ct.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--ink)' }}>{ct.tipo}{ct.numero ? ' · ' + ct.numero : ''} <span style={{ color: s.cor, fontWeight: 700 }}>({s.label}{ct.validade ? ' ' + ct.validade : ''})</span></span>
                    <Button variant="ghost" onClick={() => void removerCert(ct.id)}>remover</Button>
                  </div>
                ); })}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <SelectField label="Tipo" value={String(cf.tipo ?? '')} onChange={(e) => setCf((s) => ({ ...s, tipo: e.target.value }))}><option value="">-</option>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</SelectField>
                  <Field label="Numero" value={String(cf.numero ?? '')} onChange={(e) => setCf((s) => ({ ...s, numero: e.target.value }))} />
                  <Field label="Validade" type="date" value={String(cf.validade ?? '')} onChange={(e) => setCf((s) => ({ ...s, validade: e.target.value }))} />
                  <Button variant="secondary" onClick={() => void adicionarCert()}>Adicionar</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
