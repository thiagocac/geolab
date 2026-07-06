import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { DataTable } from '../../components/ui/DataTable';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { openDeferredTab } from '../../lib/pdf';
import type { Column, SortState } from '../../lib/api/types';
import { FUNCOES, addCert, contarUsoColaborador, listColaboradores, saveColaborador, signedCertAnexo, softDeleteCert, softDeleteColaborador, uploadCertAnexo, type ColaboradorRow } from '../../lib/api/colaboradores';

const TIPOS = ['NBR 15146-1 (Moldagem)', 'NBR 15146-2 (Rompimento)', 'CREA', 'CRQ', 'TER', 'Outro'];
const str = (v: unknown) => String(v ?? '').trim();
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function certStatus(validade: string | null): { label: string; cor: string } {
  if (!validade) return { label: 'sem validade', cor: 'var(--ink-faint)' };
  const hoje = ymd(Date.now()), in30 = ymd(Date.now() + 30 * 86400000);
  if (validade < hoje) return { label: 'vencida', cor: 'var(--magenta)' };
  if (validade <= in30) return { label: 'vence em breve', cor: '#d97706' };
  return { label: 'valida', cor: '#16a34a' };
}
const temVencida = (c: ColaboradorRow) => c.certs.some((ct) => ct.validade !== null && ct.validade < ymd(Date.now()));

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
  useEffect(() => { const c = sp.get('cert'); if (c === 'vencida') setFCert(c); }, [sp]);
  const [soAtivos, setSoAtivos] = useState(true);
  const [sort, setSort] = useState<SortState>({ column: 'nome', direction: 'asc' });

  const q = useQuery({ queryKey: ['colaboradores'], queryFn: listColaboradores });
  const atual = editId ? (q.data ?? []).find((c) => c.id === editId) : null;

  const rows = q.data ?? [];
  const vistos = useMemo(() => {
    const b = norm(busca.trim());
    let out = rows.filter((c) => {
      if (soAtivos && !c.ativo) return false;
      if (fFuncao && !c.funcoes.some((fn) => norm(fn) === norm(fFuncao))) return false;
      if (fCert === 'vencida' && !temVencida(c)) return false;
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

  function novo() { setEditId(null); setF({ ativo: true, funcoes: [] as string[] }); setCf({}); setCertFile(null); setOpen(true); }
  function editar(c: ColaboradorRow) { setEditId(c.id); setF({ nome: c.nome, documento: c.documento ?? '', registro_profissional: c.registro_profissional ?? '', funcoes: [...c.funcoes], ativo: c.ativo }); setCf({}); setCertFile(null); setOpen(true); }
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
      await qc.invalidateQueries({ queryKey: ['colaboradores'] });
      await qc.invalidateQueries({ queryKey: ['colaboradores-ref'] });
      setEditId(id); toast('Colaborador salvo.', 'success');
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
      setCf({}); setCertFile(null); setFileKey((k) => k + 1); toast('Certificacao adicionada.', 'success');
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
    { key: 'situacao', header: 'Situação', sortable: true, render: (c) => <span style={{ fontSize: 12, fontWeight: 700, color: c.ativo ? '#16a34a' : 'var(--ink-faint)' }}>{c.ativo ? 'Ativo' : 'Inativo'}</span> },
    { key: '__actions', header: '', render: (c) => <span style={{ display: 'inline-flex', gap: 6 }}><Button variant="ghost" onClick={() => editar(c)}>Editar</Button><Button variant="ghost" onClick={() => void excluir(c)}>Excluir</Button></span> },
  ];

  const funcoesForm = Array.isArray(f.funcoes) ? (f.funcoes as string[]) : [];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Cadastros" title="Colaboradores" description="Moldadores, laboratoristas e RT, com funções, situação e certificações." />
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 200 }}><Field label="Buscar" placeholder="Nome, CPF ou registro" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        <div style={{ flex: '0 1 180px' }}><SelectField label="Função" value={fFuncao} onChange={(e) => setFFuncao(e.target.value)}><option value="">Todas</option>{FUNCOES.map((fn) => <option key={fn} value={fn}>{fn}</option>)}</SelectField></div>
        <div style={{ flex: '0 1 200px' }}><SelectField label="Certificação" value={fCert} onChange={(e) => setFCert(e.target.value)}><option value="">Todas</option><option value="vencida">Com vencida</option><option value="sem">Sem certificação</option></SelectField></div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={soAtivos} onChange={(e) => setSoAtivos(e.target.checked)} /> Só ativos</label>
        <div style={{ marginLeft: 'auto' }}><Button onClick={novo}>Novo colaborador</Button></div>
      </div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState />
        : vistos.length === 0 ? <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300">Nenhum colaborador para os filtros — ajuste a busca ou os filtros acima.</Card>
        : <DataTable rows={vistos} columns={columns} rowKey={(c) => c.id} sort={sort} onSort={setSort} />}

      <Drawer wide open={open} title={editId ? 'Editar colaborador' : 'Novo colaborador'} onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar dados'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Nome*" value={String(f.nome ?? '')} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} />
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
            <strong style={{ fontSize: 13, color: 'var(--ink)' }}>Certificacoes</strong>
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
                  <SelectField label="Tipo" value={String(cf.tipo ?? '')} onChange={(e) => setCf((s) => ({ ...s, tipo: e.target.value }))}><option value="">-</option>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</SelectField>
                  <Field label="Numero" value={String(cf.numero ?? '')} onChange={(e) => setCf((s) => ({ ...s, numero: e.target.value }))} />
                  <Field label="Validade" type="date" value={String(cf.validade ?? '')} onChange={(e) => setCf((s) => ({ ...s, validade: e.target.value }))} />
                  <label className="block min-w-0 space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Anexo (PDF/scan)</span><input key={fileKey} type="file" className="input" accept="application/pdf,image/*" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} /></label>
                  <Button variant="secondary" onClick={() => void adicionarCert()} disabled={busyCert}>{busyCert ? 'Enviando...' : 'Adicionar'}</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
}
