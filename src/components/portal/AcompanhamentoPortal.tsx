import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/State';
import { hojeISO } from '../../lib/portal/resultados';
import type { PortalResultadoRow } from '../../lib/portal/types';
import type { PortalFinanceiro } from '../../lib/api/portalResultados';

const money = (v: number | null) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

export function AcompanhamentoPortal({ resultados, financeiro, verAgenda, verMedicao, verNc }: {
  resultados: PortalResultadoRow[]; financeiro: PortalFinanceiro[];
  verAgenda: boolean; verMedicao: boolean; verNc: boolean;
}) {
  const hoje = hojeISO();
  const agenda = resultados
    .filter((r) => r.resultado_valor == null && r.situacao === 'pendente' && r.data_prevista_rompimento)
    .sort((a, b) => String(a.data_prevista_rompimento).localeCompare(String(b.data_prevista_rompimento)))
    .slice(0, 200);

  return (
    <div className="space-y-4">
      {verAgenda ? (
        <Card>
          <CardHeader kicker="Acompanhamento" title="Agenda de rompimentos">Corpos de prova pendentes e a data prevista de ensaio.</CardHeader>
          {agenda.length === 0 ? <EmptyState /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-3 py-2">Data prevista</th><th>Concretagem</th><th>CP</th><th>Idade</th><th>Situação</th></tr></thead>
                <tbody>{agenda.map((r) => {
                  const venc = !!r.data_prevista_rompimento && r.data_prevista_rompimento < hoje;
                  return (<tr key={r.cp_id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 font-semibold">{r.data_prevista_rompimento}</td>
                    <td>{r.concretagem_codigo ?? '—'}{r.work_nome ? ' · ' + r.work_nome : ''}</td>
                    <td>{r.cp_codigo ?? r.numeracao_lab ?? '—'}</td>
                    <td>{r.idade_dias ?? '—'}{r.idade_unidade === 'hora' ? 'h' : 'd'}</td>
                    <td>{venc ? <Badge tone="danger">atrasado</Badge> : <Badge tone="info">agendado</Badge>}</td>
                  </tr>);
                })}</tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {verMedicao ? (
        <Card>
          <CardHeader kicker="Financeiro" title="Medição e faturamento">Medições e faturas emitidas pelo laboratório para a sua empresa.</CardHeader>
          {financeiro.length === 0 ? <EmptyState /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">{financeiro.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
                    <Badge tone={m.tipo === 'fatura' ? 'brand' : 'info'}>{m.tipo === 'fatura' ? 'Fatura' : 'Medição'}</Badge>
                    {m.numero ? 'Nº ' + m.numero : ''}{m.competencia ? ' · ' + m.competencia : ''}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{m.periodo_inicio ? 'Período ' + m.periodo_inicio + ' a ' + (m.periodo_fim ?? '—') : (m.data_emissao ? 'Emissão ' + m.data_emissao : '')}</div>
                </div>
                <div className="flex items-center gap-3"><span className="font-black text-slate-900 dark:text-slate-50">{money(m.valor)}</span>{m.status ? <StatusBadge status={m.status} /> : null}</div>
              </div>
            ))}</div>
          )}
        </Card>
      ) : null}

      {verNc ? (
        <Card>
          <CardHeader kicker="Qualidade" title="Não conformidades">Acompanhamento das não conformidades das suas obras.</CardHeader>
          <p className="p-4 text-sm text-slate-500">Nenhuma não conformidade registrada para as suas obras. Quando o laboratório registrar uma NC vinculada à sua obra, ela aparecerá aqui.</p>
        </Card>
      ) : null}
    </div>
  );
}
