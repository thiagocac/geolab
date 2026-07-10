import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '../ui/Card';
import { SelectField } from '../ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../ui/State';
import { Stat } from '../ui/Stat';
import { getPortalFinancialSnapshot } from '../../lib/api/portalFinance';
import { dateBr, money, Pill, TableShell, Td, Th } from '../../pages/gestao/product/ProductUi';

export function PortalFinancePanel() {
  const [workId, setWorkId] = useState('');
  const query = useQuery({ queryKey: ['portal-financial', workId], queryFn: () => getPortalFinancialSnapshot(undefined, undefined, workId || undefined) });
  const data = query.data;
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState message={(query.error as Error).message} />;
  if (!data?.enabled) return <EmptyState title="Financeiro não habilitado" description="Solicite ao laboratório a liberação desta visão para o seu usuário." />;
  return <div className="space-y-5">
    <Card><CardHeader kicker="Filtros" title="Posição financeira" /><div className="max-w-md p-5"><SelectField label="Obra" value={workId} onChange={(e) => setWorkId(e.target.value)}><option value="">Todas as obras autorizadas</option>{data.works.map((row) => <option key={row.id} value={row.id}>{row.nome}</option>)}</SelectField></div></Card>
    <div className="grid gap-3 md:grid-cols-4"><Stat label="Medido" value={money(data.kpis.measured)} /><Stat label="Faturado" value={money(data.kpis.invoiced)} /><Stat label="Em aberto" value={money(data.kpis.open)} /><Stat label="Vencidos" value={data.kpis.overdue} /></div>
    <Card><CardHeader kicker="Medições" title="Medições submetidas" /><div className="p-5">{!data.measurements.length ? <EmptyState title="Nenhuma medição no período" /> : <TableShell><thead><tr><Th>Número</Th><Th>Competência</Th><Th>Período</Th><Th>Valor</Th><Th>Status</Th><Th>Decisão</Th></tr></thead><tbody>{data.measurements.map((raw) => { const row = raw as Record<string, unknown>; return <tr key={String(row.id)}><Td>{String(row.numero ?? '—')}</Td><Td>{String(row.competencia ?? '—')}</Td><Td>{dateBr(row.periodo_inicio)} a {dateBr(row.periodo_fim)}</Td><Td>{money(row.valor_total)}</Td><Td><Pill tone={String(row.status) === 'aprovada' ? 'good' : 'warn'}>{String(row.status)}</Pill></Td><Td>{String(row.client_decision ?? 'aguardando')}</Td></tr>; })}</tbody></TableShell>}</div></Card>
    <Card><CardHeader kicker="Cobrança" title="Faturas e contas a receber" /><div className="p-5">{!data.receivables.length ? <EmptyState title="Nenhum título financeiro" /> : <TableShell><thead><tr><Th>Descrição</Th><Th>Vencimento</Th><Th>Valor</Th><Th>Saldo</Th><Th>Status</Th></tr></thead><tbody>{data.receivables.map((raw) => { const row = raw as Record<string, unknown>; return <tr key={String(row.id)}><Td>{String(row.descricao)}</Td><Td>{dateBr(row.data_vencimento)}</Td><Td>{money(row.valor)}</Td><Td>{money(row.saldo)}</Td><Td><Pill tone={String(row.status) === 'liquidado' ? 'good' : String(row.data_vencimento ?? '') < new Date().toISOString().slice(0, 10) ? 'bad' : 'warn'}>{String(row.status)}</Pill></Td></tr>; })}</tbody></TableShell>}</div></Card>
  </div>;
}
