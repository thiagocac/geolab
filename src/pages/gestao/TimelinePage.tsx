import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Field';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { listConcretagemTimeline, listTenantTimeline, listWorkTimeline, type TimelineEvent } from '../../lib/api/timeline';
import { formatDate } from '../../lib/format';

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

function severityClass(severity: string) {
  if (severity === 'error') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (severity === 'warn') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
}
function kindLabel(kind: string) {
  return KIND_OPTIONS.find((k) => k.value === kind)?.label ?? kind;
}
function eventRoute(ev: TimelineEvent): string | null {
  if (ev.concretagem_id) return '/concretagens/' + ev.concretagem_id;
  if (ev.ref_table === 'lab_reports') return '/laudos';
  if (ev.ref_table === 'non_conformities') return '/nao-conformidades';
  return null;
}
function EventCard({ ev }: { ev: TimelineEvent }) {
  const route = eventRoute(ev);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{kindLabel(ev.event_kind)}</span>
            <span className={'badge ' + severityClass(ev.severity)}>{ev.severity === 'warn' ? 'alerta' : ev.severity}</span>
            {ev.event_subtype ? <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{ev.event_subtype}</span> : null}
          </div>
          <h2 className="mt-2 text-base font-bold text-slate-950 dark:text-slate-50">{ev.title}</h2>
          {ev.subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{ev.subtitle}</p> : null}
        </div>
        <time className="text-right text-xs font-bold text-slate-500 dark:text-slate-400" dateTime={ev.event_at}>{formatDate(ev.event_date ?? ev.event_at.slice(0, 10))}<br />{new Date(ev.event_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
        {ev.work_nome ? <span>Obra: <strong>{ev.work_nome}</strong></span> : null}
        {ev.concretagem_codigo ? <span>Concretagem: <strong>{ev.concretagem_codigo}</strong></span> : null}
        {ev.actor_name ? <span>Ator: <strong>{ev.actor_name}</strong></span> : null}
      </div>
      {route ? <div className="mt-3"><Button variant="secondary" onClick={() => { window.location.href = route; }}>Abrir origem</Button></div> : null}
    </article>
  );
}

export function TimelinePage() {
  const [scope, setScope] = useState<Scope>('tenant');
  const [targetId, setTargetId] = useState('');
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
      {!enabled ? <EmptyState /> : query.isLoading ? <LoadingState /> : query.error ? <ErrorState message={(query.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : <div className="space-y-3">{rows.map((ev, i) => <EventCard key={(ev.ref_table ?? ev.event_kind) + '-' + (ev.ref_id ?? i) + '-' + ev.event_at} ev={ev} />)}</div>}
    </div>
  );
}
