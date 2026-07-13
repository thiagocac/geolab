import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { FilePicker } from '../../components/ui/FilePicker';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { openDeferredTab } from '../../lib/pdf';
import type { Column, SortState } from '../../lib/api/types';
import { FUNCOES, addCert, contarUsoColaborador, listColaboradorEquipamentos, listColaboradores, listMembersForLink, saveColaborador, setColaboradorEquipamentos, setColaboradorMember, signedCertAnexo, softDeleteCert, softDeleteColaborador, uploadCertAnexo, type ColaboradorRow } from '../../lib/api/colaboradores';
import { inviteMember } from '../../lib/api/operacao';
import { listEquipamentosRef, rotuloEquip, TIPOS_EQUIP } from '../../lib/api/equipamentos';

const TIPOS = ['NBR 15146-1 (Moldagem)', 'NBR 15146-2 (Rompimento)', 'CREA', 'CRQ', 'TER', 'Outro'];
const str = (v: unknown) => String(v ?? '').trim();
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function certStatus(validade: string | null): { label: string; cor: string } {
  if (!validade) return { label: 'sem validade', cor: 'var(--ink-faint)' };
  const hoje = ymd(Date.now()), in30 = ymd(Date.now() + 30 * 86400000);
  if (validade < hoje) return { label: 'vencida', cor: 'var(--magenta)' };
  if (validade <= in30) return { label: 'vence em breve', cor: 'var(--warning)' };
  return { label: 'válida', cor: '#16a34a' };
}
const temVencida = (c: ColaboradorRow) => c.certs.some((ct) => ct.validade !== null && ct.validade < ymd(Date.now()));
const temVence30 = (c: ColaboradorRow) => c.certs.some((ct) => ct.validade !== null && ct.validade >= ymd(Date.now()) && ct.validade <= ymd(Date.now() + 30 * 86400000));

export function ColaboradoresPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, unknown>>({});
  const [cf, setCf] = useState<Record<string, unknown>>({});
  const [certFile, setCertFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyCert, setBusyCert] = useState(false);
  // Busca + filtros + ordenação (no cliente: a lista de um lab é pequena).
  const [busca, setBusca] = useState('');
  const [fFuncao, setFFuncao] = useState('');
  const [fCert, setFCert] = useState('');
  const [sp] = useSearchParams();
  useEffect(() => { const c = sp.get('cert'); if (c === 'vencida' || c === 'vence30') setFCert(c); }, [sp]);
  const [soAtivos, setSoAtivos] = useState(true);
  const [sort, setSort] = useState<SortState>({ column: 'nome', direction: 'asc' });

  const [senha, setSenha] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['colaboradores'], queryFn: listColaboradores });
  const membersLink = useQuery({ queryKey: ['members-link'], queryFn: listMembersForLink });
  const equipRefQ = useQuery({ queryKey: ['equipamentos-ref'], queryFn: listEquipamentosRef });
  const [equipSel, setEquipSel] = useState<Set<string>>(new Set());
  const colabEquipQ = useQuery({ queryKey: ['colab-equip', editId], queryFn: () => listColaboradorEquipamentos(editId!), enabled: !!editId && open });
  useEffect(() => { if (editId && colabEquipQ.data) setEquipSel(new Set(colabEquipQ.data)); }, [editId, colabEquipQ.data]);
  function toggleEquip(id: string) { setEquipSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  const atual = editId ? (q.data ?? []).find((c) => c.id === editId) : null;

  const rows = q.data ?? [];
  const vistos = useMemo(() => {
    const b = norm(busca.trim());
    let out = rows.filter((c) => {
      if (soAtivos && !c.ativo) return false;
      if (fFuncao && !c.funcoes.some((fn) => norm(fn) === norm(fFuncao))) return false;
      if (fCert === 'vencida' && !temVencida(c)) return false;
      if (fCert === 'vence30' && !temVence30(c)) return false;
      if (fCert === 'sem' && c.certs.length > 0) return false;
      if (b && !(norm(c.nome).includes(b) || norm(c.documento ?? '').includes(b) || norm(c.registro_profissional ?? '').includes(b))) return false;
      return true;
    });
    const dir = sort.direction === 'asc' ? 1 : -1;
    out = [...out].sort((a, z) => {
      if (sort.column === 'situacao') return (Number(z.ativo) - Number(a.ativo)) * dir || a.nome.localeCompare(z.nome, 'pt-BR');
      return a.nome.localeCompare(z.nome, 'pt-BR') * dir;
    });
    return out;
  }, [rows, busca, fFuncao, fCert, soAtivos, sort]);

  function novo() { setEditId(null); setF({ ativo: true, funcoes: [] as string[], vinc: 'none' }); setCf({}); setCertFile(null); setEquipSel(new Set()); setOpen(true); }
  function editar(c: ColaboradorRow) { setEditId(c.id); setF({ nome: c.nome, documento: c.documento ?? '', registro_profissional: c.registro_profissional ?? '', funcoes: [...c.funcoes], ativo: c.ativo, vinc: c.member_id ?? 'none' }); setCf({}); setCertFile(null); setEquipSel(new Set()); setOpen(true); }
  function toggleFuncao(fn: string) {
    setF((s) => { const cur = Array.isArray(s.funcoes) ? (s.funcoes as string[]) : []; return { ...s, funcoes: cur.includes(fn) ? cur.filter((x) => x !== fn) : [...cur, fn] }; });
  }

  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      if (!str(f.nome)) throw new Error('Nome e obrigatorio.');
      const id = await saveColaborador(member.tenant_id, editId, {
        nome: str(f.nome), documento: str(f.documento) || null, registro_profissional: str(f.registro_profissional) || null,
        funcoes: Array.isArray(f.funcoes) ? (f.funcoes as string[]) : [], ativo: f.ativo !== false,
      });
      const vinc = String(f.vinc ?? 'none');
      let linked: string | null = editId ? (atual?.member_id ?? null) : null;
      let msg = 'Colaborador salvo.';
      if (vinc === '__new') {
        const email = str(f.nu_email);
        if (!email) throw new Error('Informe o e-mail do novo usuário.');
        const r = await inviteMember({ full_name: str(f.nome), email, role: str(f.nu_role) || 'operador_campo' });
        if (r.member_id) { await setColaboradorMember(id, r.member_id); linked = r.member_id; }
        if (r.temp_password) setSenha(r.temp_password);
        msg = 'Colaborador salvo e usuário criado.';
      } else if (vinc && vinc !== 'none') {
        await setColaboradorMember(id, vinc); linked = vinc;
      } else if (linked) {
        await setColaboradorMember(id, null); linked = null;
      }
      await setColaboradorEquipamentos(member.tenant_id, id, [...equipSel]);
      await qc.invalidateQueries({ queryKey: ['colaboradores'] });
      await qc.invalidateQueries({ queryKey: ['colaboradores-ref'] });
      await qc.invalidateQueries({ queryKey: ['members-link'] });
      await qc.invalidateQueries({ queryKey: ['lab-members'] });
      await qc.invalidateQueries({ queryKey: ['colab-equip', id] });
      await qc.invalidateQueries({ queryKey: ['minhas-prensas'] });
      setEditId(id); setF((s) => ({ ...s, vinc: linked ?? 'none', nu_email: '' })); toast(msg, 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function adicionarCert() {
    if (!member || !editId) return;
    setBusyCert(true);
    try {
      if (!str(cf.tipo)) throw new Error('Selecione o tipo da certificacao.');
      let anexoPath: string | undefined;
      if (certFile) anexoPath = await uploadCertAnexo(member.tenant_id, editId, certFile);
      await addCert(member.tenant_id, editId, { tipo: str(cf.tipo), numero: str(cf.numero) || undefined, validade: str(cf.validade) || undefined, anexoPath });
      await qc.invalidateQueries({ queryKey: ['colaboradores'] });
      setCf({}); setCertFile(null); setFileKey((k) => k + 1); toast('Certificação adicionada.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusyCert(false); }
  }
  async function removerCert(id: string) {
    try { await softDeleteCert(id); await qc.invalidateQueries({ queryKey: ['colaboradores'] }); } catch (e) { toast((e as Error).message, 'error'); }
  }
  function abrirAnexo(path: string) {
    const tab = openDeferredTab('Abrindo anexo…');
    signedCertAnexo(path).then((u) => tab.set(u)).catch((e) => { tab.fail(); toast((e as Error).message, 'error'); });
  }
  async function excluir(c: ColaboradorRow) {
    const uso = await contarUsoColaborador(c.id);
    const emUso = !!uso && (uso.concretagens > 0 || uso.rompimentos > 0);
    const message = emUso
      ? c.nome + ' aparece em ' + (uso?.concretagens ?? 0) + ' concretagem(ns) e ' + (uso?.rompimentos ?? 0) + ' rompimento(s). O nome permanece nesses registros; prefira Inativar para manter o historico limpo. Excluir mesmo assim?'
      : 'Excluir ' + c.nome + '?';
    if (!(await confirm({ title: 'Excluir colaborador', message, danger: true, confirmLabel: 'Excluir' }))) return;
    try { await softDeleteColaborador(c.id); await qc.invalidateQueries({ queryKey: ['colaboradores'] }); await qc.invalidateQueries({ queryKey: ['colaboradores-ref'] }); toast('Excluido.', 'success'); } catch (e) { toast((e as Error).message, 'error'); }
  }

  const columns: Array<Column<ColaboradorRow>> = [
    { key: 'nome', header: 'Nome', sortable: true, render: (c) => <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, color: 'var(--ink)' }}>{c.nome}</div>{c.registro_profissional ? <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{c.registro_profissional}</div> : null}</div> },
    { key: 'funcoes', header: 'Funções', render: (c) => c.funcoes.length === 0 ? <span style={{ color: 'var(--ink-faint)' }}>—</span> : <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{c.funcoes.map((fn) => <span key={fn} style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', border: '1px solid var(--line)', borderRadius: 999, padding: '2px 8px' }}>{fn}</span>)}</span> },
    { key: 'certs', header: 'Certificações', render: (c) => c.certs.length === 0 ? <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>sem certificacoes</span> : <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{c.certs.map((ct) => { const s = certStatus(ct.validade); return <span key={ct.id} style={{ fontSize: 11, fontWeight: 700, color: s.cor, border: '1px solid var(--line)', borderRadius: 999, padding: '2px 8px' }}>{ct.tipo.split(' ')[0]} · {s.label}</span>; })}</span> },
    { key: 'situacao', header: 'Situação', sortable: true, render: (c) => <span style={{ fontSize: 12, fontWeight: 700, color: c.ativo ? 'var(--success)' : 'var(--ink-faint)' }}>{c.ativo ? 'Ativo' : 'Inativo'}</span> },
    { key: '__actions', header: '', render: (c) => <span style={{ display: 'inline-flex', gap: 6 }}><Button variant="ghost" onClick={() => editar(c)}>Editar</Button><Button variant="ghost" onClick={() => void excluir(c)}>Excluir</Button></span> },
  ];

  const funcoesForm = Array.isArray(f.funcoes) ? (f.funcoes as string[]) : [];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Cadastros" title="Colaboradores" description="Moldadores, laboratoristas e RT, com funções, situação e certificações." />
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 200 }}><Field label="Buscar" placeholder="Nome, CPF ou registro" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        <div style={{ flex: '0 1 180px' }}><SelectField label="Função" value={fFuncao} onChange={(e) => setFFuncao(e.target.value)}><option value="">Todas</option>{FUNCOES.map((fn) => <option key={fn} value={fn}>{fn}</option>)}</SelectField></div>
        <div style={{ flex: '0 1 200px' }}><SelectField label="Certificação" value={fCert} onChange={(e) => setFCert(e.target.value)}><option value="">Todas</option><option value="vencida">Com vencida</option><option value="vence30">Vence em 30 dias</option><option value="sem">Sem certificação</option></SelectField></div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={soAtivos} onChange={(e) => setSoAtivos(e.target.checked)} /> Só ativos</label>
        <div style={{ marginLeft: 'auto' }}><Button onClick={novo}>Novo colaborador</Button></div>
      </div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState />
        : vistos.length === 0 ? <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300">Nenhum colaborador para os filtros — ajuste a busca ou os filtros acima.</Card>
        : <DataTable rows={vistos} columns={columns} rowKey={(c) => c.id} sort={sort} onSort={setSort} />}

      <Drawer wide open={open} title={editId ? 'Editar colaborador' : 'Novo colaborador'} onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar dados'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Nome" required value={String(f.nome ?? '')} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} />
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <Field label="CPF" value={String(f.documento ?? '')} onChange={(e) => setF((s) => ({ ...s, documento: e.target.value }))} />
            <Field label="Registro (CREA/CRQ/TER)" value={String(f.registro_profissional ?? '')} onChange={(e) => setF((s) => ({ ...s, registro_profissional: e.target.value }))} />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Funções</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {FUNCOES.map((fn) => { const on = funcoesForm.includes(fn); return (
                <button key={fn} type="button" onClick={() => toggleFuncao(fn)} aria-pressed={on} style={{ fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '6px 12px', minHeight: 32, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--magenta)' : 'var(--line)'), background: on ? 'var(--magenta)' : 'transparent', color: on ? '#fff' : 'var(--ink-soft)' }}>{fn}</button>
              ); })}
            </div>
            <span className="mt-1 block text-xs text-slate-500">Filtram os seletores de moldador (programação/concretagem) e operador (rompimentos).</span>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={f.ativo !== false} onChange={(e) => setF((s) => ({ ...s, ativo: e.target.checked }))} /> Ativo</label>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <strong style={{ fontSize: 13, color: 'var(--ink)' }}>Usuário (login)</strong>
            <div style={{ marginTop: 8 }}>
              <SelectField label="Vincular a usuário" value={String(f.vinc ?? 'none')} onChange={(e) => setF((s) => ({ ...s, vinc: e.target.value }))}>
                <option value="none">— Sem usuário —</option>
                <option value="__new">+ Criar novo usuário para este colaborador</option>
                {(membersLink.data ?? []).filter((m) => m.colaborador_id === null || m.id === String(f.vinc)).map((m) => <option key={m.id} value={m.id}>{(m.full_name || m.email)} · {m.email}</option>)}
              </SelectField>
            </div>
            {String(f.vinc) === '__new' ? (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginTop: 8 }}>
                <Field label="E-mail do usuário" type="email" value={String(f.nu_email ?? '')} onChange={(e) => setF((s) => ({ ...s, nu_email: e.target.value }))} />
                <SelectField label="Papel" value={String(f.nu_role ?? 'operador_campo')} onChange={(e) => setF((s) => ({ ...s, nu_role: e.target.value }))}>
                  <option value="operador_campo">Operador de campo</option>
                  <option value="laboratorista">Laboratorista</option>
                  <option value="gestor_qualidade">Gestor / RT</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="admin">Admin</option>
                </SelectField>
              </div>
            ) : null}
            <span className="mt-1 block text-xs text-slate-500">Liga este colaborador a um login. Um usuário fica ligado a no máximo um colaborador.</span>
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <strong style={{ fontSize: 13, color: 'var(--ink)' }}>Equipamentos</strong>
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '6px 0 0' }}>Prensas e demais equipamentos deste colaborador. Com 1 prensa vinculada, ela vem travada no rompimento; com várias, ele escolhe só entre as dele.</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {(equipRefQ.data ?? []).filter((e) => e.ativo).map((e) => { const on = equipSel.has(e.id); const tipo = TIPOS_EQUIP.find((t) => t.value === e.tipo)?.label ?? e.tipo; return (
                <button key={e.id} type="button" onClick={() => toggleEquip(e.id)} aria-pressed={on} style={{ fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '6px 12px', minHeight: 32, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--magenta)' : 'var(--line)'), background: on ? 'var(--magenta)' : 'transparent', color: on ? '#fff' : 'var(--ink-soft)' }}>{tipo}: {rotuloEquip(e)}</button>
              ); })}
              {(equipRefQ.data ?? []).filter((e) => e.ativo).length === 0 ? <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Nenhum equipamento ativo cadastrado.</span> : null}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <strong style={{ fontSize: 13, color: 'var(--ink)' }}>Certificações</strong>
            {!editId ? <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '6px 0 0' }}>Salve os dados primeiro para adicionar certificacoes.</p> : (
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {(atual?.certs ?? []).map((ct) => { const s = certStatus(ct.validade); return (
                  <div key={ct.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--ink)' }}>{ct.tipo}{ct.numero ? ' · ' + ct.numero : ''} <span style={{ color: s.cor, fontWeight: 700 }}>({s.label}{ct.validade ? ' ' + ct.validade : ''})</span></span>
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      {ct.anexo_path ? <Button variant="ghost" onClick={() => abrirAnexo(ct.anexo_path as string)}>anexo</Button> : null}
                      <Button variant="ghost" onClick={() => void removerCert(ct.id)}>remover</Button>
                    </span>
                  </div>
                ); })}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <SelectField label="Tipo" required value={String(cf.tipo ?? '')} onChange={(e) => setCf((s) => ({ ...s, tipo: e.target.value }))}><option value="">-</option>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</SelectField>
                  <Field label="Número" value={String(cf.numero ?? '')} onChange={(e) => setCf((s) => ({ ...s, numero: e.target.value }))} />
                  <Field label="Validade" type="date" value={String(cf.validade ?? '')} onChange={(e) => setCf((s) => ({ ...s, validade: e.target.value }))} />
                  <div className="block min-w-0 space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Anexo (PDF/scan)</span><FilePicker key={fileKey} accept="application/pdf,image/*" onFiles={(fs) => setCertFile(fs[0] ?? null)} /></div>
                  <Button variant="secondary" onClick={() => void adicionarCert()} disabled={busyCert}>{busyCert ? 'Enviando...' : 'Adicionar'}</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Drawer>
      <Modal open={!!senha} title="Senha provisória" onClose={() => setSenha(null)} footer={<Button onClick={() => setSenha(null)}>Fechar</Button>}>
        <p className="m-0 text-sm">Anote e repasse com segurança — não será exibida de novo:</p>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900">{senha}</div>
      </Modal>
    </div>
  );
}
