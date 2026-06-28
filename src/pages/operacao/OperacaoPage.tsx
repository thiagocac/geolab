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
import { listMembers, inviteMember, setMemberActive, createLab, type MemberRow } from '../../lib/api/operacao';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const PERFIS: [string, string][] = [['admin', 'Admin do laboratorio'], ['gestor_qualidade', 'Gestor da qualidade / RT'], ['laboratorista', 'Laboratorista'], ['operador_campo', 'Operador de campo'], ['financeiro', 'Financeiro'], ['cliente', 'Cliente (portal)']];

export function OperacaoPage() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const isConsulte = hasRole('admin_consulte');
  const [tab, setTab] = useState<'usuarios' | 'labs'>('usuarios');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [f, setF] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [senha, setSenha] = useState<string | null>(null);

  const membersQ = useQuery({ queryKey: ['op-members'], queryFn: listMembers });

  async function convidar() {
    setBusy(true);
    try {
      if (!f.full_name || !f.email) throw new Error('Nome e e-mail sao obrigatorios.');
      const r = await inviteMember({ full_name: String(f.full_name), email: String(f.email), role: String(f.role || 'operador_campo'), cargo: f.cargo ? String(f.cargo) : undefined, telefone: f.telefone ? String(f.telefone) : undefined });
      await qc.invalidateQueries({ queryKey: ['op-members'] });
      setInviteOpen(false); setF({}); setSenha(r.temp_password ?? null);
      toast('Usuario criado.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function criarLab() {
    setBusy(true);
    try {
      if (!f.lab_nome || !f.admin_email || !f.admin_nome) throw new Error('Nome do lab, nome e e-mail do admin sao obrigatorios.');
      const r = await createLab({ lab_nome: String(f.lab_nome), lab_slug: f.lab_slug ? String(f.lab_slug) : undefined, admin_email: String(f.admin_email), admin_nome: String(f.admin_nome), cnpj: f.cnpj ? String(f.cnpj) : undefined });
      setLabOpen(false); setF({}); setSenha(r.temp_password ?? null);
      toast('Laboratorio criado.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function toggle(m: MemberRow) {
    if (m.active && !(await confirm({ title: 'Desativar usuário', message: 'Desativar ' + (m.full_name ?? m.email) + '? A pessoa perde o acesso ao laboratório até ser reativada.', danger: true, confirmLabel: 'Desativar' }))) return;
    try { await setMemberActive(m.id, !m.active); await qc.invalidateQueries({ queryKey: ['op-members'] }); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  const members = membersQ.data ?? [];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Operacao interna" title="Operacao" description="Usuarios do laboratorio e (Concresoft) criacao de laboratorios." />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant={tab === 'usuarios' ? 'primary' : 'ghost'} onClick={() => setTab('usuarios')}>Usuarios</Button>
        {isConsulte ? <Button variant={tab === 'labs' ? 'primary' : 'ghost'} onClick={() => setTab('labs')}>Laboratorios</Button> : null}
      </div>

      {tab === 'usuarios' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={() => { setF({ role: 'operador_campo' }); setInviteOpen(true); }}>Novo usuario</Button></div>
          {membersQ.isLoading ? <LoadingState /> : membersQ.isError ? <ErrorState message={(membersQ.error as Error).message} /> : members.length === 0 ? <EmptyState /> : (
            <Card><div style={{ display: 'grid', gap: 6 }}>
              {members.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13 }}><strong>{m.full_name ?? m.email}</strong> - {m.email} - <span style={{ color: 'var(--ink-faint)' }}>{m.role}{m.cargo ? ' / ' + m.cargo : ''}</span>{!m.active ? ' - inativo' : ''}</span>
                  <Button variant="ghost" onClick={() => void toggle(m)}>{m.active ? 'Desativar' : 'Ativar'}</Button>
                </div>
              ))}
            </div></Card>
          )}
        </>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={() => { setF({}); setLabOpen(true); }}>Novo laboratorio</Button></div>
          <Card><p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>Criacao de laboratorio (tenant + admin) restrita à Concresoft. A listagem de todos os laboratorios depende de policy cross-tenant (proximo bloco).</p></Card>
        </div>
      )}

      <Modal open={inviteOpen} title="Novo usuario" onClose={() => setInviteOpen(false)} footer={<><Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancelar</Button><Button onClick={() => void convidar()} disabled={busy}>{busy ? 'Criando...' : 'Criar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Nome*" value={String(f.full_name ?? '')} onChange={(e) => setF((s) => ({ ...s, full_name: e.target.value }))} />
          <Field label="E-mail*" type="email" value={String(f.email ?? '')} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} />
          <SelectField label="Perfil" value={String(f.role ?? 'operador_campo')} onChange={(e) => setF((s) => ({ ...s, role: e.target.value }))}>{PERFIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectField>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <Field label="Cargo" value={String(f.cargo ?? '')} onChange={(e) => setF((s) => ({ ...s, cargo: e.target.value }))} />
            <Field label="Telefone" value={String(f.telefone ?? '')} onChange={(e) => setF((s) => ({ ...s, telefone: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <Modal open={labOpen} title="Novo laboratorio" onClose={() => setLabOpen(false)} footer={<><Button variant="ghost" onClick={() => setLabOpen(false)}>Cancelar</Button><Button onClick={() => void criarLab()} disabled={busy}>{busy ? 'Criando...' : 'Criar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Nome do laboratorio*" value={String(f.lab_nome ?? '')} onChange={(e) => setF((s) => ({ ...s, lab_nome: e.target.value }))} />
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <Field label="Slug (opcional)" value={String(f.lab_slug ?? '')} onChange={(e) => setF((s) => ({ ...s, lab_slug: e.target.value }))} />
            <Field label="CNPJ (opcional)" value={String(f.cnpj ?? '')} onChange={(e) => setF((s) => ({ ...s, cnpj: e.target.value }))} />
          </div>
          <Field label="Nome do admin*" value={String(f.admin_nome ?? '')} onChange={(e) => setF((s) => ({ ...s, admin_nome: e.target.value }))} />
          <Field label="E-mail do admin*" type="email" value={String(f.admin_email ?? '')} onChange={(e) => setF((s) => ({ ...s, admin_email: e.target.value }))} />
        </div>
      </Modal>

      <Modal open={!!senha} title="Senha provisoria" onClose={() => setSenha(null)} footer={<Button onClick={() => setSenha(null)}>Fechar</Button>}>
        <p style={{ margin: 0, fontSize: 13 }}>Anote e repasse com seguranca - nao sera exibida de novo:</p>
        <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'monospace', fontSize: 14 }}>{senha}</div>
      </Modal>
    </div>
  );
}
