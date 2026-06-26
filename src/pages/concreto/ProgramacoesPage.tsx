import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { LoadingState, ErrorState } from '../../components/ui/State';
import { VirtualTable } from '../../components/ui/VirtualTable';
import { listProgramacoes, confirmarProgramacao, cancelarProgramacao, invokeFicha } from '../../lib/api/concretagem';
import { saveBlob as dl } from '../../lib/pdf';
function statusCls(s: string) { if (s === 'registrado' || s === 'aprovado') return 'bg-green-100 text-green-700'; if (s === 'cancelada') return 'bg-red-100 text-red-700'; if (s === 'pendente') return 'bg-amber-100 text-amber-800'; return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'; }

export function ProgramacoesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['programacoes'], queryFn: listProgramacoes });
  type Row = NonNullable<typeof q.data>[number];
  const [busca, setBusca] = useState('');

  async function confirmar(id: string) { try { await confirmarProgramacao(id); await qc.invalidateQueries({ queryKey: ['programacoes'] }); toast('Programação confirmada.', 'success'); } catch (e) { toast((e as Error).message, 'error'); } }
  async function cancelar(id: string) { try { await cancelarProgramacao(id); await qc.invalidateQueries({ queryKey: ['programacoes'] }); toast('Programação cancelada.', 'success'); } catch (e) { toast((e as Error).message, 'error'); } }
  async function ficha(id: string) { try { dl(await invokeFicha(id), 'ficha-programacao.pdf'); } catch (e) { toast((e as Error).message, 'error'); } }

  const todas: Row[] = q.data ?? [];
  const termo = busca.trim().toLowerCase();
  const rows: Row[] = termo ? todas.filter((r) => [r.numero_relatorio, r.codigo, r.lab_clients?.razao_social, r.client_works?.nome].some((v) => String(v ?? '').toLowerCase().includes(termo))) : todas;
  const columns: ColumnDef<Row, unknown>[] = [
    { id: 'relatorio', header: 'Nº relatório', accessorFn: (r) => r.numero_relatorio ?? '', size: 130, cell: ({ row }) => <span className="font-bold">{row.original.numero_relatorio ?? '-'}</span> },
    { id: 'status', header: 'Status', accessorFn: (r) => r.status, size: 120, cell: ({ row }) => <div><span className={'rounded-full px-2 py-1 text-xs font-black ' + statusCls(row.original.status)}>{row.original.status}</span><div className="mt-1 text-[11px] text-slate-400">{row.original.origem}</div></div> },
    { id: 'data', header: 'Data/hora', accessorFn: (r) => r.data_programada ?? r.data_real ?? '', size: 120, cell: ({ row }) => <div><div className="font-bold">{row.original.data_programada ?? row.original.data_real ?? '-'}</div><div className="text-xs text-slate-500">{row.original.hora_programada ?? row.original.hora_inicio ?? '-'}</div></div> },
    { id: 'cliente', header: 'Cliente / obra', accessorFn: (r) => r.lab_clients?.razao_social ?? '', size: 220, cell: ({ row }) => <div><b>{row.original.lab_clients?.razao_social ?? '-'}</b><div className="text-xs text-slate-500">{row.original.client_works?.nome ?? '-'}</div></div> },
    { id: 'local', header: 'Local / peça', accessorFn: (r) => r.local_texto ?? '', size: 140, cell: ({ row }) => <span>{row.original.local_texto ?? '-'}</span> },
    { id: 'traco', header: 'Traço', accessorFn: (r) => r.operational_materials?.nome ?? r.traco_texto ?? '', size: 160, cell: ({ row }) => <div>{row.original.operational_materials?.nome ?? row.original.traco_texto ?? '-'}<div className="text-xs text-slate-500">FCK {row.original.fck_previsto ?? row.original.operational_materials?.fck_mpa ?? '-'} MPa</div></div> },
    { id: 'fornecedor', header: 'Fornecedor', accessorFn: (r) => r.fornecedor_texto ?? '', size: 140, cell: ({ row }) => <span>{row.original.fornecedor_texto ?? '-'}</span> },
    { id: 'volume', header: 'Volume', accessorFn: (r) => r.volume_programado_m3 ?? 0, size: 95, cell: ({ row }) => <span>{row.original.volume_programado_m3 ?? '-'} m³</span> },
    { id: 'acoes', header: 'Ações', enableSorting: false, size: 300, cell: ({ row }) => { const r = row.original; return <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => nav('/concretagens/' + r.id, { viewTransition: true })}>Abrir</Button>{r.status !== 'registrado' && r.status !== 'cancelada' ? <Button variant="secondary" onClick={() => void confirmar(r.id)}>Confirmar</Button> : null}<Button variant="ghost" onClick={() => void ficha(r.id)}>Ficha</Button>{r.status !== 'cancelada' ? <Button variant="ghost" onClick={() => void cancelar(r.id)}>Cancelar</Button> : null}</div>; } },
  ];
  const tableHeight = Math.min(620, 46 + Math.max(rows.length, 1) * 66);

  return (
    <section className="space-y-4">
      <PageHeader kicker="Concreto · laboratório" title="Programação de concretagens" description="Agenda do laboratório para solicitações da obra, portal do cliente e programações internas. A confirmação transforma a programação em atendimento pronto para ficha e caminhões. Clique nos cabeçalhos para ordenar." />
      <div className="flex flex-wrap items-center justify-between gap-2"><input className="input" placeholder="Filtrar por Nº relatório, código, cliente ou obra" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 380 }} /><Button onClick={() => nav('/programacoes/nova', { viewTransition: true })}>Nova programação</Button></div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : (
        <VirtualTable data={rows} columns={columns} rowId={(r) => r.id} height={tableHeight} emptyLabel="Nenhuma programação." />
      )}
    </section>
  );
}
