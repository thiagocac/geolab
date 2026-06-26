import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { FEATURES, PERFIS, resolvePermissoes, perfilDe, type PortalPermissoes, type FeatureKey } from '../../lib/api/portalPermissoes';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { createClienteUsuario, criarLinkPortal, listClienteUsuarios, listClientesPortal, listObrasPortal, replaceClienteUsuarioObras, setClienteUsuarioAtivo, listarMagicLinksPortal, revogarMagicLink, updateClienteUsuarioPermissoes, type ClienteUsuarioRow } from '../../lib/api/clientUsers';

const genPass = () => 'GeoLab#' + Math.random().toString(36).slice(2, 8).toUpperCase() + '29';
const arr = (x: string[]) => [...new Set(x.filter(Boolean))];
const fmtData = (v: string | null) => { if (!v) return '—'; try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return v; } };

export function ClienteUsuariosPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<ClienteUsuarioRow | null>(null);
  const [f, setF] = useState<Record<string, unknown>>({ password: genPass() });
  const [workIds, setWorkIds] = useState<string[]>([]);
  const [permsForm, setPermsForm] = useState<PortalPermissoes>(() => resolvePermissoes(true, null));
  const [perfilSel, setPerfilSel] = useState('completo');
  const [busy, setBusy] = useState(false);
  const [senha, setSenha] = useState<{ username: string; password: string } | null>(null);
  const [linkClient, setLinkClient] = useState('');
  const [linkDias, setLinkDias] = useState(30);
  const [linkBusy, setLinkBusy] = useState(false);
  const users = useQuery({ queryKey: ['cliente-usuarios'], queryFn: listClienteUsuarios });
  const clients = useQuery({ queryKey: ['cliente-options'], queryFn: listClientesPortal });
  const links = useQuery({ queryKey: ['portal-magic-links'], queryFn: listarMagicLinksPortal });
  const obras = useQuery({ queryKey: ['obra-options', f.client_id ?? 'all'], queryFn: () => listObrasPortal(String(f.client_id ?? '') || undefined) });
  const todasObras = useQuery({ queryKey: ['obra-options-all'], queryFn: () => listObrasPortal() });
  const obrasAcesso = useMemo(() => todasObras.data ?? [], [todasObras.data]);
  function toggleWork(id: string) { setWorkIds((list) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id]); }
  function aplicarPerfil(key: string) { const p = PERFIS.find((x) => x.key === key); if (p) { setPermsForm({ ...p.perms }); setPerfilSel(key); } else setPerfilSel('personalizado'); }
  function toggleFeature(k: FeatureKey) { setPermsForm((st) => ({ ...st, [k]: !st[k] })); setPerfilSel('personalizado'); }
  function abrirNovo() { setF({ password: genPass() }); setWorkIds([]); setOpen(true); }
  function abrirAcesso(u: ClienteUsuarioRow) { setAccess(u); setWorkIds(u.obras.map((o) => o.id)); const p = resolvePermissoes(true, u.portal_permissoes); setPermsForm(p); setPerfilSel(perfilDe(p)); }
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
      await updateClienteUsuarioPermissoes(access.id, permsForm);
      await qc.invalidateQueries({ queryKey: ['cliente-usuarios'] });
      setAccess(null); toast('Obras do usuario atualizadas.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function toggleAtivo(u: ClienteUsuarioRow) {
    try { await setClienteUsuarioAtivo(u.id, !u.active); await qc.invalidateQueries({ queryKey: ['cliente-usuarios'] }); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function gerarLink() {
    if (!linkClient) { toast('Selecione um cliente.', 'error'); return; }
    setLinkBusy(true);
    try {
      const url = await criarLinkPortal(linkClient, linkDias);
      try { await navigator.clipboard.writeText(url); toast('Link do portal copiado (valido ' + linkDias + ' dias).', 'success'); }
      catch { toast('Link do portal: ' + url, 'info'); }
      await qc.invalidateQueries({ queryKey: ['portal-magic-links'] });
    } catch (e) { toast((e as Error).message, 'error'); } finally { setLinkBusy(false); }
  }
  async function revogar(id: string) {
    try { await revogarMagicLink(id); await qc.invalidateQueries({ queryKey: ['portal-magic-links'] }); toast('Link revogado.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  const list = users.data ?? [];
  return (
    <section className="space-y-5">
      <PageHeader kicker="Portal do cliente" title="Usuarios de clientes" description="Crie acessos para construtoras, vincule as obras permitidas e gere usuario/senha para entrada no portal." />
      <div className="flex justify-end"><Button onClick={abrirNovo}>Novo usuario de cliente</Button></div>
      <Card>
        <CardHeader title="Acesso por link (sem senha)">Gere um link de leitura do portal para um cliente. Libera todas as obras do cliente por 30 dias, sem login.</CardHeader>
        <div className="flex flex-wrap items-end gap-2 p-4">
          <div className="min-w-[240px] flex-1"><SelectField label="Cliente" value={linkClient} onChange={(e) => setLinkClient(e.target.value)}><option value="">Selecione</option>{(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectField></div>
          <div className="w-36"><SelectField label="Validade" value={String(linkDias)} onChange={(e) => setLinkDias(Number(e.target.value))}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option></SelectField></div>
          <Button variant="secondary" onClick={() => void gerarLink()} disabled={linkBusy || !linkClient}>{linkBusy ? 'Gerando...' : 'Gerar link do portal'}</Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Links de portal ativos">Acompanhe o último acesso e revogue o acesso por link quando necessário.</CardHeader>
        {links.isLoading ? <LoadingState /> : (links.data ?? []).length === 0 ? <EmptyState /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">{(links.data ?? []).map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div><div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">{m.client_nome ?? 'Cliente'} {m.ativo ? <Badge tone="success">Ativo</Badge> : <Badge tone="neutral">{m.consumed_at ? 'Revogado' : 'Expirado'}</Badge>}</div><div className="mt-1 text-xs text-slate-500">Criado {fmtData(m.created_at)} · expira {fmtData(m.expires_at)} · {m.access_count} acesso(s) · último {fmtData(m.last_access_at)}</div></div>
              {m.ativo ? <Button variant="ghost" onClick={() => void revogar(m.id)}>Revogar</Button> : null}
            </div>
          ))}</div>
        )}
      </Card>
      {users.isLoading ? <LoadingState /> : users.isError ? <ErrorState message={(users.error as Error).message} /> : list.length === 0 ? <EmptyState /> : (
        <Card><div className="divide-y divide-slate-100 dark:divide-slate-800">{list.map((u) => <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><div><div className="font-black text-slate-950 dark:text-slate-50">{u.full_name ?? u.email} · {u.email}</div><div className="mt-1 text-slate-500">{u.active ? 'Ativo' : 'Inativo'} · {u.obras.length ? u.obras.map((o) => o.nome).join(', ') : 'sem obras vinculadas'}</div></div><div className="flex gap-2"><Button variant="secondary" onClick={() => abrirAcesso(u)}>Configurar acesso</Button><Button variant="ghost" onClick={() => void toggleAtivo(u)}>{u.active ? 'Desativar' : 'Ativar'}</Button></div></div>)}</div></Card>
      )}
      <Modal open={open} title="Novo usuario de cliente" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void criar()} disabled={busy}>{busy ? 'Criando...' : 'Criar acesso'}</Button></>}>
        <div className="space-y-4">
          <Field label="Nome*" value={String(f.nome ?? '')} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} />
          <Field label="E-mail / usuario*" type="email" value={String(f.email ?? '')} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} />
          <Field label="Telefone" value={String(f.telefone ?? '')} onChange={(e) => setF((s) => ({ ...s, telefone: e.target.value }))} />
          <div className="flex items-end gap-2"><div className="flex-1 min-w-0"><Field label="Senha provisoria" value={String(f.password ?? '')} onChange={(e) => setF((s) => ({ ...s, password: e.target.value }))} /></div><Button variant="secondary" onClick={() => setF((s) => ({ ...s, password: genPass() }))}>Gerar</Button></div>
          <SelectField label="Filtrar obras por cliente" value={String(f.client_id ?? '')} onChange={(e) => setF((s) => ({ ...s, client_id: e.target.value }))}><option value="">Todos</option>{(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectField>
          <Card className="max-h-64 overflow-auto p-3"><div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Obras liberadas</div>{(obras.data ?? []).map((o) => <label key={o.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={workIds.includes(o.id)} onChange={() => toggleWork(o.id)} /> {o.nome} <span className="text-xs text-slate-400">{o.cliente}</span></label>)}</Card>
        </div>
      </Modal>
      <Modal open={!!access} title="Configurar acesso" onClose={() => setAccess(null)} footer={<><Button variant="ghost" onClick={() => setAccess(null)}>Cancelar</Button><Button onClick={() => void salvarAcesso()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar acesso'}</Button></>}>
        <CardHeader title={access?.full_name ?? access?.email ?? 'Usuario'}>Defina o perfil de acesso, os recursos liberados e as obras visíveis para este login do cliente.</CardHeader>
        <div className="space-y-4">
          <SelectField label="Perfil de acesso" value={perfilSel} onChange={(e) => aplicarPerfil(e.target.value)}>{PERFIS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}<option value="personalizado">Personalizado</option></SelectField>
          <Card className="p-3"><div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Recursos liberados</div><div className="grid gap-1 sm:grid-cols-2">{FEATURES.map((ft) => <label key={ft.key} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={permsForm[ft.key]} onChange={() => toggleFeature(ft.key)} /> {ft.label}</label>)}</div></Card>
          <Card className="max-h-72 overflow-auto p-3"><div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Obras visíveis</div>{obrasAcesso.map((o) => <label key={o.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={workIds.includes(o.id)} onChange={() => toggleWork(o.id)} /> {o.nome} <span className="text-xs text-slate-400">{o.cliente}</span></label>)}</Card>
        </div>
      </Modal>
      <Modal open={!!senha} title="Acesso criado" onClose={() => setSenha(null)} footer={<Button onClick={() => setSenha(null)}>Fechar</Button>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Repasse estes dados ao cliente com seguranca. A senha nao sera exibida novamente.</p>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-800">Usuario: {senha?.username}<br />Senha: {senha?.password}</div>
      </Modal>
    </section>
  );
}
