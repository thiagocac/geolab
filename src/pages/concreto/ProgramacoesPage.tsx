import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { useToast } from '../../lib/toast';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Stat } from '../../components/ui/Stat';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField } from '../../components/ui/Field';
import { Tooltip } from '../../components/ui/Tooltip';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { VirtualTable } from '../../components/ui/VirtualTable';
import { ChevronRight, CheckCircle, Users, Mold, FileText, XCircle } from '../../components/ui/icons';
import { MoldingStandardEditor } from '../../components/domain/MoldingStandardEditor';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import {
  listProgramacoes, confirmarProgramacao, cancelarProgramacao, invokeFicha,
  atribuirEquipe, provisionarFormas, listEquipeColaboradores, padraoMoldagemDaConcretagem,
  type ConcretagemRow,
} from '../../lib/api/concretagem';
import { toNumber, padroesToDb, type PadraoMoldagem } from '../../lib/concreto';
import { saveBlob as dl } from '../../lib/pdf';

type Row = ConcretagemRow;
const podeConfirmar = (r: Row) => r.status !== 'registrado' && r.status !== 'cancelada';
const teamLabel = (r: Row) => [r.moldador?.nome, r.laboratorista?.nome].filter(Boolean).join(' • ');

export function ProgramacoesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const confirm = useConfirm();
  const { member } = useAuth();
  const q = useQuery({ queryKey: ['programacoes', member?.tenant_id], queryFn: () => listProgramacoes(member?.tenant_id) });
  const colabs = useQuery({ queryKey: ['equipe-colabs', member?.tenant_id], queryFn: listEquipeColaboradores });
  const [busca, setBusca] = useState('');
  const [busy, setBusy] = useState(false);

  // Modal "Atribuir equipe"
  const [equipeRow, setEquipeRow] = useState<Row | null>(null);
  const [moldadorId, setMoldadorId] = useState('');
  const [labId, setLabId] = useState('');
  // Modal "Provisionar fôrmas"
  const [formasRow, setFormasRow] = useState<Row | null>(null);
  const [cap, setCap] = useState('8');
  const [nAmostrasManual, setNAmostrasManual] = useState('');
  // Padrão de moldagem editável quando o traço NÃO é cadastrado (sem operational_material_id).
  const [padraoEdit, setPadraoEdit] = useState<PadraoMoldagem[]>([]);

  const todas: Row[] = q.data ?? [];
  const termo = busca.trim().toLowerCase();
  const rows: Row[] = termo
    ? todas.filter((r) => [r.numero_relatorio, r.codigo, r.lab_clients?.razao_social, r.client_works?.nome].some((v) => String(v ?? '').toLowerCase().includes(termo)))
    : todas;

  const resumo = useMemo(() => ({
    total: todas.length,
    aguardando: todas.filter(podeConfirmar).length,
    comEquipe: todas.filter((r) => r.moldador_id || r.laboratorista_id).length,
    formas: todas.reduce((s, r) => s + (r.formas_previstas ?? 0), 0),
  }), [todas]);

  async function confirmar(id: string) { try { await confirmarProgramacao(id); await qc.invalidateQueries({ queryKey: ['programacoes'] }); toast('Programação confirmada.', 'success'); } catch (e) { toast((e as Error).message, 'error'); } }
  async function cancelar(id: string) { if (!(await confirm({ title: 'Cancelar programação', message: 'Cancelar esta programação? A ação não pode ser desfeita.', danger: true, confirmLabel: 'Cancelar programação', cancelLabel: 'Voltar' }))) return; try { await cancelarProgramacao(id); await qc.invalidateQueries({ queryKey: ['programacoes'] }); toast('Programação cancelada.', 'success'); } catch (e) { toast((e as Error).message, 'error'); } }
  async function ficha(id: string) { try { dl(await invokeFicha(id), 'ficha-programacao.pdf'); } catch (e) { toast((e as Error).message, 'error'); } }

  function abrirEquipe(r: Row) { setMoldadorId(r.moldador_id ?? ''); setLabId(r.laboratorista_id ?? ''); setEquipeRow(r); }
  async function salvarEquipe() {
    if (!equipeRow) return;
    setBusy(true);
    try {
      await atribuirEquipe(equipeRow.id, moldadorId || null, labId || null);
      await qc.invalidateQueries({ queryKey: ['programacoes'] });
      toast('Equipe atribuída.', 'success');
      setEquipeRow(null);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  function abrirFormas(r: Row) { setCap('8'); setNAmostrasManual(''); setPadraoEdit(padraoMoldagemDaConcretagem(r)); setFormasRow(r); }
  const capNum = Math.max(1, toNumber(cap) ?? 8);
  const volume = formasRow?.volume_programado_m3 ?? null;
  const estAmostras = volume && volume > 0 ? Math.max(1, Math.ceil(volume / capNum)) : 1;
  const nAmostras = nAmostrasManual.trim() !== '' ? Math.max(1, Math.floor(toNumber(nAmostrasManual) ?? 1)) : estAmostras;
  // Traço cadastrado: padrão vem do traço (read-only). Não cadastrado: padrão editável (padraoEdit).
  const tracoRegistrado = !!formasRow?.operational_material_id;
  const padraoAtivo = tracoRegistrado ? (formasRow ? padraoMoldagemDaConcretagem(formasRow) : []) : padraoEdit;
  const cpsAmostra = padraoAtivo.reduce((s, p) => s + (toNumber(p.quantidadeCp) ?? 0), 0);
  const formasNecessarias = cpsAmostra * nAmostras;

  async function salvarFormas() {
    if (!formasRow) return;
    setBusy(true);
    try {
      await provisionarFormas(formasRow.id, formasNecessarias, { n_amostras: nAmostras, cps_por_amostra: cpsAmostra, capacidade_m3: capNum, volume_m3: volume }, formasRow.metadata ?? null, tracoRegistrado ? null : padroesToDb(padraoEdit));
      await qc.invalidateQueries({ queryKey: ['programacoes'] });
      toast('Formas provisionadas: ' + formasNecessarias + '.', 'success');
      setFormasRow(null);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }


  const columns: ColumnDef<Row, unknown>[] = [
    { id: 'relatorio', header: 'Nº relatório', accessorFn: (r) => r.numero_relatorio ?? '', size: 120, cell: ({ row }) => <span className="font-bold">{row.original.numero_relatorio ?? '-'}</span> },
    { id: 'status', header: 'Status', accessorFn: (r) => r.status, size: 116, cell: ({ row }) => <div><StatusBadge status={row.original.status} /><div className="mt-1 text-[11px] text-slate-400">{row.original.origem}</div></div> },
    { id: 'data', header: 'Data/hora', accessorFn: (r) => r.data_programada ?? r.data_real ?? '', size: 116, cell: ({ row }) => <div><div className="font-bold">{row.original.data_programada ?? row.original.data_real ?? '-'}</div><div className="text-xs text-slate-500">{row.original.hora_programada ?? row.original.hora_inicio ?? '-'}</div></div> },
    { id: 'cliente', header: 'Cliente / obra', accessorFn: (r) => r.lab_clients?.razao_social ?? '', size: 210, cell: ({ row }) => <div className="min-w-0"><b className="block truncate">{row.original.lab_clients?.razao_social ?? '-'}</b><div className="truncate text-xs text-slate-500">{row.original.client_works?.nome ?? '-'}</div></div> },
    { id: 'local', header: 'Local / peça', accessorFn: (r) => r.local_texto ?? '', size: 130, cell: ({ row }) => <span className="text-sm">{row.original.local_texto ?? '-'}</span> },
    { id: 'traco', header: 'Traço', accessorFn: (r) => r.operational_materials?.nome ?? r.traco_texto ?? '', size: 160, cell: ({ row }) => <div className="text-sm">{row.original.operational_materials?.nome ?? row.original.traco_texto ?? '-'}<div className="text-xs text-slate-500">FCK {row.original.fck_previsto ?? row.original.operational_materials?.fck_mpa ?? '-'} MPa</div></div> },
    { id: 'fornecedor', header: 'Fornecedor', accessorFn: (r) => r.fornecedor_texto ?? '', size: 130, cell: ({ row }) => <span className="text-sm">{row.original.fornecedor_texto ?? '-'}</span> },
    { id: 'volume', header: 'Volume', accessorFn: (r) => r.volume_programado_m3 ?? 0, size: 84, cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.volume_programado_m3 ?? '-'} m³</span> },
    { id: 'equipe', header: 'Equipe / fôrmas', enableSorting: false, size: 178, cell: ({ row }) => {
      const r = row.original; const team = teamLabel(r);
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300"><Users size={12} className="shrink-0 text-slate-400" />{team ? <span className="truncate">{team}</span> : <span className="text-slate-400">Sem equipe</span>}</div>
          <div className="text-xs">{r.formas_previstas ? <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"><Mold size={11} />{r.formas_previstas} formas</span> : <span className="text-slate-400">Sem formas</span>}</div>
        </div>
      );
    } },
    { id: 'acoes', header: 'Ações', enableSorting: false, size: 264, cell: ({ row }) => {
      const r = row.original;
      return (
        <div className="flex flex-nowrap items-center gap-1">
          <Tooltip label="Abrir"><button type="button" aria-label="Abrir" className="icon-btn !min-h-9 !min-w-9" onClick={() => nav('/concretagens/' + r.id, { viewTransition: true })}><ChevronRight size={16} /></button></Tooltip>
          {podeConfirmar(r) ? <Tooltip label="Confirmar"><button type="button" aria-label="Confirmar" className="icon-btn !min-h-9 !min-w-9" onClick={() => void confirmar(r.id)}><CheckCircle size={16} /></button></Tooltip> : null}
          <Tooltip label="Atribuir equipe"><button type="button" aria-label="Atribuir equipe" className="icon-btn !min-h-9 !min-w-9" onClick={() => abrirEquipe(r)}><Users size={16} /></button></Tooltip>
          <Tooltip label="Provisionar fôrmas"><button type="button" aria-label="Provisionar fôrmas" className="icon-btn !min-h-9 !min-w-9" onClick={() => abrirFormas(r)}><Mold size={16} /></button></Tooltip>
          <Tooltip label="Ficha (PDF)"><button type="button" aria-label="Ficha (PDF)" className="icon-btn !min-h-9 !min-w-9" onClick={() => void ficha(r.id)}><FileText size={16} /></button></Tooltip>
          {r.status !== 'cancelada' ? <Tooltip label="Cancelar"><button type="button" aria-label="Cancelar programação" className="icon-btn !min-h-9 !min-w-9 hover:!text-red-600" onClick={() => void cancelar(r.id)}><XCircle size={16} /></button></Tooltip> : null}
        </div>
      );
    } },
  ];
  const tableHeight = Math.min(640, 48 + Math.max(rows.length, 1) * 70);

  return (
    <section className="space-y-4">
      <PageHeader kicker="Concreto · laboratório" title="Programação de concretagens" description="Agenda do laboratório para solicitações da obra, portal do cliente e programações internas. Atribua a equipe, provisione as formas e confirme para gerar ficha e caminhões. Clique nos cabeçalhos para ordenar." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Programações" value={resumo.total} />
        <Stat label="Aguardando confirmação" value={resumo.aguardando} />
        <Stat label="Com equipe" value={resumo.comEquipe} />
        <Stat label="Fôrmas provisionadas" value={resumo.formas} detail="soma das previsões" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <input className="input" placeholder="Filtrar por Nº relatório, código, cliente ou obra" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 380 }} />
        <Button onClick={() => nav('/programacoes/nova', { viewTransition: true })}>Nova programação</Button>
      </div>

      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : (
        <VirtualTable data={rows} columns={columns} rowId={(r) => r.id} height={tableHeight} estimateRow={70} emptyLabel="Nenhuma programação." />
      )}

      <Modal open={!!equipeRow} title={'Atribuir equipe' + (equipeRow?.numero_relatorio ? ' — ' + equipeRow.numero_relatorio : '')} onClose={() => setEquipeRow(null)}
        footer={<><Button variant="ghost" onClick={() => setEquipeRow(null)}>Cancelar</Button><Button onClick={() => void salvarEquipe()} disabled={busy}>{busy ? 'Salvando…' : 'Salvar equipe'}</Button></>}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Vincule o moldador e o laboratorista que vão atender esta programação. Aparecem na ficha de moldagem e na agenda do laboratório.</p>
          <SelectField label="Moldador" value={moldadorId} onChange={(e) => setMoldadorId(e.target.value)}>
            <option value="">A definir</option>
            {(colabs.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}{c.funcoes.length ? ' — ' + c.funcoes.join(', ') : ''}</option>)}
          </SelectField>
          <SelectField label="Laboratorista" value={labId} onChange={(e) => setLabId(e.target.value)}>
            <option value="">A definir</option>
            {(colabs.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}{c.funcoes.length ? ' — ' + c.funcoes.join(', ') : ''}</option>)}
          </SelectField>
          {colabs.data && colabs.data.length === 0 ? <p className="text-xs" style={{ color: 'var(--magenta)' }}>Nenhum colaborador cadastrado. Cadastre em Cadastros › Colaboradores.</p> : null}
        </div>
      </Modal>

      <Modal open={!!formasRow} title={'Provisionar fôrmas' + (formasRow?.numero_relatorio ? ' — ' + formasRow.numero_relatorio : '')} onClose={() => setFormasRow(null)}
        footer={<><Button variant="ghost" onClick={() => setFormasRow(null)}>Cancelar</Button><Button onClick={() => void salvarFormas()} disabled={busy || formasNecessarias <= 0}>{busy ? 'Salvando…' : 'Salvar provisão'}</Button></>}>
        {formasRow ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">As fôrmas (moldes de CP) são calculadas a partir do padrão de moldagem do traço: <b>CPs por amostra × nº de amostras (caminhões) = formas necessárias</b>.</p>
            {tracoRegistrado ? (
              <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                <div className="flex justify-between"><span className="text-slate-500">Padrão de moldagem</span><span className="font-bold">{cpsAmostra} CP por amostra</span></div>
                <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                  {padraoAtivo.map((p) => <li key={p.id} className="flex justify-between"><span>{p.idadeControle} {p.unidadeIdade}</span><span>{toNumber(p.quantidadeCp) ?? 0} CP</span></li>)}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between gap-2"><span className="text-slate-500">Padrão de moldagem <span className="font-bold text-slate-700 dark:text-slate-200">— traço não cadastrado, edite abaixo</span></span><span className="font-bold">{cpsAmostra} CP por amostra</span></div>
                <MoldingStandardEditor value={padraoEdit} onChange={setPadraoEdit} fck={formasRow.fck_previsto ?? null} />
                <p className="mt-2 text-xs text-slate-500">Sem traço cadastrado, o padrão vem do default (NBR 5739: 28d e 63d, 2 CP cada). Ajuste as idades e a quantidade de CP — o valor é salvo nesta concretagem e usado para gerar os CPs.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Volume programado (m³)" value={volume ?? '—'} readOnly />
              <Field label="Capacidade/caminhão (m³)" type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} hint="Base da estimativa de caminhões." />
            </div>
            <Field label="Nº de amostras / caminhões" type="number" min={1} value={nAmostrasManual.trim() !== '' ? nAmostrasManual : String(estAmostras)} onChange={(e) => setNAmostrasManual(e.target.value)} hint={volume ? ('Estimado: ' + volume + ' m³ ÷ ' + capNum + ' = ' + estAmostras + ' caminhão(ões). Edite se necessário.') : 'Informe o nº de amostras.'} />
            <div className="rounded-xl p-4 text-center" style={{ background: 'var(--surface-2)' }}>
              <p className="kicker">Fôrmas necessárias</p>
              <strong className="mt-1 block text-3xl font-extrabold tabular-nums" style={{ color: 'var(--magenta)' }}>{formasNecessarias}</strong>
              <p className="mt-1 text-xs text-slate-500">{cpsAmostra} CP × {nAmostras} amostra(s)</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">A entrega no estoque de fôrmas em campo é registrada automaticamente ao salvar a provisão (movimento automático por concretagem).</p>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
