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
import { DataTable } from '../../components/ui/DataTable';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { openDeferredTab } from '../../lib/pdf';
import { listObrasRef } from '../../lib/api/operacao';
import type { Column, SortState } from '../../lib/api/types';
import { TIPOS_EQUIP, addVerificacao, contarUsoEquipamento, getEquipamentoObras, listEquipamentos, listVerificacoes, rotuloEquip, saveEquipamento, setEquipamentoObras, signedCertEquipAnexo, softDeleteEquipamento, softDeleteVerificacao, uploadCertEquipAnexo, verifStatus, type EquipamentoRow, type VerificacaoRow } from '../../lib/api/equipamentos';

const str = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown) => { const s = str(v); if (!s) return null; const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : null; };
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const tipoLabel = (t: string) => TIPOS_EQUIP.find((x) => x.value === t)?.label ?? t;
function calibStatus(validade: string | null): { label: string; cor: string } {
  if (!validade) return { label: 'sem calibração', cor: 'var(--ink-faint)' };
  const hoje = ymd(Date.now()), in30 = ymd(Date.now() + 30 * 86400000);
  if (validade < hoje) return { label: 'vencida', cor: 'var(--magenta)' };
  if (validade <= in30) return { label: 'vence em breve', cor: 'var(--warning)' };
  return { label: 'em dia', cor: '#16a34a' };
}

export function EquipamentosPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, unknown>>({});
  const [certFile, setCertFile] = useState<File | null>(null);
  const [obrasAloc, setObrasAloc] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // Busca + filtros + ordenação (no cliente: a lista de um lab é pequena).
  const [busca, setBusca] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fCalib, setFCalib] = useState('');
  const [sp] = useSearchParams();
  useEffect(() => { const c = sp.get('cal'); if (c === 'vencida' || c === 'vence30') setFCalib(c); }, [sp]);
  const [soAtivos, setSoAtivos] = useState(true);
  const [sort, setSort] = useState<SortState>({ column: 'nome', direction: 'asc' });

  const q = useQuery({ queryKey: ['equipamentos'], queryFn: listEquipamentos });
  const obrasQ = useQuery({ queryKey: ['ref', 'obras', 'equip'], queryFn: listObrasRef });
  const atual = editId ? (q.data ?? []).find((e) => e.id === editId) : null;
  const isPrensa = String(f.tipo ?? '') === 'prensa';
  const alocQ = useQuery({ queryKey: ['equip-obras', editId], queryFn: () => getEquipamentoObras(editId as string), enabled: !!editId && isPrensa });
  useEffect(() => { if (alocQ.data) setObrasAloc(new Set(alocQ.data)); }, [alocQ.data]);
  // B2 — verificação intermediária da prensa (só prensa).
  const verifQ = useQuery({ queryKey: ['equip-verif', editId], queryFn: () => listVerificacoes(editId as string), enabled: !!editId && isPrensa });
  const [vf, setVf] = useState<Record<string, unknown>>({});
  const [vBusy, setVBusy] = useState(false);
  const rows = q.data ?? [];

  const vistos = useMemo(() => {
    const b = norm(busca.trim());
    let out = rows.filter((e) => {
      if (soAtivos && !e.ativo) return false;
      if (fTipo && e.tipo !== fTipo) return false;
      if (fCalib === 'vencida' && !(e.validade_calibracao && e.validade_calibracao < ymd(Date.now()))) return false;
      if (fCalib === 'vence30' && !(e.validade_calibracao && e.validade_calibracao >= ymd(Date.now()) && e.validade_calibracao <= ymd(Date.now() + 30 * 86400000))) return false;
      if (b && !(norm(rotuloEquip(e)).includes(b) || norm(e.numero_serie ?? '').includes(b) || norm(e.numero_certificado ?? '').includes(b))) return false;
      return true;
    });
    const dir = sort.direction === 'asc' ? 1 : -1;
    out = [...out].sort((a, z) => {
      if (sort.column === 'validade') return String(a.validade_calibracao ?? '9999').localeCompare(String(z.validade_calibracao ?? '9999')) * dir || rotuloEquip(a).localeCompare(rotuloEquip(z), 'pt-BR');
      if (sort.column === 'tipo') return a.tipo.localeCompare(z.tipo) * dir || rotuloEquip(a).localeCompare(rotuloEquip(z), 'pt-BR');
      return rotuloEquip(a).localeCompare(rotuloEquip(z), 'pt-BR') * dir;
    });
    return out;
  }, [rows, busca, fTipo, fCalib, soAtivos, sort]);

  function novo() { setEditId(null); setF({ tipo: 'prensa', ativo: true }); setCertFile(null); setObrasAloc(new Set()); setVf({}); setOpen(true); }
  function editar(e: EquipamentoRow) {
    setEditId(e.id);
    setF({ tipo: e.tipo, apelido: e.apelido ?? '', marca_modelo: e.marca_modelo ?? '', numero_serie: e.numero_serie ?? '', capacidade_kn: e.capacidade_kn ?? '', classe: e.classe ?? '', numero_certificado: e.numero_certificado ?? '', data_calibracao: e.data_calibracao ?? '', validade_calibracao: e.validade_calibracao ?? '', lab_calibrador: e.lab_calibrador ?? '', incerteza_mpa: e.incerteza_mpa ?? '', verif_periodicidade_dias: e.verif_periodicidade_dias ?? '', observacao: e.observacao ?? '', ativo: e.ativo });
    setCertFile(null); setObrasAloc(new Set()); setVf({}); setOpen(true);
  }

  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      if (!str(f.tipo)) throw new Error('Selecione o tipo do equipamento.');
      const values: Record<string, unknown> = {
        tipo: str(f.tipo), apelido: str(f.apelido) || null, marca_modelo: str(f.marca_modelo) || null, numero_serie: str(f.numero_serie) || null,
        capacidade_kn: num(f.capacidade_kn), classe: str(f.classe) || null, numero_certificado: str(f.numero_certificado) || null,
        data_calibracao: str(f.data_calibracao) || null, validade_calibracao: str(f.validade_calibracao) || null, lab_calibrador: str(f.lab_calibrador) || null,
        incerteza_mpa: num(f.incerteza_mpa), verif_periodicidade_dias: num(f.verif_periodicidade_dias), observacao: str(f.observacao) || null, ativo: f.ativo !== false,
      };
      // 1) grava o equipamento (id resolvido). Anexo novo: no cadastro novo re-sobe com o id real.
      let id: string;
      if (editId) {
        if (certFile) values.anexo_certificado_path = await uploadCertEquipAnexo(member.tenant_id, editId, certFile);
        id = await saveEquipamento(member.tenant_id, editId, values);
      } else {
        id = await saveEquipamento(member.tenant_id, null, { ...values, anexo_certificado_path: null });
        if (certFile) { const p = await uploadCertEquipAnexo(member.tenant_id, id, certFile); await saveEquipamento(member.tenant_id, id, { anexo_certificado_path: p }); }
      }
      // 2) alocação de obras — só para prensas (para os demais tipos não faz sentido).
      if (str(f.tipo) === 'prensa') await setEquipamentoObras(id, [...obrasAloc]);
      await qc.invalidateQueries({ queryKey: ['equipamentos'] });
      await qc.invalidateQueries({ queryKey: ['equipamentos-ref'] });
      await qc.invalidateQueries({ queryKey: ['equip-obras'] });
      await qc.invalidateQueries({ queryKey: ['alocacao-obras'] });
      setEditId(id); setCertFile(null); toast('Equipamento salvo.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  function toggleObra(id: string) { setObrasAloc((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function abrirAnexo(path: string) {
    const tab = openDeferredTab('Abrindo certificado…');
    signedCertEquipAnexo(path).then((u) => tab.set(u)).catch((e) => { tab.fail(); toast((e as Error).message, 'error'); });
  }
  async function excluir(e: EquipamentoRow) {
    const uso = await contarUsoEquipamento(e.id);
    const emUso = !!uso && uso.rompimentos > 0;
    const rot = rotuloEquip(e);
    const message = emUso
      ? rot + ' aparece em ' + (uso?.rompimentos ?? 0) + ' rompimento(s). O vínculo permanece nesses registros (e no laudo); prefira Inativar para manter o histórico. Excluir mesmo assim?'
      : 'Excluir ' + rot + '?';
    if (!(await confirm({ title: 'Excluir equipamento', message, danger: true, confirmLabel: 'Excluir' }))) return;
    try { await softDeleteEquipamento(e.id); await qc.invalidateQueries({ queryKey: ['equipamentos'] }); await qc.invalidateQueries({ queryKey: ['equipamentos-ref'] }); toast('Excluido.', 'success'); } catch (err) { toast((err as Error).message, 'error'); }
  }
  async function addVerif() {
    if (!member || !editId) return;
    const data = str(vf.data_verificacao); if (!data) { toast('Informe a data da verificação.', 'error'); return; }
    setVBusy(true);
    try {
      await addVerificacao(member.tenant_id, editId, { data_verificacao: data, padrao_utilizado: str(vf.padrao_utilizado) || null, desvio_pct: num(vf.desvio_pct), conforme: vf.conforme !== false, responsavel: str(vf.responsavel) || null, observacao: str(vf.observacao) || null });
      setVf({}); await qc.invalidateQueries({ queryKey: ['equip-verif', editId] });
      toast('Verificação registrada.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setVBusy(false); }
  }
  async function excluirVerif(id: string) {
    if (!(await confirm({ title: 'Excluir verificação', message: 'Excluir este registro de verificação?', danger: true, confirmLabel: 'Excluir' }))) return;
    try { await softDeleteVerificacao(id); await qc.invalidateQueries({ queryKey: ['equip-verif', editId] }); toast('Excluído.', 'success'); } catch (e) { toast((e as Error).message, 'error'); }
  }

  const columns: Array<Column<EquipamentoRow>> = [
    { key: 'nome', header: 'Equipamento', sortable: true, render: (e) => <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, color: 'var(--ink)' }}>{rotuloEquip(e)}</div><div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{[e.apelido ? e.marca_modelo : null, e.numero_serie ? 'sér. ' + e.numero_serie : null].filter(Boolean).join(' · ') || '—'}</div></div> },
    { key: 'tipo', header: 'Tipo', sortable: true, render: (e) => <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', border: '1px solid var(--line)', borderRadius: 999, padding: '2px 8px' }}>{tipoLabel(e.tipo)}</span> },
    { key: 'validade', header: 'Calibração', sortable: true, render: (e) => { const s = calibStatus(e.validade_calibracao); return <span style={{ fontSize: 12, fontWeight: 700, color: s.cor }}>{s.label}{e.validade_calibracao ? ' · ' + e.validade_calibracao : ''}</span>; } },
    { key: 'situacao', header: 'Situação', render: (e) => <span style={{ fontSize: 12, fontWeight: 700, color: e.ativo ? 'var(--success)' : 'var(--ink-faint)' }}>{e.ativo ? 'Ativo' : 'Inativo'}</span> },
    { key: '__actions', header: '', render: (e) => <span style={{ display: 'inline-flex', gap: 6 }}>{e.anexo_certificado_path ? <Button variant="ghost" onClick={() => abrirAnexo(e.anexo_certificado_path as string)}>certificado</Button> : null}<Button variant="ghost" onClick={() => editar(e)}>Editar</Button><Button variant="ghost" onClick={() => void excluir(e)}>Excluir</Button></span> },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Cadastros" title="Equipamentos" description="Prensas, balanças e demais equipamentos, com calibração, apelido e certificado." />
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 200 }}><Field label="Buscar" placeholder="Apelido, marca, série ou certificado" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        <div style={{ flex: '0 1 170px' }}><SelectField label="Tipo" value={fTipo} onChange={(e) => setFTipo(e.target.value)}><option value="">Todos</option>{TIPOS_EQUIP.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</SelectField></div>
        <div style={{ flex: '0 1 200px' }}><SelectField label="Calibração" value={fCalib} onChange={(e) => setFCalib(e.target.value)}><option value="">Todas</option><option value="vencida">Vencida</option><option value="vence30">Vence em 30 dias</option></SelectField></div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={soAtivos} onChange={(e) => setSoAtivos(e.target.checked)} /> Só ativos</label>
        <div style={{ marginLeft: 'auto' }}><Button onClick={novo}>Novo equipamento</Button></div>
      </div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState />
        : vistos.length === 0 ? <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300">Nenhum equipamento para os filtros — ajuste a busca ou os filtros acima.</Card>
        : <DataTable rows={vistos} columns={columns} rowKey={(e) => e.id} sort={sort} onSort={setSort} />}

      <Drawer wide open={open} title={editId ? 'Editar equipamento' : 'Novo equipamento'} onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <SelectField label="Tipo" required value={String(f.tipo ?? 'prensa')} onChange={(e) => setF((s) => ({ ...s, tipo: e.target.value }))}>{TIPOS_EQUIP.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</SelectField>
            <Field label="Apelido" hint="Ex.: Prensa 1 (distingue prensas idênticas)" value={String(f.apelido ?? '')} onChange={(e) => setF((s) => ({ ...s, apelido: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <Field label="Marca / modelo" value={String(f.marca_modelo ?? '')} onChange={(e) => setF((s) => ({ ...s, marca_modelo: e.target.value }))} />
            <Field label="Nº de série" value={String(f.numero_serie ?? '')} onChange={(e) => setF((s) => ({ ...s, numero_serie: e.target.value }))} />
            <Field label="Capacidade (kN)" type="number" value={String(f.capacidade_kn ?? '')} onChange={(e) => setF((s) => ({ ...s, capacidade_kn: e.target.value }))} />
            <Field label="Classe" value={String(f.classe ?? '')} onChange={(e) => setF((s) => ({ ...s, classe: e.target.value }))} />
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <strong style={{ fontSize: 13, color: 'var(--ink)' }}>Calibração</strong>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginTop: 8 }}>
              <Field label="Nº do certificado" value={String(f.numero_certificado ?? '')} onChange={(e) => setF((s) => ({ ...s, numero_certificado: e.target.value }))} />
              <Field label="Data da calibração" type="date" value={String(f.data_calibracao ?? '')} onChange={(e) => setF((s) => ({ ...s, data_calibracao: e.target.value }))} />
              <Field label="Válido até" type="date" value={String(f.validade_calibracao ?? '')} onChange={(e) => setF((s) => ({ ...s, validade_calibracao: e.target.value }))} />
              <Field label="Lab. calibrador" value={String(f.lab_calibrador ?? '')} onChange={(e) => setF((s) => ({ ...s, lab_calibrador: e.target.value }))} />
              <Field label="Incerteza (MPa)" type="number" value={String(f.incerteza_mpa ?? '')} onChange={(e) => setF((s) => ({ ...s, incerteza_mpa: e.target.value }))} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="block min-w-0 space-y-1"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Certificado (PDF/scan)</span><FilePicker accept="application/pdf,image/*" onFiles={(fs) => setCertFile(fs[0] ?? null)} /></div>
              {atual?.anexo_certificado_path && !certFile ? <button type="button" className="mt-1 text-xs font-bold" style={{ color: 'var(--magenta)' }} onClick={() => abrirAnexo(atual.anexo_certificado_path as string)}>ver certificado atual</button> : null}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={f.ativo !== false} onChange={(e) => setF((s) => ({ ...s, ativo: e.target.checked }))} /> Ativo</label>
          {isPrensa ? (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <strong style={{ fontSize: 13, color: 'var(--ink)' }}>Obras alocadas</strong>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '4px 0 8px' }}>Define a prensa prevista na agenda de rompimentos de cada obra. Não trava o lançamento — é sugestão e eixo de agenda.</p>
              {!editId ? <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Salve a prensa primeiro para alocar obras.</p>
                : alocQ.isLoading ? <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Carregando…</p>
                : (obrasQ.data ?? []).length === 0 ? <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Nenhuma obra cadastrada.</p>
                : <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {(obrasQ.data ?? []).map((o) => (
                      <label key={o.value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={obrasAloc.has(o.value)} onChange={() => toggleObra(o.value)} /> {o.label}</label>
                    ))}
                  </div>}
            </div>
          ) : null}
          {isPrensa ? (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <strong style={{ fontSize: 13, color: 'var(--ink)' }}>Verificação intermediária</strong>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '4px 0 8px' }}>Verificação periódica entre calibrações (anel/padrão). Vencida gera pendência — não bloqueia o ensaio. Deixe a periodicidade vazia para não controlar.</p>
              <div style={{ maxWidth: 260 }}><Field label="Periodicidade (dias)" type="number" hint="Vazio = sem controle de verificação." value={String(f.verif_periodicidade_dias ?? '')} onChange={(e) => setF((s) => ({ ...s, verif_periodicidade_dias: e.target.value }))} /></div>
              {!editId ? <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 8 }}>Salve a prensa primeiro para registrar verificações.</p> : (
                <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                  {(() => { const st = verifStatus(num(f.verif_periodicidade_dias), verifQ.data?.[0]?.data_verificacao ?? null); return <span style={{ fontSize: 12, fontWeight: 700, color: st.cor }}>Status: {st.label}{st.proxima ? ' · próxima até ' + st.proxima.split('-').reverse().join('/') : ''}</span>; })()}
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', alignItems: 'end' }}>
                    <Field label="Data" required type="date" value={String(vf.data_verificacao ?? '')} onChange={(e) => setVf((s) => ({ ...s, data_verificacao: e.target.value }))} />
                    <Field label="Padrão usado" value={String(vf.padrao_utilizado ?? '')} onChange={(e) => setVf((s) => ({ ...s, padrao_utilizado: e.target.value }))} />
                    <Field label="Desvio (%)" type="number" value={String(vf.desvio_pct ?? '')} onChange={(e) => setVf((s) => ({ ...s, desvio_pct: e.target.value }))} />
                    <Field label="Responsável" value={String(vf.responsavel ?? '')} onChange={(e) => setVf((s) => ({ ...s, responsavel: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={vf.conforme !== false} onChange={(e) => setVf((s) => ({ ...s, conforme: e.target.checked }))} /> Conforme</label>
                  <div><Button variant="secondary" disabled={vBusy} onClick={() => void addVerif()}>{vBusy ? 'Salvando...' : 'Registrar verificação'}</Button></div>
                  {verifQ.isLoading ? <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Carregando…</p> : (verifQ.data ?? []).length === 0 ? <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Nenhuma verificação registrada.</p> : (
                    <div style={{ display: 'grid', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                      {(verifQ.data ?? []).map((v: VerificacaoRow) => (
                        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                          <span><b>{v.data_verificacao.split('-').reverse().join('/')}</b>{v.desvio_pct != null ? ' · desvio ' + v.desvio_pct + '%' : ''}{v.padrao_utilizado ? ' · ' + v.padrao_utilizado : ''} · <span style={{ fontWeight: 700, color: v.conforme ? '#16a34a' : 'var(--magenta)' }}>{v.conforme ? 'conforme' : 'não conforme'}</span></span>
                          <button type="button" className="text-xs font-bold" style={{ color: 'var(--magenta)' }} onClick={() => void excluirVerif(v.id)}>excluir</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
          <Field label="Observação" value={String(f.observacao ?? '')} onChange={(e) => setF((s) => ({ ...s, observacao: e.target.value }))} />
        </div>
      </Drawer>
    </div>
  );
}
