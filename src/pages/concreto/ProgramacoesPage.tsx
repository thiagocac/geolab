import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { useToast } from '../../lib/toast';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { origemLabel } from '../../lib/status';
import { Stat } from '../../components/ui/Stat';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { VirtualTable } from '../../components/ui/VirtualTable';
import { ChevronRight, CheckCircle, Users, Mold, FileText, XCircle } from '../../components/ui/icons';
import { EquipeModal, FormasModal } from '../../components/domain/ConcretagemOpsModals';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { listProgramacoes, confirmarProgramacao, cancelarProgramacao, invokeFicha, type ConcretagemRow } from '../../lib/api/concretagem';
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
  const [busca, setBusca] = useState('');
  // Modais compartilhados (v220): Atribuir equipe / Provisionar fôrmas vivem em ConcretagemOpsModals.
  const [equipeRow, setEquipeRow] = useState<Row | null>(null);
  const [formasRow, setFormasRow] = useState<Row | null>(null);

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

  const columns: ColumnDef<Row, unknown>[] = [
    { id: 'relatorio', header: 'Nº relatório', accessorFn: (r) => r.numero_relatorio ?? '', size: 120, cell: ({ row }) => <span className="font-bold">{row.original.numero_relatorio ?? '-'}</span> },
    { id: 'status', header: 'Status', accessorFn: (r) => r.status, size: 150, cell: ({ row }) => <div><StatusBadge status={row.original.status} domain="concretagem" /><div className="mt-1 text-[11px] text-slate-400">{origemLabel(row.original.origem)}</div></div> },
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
          <Tooltip label="Atribuir equipe"><button type="button" aria-label="Atribuir equipe" className="icon-btn !min-h-9 !min-w-9" onClick={() => setEquipeRow(r)}><Users size={16} /></button></Tooltip>
          <Tooltip label="Provisionar fôrmas"><button type="button" aria-label="Provisionar fôrmas" className="icon-btn !min-h-9 !min-w-9" onClick={() => setFormasRow(r)}><Mold size={16} /></button></Tooltip>
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

      {equipeRow ? <EquipeModal row={equipeRow} onClose={() => setEquipeRow(null)} /> : null}
      {formasRow ? <FormasModal row={formasRow} onClose={() => setFormasRow(null)} /> : null}
    </section>
  );
}
