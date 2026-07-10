import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Stat } from '../components/ui/Stat';
import { Button } from '../components/ui/Button';
import { LoadingState, ErrorState } from '../components/ui/State';
import { getKpis } from '../lib/api/dashboard';

/**
 * Painel inicial (v213, fusão DB-001 do Dashboard v2): cockpit resumido — KPIs clicáveis + atalhos.
 * Os gráficos que viviam aqui (230px, duplicados) foram fundidos no hub /dashboards, que agora é
 * full-screen com filtros na URL. Cada KPI navega direto para a tela de trabalho correspondente.
 */

const fmtVol = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function KpiLink({ label, value, detail, to }: { label: string; value: string | number; detail?: string; to: string }) {
  const nav = useNavigate();
  return (
    <button type="button" onClick={() => nav(to)} className="text-left transition hover:opacity-80">
      <Stat label={label} value={value} detail={detail} />
    </button>
  );
}

export function DashboardPage() {
  const { member } = useAuth();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['kpis', member?.tenant_id], queryFn: () => getKpis(member?.tenant_id) });
  const k = q.data;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Concresoft" title="Painel" description={'Laboratorio: ' + (member?.tenant_name ?? '-')} />
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : k ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <KpiLink label="Rompimentos atrasados" value={k.agenda.atrasados} detail="CPs vencidos sem resultado" to="/rompimentos?janela=atrasados" />
            <KpiLink label="CPs a romper" value={k.agenda.total} detail="aguardando resultado" to="/rompimentos?janela=pendentes" />
            <KpiLink label="Rompimentos hoje" value={k.agenda.hoje} detail="abrir agenda do dia" to="/rompimentos?janela=hoje" />
            <KpiLink label="Laudos a emitir" value={k.laudos.rascunho} detail="rascunho/revisão" to="/laudos" />
            <KpiLink label="Volume do mes (m³)" value={fmtVol(k.volumeMes)} detail="concretado no mês" to="/dashboards?painel=exec" />
            <KpiLink label="Calibracoes vencendo" value={k.calibracoesVencendo} detail="próximos 30 dias" to="/cadastros" />
          </div>
          <Card>
            <CardHeader kicker="Gestão" title="Dashboards do laboratório" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 16 }}>
              <Button onClick={() => nav('/dashboards')}>Abrir dashboards</Button>
              <Button variant="secondary" onClick={() => nav('/dashboards?painel=qualidade')}>Qualidade</Button>
              <Button variant="secondary" onClick={() => nav('/dashboards?painel=rompimentos')}>Agenda</Button>
              <Button variant="secondary" onClick={() => nav('/dashboards?painel=financeiro')}>Financeiro</Button>
            </div>
          </Card>
          <Card>
            <CardHeader kicker="Atalhos" title="Ações rápidas" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 16 }}>
              <Button onClick={() => nav('/rompimentos')}>Agenda de rompimentos</Button>
              <Button variant="secondary" onClick={() => nav('/importacoes')}>Importar resultados</Button>
              <Button variant="secondary" onClick={() => nav('/laudos')}>Laudos</Button>
              <Button variant="ghost" onClick={() => nav('/nova-obra')}>Nova obra</Button>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
