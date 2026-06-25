import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listProgramacoes, confirmarProgramacao, cancelarProgramacao, invokeFicha } from '../../lib/api/concretagem';

function dl(blob: Blob, name: string) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }
function statusCls(s: string) { if (s === 'registrado' || s === 'aprovado') return 'bg-green-100 text-green-700'; if (s === 'cancelada') return 'bg-red-100 text-red-700'; if (s === 'pendente') return 'bg-amber-100 text-amber-800'; return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'; }

export function ProgramacoesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['programacoes'], queryFn: listProgramacoes });

  async function confirmar(id: string) { try { await confirmarProgramacao(id); await qc.invalidateQueries({ queryKey: ['programacoes'] }); toast('Programação confirmada.', 'success'); } catch (e) { toast((e as Error).message, 'error'); } }
  async function cancelar(id: string) { try { await cancelarProgramacao(id); await qc.invalidateQueries({ queryKey: ['programacoes'] }); toast('Programação cancelada.', 'success'); } catch (e) { toast((e as Error).message, 'error'); } }
  async function ficha(id: string) { try { dl(await invokeFicha(id), 'ficha-programacao.pdf'); } catch (e) { toast((e as Error).message, 'error'); } }

  const rows = q.data ?? [];
  return (
    <section className="space-y-4">
      <PageHeader kicker="Concreto · laboratório" title="Programação de concretagens" description="Agenda do laboratório para solicitações da obra, portal do cliente e programações internas. A confirmação transforma a programação em atendimento pronto para ficha e caminhões." />
      <div className="flex justify-end"><Button onClick={() => nav('/programacoes/nova', { viewTransition: true })}>Nova programação</Button></div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-3 py-2">Status</th><th>Data/hora</th><th>Cliente / obra</th><th>Local / peça</th><th>Traço</th><th>Fornecedor</th><th>Volume</th><th>Ações</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2"><span className={'rounded-full px-2 py-1 text-xs font-black ' + statusCls(r.status)}>{r.status}</span><div className="mt-1 text-[11px] text-slate-400">{r.origem}</div></td>
                    <td className="px-3 py-2 font-bold">{r.data_programada ?? r.data_real ?? '-'}<div className="text-xs font-normal text-slate-500">{r.hora_programada ?? r.hora_inicio ?? '-'}</div></td>
                    <td className="px-3 py-2"><b>{r.lab_clients?.razao_social ?? '-'}</b><div className="text-xs text-slate-500">{r.client_works?.nome ?? '-'}</div></td>
                    <td className="px-3 py-2">{r.local_texto ?? '-'}</td>
                    <td className="px-3 py-2">{r.operational_materials?.nome ?? r.traco_texto ?? '-'}<div className="text-xs text-slate-500">FCK {r.fck_previsto ?? r.operational_materials?.fck_mpa ?? '-'} MPa</div></td>
                    <td className="px-3 py-2">{r.fornecedor_texto ?? '-'}</td>
                    <td className="px-3 py-2">{r.volume_programado_m3 ?? '-'} m³</td>
                    <td className="px-3 py-2"><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => nav('/concretagens/' + r.id, { viewTransition: true })}>Abrir</Button>{r.status !== 'registrado' && r.status !== 'cancelada' ? <Button variant="secondary" onClick={() => void confirmar(r.id)}>Confirmar</Button> : null}<Button variant="ghost" onClick={() => void ficha(r.id)}>Ficha</Button>{r.status !== 'cancelada' ? <Button variant="ghost" onClick={() => void cancelar(r.id)}>Cancelar</Button> : null}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
