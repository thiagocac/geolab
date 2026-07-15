import { Fragment, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, TextArea } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listRbacMatrix, setRolePermissions, listRoles, listPermissionsCatalog, upsertRole, cloneRole, setRoleActive, type RoleRow } from '../../lib/api/rbac';

function riskDot(risk: string): string {
  if (risk === 'critico') return 'bg-red-500';
  if (risk === 'alto') return 'bg-amber-500';
  if (risk === 'medio') return 'bg-yellow-400';
  return 'bg-slate-300';
}
function riskLabel(risk: string): string {
  return risk === 'critico' ? 'crítico' : risk === 'alto' ? 'alto' : risk === 'medio' ? 'médio' : 'baixo';
}

export function RbacPage() {
  const { can, hasRole } = useAuth();
  const podeGerenciar = can('rbac.gerenciar') || hasRole('admin', 'admin_consulte');
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'matriz' | 'papeis'>('matriz');
  const [busca, setBusca] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [pModal, setPModal] = useState<null | { mode: 'novo' | 'editar' | 'clonar'; id?: string; nome: string; desc: string }>(null);
  const [busy, setBusy] = useState(false);

  const matrixQ = useQuery({ queryKey: ['rbac', 'matrix'], queryFn: listRbacMatrix });
  const rolesQ = useQuery({ queryKey: ['rbac', 'roles'], queryFn: listRoles });
  const permsQ = useQuery({ queryKey: ['rbac', 'perms-catalog'], queryFn: listPermissionsCatalog });

  const enabled = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of matrixQ.data ?? []) { if (!m.has(r.role_id)) m.set(r.role_id, new Set()); if (r.enabled) m.get(r.role_id)!.add(r.permission_key); }
    return m;
  }, [matrixQ.data]);

  const allRoles = rolesQ.data ?? [];
  const roles = allRoles.filter((r) => r.active);
  const q = busca.trim().toLowerCase();
  const perms = (permsQ.data ?? []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  const cats = useMemo(() => [...new Set(perms.map((p) => p.category))], [perms]);

  async function toggle(roleId: string, permKey: string, checked: boolean) {
    const cur = new Set(enabled.get(roleId) ?? []);
    if (checked) cur.add(permKey); else cur.delete(permKey);
    setSaving(roleId + ':' + permKey);
    try { await setRolePermissions(roleId, [...cur]); await qc.invalidateQueries({ queryKey: ['rbac', 'matrix'] }); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(null); }
  }
  async function salvarPapel() {
    if (!pModal) return;
    setBusy(true);
    try {
      if (!pModal.nome.trim()) throw new Error('Nome do papel é obrigatório.');
      if (pModal.mode === 'clonar' && pModal.id) await cloneRole(pModal.id, pModal.nome.trim());
      else await upsertRole(pModal.mode === 'editar' ? (pModal.id ?? null) : null, pModal.nome.trim(), pModal.desc.trim());
      await qc.invalidateQueries({ queryKey: ['rbac', 'roles'] });
      await qc.invalidateQueries({ queryKey: ['rbac', 'matrix'] });
      toast('Papel salvo.', 'success'); setPModal(null);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function desativar(role: RoleRow) {
    if (role.active && !(await confirm({ title: 'Desativar papel', message: 'Desativar o papel ' + role.name + '?', danger: true, confirmLabel: 'Desativar' }))) return;
    try { await setRoleActive(role.id, !role.active); await qc.invalidateQueries({ queryKey: ['rbac', 'roles'] }); await qc.invalidateQueries({ queryKey: ['rbac', 'matrix'] }); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  const loading = matrixQ.isLoading || permsQ.isLoading || rolesQ.isLoading;
  const erro = matrixQ.error || permsQ.error || rolesQ.error;

  return (
    <div className="space-y-4">
      <PageHeader kicker="Acessos" title="Papéis e permissões" description="Matriz papel × permissão por categoria e gestão de papéis do laboratório." />
      <div className="flex gap-2">
        <Button variant={tab === 'matriz' ? 'primary' : 'ghost'} onClick={() => setTab('matriz')}>Matriz</Button>
        <Button variant={tab === 'papeis' ? 'primary' : 'ghost'} onClick={() => setTab('papeis')}>Papéis</Button>
      </div>

      {loading ? <LoadingState /> : erro ? <ErrorState message={(erro as Error).message} /> : tab === 'matriz' ? (
        <Card>
          <div className="flex flex-wrap items-center gap-2 p-4">
            <input aria-label="Buscar permissão" className="input max-w-[280px]" placeholder="Buscar permissão…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <span className="text-xs text-slate-500">{perms.length} permissões · {roles.length} papéis</span>
          </div>
          {perms.length === 0 ? <div className="p-4"><EmptyState /></div> : (
            <div className="table-scroll px-2 pb-2">
              <table className="table">
                <thead>
                  <tr><th className="min-w-[280px]">Permissão</th>{roles.map((r) => <th key={r.id} className="text-center">{r.name}</th>)}</tr>
                </thead>
                <tbody>
                  {cats.map((cat) => (
                    <Fragment key={cat}>
                      <tr><td colSpan={roles.length + 1} className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">{cat}</td></tr>
                      {perms.filter((p) => p.category === cat).map((p) => (
                        <tr key={p.key}>
                          <td>
                            <div className="flex items-center gap-2 font-bold text-slate-950 dark:text-slate-50"><span className={'inline-block h-2 w-2 rounded-full ' + riskDot(p.risk_level)} title={'Risco: ' + riskLabel(p.risk_level)} />{p.name}</div>
                            <div className="mt-0.5 text-xs text-slate-500">{p.key}{p.description ? ' · ' + p.description : ''}</div>
                          </td>
                          {roles.map((r) => {
                            const checked = enabled.get(r.id)?.has(p.key) ?? false;
                            const k = r.id + ':' + p.key;
                            return <td key={r.id} className="text-center"><input aria-label={`${p.name} para ${r.name}`} type="checkbox" checked={checked} disabled={!podeGerenciar || saving === k} onChange={(e) => void toggle(r.id, p.key, e.target.checked)} /></td>;
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between p-4">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Papéis do laboratório</span>
            {podeGerenciar ? <Button onClick={() => setPModal({ mode: 'novo', nome: '', desc: '' })}>Novo papel</Button> : null}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {allRoles.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-slate-950 dark:text-slate-50">{r.name}</span>
                    <span className={'rounded px-1.5 py-0.5 text-[11px] font-bold ' + (r.built_in ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300')}>{r.built_in ? 'built-in' : 'custom'}</span>
                    {!r.active ? <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">inativo</span> : null}
                    <span className="text-xs text-slate-400">{enabled.get(r.id)?.size ?? 0} permissões</span>
                  </div>
                  {r.description ? <div className="mt-0.5 text-xs text-slate-500">{r.description}</div> : null}
                </div>
                {podeGerenciar ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => setPModal({ mode: 'clonar', id: r.id, nome: r.name + ' (cópia)', desc: '' })}>Clonar</Button>
                    {!r.built_in ? <Button variant="ghost" onClick={() => setPModal({ mode: 'editar', id: r.id, nome: r.name, desc: r.description ?? '' })}>Editar</Button> : null}
                    {!r.built_in ? <Button variant="ghost" onClick={() => void desativar(r)}>{r.active ? 'Desativar' : 'Ativar'}</Button> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={!!pModal} title={pModal?.mode === 'clonar' ? 'Clonar papel' : pModal?.mode === 'editar' ? 'Editar papel' : 'Novo papel'} onClose={() => setPModal(null)} footer={<><Button variant="ghost" onClick={() => setPModal(null)}>Cancelar</Button><Button onClick={() => void salvarPapel()} busy={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button></>}>
        {pModal ? (
          <div className="space-y-3">
            <Field label="Nome do papel" required value={pModal.nome} onChange={(e) => setPModal({ ...pModal, nome: e.target.value })} />
            {pModal.mode !== 'clonar' ? <TextArea label="Descrição" value={pModal.desc} onChange={(e) => setPModal({ ...pModal, desc: e.target.value })} /> : <p className="text-xs text-slate-500">O clone copia todas as permissões do papel de origem; ajuste a matriz depois.</p>}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
