import { Button } from './ui/Button';
import { formatDate } from '../lib/format';
import type { TimelineEvent } from '../lib/api/timeline';

const KIND_LABELS: Record<string, string> = {
  auditoria: 'Auditoria', concretagem: 'Concretagem', moldagem: 'Moldagem',
  rompimento: 'Rompimento', resultado: 'Resultado', laudo: 'Laudo',
};
function severityClass(severity: string) {
  if (severity === 'error') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (severity === 'warn') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
}
function kindLabel(kind: string) { return KIND_LABELS[kind] ?? kind; }
function eventRoute(ev: TimelineEvent): string | null {
  if (ev.concretagem_id) return '/concretagens/' + ev.concretagem_id;
  if (ev.ref_table === 'lab_reports') return '/laudos';
  if (ev.ref_table === 'non_conformities') return '/nao-conformidades';
  return null;
}

function EventCard({ ev, hideOrigin }: { ev: TimelineEvent; hideOrigin?: boolean }) {
  const route = hideOrigin ? null : eventRoute(ev);
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

export function TimelineList({ events, hideOrigin }: { events: TimelineEvent[]; hideOrigin?: boolean }) {
  return <div className="space-y-3">{events.map((ev, i) => <EventCard key={(ev.ref_table ?? ev.event_kind) + '-' + (ev.ref_id ?? i) + '-' + ev.event_at} ev={ev} hideOrigin={hideOrigin} />)}</div>;
}
