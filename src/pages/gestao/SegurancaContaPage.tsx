import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { useAuth } from '../../lib/auth';
import { adminAuthAttemptSummary, adminListLoginEvents, listMyLoginEvents, type LoginEvent } from '../../lib/api/accountSecurity';

function fmtDateTime(value: string | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR');
}
function shortUa(ua: string | null): string {
  if (!ua) return '-';
  return ua.length > 92 ? ua.slice(0, 92) + '…' : ua;
}
function EventTable({ rows, admin }: { rows: LoginEvent[]; admin?: boolean }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="table-scroll"><table className="table"><thead><tr>{admin ? <th>Usuário</th> : null}<th>Data/hora</th><th>Origem</th><th>IP</th><th>Navegador</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}>{admin ? <td><div className="font-semibold">{r.member_name ?? '-'}</div><div className="text-xs text-slate-500 dark:text-slate-400">{r.email ?? '-'}</div></td> : null}<td>{fmtDateTime(r.signed_in_at)}</td><td>{r.origin}</td><td>{r.ip ?? '-'}</td><td><span title={r.user_agent ?? ''}>{shortUa(r.user_agent)}</span></td></tr>)}</tbody></table></div>
  );
}

export function SegurancaContaPage() {
  const { hasRole } = useAuth();
  const [minutes, setMinutes] = useState(60);
  const isAdmin = hasRole('admin', 'admin_consulte');
  const mine = useQuery({ queryKey: ['account-security', 'mine'], queryFn: () => listMyLoginEvents(20), staleTime: 30_000 });
  const tenant = useQuery({ queryKey: ['account-security', 'tenant'], enabled: isAdmin, queryFn: () => adminListLoginEvents(100), staleTime: 30_000 });
  const attempts = useQuery({ queryKey: ['account-security', 'attempts', minutes], enabled: isAdmin, queryFn: () => adminAuthAttemptSummary(minutes), staleTime: 30_000 });
  const myRows = mine.data ?? [];
  const tenantRows = tenant.data ?? [];
  const summary = attempts.data;
  const uniqueUsers = useMemo(() => new Set(tenantRows.map((r) => r.member_id).filter(Boolean)).size, [tenantRows]);

  return (
    <div className="space-y-6">
      <PageHeader kicker="Onda 3 · Segurança" title="Segurança da conta" description="Trilha de acessos autenticados, base para suporte, auditoria operacional e detecção de brute-force via Password Verification Hook." />
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4"><p className="kicker">Meus acessos</p><p className="mt-1 text-2xl font-bold">{myRows.length}</p></Card>
        <Card className="p-4"><p className="kicker">Usuários no tenant</p><p className="mt-1 text-2xl font-bold">{isAdmin ? uniqueUsers : '-'}</p></Card>
        <Card className="p-4"><p className="kicker">Falhas recentes</p><p className={'mt-1 text-2xl font-bold ' + (summary?.suspicious ? 'text-red-600' : '')}>{isAdmin && summary ? summary.failed_attempts : '-'}</p></Card>
      </div>
      <Card>
        <CardHeader kicker="Conta" title="Meus logins recentes">Eventos registrados após login, sem bloquear a sessão em caso de falha de telemetria.</CardHeader>
        <div className="p-5">{mine.isLoading ? <LoadingState /> : mine.error ? <ErrorState message={(mine.error as Error).message} /> : <EventTable rows={myRows} />}</div>
      </Card>
      {isAdmin ? (
        <Card>
          <CardHeader kicker="Admin" title="Acessos do laboratório">Visão tenant-scoped para suporte e segurança.</CardHeader>
          <div className="p-5">{tenant.isLoading ? <LoadingState /> : tenant.error ? <ErrorState message={(tenant.error as Error).message} /> : <EventTable rows={tenantRows} admin />}</div>
        </Card>
      ) : null}
      {isAdmin ? (
        <Card>
          <CardHeader kicker="Auth hook" title="Tentativas de autenticação">Resumo service-only; depende da ativação manual do Password Verification Hook apontando para public.password_verification_hook no painel Supabase.</CardHeader>
          <div className="flex flex-wrap items-center gap-2 p-5 pt-0">
            {[15, 60, 240, 1440].map((m) => <Button key={m} variant={minutes === m ? 'primary' : 'secondary'} onClick={() => setMinutes(m)}>{m < 60 ? m + ' min' : m === 60 ? '1 h' : m === 240 ? '4 h' : '24 h'}</Button>)}
          </div>
          <div className="p-5 pt-0">
            {attempts.isLoading ? <LoadingState /> : attempts.error ? <ErrorState message={(attempts.error as Error).message} /> : !summary ? <EmptyState /> : (
              <div className="grid gap-3 md:grid-cols-5">
                <Card className="p-4"><p className="kicker">Janela</p><p className="mt-1 text-xl font-bold">{summary.window_minutes} min</p></Card>
                <Card className="p-4"><p className="kicker">Tentativas</p><p className="mt-1 text-xl font-bold">{summary.total_attempts}</p></Card>
                <Card className="p-4"><p className="kicker">Falhas</p><p className="mt-1 text-xl font-bold">{summary.failed_attempts}</p></Card>
                <Card className="p-4"><p className="kicker">E-mails hash</p><p className="mt-1 text-xl font-bold">{summary.distinct_email_hashes}</p></Card>
                <Card className="p-4"><p className="kicker">IPs</p><p className="mt-1 text-xl font-bold">{summary.distinct_ips}</p></Card>
              </div>
            )}
            {summary?.suspicious ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">Sinal suspeito: volume de falhas/IPs acima do limiar da Onda 3. Integrar ao ops-alarm após validação do hook.</div> : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
