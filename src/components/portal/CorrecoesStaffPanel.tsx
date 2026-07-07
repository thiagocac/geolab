import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { useToast } from '../../lib/toast';
import { listCorrecoesStaff, decidirCorrecao } from '../../lib/api/portalCorrecao';
import { gerarLaudo } from '../../lib/api/laudo';
import type { PortalCorrecao } from '../../lib/portal/types';

const TIPO_LABEL: Record<string, string> = { local_peca: 'Local / peça', elementos_caminhao: 'Elementos do caminhão', resultado: 'Resultado de CP', outro: 'Outro' };
const isPeca = (t: string) => t === 'local_peca' || t === 'elementos_caminhao';

export function CorrecoesStaffPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['correcoes-staff'], queryFn: () => listCorrecoesStaff() });
  const [acao, setAcao] = useState<{ p: PortalCorrecao; modo: 'aprovar' | 'rejeitar' } | null>(null);
  const [valorFinal, setValorFinal] = useState('');
  const [coment, setComent] = useState('');
  const [busy, setBusy] = useState(false);

  const abertos = (q.data ?? []).filter((p) => p.status === 'pendente' || p.status === 'em_analise');
  if (q.isLoading || !abertos.length) return null;

  function abrir(p: PortalCorrecao, modo: 'aprovar' | 'rejeitar') { setAcao({ p, modo }); setComent(''); setValorFinal(p.valor_proposto ?? p.valor_atual ?? ''); }
  async function confirmar() {
    if (!acao) return;
    const { p, modo } = acao; setBusy(true);
    try {
      if (modo === 'rejeitar') {
        await decidirCorrecao(p.id, 'rejeitar', coment.trim() || undefined);
        toast('Pedido rejeitado.', 'success');
      } else {
        const res = await decidirCorrecao(p.id, 'aprovar', coment.trim() || undefined, isPeca(p.tipo) ? (valorFinal.trim() || undefined) : undefined);
        if (res.needs_reemissao && res.concretagem_id) {
          try { await gerarLaudo(String(res.concretagem_id), true); toast('Correção aplicada e laudo reemitido (nova revisão em rascunho).', 'success'); }
          catch { toast('Correção aplicada. Falha ao reemitir — gere o laudo manualmente em Novo laudo.', 'warning'); }
        } else { toast('Correção registrada. Para resultado, re-lance o valor no Rompimentos e reemita o laudo.', 'info'); }
      }
      await Promise.all([qc.invalidateQueries({ queryKey: ['correcoes-staff'] }), qc.invalidateQueries({ queryKey: ['laudos'] }), qc.invalidateQueries({ queryKey: ['laudos-cls'] })]);
      setAcao(null);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10">
      <CardHeader title={'Correções solicitadas pelo cliente (' + abertos.length + ')'}>Pedidos abertos no portal. Aprovar peça aplica o texto e reemite o laudo (R+1); resultado é re-lançado pelo RT no Rompimentos.</CardHeader>
      <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
        {abertos.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning">{TIPO_LABEL[p.tipo] ?? p.tipo}</Badge>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{p.lab_report_numero ? 'Laudo ' + p.lab_report_numero : (p.concretagem_codigo ?? '—')}</span>
                <span className="text-slate-500">{p.work_nome ?? ''}</span>
              </div>
              <div className="mt-1 text-slate-600 dark:text-slate-300">
                {isPeca(p.tipo) ? <><span className="text-slate-400 line-through">{p.valor_atual || '—'}</span>{p.valor_proposto ? <> {'→'} <span className="font-semibold">{p.valor_proposto}</span></> : null}</> : null}
                {p.comentario_cliente ? <div className="text-xs text-slate-500">{'"' + p.comentario_cliente + '"'}</div> : null}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => abrir(p, 'rejeitar')}>Rejeitar</Button>
              <Button onClick={() => abrir(p, 'aprovar')}>Aprovar</Button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!acao} title={acao?.modo === 'aprovar' ? 'Aprovar correção' : 'Rejeitar correção'} onClose={() => setAcao(null)} footer={<><Button variant="ghost" onClick={() => setAcao(null)}>Cancelar</Button><Button onClick={() => void confirmar()} disabled={busy}>{busy ? 'Processando...' : (acao?.modo === 'aprovar' ? 'Aprovar' : 'Rejeitar')}</Button></>}>
        {acao ? (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">{(TIPO_LABEL[acao.p.tipo] ?? acao.p.tipo) + ' · ' + (acao.p.lab_report_numero ? 'Laudo ' + acao.p.lab_report_numero : (acao.p.concretagem_codigo ?? ''))}</p>
            {acao.p.comentario_cliente ? <p className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{'Cliente: "' + acao.p.comentario_cliente + '"'}</p> : null}
            {acao.modo === 'aprovar' && isPeca(acao.p.tipo) ? (
              <label className="block"><span className="text-xs font-semibold text-slate-500">{'Texto final (' + (acao.p.tipo === 'local_peca' ? 'Local / peça' : 'Elementos concretados') + ')'}</span><input className="input mt-1" value={valorFinal} onChange={(e) => setValorFinal(e.target.value)} /></label>
            ) : null}
            {acao.modo === 'aprovar' && acao.p.tipo === 'resultado' ? <p className="text-xs text-amber-700 dark:text-amber-300">Aprovar apenas registra o aceite. Re-lance o valor correto na tela de Rompimentos (mantém o histórico) e reemita o laudo.</p> : null}
            <label className="block"><span className="text-xs font-semibold text-slate-500">{'Comentário ' + (acao.modo === 'rejeitar' ? '(motivo)' : '(opcional)')}</span><textarea className="input mt-1" rows={2} value={coment} onChange={(e) => setComent(e.target.value)} /></label>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
