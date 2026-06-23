import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';

export function DashboardPage() {
  const { member } = useAuth();
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="GEOLAB" title="Painel" description={`Laboratório: ${member?.tenant_name ?? '—'}`} />
      <Card>
        <CardHeader kicker="v2 — fundação" title="Bem-vindo ao GEOLAB" />
        <p style={{ color: '#374151', lineHeight: 1.5, margin: 0 }}>
          Olá, {member?.full_name ?? member?.email}. A fundação está no ar — login e seleção de laboratório.
          Os módulos (cadastros, concretagem, rompimento e laudo) entram nas próximas releases.
        </p>
      </Card>
    </div>
  );
}
