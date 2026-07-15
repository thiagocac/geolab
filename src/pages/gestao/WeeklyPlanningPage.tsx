import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, SelectField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { Stat } from '../../components/ui/Stat';
import { useAuth } from '../../lib/auth';
import { listClientsRef, listCollaboratorsRef, listEquipmentRef, listWorksRef } from '../../lib/api/productEvolution';
import { assignWeeklyOperation, getWeeklyOperationsPlan, type WeeklyProgram } from '../../lib/api/weeklyPlanning';
import { useToast } from '../../lib/toast';
import { dateBr, Pill, TableShell, Td, Th } from './product/ProductUi';

function startOfWeek(date = new Date()) { const d = new Date(date); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0, 10); }
function addDays(value: string, days: number) { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

export function WeeklyPlanningPage() {
  const { member, can } = useAuth(); const toast = useToast(); const qc = useQueryClient();
  const [from, setFrom] = useState(startOfWeek()); const [clientId, setClientId] = useState(''); const [workId, setWorkId] = useState(''); const [collabId, setCollabId] = useState('');
  const [selected, setSelected] = useState<WeeklyProgram | null>(null); const [assignment, setAssignment] = useState({ moldadorId: '', laboratoristaId: '', prensaId: '' }); const [busy, setBusy] = useState(false);
  const to = addDays(from, 6);
  const plan = useQuery({ queryKey: ['weekly-plan', member?.tenant_id, from, clientId, workId, collabId], enabled: !!member, queryFn: () => getWeeklyOperationsPlan({ from, to, clientId: clientId || undefined, workId: workId || undefined, collaboratorId: collabId || undefined }) });
  const clients = useQuery({ queryKey: ['refs-clients'], queryFn: listClientsRef }); const works = useQuery({ queryKey: ['refs-works', clientId], queryFn: () => listWorksRef(clientId || undefined) }); const collaborators = useQuery({ queryKey: ['refs-collaborators'], queryFn: listCollaboratorsRef }); const equipment = useQuery({ queryKey: ['refs-equipment'], queryFn: listEquipmentRef });
  const grouped = useMemo(() => { const map = new Map<string, WeeklyProgram[]>(); for (const row of plan.data?.programacoes ?? []) map.set(row.data_programada, [...(map.get(row.data_programada) ?? []), row]); return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)); }, [plan.data?.programacoes]);
  function open(row: WeeklyProgram) { setSelected(row); setAssignment({ moldadorId: row.moldador_id ?? '', laboratoristaId: row.laboratorista_id ?? '', prensaId: '' }); }
  async function save() { if (!selected) return; setBusy(true); try { await assignWeeklyOperation({ concretagemId: selected.id, ...assignment }); await qc.invalidateQueries({ queryKey: ['weekly-plan'] }); setSelected(null); toast('Equipe e capacidade reservadas.', 'success'); } catch (error) { toast((error as Error).message, 'error'); } finally { setBusy(false); } }
  return <div className="space-y-6">
    <PageHeader kicker="Operação" title="Planejamento operacional semanal" description="Programações, rompimentos, escala, prensa e conflitos em uma única visão de sete dias." />
    <Card><CardHeader kicker="Filtros" title={`${dateBr(from)} a ${dateBr(to)}`} /><div className="grid gap-4 p-5 md:grid-cols-5"><Field label="Início da semana" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><SelectField label="Cliente" value={clientId} onChange={(e) => { setClientId(e.target.value); setWorkId(''); }}><option value="">Todos</option>{(clients.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</SelectField><SelectField label="Obra" value={workId} onChange={(e) => setWorkId(e.target.value)}><option value="">Todas</option>{(works.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</SelectField><SelectField label="Colaborador" value={collabId} onChange={(e) => setCollabId(e.target.value)}><option value="">Todos</option>{(collaborators.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</SelectField><div className="flex items-end gap-2"><Button variant="secondary" onClick={() => setFrom(addDays(from, -7))}>← Semana</Button><Button variant="secondary" onClick={() => setFrom(addDays(from, 7))}>Semana →</Button></div></div></Card>
    {plan.isLoading ? <LoadingState /> : plan.error ? <ErrorState message={(plan.error as Error).message} /> : <>
      <div className="grid gap-3 md:grid-cols-4"><Stat label="Programações" value={plan.data?.kpis.programacoes ?? 0} /><Stat label="CPs para romper" value={plan.data?.kpis.rupturas ?? 0} /><Stat label="Atrasados" value={plan.data?.kpis.atrasados ?? 0} /><Stat label="Conflitos" value={plan.data?.kpis.conflitos ?? 0} /></div>
      {!grouped.length ? <EmptyState title="Nenhuma programação na semana" /> : <div className="grid gap-4">{grouped.map(([date, rows]) => <Card key={date}><CardHeader kicker={dateBr(date)} title={`${rows.length} programação(ões)`} /><div className="p-4"><TableShell><thead><tr><Th>Obra / local</Th><Th>Hora</Th><Th>Volume</Th><Th>Equipe</Th><Th>CPs</Th><Th>Status</Th><Th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><Td><b>{row.work_name}</b><div className="text-xs text-slate-500">{row.client_name} · {row.local_texto || 'local não informado'}</div></Td><Td>{row.hora_programada?.slice(0, 5) || '—'}</Td><Td>{row.volume_programado_m3 || 0} m³</Td><Td><div className="text-xs">Moldador: {row.moldador || 'não definido'}</div><div className="text-xs">Lab: {row.laboratorista || 'não definido'}</div></Td><Td>{row.cps}</Td><Td><Pill tone={row.moldador_id ? 'good' : 'warn'}>{row.status}</Pill></Td><Td>{can('planejamento.gerenciar') ? <Button variant="secondary" onClick={() => open(row)}>Atribuir</Button> : null}</Td></tr>)}</tbody></TableShell></div></Card>)}</div>}
      <Card><CardHeader kicker="Rompimentos" title="Carga da prensa" /><div className="p-5">{(plan.data?.rupturas ?? []).length ? <TableShell><thead><tr><Th>Data</Th><Th>Obra</Th><Th>Concretagem</Th><Th>CPs</Th><Th>Atrasados</Th></tr></thead><tbody>{plan.data!.rupturas.map((row, index) => <tr key={`${row.data}-${row.work_id}-${index}`}><Td>{dateBr(row.data)}</Td><Td>{row.work_name}</Td><Td>{row.concretagem || '—'}</Td><Td>{row.cps}</Td><Td><Pill tone={row.atrasados ? 'bad' : 'good'}>{row.atrasados}</Pill></Td></tr>)}</tbody></TableShell> : <EmptyState title="Sem rompimentos na semana" />}</div></Card>
    </>}
    <Modal open={!!selected} title="Atribuir operação" onClose={() => setSelected(null)} footer={<><Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button><Button busy={busy} onClick={() => void save()}>{busy ? 'Salvando...' : 'Salvar atribuição'}</Button></>}>
      <div className="grid gap-4"><p className="text-sm text-slate-600 dark:text-slate-300">{selected?.work_name} · {dateBr(selected?.data_programada)}</p><SelectField label="Moldador" value={assignment.moldadorId} onChange={(e) => setAssignment({ ...assignment, moldadorId: e.target.value })}><option value="">Não definido</option>{(collaborators.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</SelectField><SelectField label="Laboratorista" value={assignment.laboratoristaId} onChange={(e) => setAssignment({ ...assignment, laboratoristaId: e.target.value })}><option value="">Não definido</option>{(collaborators.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</SelectField><SelectField label="Prensa / equipamento" value={assignment.prensaId} onChange={(e) => setAssignment({ ...assignment, prensaId: e.target.value })}><option value="">Não reservar</option>{(equipment.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</SelectField></div>
    </Modal>
  </div>;
}
