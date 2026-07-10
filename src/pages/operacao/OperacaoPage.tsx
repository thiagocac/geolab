import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import {
  listLabMembers, inviteMember, setMemberActive, createLab, updateMember, setMemberRoles,
  getMemberObras, setMemberObras, getMemberOverrides, setMemberOverride, listObrasRef,
  resetPassword, getMemberEffectivePermissions,
  type LabMemberRow,
} from '../../lib/api/operacao';
import { listRoles, listPermissionsCatalog } from '../../lib/api/rbac';

function fmtLogin(v: string | null): string {
  if (!v) return 'nunca';
  const d = new Date(v);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function OperacaoPage() {
  const { hasRole, can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const isConsulte = hasRole('admin_consulte');
  const podeGerenciar = can('usuario.gerenciar') || hasRole('admin', 'admin_consulte');
  const [tab, setTab] = useState<'usuarios' | 'labs'>('usuarios');
  const [busca, setBusca] = useState('');
  const [filtroPapel, setFiltroPapel] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [f, setF] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [senha, setSenha] = useState<string | null>(null);

  const [edit, setEdit] = useState<LabMemberRow | null>(null);
  const [eNome, setENome] = useState(''); const [eCargo, setECargo] = useState(''); const [eTel, setETel] = useState('');
  const [eRoleIds, setERoleIds] = useState<Set<string>>(new Set());
  const [eEscopo, setEEscopo] = useState<'todas' | 'especificas'>('todas');
  const [eObras, setEObras] = useState<Set<string>>(new Set());
  const [ovPerm, setOvPerm] = useState(''); const [ovAllowed, setOvAllowed] = useState('true');

  const membersQ = useQuery({ queryKey: ['lab-members'], queryFn: listLabMembers });
  const rolesQ = useQuery({ queryKey: ['rbac', 'roles'], queryFn: listRoles });
  const obrasQ = useQuery({ queryKey: ['ref', 'obras', 'op'], queryFn: listObrasRef });
  const permsQ = useQuery({ queryKey: ['rbac', 'perms-catalog'], queryFn: listPermissionsCatalog });
  const scopeQ = useQuery({ queryKey: ['member-obras', edit?.member_id], queryFn: () => getMemberObras(edit!.member_id), enabled: !!edit });
  const overQ = useQuery({ queryKey: ['member-over', edit?.member_id], queryFn: () => getMemberOverrides(edit!.member_id), enabled: !!edit });
  const effQ = useQuery({ queryKey: ['member-eff', edit?.member_id], queryFn: () => getMemberEffectivePermissions(edit!.member_id), enabled: !!edit });

  const roles = rolesQ.data ?? [];
  const rolesAtivos = roles.filter((r) => r.active);
  const roleNome = useMemo(() => new Map(roles.map((r) => [r.key, r.name] as [string, string])), [roles]);

  const members = membersQ.data ?? [];
  const view = members.filter((m) => {
    const q = busca.trim().toLowerCase();
    if (q && !((m.full_name ?? '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q))) return false;
    if (filtroPapel && !(m.role_keys.includes(filtroPapel) || m.role === filtroPapel)) return false;
    if (filtroStatus === 'ativo' && !m.active) return false;
    if (filtroStatus === 'inativo' && m.active) return false;
    return true;
  });

  function abrirFicha(m: LabMemberRow) {
    setEdit(m);
    setENome(m.full_name ?? ''); setECargo(m.cargo ?? ''); setETel(m.telefone ?? '');
    setERoleIds(new Set(m.role_ids));
    setEEscopo(m.n_obras > 0 ? 'especificas' : 'todas');
    setEObras(new Set());
    setOvPerm(''); setOvAllowed('true');
  }
  useEffect(() => {
    if (!edit || !scopeQ.data) return;
    setEEscopo(scopeQ.data.length > 0 ? 'especificas' : 'todas');
    setEObras(new Set(scopeQ.data));
  }, [edit?.member_id, scopeQ.data]);

  async function convidar() {
    setBusy(true);
    try {
      if (!f.full_name || !f.email) throw new Error('Nome e e-mail são obrigatórios.');
      const r = await inviteMember({ full_name: String(f.full_name), email: String(f.email), role: String(f.role || 'operador_campo'), cargo: f.cargo ? String(f.cargo) : undefined, telefone: f.telefone ? String(f.telefone) : undefined });
      await qc.invalidateQueries({ queryKey: ['lab-members'] });
      setInviteOpen(false); setF({}); setSenha(r.temp_password ?? null);
      toast('Usuário criado.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function criarLab() {
    setBusy(true);
    try {
      if (!f.lab_nome || !f.admin_email || !f.admin_nome) throw new Error('Nome do lab, nome e e-mail do admin são obrigatórios.');
      const r = await createLab({ lab_nome: String(f.lab_nome), lab_slug: f.lab_slug ? String(f.lab_slug) : undefined, admin_email: String(f.admin_email), admin_nome: String(f.admin_nome), cnpj: f.cnpj ? String(f.cnpj) : undefined });
      setLabOpen(false); setF({}); setSenha(r.temp_password ?? null);
      toast('Laboratório criado.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function toggle(m: LabMemberRow) {
    if (m.active && !(await confirm({ title: 'Desativar usuário', message: 'Desativar ' + (m.full_name ?? m.email) + '? A pessoa perde o acesso até ser reativada.', danger: true, confirmLabel: 'Desativar' }))) return;
    try { await setMemberActive(m.member_id, !m.active); await qc.invalidateQueries({ queryKey: ['lab-members'] }); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function salvarFicha() {
    if (!edit) return;
    setBusy(true);
    try {
      await updateMember(edit.member_id, eNome, eCargo, eTel);
      await setMemberRoles(edit.member_id, [...eRoleIds]);
      await setMemberObras(edit.member_id, eEscopo === 'todas' ? [] : [...eObras]);
      await qc.invalidateQueries({ queryKey: ['lab-members'] });
      toast('Usuário atualizado.', 'success');
      setEdit(null);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function aplicarOverride(remove: boolean) {
    if (!edit || !ovPerm) return;
    try {
      await setMemberOverride(edit.member_id, ovPerm, remove ? null : ovAllowed === 'true');
      await qc.invalidateQueries({ queryKey: ['member-over', edit.member_id] });
      await qc.invalidateQueries({ queryKey: ['lab-members'] });
      if (remove) setOvPerm('');
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  async function resetSenha() {
    if (!edit) return;
    if (!(await confirm({ title: 'Redefinir senha', message: 'Gerar nova senha provisória para ' + (edit.full_name ?? edit.email) + '? A senha atual deixará de funcionar.', danger: true, confirmLabel: 'Redefinir' }))) return;
    try { const r = await resetPassword(edit.member_id); setSenha(r.temp_password ?? null); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  function toggleRole(id: string) { setERoleIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleObra(id: string) { setEObras((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  return (
    <div className="space-y-4">
      <PageHeader kicker="Operação interna" title="Usuários e acessos" description="Usuários do laboratório: papéis, escopo de obras, exceções de permissão e trilha de acesso." />
      <div className="flex gap-2">
        <Button variant={tab === 'usuarios' ? 'primary' : 'ghost'} onClick={() => setTab('usuarios')}>Usuários</Button>
        {isConsulte ? <Button variant={tab === 'labs' ? 'primary' : 'ghost'} onClick={() => setTab('labs')}>Laboratórios</Button> : null}
      </div>

      {tab === 'usuarios' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input max-w-[240px]" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <select className="input max-w-[200px]" value={filtroPapel} onChange={(e) => setFiltroPapel(e.target.value)}><option value="">Todos os papéis</option>{rolesAtivos.map((r) => <option key={r.id} value={r.key}>{r.name}</option>)}</select>
            <select className="input max-w-[150px]" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}><option value="">Todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select>
            <div className="ml-auto">{podeGerenciar ? <Button onClick={() => { setF({ role: 'operador_campo' }); setInviteOpen(true); }}>Novo usuário</Button> : null}</div>
          </div>
          {membersQ.isLoading ? <LoadingState /> : membersQ.isError ? <ErrorState message={(membersQ.error as Error).message} /> : view.length === 0 ? <EmptyState /> : (
            <Card>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {view.map((m) => {
                  const papeis = m.role_keys.length ? m.role_keys : (m.role ? [m.role] : []);
                  return (
                    <div key={m.member_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-slate-950 dark:text-slate-50">{m.full_name ?? m.email}</span>
                          {!m.active ? <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">inativo</span> : null}
                          {papeis.map((k) => <span key={k} className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{roleNome.get(k) ?? k}</span>)}
                          {m.n_overrides > 0 ? <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{m.n_overrides} exceção(ões)</span> : null}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{m.email}{m.cargo ? ' · ' + m.cargo : ''} · {m.n_obras > 0 ? m.n_obras + ' obra(s)' : 'todas as obras'} · último acesso: {fmtLogin(m.last_login)}</div>
                      </div>
                      <div className="flex gap-2">
                        {podeGerenciar ? <Button variant="ghost" onClick={() => abrirFicha(m)}>Editar</Button> : null}
                        {podeGerenciar ? <Button variant="ghost" onClick={() => void toggle(m)}>{m.active ? 'Desativar' : 'Ativar'}</Button> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end"><Button onClick={() => { setF({}); setLabOpen(true); }}>Novo laboratório</Button></div>
          <Card><p className="m-0 p-4 text-sm text-slate-500">Criação de laboratório (tenant + admin) restrita à Concresoft.</p></Card>
        </div>
      )}

      <Modal open={inviteOpen} title="Novo usuário" onClose={() => setInviteOpen(false)} footer={<><Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancelar</Button><Button onClick={() => void convidar()} disabled={busy}>{busy ? 'Criando...' : 'Criar'}</Button></>}>
        <div className="space-y-3">
          <Field label="Nome" required value={String(f.full_name ?? '')} onChange={(e) => setF((s) => ({ ...s, full_name: e.target.value }))} />
          <Field label="E-mail" required type="email" value={String(f.email ?? '')} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} />
          <SelectField label="Papel principal" value={String(f.role ?? 'operador_campo')} onChange={(e) => setF((s) => ({ ...s, role: e.target.value }))}>{rolesAtivos.filter((r) => r.key !== 'admin_consulte' && r.key !== 'cliente').map((r) => <option key={r.id} value={r.key}>{r.name}</option>)}</SelectField>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Cargo" value={String(f.cargo ?? '')} onChange={(e) => setF((s) => ({ ...s, cargo: e.target.value }))} />
            <Field label="Telefone" value={String(f.telefone ?? '')} onChange={(e) => setF((s) => ({ ...s, telefone: e.target.value }))} />
          </div>
          <p className="text-xs text-slate-500">Mais papéis e escopo de obras podem ser definidos na ficha após criar.</p>
        </div>
      </Modal>

      <Modal open={!!edit} wide title={edit ? 'Editar ' + (edit.full_name ?? edit.email) : ''} onClose={() => setEdit(null)} footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Fechar</Button><Button onClick={() => void salvarFicha()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button></>}>
        {edit ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Nome" value={eNome} onChange={(e) => setENome(e.target.value)} />
              <Field label="Cargo" value={eCargo} onChange={(e) => setECargo(e.target.value)} />
              <Field label="Telefone" value={eTel} onChange={(e) => setETel(e.target.value)} />
            </div>
            <div className="text-xs text-slate-500">E-mail: {edit.email} · último acesso: {fmtLogin(edit.last_login)}</div>

            <div>
              <div className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">Papéis</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {rolesAtivos.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                    <input type="checkbox" checked={eRoleIds.has(r.id)} onChange={() => toggleRole(r.id)} />
                    <span className="font-bold">{r.name}</span>{r.built_in ? null : <span className="rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800">custom</span>}
                  </label>
                ))}
              </div>
              {edit.role && !edit.role_keys.length ? <p className="mt-1 text-xs text-slate-500">Papel base atual: <strong>{roleNome.get(edit.role) ?? edit.role}</strong> (mantido; marque acima para granular).</p> : null}
            </div>

            <div>
              <div className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">Escopo de obras</div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" checked={eEscopo === 'todas'} onChange={() => setEEscopo('todas')} /> Todas as obras</label>
                <label className="flex items-center gap-2"><input type="radio" checked={eEscopo === 'especificas'} onChange={() => setEEscopo('especificas')} /> Obras específicas</label>
              </div>
              {eEscopo === 'especificas' ? (
                <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2 dark:border-slate-700">
                  {(obrasQ.data ?? []).map((o) => <label key={o.value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={eObras.has(o.value)} onChange={() => toggleObra(o.value)} /> {o.label}</label>)}
                  {(obrasQ.data ?? []).length === 0 ? <span className="text-xs text-slate-500">Nenhuma obra cadastrada.</span> : null}
                </div>
              ) : null}
            </div>

            <details className="rounded-lg border border-slate-200 dark:border-slate-700">
              <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">Permissões avançadas (exceções por usuário)</summary>
              <div className="space-y-3 p-3">
                <p className="text-xs text-slate-500">Exceções sobrepõem os papéis: "negar" sempre vence. Use com parcimônia.</p>
                {(overQ.data ?? []).length ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(overQ.data ?? []).map((o) => (
                      <div key={o.permission_key} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                        <span><span className={'mr-2 inline-block h-2 w-2 rounded-full ' + (o.allowed ? 'bg-emerald-500' : 'bg-red-500')} />{o.permission_key} — <strong>{o.allowed ? 'permitir' : 'negar'}</strong></span>
                        <button type="button" className="text-xs font-bold text-slate-400 hover:text-red-600" onClick={() => { setOvPerm(o.permission_key); void aplicarOverride(true); }}>remover</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-slate-500">Sem exceções.</p>}
                <div className="flex flex-wrap items-end gap-2">
                  <select className="input max-w-[260px]" value={ovPerm} onChange={(e) => setOvPerm(e.target.value)}><option value="">Escolher permissão…</option>{(permsQ.data ?? []).map((p) => <option key={p.key} value={p.key}>{p.category} · {p.name}</option>)}</select>
                  <select className="input max-w-[130px]" value={ovAllowed} onChange={(e) => setOvAllowed(e.target.value)}><option value="true">Permitir</option><option value="false">Negar</option></select>
                  <Button variant="secondary" onClick={() => void aplicarOverride(false)} disabled={!ovPerm}>Aplicar exceção</Button>
                </div>
              </div>
            </details>

            <div>
              <div className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">Conta</div>
              <Button variant="secondary" onClick={() => void resetSenha()}>Redefinir senha</Button>
            </div>

            <details className="rounded-lg border border-slate-200 dark:border-slate-700">
              <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">Permissões efetivas ({effQ.data?.length ?? 0})</summary>
              <div className="space-y-2 p-3">
                {(() => { const set = new Set(effQ.data ?? []); const grp: Record<string, string[]> = {}; for (const p of (permsQ.data ?? [])) { if (set.has(p.key)) { if (!grp[p.category]) grp[p.category] = []; grp[p.category].push(p.name); } } const ents = Object.entries(grp); return ents.length ? ents.map(([cat, names]) => <div key={cat}><div className="text-xs font-black uppercase tracking-wide text-slate-500">{cat}</div><div className="mt-1 flex flex-wrap gap-1">{names.map((n) => <span key={n} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{n}</span>)}</div></div>) : <span className="text-xs text-slate-500">Sem permissões resolvidas.</span>; })()}
              </div>
            </details>
          </div>
        ) : null}
      </Modal>

      <Modal open={labOpen} title="Novo laboratório" onClose={() => setLabOpen(false)} footer={<><Button variant="ghost" onClick={() => setLabOpen(false)}>Cancelar</Button><Button onClick={() => void criarLab()} disabled={busy}>{busy ? 'Criando...' : 'Criar'}</Button></>}>
        <div className="space-y-3">
          <Field label="Nome do laboratório" required value={String(f.lab_nome ?? '')} onChange={(e) => setF((s) => ({ ...s, lab_nome: e.target.value }))} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Slug (opcional)" value={String(f.lab_slug ?? '')} onChange={(e) => setF((s) => ({ ...s, lab_slug: e.target.value }))} />
            <Field label="CNPJ (opcional)" value={String(f.cnpj ?? '')} onChange={(e) => setF((s) => ({ ...s, cnpj: e.target.value }))} />
          </div>
          <Field label="Nome do admin" required value={String(f.admin_nome ?? '')} onChange={(e) => setF((s) => ({ ...s, admin_nome: e.target.value }))} />
          <Field label="E-mail do admin" required type="email" value={String(f.admin_email ?? '')} onChange={(e) => setF((s) => ({ ...s, admin_email: e.target.value }))} />
        </div>
      </Modal>

      <Modal open={!!senha} title="Senha provisória" onClose={() => setSenha(null)} footer={<Button onClick={() => setSenha(null)}>Fechar</Button>}>
        <p className="m-0 text-sm">Anote e repasse com segurança — não será exibida de novo:</p>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900">{senha}</div>
      </Modal>
    </div>
  );
}
