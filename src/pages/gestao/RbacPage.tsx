import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { Button } from '../../components/ui/Button';
import { listRbacMatrix, setRolePermissions, type RbacMatrixRow } from '../../lib/api/rbac';

type RoleView = { id: string; key: string; name: string };
type PermissionView = { key: string; name: string; category: string };

function badgeClass(category: string): string {
  if (category === 'Laudos' || category === 'Resultados') return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200';
  if (category === 'Financeiro') return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
  if (category === 'RBAC' || category === 'Segurança') return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
}

function buildViews(rows: RbacMatrixRow[]) {
  const roleMap = new Map<string, RoleView>();
  const permMap = new Map<string, PermissionView>();
  const enabled = new Map<string, Set<string>>();
  for (const row of rows) {
    roleMap.set(row.role_id, { id: row.role_id, key: row.role_key, name: row.role_name });
    permMap.set(row.permission_key, { key: row.permission_key, name: row.permission_name, category: row.category });
    if (!enabled.has(row.role_id)) enabled.set(row.role_id, new Set());
    if (row.enabled) enabled.get(row.role_id)!.add(row.permission_key);
  }
  const roles = [...roleMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  const permissions = [...permMap.values()].sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
  return { roles, permissions, enabled };
}

export function RbacPage() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const matrix = useQuery({ queryKey: ['rbac', 'matrix'], staleTime: 30_000, queryFn: listRbacMatrix });
  const rows = matrix.data ?? [];
  const { roles, permissions, enabled } = useMemo(() => buildViews(rows), [rows]);
  const canToggle = rows.length > 0;

  async function toggle(role: RoleView, permissionKey: string, checked: boolean) {
    const current = new Set(enabled.get(role.id) ?? []);
    if (checked) current.add(permissionKey); else current.delete(permissionKey);
    setSaving(role.id + ':' + permissionKey);
    setMsg(null);
    try {
      await setRolePermissions(role.id, [...current]);
      await qc.invalidateQueries({ queryKey: ['rbac', 'matrix'] });
      setMsg('Permissões atualizadas para ' + role.name + '.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader kicker="Onda 3 · RBAC" title="Permissões granulares" description="Matriz papel × permissão, coexistente com os perfis atuais. Começa separando lançar resultado, emitir laudo e aprovar laudo." />
      <Card>
        <CardHeader kicker="Matriz" title="Papéis e permissões">Use esta tela para ajustar permissões após aplicar a migration 098. O seed inicial espelha os perfis atuais.</CardHeader>
        <div className="p-5">
          {msg ? <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">{msg}</div> : null}
          {matrix.isLoading ? <LoadingState /> : matrix.error ? <ErrorState message={(matrix.error as Error).message} /> : !canToggle ? <EmptyState /> : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Permissão</th>
                    {roles.map((role) => <th key={role.id}>{role.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((perm) => (
                    <tr key={perm.key}>
                      <td>
                        <div className="font-bold text-slate-950 dark:text-slate-50">{perm.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span className={'badge ' + badgeClass(perm.category)}>{perm.category}</span><span>{perm.key}</span></div>
                      </td>
                      {roles.map((role) => {
                        const checked = enabled.get(role.id)?.has(perm.key) ?? false;
                        const key = role.id + ':' + perm.key;
                        return (
                          <td key={role.id}>
                            <label className="inline-flex items-center gap-2 text-sm font-semibold">
                              <input type="checkbox" checked={checked} disabled={!!saving} onChange={(e) => void toggle(role, perm.key, e.target.checked)} />
                              {saving === key ? 'Salvando' : checked ? 'Sim' : 'Não'}
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
      <Card className="p-5">
        <p className="text-sm text-slate-600 dark:text-slate-300">Transição segura: as funções novas consultam a matriz, mas mantêm fallback para <code>members.role</code>/<code>roles[]</code>. O corte rígido pode ser feito depois, quando o Thiago validar a matriz por laboratório.</p>
        <div className="mt-3"><Button variant="secondary" onClick={() => void matrix.refetch()}>Recarregar matriz</Button></div>
      </Card>
    </div>
  );
}
