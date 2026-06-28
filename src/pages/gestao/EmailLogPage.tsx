import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listDispatchLog, dispatchCountsByStatus, getDispatchSettings, saveDispatchSettings, listOutbox, listSuppressions, addSuppression, removeSuppression, listEventTypes, type DispatchLogRow, type OutboxRow, type SuppressionRow, type EventType } from '../../lib/api/emails';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';

/**
 * Painel de E-mails (admin) — lê notification_dispatch_log + notification_dispatch_settings (singleton)
 * + notify_event_outbox, filtrando SEMPRE por tenant_id explícito (além da RLS is_tenant_member).
 * Permite alternar os flags de despacho (dispatch_enabled / dry_run) — UPDATE liberado por
 * has_role('admin_consulte'). NUNCA expõe dispatch_secret. Auto-refresh a cada 60s.
 *
 * DEPENDÊNCIA: regenerar database.types.ts após aplicar 072 (dispatcher/quiet-hours) e as tabelas de
 * notificação (065–070, fora desta pasta) — senão o tsc/vite acusa "table não existe". O esbuild passa.
 */

const REFRESH_MS = 60_000;
const STATUSES = ['queued', 'sent', 'skipped', 'suppressed', 'failed', 'bounced'] as const;

const STATUS_TONE: Record<string, string> = {
  sent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  queued: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  skipped: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  suppressed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  bounced: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  complained: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};
function StatusPill({ s }: { s: string }) {
  const tone = STATUS_TONE[s] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{s}</span>;
}

const fmtDT = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('pt-BR') : '—');

// Uma etapa da escada de ciclo de vida do e-mail (enviado → entregue → aberto → clicado → bounce/reclamação).
function Etapa({ label, at, reached, negativo, extra }: { label: string; at: string | null; reached: boolean; negativo?: boolean; extra?: string | null }) {
  const dot = negativo ? 'bg-red-500' : reached ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600';
  const txt = negativo ? 'text-red-700 dark:text-red-300' : reached ? 'text-slate-900 dark:text-slate-50' : 'text-slate-400';
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <div className={`text-sm font-semibold ${txt}`}>{label}</div>
        <div className="break-words text-xs text-slate-500 dark:text-slate-400">{reached || negativo ? fmtDT(at) : 'não registrado'}{extra ? ` · ${extra}` : ''}</div>
      </div>
    </div>
  );
}

// Campo rotulado do painel de detalhe (oculta-se quando vazio).
function Info({ label, value, mono, full, danger }: { label: string; value: string | null | undefined; mono?: boolean; full?: boolean; danger?: boolean }) {
  if (value == null || value === '') return null;
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`mt-0.5 break-words ${mono ? 'font-mono text-xs' : 'text-sm'} ${danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{value}</dd>
    </div>
  );
}

export function EmailLogPage() {
  const { member, hasRole } = useAuth();
  const tenantId = member?.tenant_id ?? '';
  const podeEditar = hasRole('admin', 'admin_consulte');
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>('');
  const [detalhe, setDetalhe] = useState<DispatchLogRow | null>(null);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoMotivo, setNovoMotivo] = useState('');
  const [suprBusy, setSuprBusy] = useState(false);
  const [suprMsg, setSuprMsg] = useState<string | null>(null);
  const [novoAllow, setNovoAllow] = useState('');

  const counts = useQuery({ queryKey: ['eml', 'counts', tenantId], enabled: !!tenantId, refetchInterval: REFRESH_MS, queryFn: () => dispatchCountsByStatus(tenantId, 7) });
  const settings = useQuery({ queryKey: ['eml', 'settings'], refetchInterval: REFRESH_MS, queryFn: () => getDispatchSettings() });
  const log = useQuery({ queryKey: ['eml', 'log', tenantId, filtro], enabled: !!tenantId, refetchInterval: REFRESH_MS, queryFn: () => listDispatchLog(tenantId, { status: filtro || undefined, limit: 100 }) });
  const outbox = useQuery({ queryKey: ['eml', 'outbox', tenantId], enabled: !!tenantId, refetchInterval: REFRESH_MS, queryFn: () => listOutbox(tenantId, { limit: 60 }) });
  const podeSupressao = hasRole('admin_consulte');
  const supr = useQuery({ queryKey: ['eml', 'suppr'], enabled: podeSupressao, refetchInterval: REFRESH_MS, queryFn: () => listSuppressions() });
  const evtypes = useQuery({ queryKey: ['eml', 'evtypes'], staleTime: 300_000, queryFn: listEventTypes });
  const evMap = useMemo(() => new Map((evtypes.data ?? []).map((t) => [t.key, t] as const)), [evtypes.data]);
  const labelEvento = (key: string) => evMap.get(key)?.descricao || key;

  const s = settings.data;
  const envioReal = !!s?.dispatch_enabled && s?.dry_run === false;
  const allow = Array.isArray(s?.email_allowlist) ? s!.email_allowlist! : [];

  async function toggle(field: 'dispatch_enabled' | 'dry_run', value: boolean) {
    if (!podeEditar) return;
    const nextEnabled = field === 'dispatch_enabled' ? value : !!s?.dispatch_enabled;
    const nextDryRun = field === 'dry_run' ? value : (s?.dry_run !== false);
    if (nextEnabled && nextDryRun === false && !envioReal) {
      if (!(await confirm({ title: 'Ativar envio real de e-mails', message: 'Isto passa a enviar e-mails de verdade aos clientes e à equipe (via Resend), fora do modo de teste. Confirmar?', danger: true, confirmLabel: 'Ativar envio real' }))) return;
    }
    setSaving(true); setSaveMsg(null);
    try {
      await saveDispatchSettings({ [field]: value }, member?.id);
      await settings.refetch();
      setSaveMsg('Configuração atualizada.');
    } catch (e) {
      setSaveMsg(`Falha ao salvar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function salvarAllowlist(next: string[]) {
    if (!podeEditar) return;
    setSaving(true); setSaveMsg(null);
    try {
      await saveDispatchSettings({ email_allowlist: next.length ? next : null }, member?.id);
      await settings.refetch();
      setSaveMsg('Allowlist atualizada.');
    } catch (e) {
      setSaveMsg(`Falha ao salvar allowlist: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }
  function adicionarAllow() {
    const email = novoAllow.trim().toLowerCase();
    if (!email) return;
    const atual = Array.isArray(s?.email_allowlist) ? s!.email_allowlist! : [];
    setNovoAllow('');
    if (atual.includes(email)) return;
    void salvarAllowlist([...atual, email]);
  }
  function removerAllow(email: string) {
    const atual = Array.isArray(s?.email_allowlist) ? s!.email_allowlist! : [];
    void salvarAllowlist(atual.filter((x) => x !== email));
  }
  async function limparAllowlist() {
    if (!(await confirm({ title: 'Liberar todos os destinatários', message: 'Esvaziar a allowlist faz com que, em envio real, TODOS os destinatários recebam e-mails (sem restrição de teste). Confirmar?', danger: true, confirmLabel: 'Liberar todos' }))) return;
    void salvarAllowlist([]);
  }

  async function adicionarSupr() {
    const email = novoEmail.trim();
    if (!email) return;
    setSuprBusy(true); setSuprMsg(null);
    try {
      await addSuppression(email, novoMotivo);
      setNovoEmail(''); setNovoMotivo('');
      await supr.refetch();
      setSuprMsg(`Supressão adicionada: ${email.toLowerCase()}.`);
    } catch (e) {
      setSuprMsg(`Falha ao adicionar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSuprBusy(false);
    }
  }

  async function removerSupr(email: string) {
    if (!(await confirm({ title: 'Remover supressão', message: `Reabilitar envios para ${email}? Ele voltará a poder receber e-mails.`, confirmLabel: 'Remover' }))) return;
    setSuprBusy(true); setSuprMsg(null);
    try {
      await removeSuppression(email);
      await supr.refetch();
      setSuprMsg(`Supressão removida: ${email}.`);
    } catch (e) {
      setSuprMsg(`Falha ao remover: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSuprBusy(false);
    }
  }

  const c = counts.data ?? {};
  const cnt = (k: string) => c[k] ?? 0;
  const backlog = (outbox.data ?? []).filter((o) => o.status !== 'processed').length;

  return (
    <div className="space-y-6">
      <PageHeader kicker="Sistema" title="E-mails" description="Despacho transacional (Resend): configuração, fila e histórico de envios do laboratório. Atualiza a cada 60s." />

      {/* Banner de modo de envio */}
      {settings.isLoading ? null : settings.error ? <ErrorState message={(settings.error as Error).message} /> : (
        <div className={`rounded-2xl border p-4 ${envioReal ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {envioReal ? '⚠ Envio real de e-mails ATIVO' : 'Nenhum e-mail real será enviado'}
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                {envioReal
                  ? 'O dispatcher está habilitado e fora do modo de teste — os e-mails saem pelo Resend.'
                  : 'Os eventos são registrados como "queued" (dry-run/despacho desligado), sem envio externo.'}
                {Array.isArray(s?.email_allowlist) && s!.email_allowlist!.length > 0 ? ` Allowlist ativa: ${s!.email_allowlist!.length} endereço(s).` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={!podeEditar || saving} onClick={() => toggle('dispatch_enabled', !s?.dispatch_enabled)}
                className={`min-h-10 rounded-xl px-3 text-sm font-semibold shadow-sm disabled:opacity-50 ${s?.dispatch_enabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100'}`}>
                Despacho: {s?.dispatch_enabled ? 'ON' : 'OFF'}
              </button>
              <button type="button" disabled={!podeEditar || saving} onClick={() => toggle('dry_run', !(s?.dry_run !== false))}
                className={`min-h-10 rounded-xl px-3 text-sm font-semibold shadow-sm disabled:opacity-50 ${s?.dry_run !== false ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100'}`}>
                Dry-run: {s?.dry_run !== false ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
          {/* Editor de allowlist (modo de teste) */}
          <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-900/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Allowlist {allow.length ? `· ${allow.length} endereço(s) — só eles recebem em envio real` : '· vazia — todos recebem em envio real'}
              </p>
              {podeEditar && allow.length ? <Button variant="ghost" onClick={limparAllowlist} disabled={saving}>Liberar todos</Button> : null}
            </div>
            {allow.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {allow.map((em: string) => (
                  <span key={em} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {em}
                    {podeEditar ? <button type="button" aria-label={`Remover ${em}`} className="leading-none text-slate-400 hover:text-red-600 disabled:opacity-50" disabled={saving} onClick={() => removerAllow(em)}>×</button> : null}
                  </span>
                ))}
              </div>
            ) : null}
            {podeEditar ? (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="min-w-[14rem] grow"><Field label="Adicionar à allowlist" type="email" placeholder="equipe@exemplo.com" value={novoAllow} onChange={(e) => setNovoAllow(e.target.value)} /></div>
                <Button onClick={adicionarAllow} disabled={saving || !novoAllow.trim()}>Adicionar</Button>
              </div>
            ) : null}
          </div>
          {saveMsg ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{saveMsg}</p> : null}
          {!podeEditar ? <p className="mt-2 text-xs text-slate-400">Somente administradores podem alterar estes flags.</p> : null}
        </div>
      )}

      {/* Contadores por status (7d) */}
      {counts.isLoading ? <LoadingState /> : counts.error ? <ErrorState message={(counts.error as Error).message} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Stat label="Enviados (7d)" value={cnt('sent')} />
          <Stat label="Na fila / dry-run" value={cnt('queued')} />
          <Stat label="Pulados" value={cnt('skipped')} />
          <Stat label="Suprimidos" value={cnt('suppressed')} />
          <Stat label="Falhas" value={cnt('failed')} />
          <Stat label="Backlog (outbox)" value={backlog} />
        </div>
      )}

      {/* Backlog do outbox */}
      <Card>
        <CardHeader kicker="Fila" title="Outbox do dispatcher">Eventos pendentes/erro do dispatcher SQL (notify_event_outbox).</CardHeader>
        <div className="p-5">
          {outbox.isLoading ? <LoadingState /> : outbox.error ? <ErrorState message={(outbox.error as Error).message} />
            : (outbox.data?.length ?? 0) === 0 ? <p className="text-sm text-emerald-700 dark:text-emerald-400">Fila vazia. ✓</p>
            : (
            <div className="table-scroll"><table className="table">
              <thead><tr><th>Criado</th><th>Evento</th><th>Modo</th><th>Status</th><th>Tentativas</th><th>Erro</th></tr></thead>
              <tbody>{outbox.data!.map((o: OutboxRow) => (
                <tr key={o.id}>
                  <td className="text-slate-500 whitespace-nowrap">{new Date(o.created_at).toLocaleString('pt-BR')}</td>
                  <td className="font-medium"><span title={o.event_type}>{labelEvento(o.event_type)}</span></td>
                  <td className="text-slate-500">{o.mode}</td>
                  <td><StatusPill s={o.status} /></td>
                  <td className="tabular-nums">{o.attempts}</td>
                  <td className="text-xs text-slate-500">{o.last_error ? <span className="text-red-600 dark:text-red-400">{o.last_error}</span> : '—'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      </Card>

      {/* Supressões (entregabilidade) — somente admin_consulte (RLS) */}
      {podeSupressao ? (
        <Card>
          <CardHeader kicker="Entregabilidade" title="Supressões de e-mail">Endereços bloqueados por bounce/reclamação/manual. Um e-mail aqui não recebe mais envios até ser removido.</CardHeader>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[16rem] grow"><Field label="Adicionar supressão (e-mail)" type="email" placeholder="cliente@exemplo.com" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} /></div>
              <div className="min-w-[10rem]"><Field label="Motivo" placeholder="manual" value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} /></div>
              <Button onClick={adicionarSupr} disabled={suprBusy || !novoEmail.trim()}>Adicionar</Button>
            </div>
            {suprMsg ? <p className="text-sm text-slate-600 dark:text-slate-300">{suprMsg}</p> : null}
            {supr.isLoading ? <LoadingState /> : supr.error ? <ErrorState message={(supr.error as Error).message} />
              : (supr.data?.length ?? 0) === 0 ? <p className="text-sm text-emerald-700 dark:text-emerald-400">Nenhuma supressão — caixa saudável. ✓</p>
              : (
              <div className="table-scroll"><table className="table">
                <thead><tr><th>E-mail</th><th>Motivo</th><th>Desde</th><th className="text-right">Ação</th></tr></thead>
                <tbody>{supr.data!.map((r: SuppressionRow) => (
                  <tr key={r.email}>
                    <td className="font-medium">{r.email}</td>
                    <td><span className="text-xs text-slate-600 dark:text-slate-300">{r.reason ?? '—'}</span></td>
                    <td className="whitespace-nowrap text-slate-500">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                    <td className="text-right"><Button variant="ghost" onClick={() => removerSupr(r.email)} disabled={suprBusy}>Remover</Button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        </Card>
      ) : null}

      {/* Histórico de envios */}
      <Card>
        <CardHeader kicker="Histórico" title="Envios recentes">Últimos registros do notification_dispatch_log do laboratório.</CardHeader>
        <div className="p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setFiltro('')} className={`rounded-full px-3 py-1 text-xs font-semibold ${filtro === '' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>todos</button>
            {STATUSES.map((st) => (
              <button key={st} type="button" onClick={() => setFiltro(st)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filtro === st ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{st}</button>
            ))}
          </div>
          {log.isLoading ? <LoadingState /> : log.error ? <ErrorState message={(log.error as Error).message} />
            : (log.data?.length ?? 0) === 0 ? <EmptyState />
            : (
            <div className="table-scroll"><table className="table">
              <thead><tr><th>Quando</th><th>Destinatário</th><th>Evento</th><th>Status</th><th>Aberturas</th><th>Detalhe</th></tr></thead>
              <tbody>{log.data!.map((r: DispatchLogRow) => (
                <tr key={r.id} onClick={() => setDetalhe(r)} title="Ver detalhe do envio" className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="text-slate-500 whitespace-nowrap">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td className="font-medium">{r.recipient_email}</td>
                  <td className="text-slate-500"><span title={r.event_type}>{labelEvento(r.event_type)}</span></td>
                  <td><StatusPill s={r.status} /></td>
                  <td className="tabular-nums text-slate-500">{r.open_count ?? 0}</td>
                  <td className="text-xs text-slate-500">{r.error_message ? <span className="text-red-600 dark:text-red-400">{r.error_message}</span> : (r.metadata && typeof r.metadata === 'object' && 'reason' in (r.metadata as Record<string, unknown>) ? String((r.metadata as Record<string, unknown>).reason) : (r.resend_id ?? '—'))}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      </Card>

      {/* Catálogo de eventos (referência + rótulos) */}
      <Card>
        <CardHeader kicker="Referência" title="Catálogo de eventos">Tipos de evento conhecidos e seus rótulos, categoria, severidade e canal padrão.</CardHeader>
        <div className="p-5">
          {evtypes.isLoading ? <LoadingState /> : evtypes.error ? <ErrorState message={(evtypes.error as Error).message} />
            : (evtypes.data?.length ?? 0) === 0 ? <p className="text-sm text-slate-500">Nenhum tipo de evento cadastrado.</p>
            : (
            <div className="table-scroll"><table className="table">
              <thead><tr><th>Descrição</th><th>Código</th><th>Categoria</th><th>Severidade</th><th>Canal</th><th>Flags</th></tr></thead>
              <tbody>{evtypes.data!.map((t: EventType) => (
                <tr key={t.key}>
                  <td className="font-medium">{t.descricao ?? t.key}</td>
                  <td><span className="font-mono text-xs text-slate-500" title={t.key}>{t.codigo ?? t.key}</span></td>
                  <td className="text-slate-600 dark:text-slate-300">{t.categoria ?? '—'}</td>
                  <td>{t.severidade === 'warning' ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">warning</span> : <span className="text-xs text-slate-500">{t.severidade ?? '—'}</span>}</td>
                  <td className="text-slate-500">{t.default_channel ?? '—'}</td>
                  <td className="text-xs text-slate-500">{[t.is_system ? 'sistema' : null, t.digest ? 'digest' : null, t.active === false ? 'inativo' : null].filter(Boolean).join(' · ') || '—'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      </Card>

      <Modal open={!!detalhe} wide title="Detalhe do envio" onClose={() => setDetalhe(null)}>
        {detalhe ? (() => {
          const status = String(detalhe.status);
          const saiu = ['sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'].includes(status);
          const naoSaiu = ['skipped', 'suppressed', 'failed'].includes(status);
          const enviadoLabel = saiu ? 'Enviado' : status === 'queued' ? 'Na fila (dry-run/aguardando)' : status === 'failed' ? 'Falha no envio' : status === 'suppressed' ? 'Suprimido' : status === 'skipped' ? 'Pulado' : 'Enviado';
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-slate-50">{detalhe.recipient_email}</span>
                <StatusPill s={status} />
                <span className="text-xs text-slate-500" title={detalhe.event_type}>{labelEvento(detalhe.event_type)}</span>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Ciclo de vida</div>
                <div className="space-y-3">
                  <Etapa label={enviadoLabel} at={detalhe.created_at} reached={saiu} negativo={naoSaiu} extra={detalhe.resend_id ? `id ${detalhe.resend_id}` : (!saiu ? (detalhe.error_message ?? status) : null)} />
                  <Etapa label="Entregue" at={detalhe.delivered_at} reached={!!detalhe.delivered_at} />
                  <Etapa label="Aberto" at={detalhe.opened_at} reached={!!detalhe.opened_at} extra={detalhe.open_count ? `${detalhe.open_count}×` : null} />
                  <Etapa label="Clicado" at={detalhe.clicked_at} reached={!!detalhe.clicked_at} extra={detalhe.click_count ? `${detalhe.click_count}×` : null} />
                  {detalhe.bounced_at ? <Etapa label="Bounce (rejeitado)" at={detalhe.bounced_at} reached negativo /> : null}
                  {detalhe.complained_at ? <Etapa label="Reclamação (spam)" at={detalhe.complained_at} reached negativo /> : null}
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Info label="Evento" value={`${labelEvento(detalhe.event_type)} (${detalhe.event_type})`} />
                <Info label="Categoria" value={evMap.get(detalhe.event_type)?.categoria ?? null} />
                <Info label="Severidade" value={evMap.get(detalhe.event_type)?.severidade ?? null} />
                <Info label="Status" value={status} />
                <Info label="Resend ID" value={detalhe.resend_id} mono />
                <Info label="Dedupe" value={detalhe.dedupe_key} mono />
                <Info label="Entidade de origem" value={detalhe.entity_type ? `${detalhe.entity_type}${detalhe.entity_id ? ` · ${detalhe.entity_id}` : ''}` : null} />
                <Info label="Última atividade" value={fmtDT(detalhe.updated_at)} />
                <Info label="Último link clicado" value={detalhe.last_clicked_url} full mono />
                <Info label="User-agent" value={detalhe.last_user_agent} full />
                <Info label="Erro / motivo" value={detalhe.error_message} full danger />
              </dl>

              {detalhe.metadata && typeof detalhe.metadata === 'object' && Object.keys(detalhe.metadata).length > 0 ? (
                <details className="rounded-xl border border-slate-200 dark:border-slate-700">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Metadata</summary>
                  <pre className="overflow-auto px-3 pb-3 text-xs text-slate-500">{JSON.stringify(detalhe.metadata, null, 2)}</pre>
                </details>
              ) : null}
            </div>
          );
        })() : null}
      </Modal>
    </div>
  );
}
