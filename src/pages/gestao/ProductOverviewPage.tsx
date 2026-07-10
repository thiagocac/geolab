import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { getProductSnapshot } from '../../lib/api/productEvolution';
import { MetricCard } from './product/ProductUi';

const modules = [
  ['/gestao/templates-documentos','Templates'],['/gestao/catalogo-servicos','Catálogo de serviços'],['/propostas','Propostas v2'],['/gestao/contratos-v2','Contratos v2'],['/gestao/medicoes-v2','Medições v2'],['/gestao/fluxo-caixa','Fluxo de caixa'],['/gestao/capacidade','Capacidade'],['/gestao/estoque','Estoque'],['/gestao/iso-17025','ISO/IEC 17025'],['/gestao/premiacao','Premiação'],
] as const;
export function ProductOverviewPage() {
  const query = useQuery({ queryKey: ['product', 'snapshot'], queryFn: getProductSnapshot });
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState message={(query.error as Error).message} />;
  const s = query.data!;
  return <div className="space-y-6"><PageHeader kicker="GEOLAB v213" title="Evolução integrada do produto" description="Visão executiva dos dez módulos priorizados, todos multi-tenant, auditáveis e conectados aos fluxos existentes." />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><MetricCard label="Templates" value={s.document_templates} /><MetricCard label="Serviços" value={s.catalog_services} /><MetricCard label="Propostas abertas" value={s.proposals_open} /><MetricCard label="Contratos ativos" value={s.contracts_active} /><MetricCard label="Medições abertas" value={s.measurements_open} /><MetricCard label="Contas a receber" value={s.accounts_receivable} /><MetricCard label="Conflitos de capacidade" value={s.capacity_conflicts} tone={s.capacity_conflicts ? 'warn' : 'good'} /><MetricCard label="Itens abaixo do mínimo" value={s.stock_low} tone={s.stock_low ? 'warn' : 'good'} /><MetricCard label="Achados ISO" value={s.iso_findings_open} tone={s.iso_findings_open ? 'warn' : 'good'} /><MetricCard label="Ciclos pendentes" value={s.bonus_cycles_pending} /></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{modules.map(([to,label], index) => <Link key={to} to={to}><Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Módulo {String(index + 1).padStart(2,'0')}</p><h2 className="mt-2 text-lg font-extrabold">{label}</h2><p className="mt-2 text-sm text-slate-500">Abrir operação e indicadores do módulo.</p></Card></Link>)}</div>
  </div>;
}
