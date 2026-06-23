import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { createClienteUsuario, listClienteUsuarios, listClientesPortal, listObrasPortal, replaceClienteUsuarioObras, setClienteUsuarioAtivo, type ClienteUsuarioRow } from '../../lib/api/clientUsers';

const genPass = () => 'GeoLab#' + Math.random().toString(36).slice(2, 8).toUpperCase() + '29';
const arr = (x: string[]) => [...new Set(x.filter(Boolean))];

export function ClienteUsuariosPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<ClienteUsuarioRow | null>(null);
  const [f, setF] = useState<Record<string, unknown>>({ password: genPass() });
  const [workIds, setWorkIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [senha, setSenha] = useState<{ username: string; password: string } | null>(null);
  const users = useQuery({ queryKey: ['cliente-usuarios'], queryFn: listClienteUsuarios });
  const clients = useQuery({ queryKey: ['cliente-options'], queryFn: listClientesPortal });
  const obras = useQuery({ queryKey: ['obra-options', f.client_id ?? 'all'], queryFn: () => listObrasPortal(String(f.client_id ?? '') || undefined) });
  const todasObras = useQuery({ queryKey: ['obra-options-all'], queryFn: () => listObrasPortal() });
  const obrasAcesso = useMemo(() => todasObras.data ?? [], [todasObras.data]);
  function toggleWork(id: string) { setWorkIds((list) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id]); }
  function abrirNovo() { setF({ password: genPass() }); setWorkIds([]); setOpen(true); }
  function abrirAcesso(u: ClienteUsuarioRow) { setAccess(u); setWorkIds(u.obras.map((o) => o.id)); }
  async function criar() {
    setBusy(true);
    try {
      if (!f.nome || !f.email) throw new Error('Nome e e-mail sao obrigatorios.');
      if (!workIds.length) throw new Error('Selecione ao menos uma obra para o usuario do cliente.');
      const r = await createClienteUsuario({ nome: String(f.nome), email: String(f.email), telefone: f.telefone ? String(f.telefone) : undefined, password: f.password ? String(f.password) : undefined, work_ids: arr(workIds) });
      await qc.invalidateQueries({ queryKey: ['cliente-usuarios'] });
      setOpen(false); setF({ password: genPass() }); setWorkIds([]); setSenha({ username: r.username, password: r.temp_password });
      toast('Usuario do cliente criado.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function salvarAcesso() {
    if (!access || !member) return;
    setBusy(true);
    try {
      if (!workIds.length) throw new Error('Selecione ao menos uma obra.');
      await replaceClienteUsuarioObras(access.id, member.tenant_id, arr(workIds));
      await qc.invalidateQueries({ queryKey: ['cliente-usuarios'] });
      setAccess(null); toast('Obras do usuario atualizadas.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function toggleAtivo(u: ClienteUsuarioRow) {
    try { await setClienteUsuarioAtivo(u.id, !u.active); await qc.invalidateQueries({ queryKey: ['cliente-usuarios'] }); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  const list = users.data ?? [];
  return (
    <section className="space-y-5">
      <PageHeader kicker="Portal do cliente" title="Usuarios de clientes" description="Crie acessos para construtoras, vincule as obras permitidas e gere usuario/senha para entrada no portal." />
      <div className="flex justify-end"><Button onClick={abrirNovo}>Novo usuario de cliente</Button></div>
      {users.isLoading ? <LoadingState /> : users.isError ? <ErrorState message={(users.error as Error).message} /> : list.length === 0 ? <EmptyState /> : (
        <Card><div className="divide-y divide-slate-100 dark:divide-slate-800">{list.map((u) => <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><div><div className="font-black text-slate-950 dark:text-slate-50">{u.full_name ?? u.email} · {u.email}</div><div className="mt-1 text-slate-500">{u.active ? 'Ativo' : 'Inativo'} · {u.obras.length ? u.obras.map((o) => o.nome).join(', ') : 'sem obras vinculadas'}</div></div><div className="flex gap-2"><Button variant="secondary" onClick={() => abrirAcesso(u)}>Obras</Button><Button variant="ghost" onClick={() => void toggleAtivo(u)}>{u.active ? 'Desativar' : 'Ativar'}</Button></div></div>)}</div></Card>
      )}
      <Modal open={open} title="Novo usuario de cliente" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void criar()} disabled={busy}>{busy ? 'Criando...' : 'Criar acesso'}</Button></>}>
        <div className="space-y-4">
          <Field label="Nome*" value={String(f.nome ?? '')} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} />
          <Field label="E-mail / usuario*" type="email" value={String(f.email ?? '')} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} />
          <Field label="Telefone" value={String(f.telefone ?? '')} onChange={(e) => setF((s) => ({ ...s, telefone: e.target.value }))} />
          <div className="flex gap-2"><Field label="Senha provisoria" value={String(f.password ?? '')} onChange={(e) => setF((s) => ({ ...s, password: e.target.value }))} /><Button variant="secondary" onClick={() => setF((s) => ({ ...s, password: genPass() }))}>Gerar</Button></div>
          <SelectField label="Filtrar obras por cliente" value={String(f.client_id ?? '')} onChange={(e) => setF((s) => ({ ...s, client_id: e.target.value }))}><option value="">Todos</option>{(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectField>
          <Card className="max-h-64 overflow-auto p-3"><div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Obras liberadas</div>{(obras.data ?? []).map((o) => <label key={o.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={workIds.includes(o.id)} onChange={() => toggleWork(o.id)} /> {o.nome} <span className="text-xs text-slate-400">{o.cliente}</span></label>)}</Card>
        </div>
      </Modal>
      <Modal open={!!access} title="Obras liberadas" onClose={() => setAccess(null)} footer={<><Button variant="ghost" onClick={() => setAccess(null)}>Cancelar</Button><Button onClick={() => void salvarAcesso()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar obras'}</Button></>}>
        <CardHeader title={access?.full_name ?? access?.email ?? 'Usuario'}>Marque as obras que este login do cliente pode acessar no portal.</CardHeader>
        <Card className="max-h-80 overflow-auto p-3">{obrasAcesso.map((o) => <label key={o.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={workIds.includes(o.id)} onChange={() => toggleWork(o.id)} /> {o.nome} <span className="text-xs text-slate-400">{o.cliente}</span></label>)}</Card>
      </Modal>
      <Modal open={!!senha} title="Acesso criado" onClose={() => setSenha(null)} footer={<Button onClick={() => setSenha(null)}>Fechar</Button>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Repasse estes dados ao cliente com seguranca. A senha nao sera exibida novamente.</p>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800">Usuario: {senha?.username}<br />Senha: {senha?.password}</div>
      </Modal>
    </section>
  );
}
