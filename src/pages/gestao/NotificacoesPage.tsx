import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listDispatchLog, listMyPrefs, setMyPref } from '../../lib/api/notificacoes';

const EVENTS: [string, string][] = [
  ['laudo_pronto', 'Laudo pronto/emitido'],
  ['resultado_abaixo_fck', 'Resultado < fck na idade de controle'],
  ['cp_atrasado', 'CP atrasado (rompimento vencido)'],
  ['calibracao_vencendo', 'Calibracao de equipamento vencendo (30d)'],
];
const OFF = ['off', 'none', 'disabled'];
const statusCor = (s: string): string => s === 'sent' ? '#16a34a' : s === 'queued' ? 'var(--ink-faint)' : s === 'failed' || s === 'suppressed' ? 'var(--magenta)' : '#d97706';

export function NotificacoesPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const memberId = member?.id ?? '';

  const logQ = useQuery({ queryKey: ['dispatch-log'], queryFn: listDispatchLog });
  const prefQ = useQuery({ queryKey: ['my-prefs', memberId], queryFn: () => listMyPrefs(memberId), enabled: !!memberId });

  const prefs = prefQ.data ?? {};
  const recebe = (evt: string) => !OFF.includes(String(prefs[evt] ?? 'email'));

  async function toggle(evt: string, on: boolean) {
    if (!member) return;
    try { await setMyPref(member.tenant_id, member.id, evt, on); await qc.invalidateQueries({ queryKey: ['my-prefs', memberId] }); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  const rows = logQ.data ?? [];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Gestao" title="Notificacoes" description="Disparos de e-mail e suas preferencias." />

      <Card>
        <CardHeader kicker="Preferencias" title="Quero receber por e-mail" />
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {EVENTS.map(([evt, label]) => (
            <label key={evt} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <input type="checkbox" checked={recebe(evt)} disabled={!memberId || prefQ.isLoading} onChange={(e) => void toggle(evt, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '10px 0 0' }}>Aplica-se ao seu usuário. O envio efetivo de e-mails depende da configuração de despacho do laboratório (Sistema › E-mails).</p>
      </Card>

      <Card>
        <CardHeader kicker="Historico" title="Notificacoes recentes" />
        {logQ.isLoading ? <LoadingState /> : logQ.isError ? <ErrorState message={(logQ.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
          <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
            {rows.map((r) => {
              const md = (r.metadata && typeof r.metadata === 'object') ? r.metadata as Record<string, unknown> : {};
              const reason = String(md.reason ?? (md.dry_run ? 'dry-run' : ''));
              return (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13 }}>{(r.created_at ?? '').slice(0, 16).replace('T', ' ')} - {r.recipient_email} - <span style={{ color: 'var(--ink-faint)' }}>{r.event_type}</span></span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: statusCor(r.status) }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: statusCor(r.status) }} />{r.status}{reason ? ' (' + reason + ')' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
