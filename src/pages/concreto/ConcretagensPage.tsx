import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { NumField } from '../../components/ui/NumField';
import { Stat } from '../../components/ui/Stat';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField } from '../../components/ui/Field';
import { Tooltip } from '../../components/ui/Tooltip';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { VirtualTable } from '../../components/ui/VirtualTable';
import { Users, Mold } from '../../components/ui/icons';
import { EquipeModal, FormasModal } from '../../components/domain/ConcretagemOpsModals';
import { recordStatusMeta, origemLabel } from '../../lib/status';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { listConcretagensCentral, createConcretagem, invokeFicha, listTracosComFck, invokeFichaBranco, getConcretagem, updateConcretagem, type ConcretagemCentralRow, type ConcretagemRow } from '../../lib/api/concretagem';
import { TracoOptions } from '../../components/TracoOptions';
import { listPecasObra } from '../../lib/api/estrutura';
import { listReference } from '../../lib/api/client';
import { FornecedorDatalist, FORNECEDORES_DL } from '../../components/domain/FornecedorDatalist';

import { saveBlob as dl } from '../../lib/pdf';

// Status TÉCNICO (computado no RPC a partir de caminhões/CPs/laudos) — elemento principal
// da coluna Status; o status operacional (Confirmada/Aguardando confirmação) vira subtexto.
const TEC: Record<string, { l: string; bg: string; fg: string }> = {
  programado: { l: 'Programado', bg: '#e2e8f0', fg: '#475569' },
  moldado: { l: 'Moldado', bg: '#dbeafe', fg: '#1d4ed8' },
  em_andamento: { l: 'Em andamento', bg: '#fef3c7', fg: '#b45309' },
  atrasado: { l: 'Atrasado', bg: '#fee2e2', fg: '#b91c1c' },
  rompido: { l: 'Rompido', bg: '#e0e7ff', fg: '#4338ca' },
  laudado: { l: 'Laudado', bg: '#dcfce7', fg: '#15803d' },
};
function TecChip({ s }: { s: string }) {
  const t = TEC[s] ?? { l: s || '-', bg: '#e2e8f0', fg: '#475569' };
  return <span style={{ background: t.bg, color: t.fg, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{t.l}</span>;
}

// ISO (aaaa-mm-dd) → dd/mm/aaaa (exibição no grid).
function dmy(d?: string | null): string {
  if (!d) return '-';
  const [y, m, dd] = d.split('-');
  return y && m && dd ? dd + '/' + m + '/' + y : d;
}
function fmtVol(n: number | null): string | null {
  return n == null ? null : String(Math.round(n * 10) / 10).replace('.', ',');
}
function numericValue(value: unknown): number | string | null {
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

export function ConcretagensPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const confirm = useConfirm();

  // M5: provisão de fôrmas difere dos CPs vivos — ajuste de 1 clique (a trigger re-sincroniza o ledger).
  async function usarCpsComoFormas(id: string, n: number) {
    if (!(await confirm({ title: 'Ajustar fôrmas', message: 'Usar o nº de CPs moldados (' + n + ') como fôrmas desta concretagem? A entrega automática no controle de fôrmas é atualizada.', confirmLabel: 'Ajustar' }))) return;
    try {
      await updateConcretagem(id, { formas_previstas: n });
      await qc.invalidateQueries({ queryKey: ['concretagens'] });
      toast('Fôrmas ajustadas para ' + n + '.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const init = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const [busca, setBusca] = useState(() => init.get('q') ?? '');
  const [buscaQ, setBuscaQ] = useState(() => init.get('q') ?? '');
  const [clienteFiltro, setClienteFiltro] = useState(() => init.get('cli') ?? '');
  const [obraFiltro, setObraFiltro] = useState(() => init.get('obra') ?? '');
  const [page, setPage] = useState(0);
  const [statusFiltro, setStatusFiltro] = useState(() => init.get('st') ?? '');
  const [spC, setSpC] = useSearchParams();
  // biome-ignore lint/correctness/useExhaustiveDependencies: seed único no mount
  useEffect(() => {
    const fl = spC.get('filtro');
    if (fl === 'sem_caminhao') { setStatusFiltro('programado'); spC.delete('filtro'); setSpC(spC, { replace: true }); }
  }, []);
  const [dataDe, setDataDe] = useState(() => init.get('de') ?? '');
  const [dataAte, setDataAte] = useState(() => init.get('ate') ?? '');
  useEffect(() => {
    const next = new URLSearchParams();
    if (buscaQ) next.set('q', buscaQ);
    if (clienteFiltro) next.set('cli', clienteFiltro);
    if (obraFiltro) next.set('obra', obraFiltro);
    if (statusFiltro) next.set('st', statusFiltro);
    if (dataDe) next.set('de', dataDe);
    if (dataAte) next.set('ate', dataAte);
    if (next.toString() !== spC.toString()) setSpC(next, { replace: true });
  }, [buscaQ, clienteFiltro, obraFiltro, statusFiltro, dataDe, dataAte, spC, setSpC]);
  const PAGE = 25;
  useEffect(() => { const t = setTimeout(() => { setBuscaQ(busca.trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [busca]);

  const q = useQuery({ queryKey: ['concretagens', member?.tenant_id, clienteFiltro, obraFiltro, statusFiltro, dataDe, dataAte, buscaQ, page], queryFn: () => listConcretagensCentral({ tenantId: member?.tenant_id, clientId: clienteFiltro || undefined, workId: obraFiltro || undefined, status: statusFiltro || undefined, from: dataDe || undefined, to: dataAte || undefined, search: buscaQ || undefined, page, pageSize: PAGE }), placeholderData: keepPreviousData });
  const clientes = useQuery({ queryKey: ['ref', 'lab_clients'], queryFn: () => listReference('lab_clients', 'razao_social') });
  const worksFiltro = useQuery({ queryKey: ['ref', 'client_works', 'all'], queryFn: () => listReference('client_works', 'nome') });
  const obras = useQuery({ queryKey: ['ref', 'client_works', form.client_id], queryFn: () => listReference('client_works', 'nome', form.client_id ? { client_id: String(form.client_id) } : undefined), enabled: !!form.client_id });
  const tracos = useQuery({ queryKey: ['tracos-fck', form.work_id, form.client_id], queryFn: () => listTracosComFck(form.work_id ? String(form.work_id) : null, form.client_id ? String(form.client_id) : null) });
  const pecas = useQuery({ queryKey: ['pecas-conc', form.work_id], queryFn: () => listPecasObra(String(form.work_id)), enabled: !!form.work_id });

  // Modais compartilhados com a Programação (v220): a central recebe a linha completa sob demanda.
  const [equipeRow, setEquipeRow] = useState<ConcretagemRow | null>(null);
  const [formasRow, setFormasRow] = useState<ConcretagemRow | null>(null);
  const [opBusy, setOpBusy] = useState(false);
  async function abrirOp(id: string, kind: 'equipe' | 'formas') {
    if (opBusy) return;
    setOpBusy(true);
    try {
      const full = await getConcretagem(id);
      if (!full) throw new Error('Concretagem não encontrada.');
      if (kind === 'equipe') setEquipeRow(full); else setFormasRow(full);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setOpBusy(false); }
  }

  async function salvar() {
    if (!member) return;
    setBusy(true);
    try {
      if (!form.client_id || !form.work_id) throw new Error('Cliente e obra são obrigatórios.');
      await createConcretagem(member.tenant_id, form);
      await qc.invalidateQueries({ queryKey: ['concretagens'] });
      toast('Concretagem criada.', 'success'); setOpen(false); setForm({});
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function ficha(id: string) { try { dl(await invokeFicha(id), 'ficha-moldagem.pdf'); } catch (e) { toast((e as Error).message, 'error'); } }
  async function fichaBranco() { try { dl(await invokeFichaBranco(), 'ficha-moldagem-em-branco.pdf'); } catch (e) { toast((e as Error).message, 'error'); } }

  const rows: ConcretagemCentralRow[] = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const kpis = q.data?.kpis ?? null;
  const pageCount = Math.max(1, Math.ceil(total / PAGE));

  const columns: ColumnDef<ConcretagemCentralRow, unknown>[] = [
    { id: 'abrir', header: '', enableSorting: false, size: 156, cell: ({ row }) => (
      <div className="flex flex-nowrap items-center gap-1">
        <Button variant="ghost" className="!min-h-9 !px-3 text-[13px]" onClick={() => nav('/concretagens/' + row.original.id, { viewTransition: true })}>Abrir</Button>
        <Button variant="secondary" className="!min-h-9 !px-3 text-[13px]" onClick={() => void ficha(row.original.id)}>Ficha</Button>
      </div>
    ) },
    { id: 'relatorio', header: 'Nº relatório', accessorFn: (r) => r.numero_relatorio ?? '', size: 130, cell: ({ row }) => <div><span className="font-bold">{row.original.numero_relatorio ?? '-'}</span><div className="text-[11px] text-slate-400">{row.original.codigo ?? ''}</div></div> },
    { id: 'status', header: 'Status', accessorFn: (r) => r.status_tecnico, size: 150, cell: ({ row }) => <div><TecChip s={row.original.status_tecnico} /><div className="mt-1 text-[11px] text-slate-400">{recordStatusMeta(row.original.status, 'concretagem').label} · {origemLabel(row.original.origem)}</div></div> },
    { id: 'data', header: 'Data/hora', accessorFn: (r) => r.data_programada ?? r.data_real ?? '', size: 108, cell: ({ row }) => <div><div className="font-bold tabular-nums">{dmy(row.original.data_programada ?? row.original.data_real)}</div><div className="text-xs text-slate-500">{row.original.hora ?? '-'}</div></div> },
    { id: 'cliente', header: 'Cliente / obra', accessorFn: (r) => r.cliente ?? '', size: 200, cell: ({ row }) => <div className="min-w-0"><b className="block truncate">{row.original.cliente ?? '-'}</b><div className="truncate text-xs text-slate-500">{row.original.obra ?? '-'}</div></div> },
    { id: 'local', header: 'Local / peça', accessorFn: (r) => r.local_texto ?? '', size: 130, cell: ({ row }) => <span className="text-sm">{row.original.local_texto ?? '-'}</span> },
    { id: 'traco', header: 'Traço', accessorFn: (r) => r.traco_nome ?? '', size: 160, cell: ({ row }) => <div className="min-w-0 text-sm"><span className="block truncate">{row.original.traco_nome ?? '-'}</span><div className="text-xs text-slate-500">FCK {row.original.fck_previsto ?? '-'} MPa</div></div> },
    { id: 'fornecedor', header: 'Fornecedor', accessorFn: (r) => r.fornecedor_texto ?? '', size: 130, cell: ({ row }) => <span className="text-sm">{row.original.fornecedor_texto ?? '-'}</span> },
    { id: 'volume', header: 'Volume', accessorFn: (r) => r.volume_lancado_m3 ?? r.volume_programado_m3 ?? 0, size: 110, cell: ({ row }) => {
      const r = row.original; const vl = fmtVol(r.volume_lancado_m3); const vp = fmtVol(r.volume_programado_m3);
      if (vl) return <div className="text-sm tabular-nums">{vl} m³<div className="text-xs text-slate-500">{vp ? 'de ' + vp + ' program.' : 'lançado'}</div></div>;
      if (vp) return <div className="text-sm tabular-nums">{vp} m³<div className="text-xs text-slate-500">programado</div></div>;
      return <span className="text-sm">-</span>;
    } },
    { id: 'cps', header: 'Caminhões / CPs', accessorFn: (r) => r.n_cps, size: 150, cell: ({ row }) => {
      const r = row.original;
      const partes = [r.n_cps_rompidos > 0 ? r.n_cps_rompidos + ' rompido(s)' : null, r.n_laudos > 0 ? r.n_laudos + ' laudo(s)' : null].filter(Boolean).join(' · ');
      return (
        <div className="text-sm">
          <span className="font-bold tabular-nums">{r.n_caminhoes} cam. · {r.n_cps} CP</span>
          <div className={'text-xs ' + (r.n_cps_atrasados > 0 ? 'font-extrabold text-red-600' : 'text-slate-500')}>{r.n_cps_atrasados > 0 ? r.n_cps_atrasados + ' CP com rompimento vencido' : (partes || '—')}</div>
        </div>
      );
    } },
    { id: 'equipe', header: 'Equipe / fôrmas', enableSorting: false, size: 178, cell: ({ row }) => {
      const r = row.original; const team = [r.moldador_nome, r.laboratorista_nome].filter(Boolean).join(' • ');
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"><Users size={12} className="shrink-0 text-slate-400" />{team ? <span className="truncate">{team}</span> : <span className="text-slate-400">Sem equipe</span>}</div>
          <div className="text-xs">{r.formas_previstas ? <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"><Mold size={11} />{r.formas_previstas} formas</span> : <span className="text-slate-400">Sem formas</span>}
            {(r.formas_previstas ?? 0) > 0 && r.n_cps > 0 && r.formas_previstas !== r.n_cps ? (
              <button type="button" className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }} title={'Provisão (' + r.formas_previstas + ') difere dos CPs moldados (' + r.n_cps + '). Clique para usar o nº de CPs.'} onClick={() => void usarCpsComoFormas(r.id, r.n_cps)}>≠ {r.n_cps} CP</button>
            ) : null}</div>
        </div>
      );
    } },
    { id: 'acoes', header: 'Ações', enableSorting: false, size: 96, cell: ({ row }) => (
      <div className="flex flex-nowrap items-center gap-1">
        <Tooltip label="Atribuir equipe"><button type="button" aria-label="Atribuir equipe" className="icon-btn !min-h-9 !min-w-9" onClick={() => void abrirOp(row.original.id, 'equipe')}><Users size={16} /></button></Tooltip>
        <Tooltip label="Provisionar fôrmas"><button type="button" aria-label="Provisionar fôrmas" className="icon-btn !min-h-9 !min-w-9" onClick={() => void abrirOp(row.original.id, 'formas')}><Mold size={16} /></button></Tooltip>
      </div>
    ) },
  ];
  const tableHeight = Math.min(640, 48 + Math.max(rows.length, 1) * 70);

  return (
    <section className="space-y-4">
      <PageHeader kicker="Concreto" title="Concretagens" description="Central de concretagens do laboratório — caminhões, CPs, rompimentos e laudos de cada evento. Clique nos cabeçalhos para ordenar." actions={<>
        <Button variant="ghost" onClick={() => void fichaBranco()}>Ficha em branco (PDF)</Button>
        <Button onClick={() => { setForm({ origem: 'programada' }); setOpen(true); }}>Nova concretagem</Button>
      </>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Concretagens" value={kpis?.total ?? total} detail="no filtro atual" onClick={() => { setStatusFiltro(''); setPage(0); }} />
        <Stat label="Em andamento" value={kpis?.emAndamento ?? '—'} detail="com CP aguardando rompimento" onClick={() => { setStatusFiltro('em_andamento'); setPage(0); }} active={statusFiltro === 'em_andamento'} />
        <Stat label="CPs moldados" value={kpis?.cps ?? '—'} detail={kpis ? kpis.cpsRompidos + ' rompidos · ' + kpis.laudos + ' laudo(s)' : undefined} />
        <Stat label="CPs atrasados" value={kpis?.cpsAtrasados ?? '—'} valueStyle={kpis && kpis.cpsAtrasados > 0 ? { color: 'var(--magenta)' } : undefined} detail="rompimento vencido" onClick={() => { setStatusFiltro('atrasado'); setPage(0); }} active={statusFiltro === 'atrasado'} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input className="input" placeholder="Buscar por Nº relatório, código, fornecedor, cliente ou obra" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 320 }} />
        <select className="input" value={clienteFiltro} onChange={(e) => { setClienteFiltro(e.target.value); setPage(0); }} style={{ maxWidth: 200 }}><option value="">Todos os clientes</option>{(clientes.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select className="input" value={obraFiltro} onChange={(e) => { setObraFiltro(e.target.value); setPage(0); }} style={{ maxWidth: 200 }}><option value="">Todas as obras</option>{(worksFiltro.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select className="input" value={statusFiltro} onChange={(e) => { setStatusFiltro(e.target.value); setPage(0); }} style={{ maxWidth: 170 }} title="Status técnico"><option value="">Todos os status</option><option value="programado">Programado</option><option value="moldado">Moldado</option><option value="em_andamento">Em andamento</option><option value="atrasado">Atrasado</option><option value="rompido">Rompido</option><option value="laudado">Laudado</option><option value="cancelada">Cancelada</option></select>
        <label className="block space-y-1"><span className="text-xs font-bold" style={{ color: 'var(--ink-faint)' }}>De</span><input className="input" type="date" value={dataDe} onChange={(e) => { setDataDe(e.target.value); setPage(0); }} style={{ maxWidth: 150 }} /></label>
        <label className="block space-y-1"><span className="text-xs font-bold" style={{ color: 'var(--ink-faint)' }}>Até</span><input className="input" type="date" value={dataAte} onChange={(e) => { setDataAte(e.target.value); setPage(0); }} style={{ maxWidth: 150 }} /></label>
      </div>

      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : (
        <VirtualTable data={rows} columns={columns} rowId={(r) => r.id} height={tableHeight} estimateRow={70} emptyLabel="Nenhuma concretagem." rowClassName={(r) => (r.n_cps_atrasados > 0 ? 'vt-alert' : '')} />
      )}

      {!q.isLoading && !q.isError && total > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{total} concretagem(ns) · página {page + 1} de {pageCount}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
            <Button variant="ghost" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      ) : null}

      <Modal open={open} title="Nova concretagem" onClose={() => setOpen(false)} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <SelectField label="Tipo" value={String(form.origem ?? 'programada')} onChange={(e) => setForm((s) => ({ ...s, origem: e.target.value }))}><option value="programada">Programada</option><option value="retroativa">Retroativa (registro de evento passado)</option></SelectField>
          <SelectField label="Cliente" required value={String(form.client_id ?? '')} onChange={(e) => setForm((s) => ({ ...s, client_id: e.target.value || null, work_id: null }))}><option value="">-</option>{(clientes.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Obra" required value={String(form.work_id ?? '')} onChange={(e) => setForm((s) => ({ ...s, work_id: e.target.value || null, unit_id: null }))}><option value="">-</option>{(obras.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Traço (opcional)" value={String(form.operational_material_id ?? '')} onChange={(e) => { const id = e.target.value || null; const t = (tracos.data ?? []).find((x) => x.value === id); setForm((s) => ({ ...s, operational_material_id: id, fck_previsto: (s.fck_previsto == null || s.fck_previsto === '') && t?.fck != null ? t.fck : s.fck_previsto })); }}><option value="">-</option><TracoOptions tracos={tracos.data ?? []} workId={form.work_id ? String(form.work_id) : null} clientId={form.client_id ? String(form.client_id) : null} /></SelectField>
          {(pecas.data ?? []).length ? <SelectField label="Peça (estrutura)" value={String(form.unit_id ?? '')} onChange={(e) => { const id = e.target.value || null; const pc = (pecas.data ?? []).find((x) => x.id === id); setForm((s) => ({ ...s, unit_id: id, local_texto: pc ? pc.label : s.local_texto })); }}><option value="">- (ou digite o local abaixo)</option>{(pecas.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</SelectField> : null}
          <Field label="Fornecedor (concreteira)" list={FORNECEDORES_DL} value={String(form.fornecedor_texto ?? '')} onChange={(e) => setForm((s) => ({ ...s, fornecedor_texto: e.target.value }))} />
          <Field label="Data programada" type="date" value={String(form.data_programada ?? '')} onChange={(e) => setForm((s) => ({ ...s, data_programada: e.target.value || null }))} />
          <NumField label="fck previsto (MPa)" value={numericValue(form.fck_previsto)} onCommit={(n) => setForm((s) => ({ ...s, fck_previsto: n }))} min={1} max={150} soft={[10, 100]} />
          <Field label="Local/peça" value={String(form.local_texto ?? '')} onChange={(e) => setForm((s) => ({ ...s, local_texto: e.target.value }))} />
          {form.origem === 'retroativa' ? <Field label="Justificativa (retroativa)" value={String(form.retroativa_justificativa ?? '')} onChange={(e) => setForm((s) => ({ ...s, retroativa_justificativa: e.target.value }))} /> : null}
        </div>
      </Modal>

      {equipeRow ? <EquipeModal row={equipeRow} onClose={() => setEquipeRow(null)} /> : null}
      {formasRow ? <FormasModal row={formasRow} onClose={() => setFormasRow(null)} /> : null}
      <FornecedorDatalist />
    </section>
  );
}
