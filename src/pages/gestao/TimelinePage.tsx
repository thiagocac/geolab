import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { listConcretagemTimeline, listTenantTimeline, listWorkTimeline } from '../../lib/api/timeline';
import { TimelineList } from '../../components/TimelineList';

type Scope = 'tenant' | 'work' | 'concretagem';
const KIND_OPTIONS = [
  { value: '', label: 'Todos os eventos' },
  { value: 'auditoria', label: 'Auditoria' },
  { value: 'concretagem', label: 'Concretagem' },
  { value: 'moldagem', label: 'Moldagem' },
  { value: 'rompimento', label: 'Rompimento' },
  { value: 'resultado', label: 'Resultado' },
  { value: 'laudo', label: 'Laudo' },
];
const SEVERITY_OPTIONS = [
  { value: '', label: 'Todas severidades' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Alerta' },
  { value: 'error', label: 'Erro' },
];

export function TimelinePage() {
  const [sp] = useSearchParams();
  const spScope = sp.get('scope');
  const [scope, setScope] = useState<Scope>(spScope === 'work' || spScope === 'concretagem' ? spScope : 'tenant');
  const [targetId, setTargetId] = useState(sp.get('id') ?? '');
  const [kind, setKind] = useState('');
  const [severity, setSeverity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(200);
  const target = targetId.trim();
  const enabled = scope === 'tenant' || target.length > 0;
  const query = useQuery({
    queryKey: ['timeline', scope, target, kind, severity, from, to, limit],
    enabled,
    staleTime: 30_000,
    queryFn: () => {
      const opts = { kinds: kind ? [kind] : undefined, severity: severity ? [severity] : undefined, from: from || undefined, to: to || undefined, limit };
      if (scope === 'work') return listWorkTimeline(target, opts);
      if (scope === 'concretagem') return listConcretagemTimeline(target, opts);
      return listTenantTimeline(opts);
    },
  });
  const rows = query.data ?? [];
  const counts = useMemo(() => rows.reduce<Record<string, number>>((acc, ev) => { acc[ev.event_kind] = (acc[ev.event_kind] ?? 0) + 1; return acc; }, {}), [rows]);
  return (
    <div className="space-y-6">
      <PageHeader kicker="Governança" title="Linha do tempo" description="Trilha auditável de ações e marcos técnicos por laboratório, obra ou concretagem. A Onda 1 depende das migrations 093/094 aplicadas no backend." />
      <Card>
        <CardHeader kicker="Filtros" title="Recorte da trilha">Use UUID de obra ou concretagem quando quiser auditar um alvo específico.</CardHeader>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <SelectField label="Escopo" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            <option value="tenant">Laboratório inteiro</option>
            <option value="work">Obra</option>
            <option value="concretagem">Concretagem</option>
          </SelectField>
          <Field label="ID do alvo" placeholder="UUID da obra ou concretagem" value={targetId} onChange={(e) => setTargetId(e.target.value)} disabled={scope === 'tenant'} />
          <SelectField label="Tipo de evento" value={kind} onChange={(e) => setKind(e.target.value)}>{KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <SelectField label="Severidade" value={severity} onChange={(e) => setSeverity(e.target.value)}>{SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          <Field label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Field label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <SelectField label="Limite" value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value="100">100 eventos</option><option value="200">200 eventos</option><option value="500">500 eventos</option>
          </SelectField>
          <div className="flex items-end"><Button variant="secondary" onClick={() => { setKind(''); setSeverity(''); setFrom(''); setTo(''); setTargetId(''); setScope('tenant'); }}>Limpar filtros</Button></div>
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4"><p className="kicker">Eventos</p><p className="mt-1 text-2xl font-bold">{rows.length}</p></Card>
        <Card className="p-4"><p className="kicker">Auditoria</p><p className="mt-1 text-2xl font-bold">{counts.auditoria ?? 0}</p></Card>
        <Card className="p-4"><p className="kicker">Técnicos</p><p className="mt-1 text-2xl font-bold">{rows.length - (counts.auditoria ?? 0)}</p></Card>
        <Card className="p-4"><p className="kicker">Alertas</p><p className="mt-1 text-2xl font-bold">{(rows.filter((r) => r.severity !== 'info')).length}</p></Card>
      </div>
      {!enabled ? <EmptyState /> : query.isLoading ? <LoadingState /> : query.error ? <ErrorState message={(query.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : <TimelineList events={rows} />}
    </div>
  );
}
