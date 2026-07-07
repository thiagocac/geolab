import { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { PortalCorrecaoConfig, PortalCorrecaoInput, PortalCorrecaoTipo, PortalLaudoView, PortalResultadoRow } from '../../lib/portal/types';

const TIPO_LABEL: Record<string, string> = {
  local_peca: 'Local / peça da concretagem',
  elementos_caminhao: 'Elementos concretados (por caminhão/NF)',
  resultado: 'Um resultado de corpo de prova',
  outro: 'Outro (descrever)',
};

export function CorrecaoModal({ open, onClose, laudo, cps, config, onSubmit }: {
  open: boolean; onClose: () => void; laudo: PortalLaudoView | null; cps: PortalResultadoRow[];
  config?: PortalCorrecaoConfig | null; onSubmit: (input: PortalCorrecaoInput) => Promise<void>;
}) {
  const autoedit = config?.correcao_auto_edicao_peca === true;
  const permiteResultado = config?.correcao_resultado !== false;
  const [tipo, setTipo] = useState<PortalCorrecaoTipo>('local_peca');
  const [receiptId, setReceiptId] = useState('');
  const [cpId, setCpId] = useState('');
  const [proposto, setProposto] = useState('');
  const [comentario, setComentario] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  const caminhoes = useMemo(() => {
    const seen = new Map<string, { id: string; nf: string; elementos: string }>();
    for (const r of cps) { if (r.receipt_id && !seen.has(r.receipt_id)) seen.set(r.receipt_id, { id: r.receipt_id, nf: r.nota_fiscal ?? '(sem NF)', elementos: r.elementos_concretados ?? '' }); }
    return [...seen.values()];
  }, [cps]);
  const localAtual = useMemo(() => cps.find((r) => r.local_texto)?.local_texto ?? '', [cps]);
  const caminhaoSel = caminhoes.find((c) => c.id === receiptId);

  function reset() { setTipo('local_peca'); setReceiptId(''); setCpId(''); setProposto(''); setComentario(''); setErro(''); setBusy(false); }
  function fechar() { reset(); onClose(); }

  async function enviar() {
    if (!laudo) return;
    setErro('');
    const com = comentario.trim();
    if (tipo === 'elementos_caminhao' && !receiptId) { setErro('Selecione o caminhão / NF.'); return; }
    if (tipo === 'resultado' && !cpId) { setErro('Selecione o corpo de prova.'); return; }
    const prop = autoedit && (tipo === 'local_peca' || tipo === 'elementos_caminhao') ? proposto.trim() : '';
    if (!com && !prop) { setErro('Descreva a correção solicitada.'); return; }
    setBusy(true);
    try {
      await onSubmit({
        work_id: laudo.work_id ?? '', tipo, lab_report_id: laudo.id, concretagem_id: laudo.concretagem_id,
        receipt_id: tipo === 'elementos_caminhao' ? receiptId : null,
        corpo_prova_id: tipo === 'resultado' ? cpId : null,
        valor_proposto: prop || null, comentario: com || null,
      });
      fechar();
    } catch (e) { setErro((e as Error).message); setBusy(false); }
  }

  const tipos: PortalCorrecaoTipo[] = permiteResultado ? ['local_peca', 'elementos_caminhao', 'resultado', 'outro'] : ['local_peca', 'elementos_caminhao', 'outro'];
  const isPeca = tipo === 'local_peca' || tipo === 'elementos_caminhao';

  return (
    <Modal open={open} title={'Solicitar correção' + (laudo ? ' — ' + laudo.numero : '')} onClose={fechar} footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button onClick={() => void enviar()} disabled={busy}>{busy ? 'Enviando...' : 'Enviar ao laboratório'}</Button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-xs text-slate-500">O laboratório analisa o pedido e, se aprovado, emite uma nova revisão do laudo (R+1). Correções de resultado são reavaliadas e re-lançadas pelo responsável técnico.</p>
        <label className="block"><span className="text-xs font-semibold text-slate-500">O que corrigir?</span>
          <select className="input mt-1" value={tipo} onChange={(e) => { setTipo(e.target.value as PortalCorrecaoTipo); setErro(''); }}>
            {tipos.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
        </label>

        {tipo === 'local_peca' ? (
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-xs text-slate-500">Local / peça atual</div>
            <div className="font-semibold">{localAtual || '—'}</div>
            {autoedit ? <label className="mt-2 block"><span className="text-xs font-semibold text-slate-500">Novo texto sugerido</span><input className="input mt-1" value={proposto} onChange={(e) => setProposto(e.target.value)} placeholder={localAtual} /></label> : null}
          </div>
        ) : null}

        {tipo === 'elementos_caminhao' ? (
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <label className="block"><span className="text-xs font-semibold text-slate-500">Caminhão / NF</span>
              <select className="input mt-1" value={receiptId} onChange={(e) => setReceiptId(e.target.value)}>
                <option value="">Selecione</option>
                {caminhoes.map((c) => <option key={c.id} value={c.id}>NF {c.nf}{c.elementos ? ' · ' + c.elementos : ''}</option>)}
              </select>
            </label>
            {caminhaoSel ? <div className="mt-2 text-xs text-slate-500">Elementos atuais: <span className="font-semibold text-slate-700 dark:text-slate-200">{caminhaoSel.elementos || '—'}</span></div> : null}
            {autoedit && receiptId ? <label className="mt-2 block"><span className="text-xs font-semibold text-slate-500">Novo texto sugerido</span><input className="input mt-1" value={proposto} onChange={(e) => setProposto(e.target.value)} placeholder={caminhaoSel?.elementos ?? ''} /></label> : null}
          </div>
        ) : null}

        {tipo === 'resultado' ? (
          <label className="block"><span className="text-xs font-semibold text-slate-500">Corpo de prova</span>
            <select className="input mt-1" value={cpId} onChange={(e) => setCpId(e.target.value)}>
              <option value="">Selecione</option>
              {cps.map((r) => <option key={r.cp_id} value={r.cp_id}>{(r.cp_codigo ?? r.numeracao_lab ?? r.cp_id.slice(0, 6)) + ' · ' + (r.idade_dias ?? '') + (r.idade_unidade === 'hora' ? 'h' : 'd') + ' · ' + (r.resultado_valor != null ? r.resultado_valor + ' MPa' : 'pendente')}</option>)}
            </select>
          </label>
        ) : null}

        <label className="block"><span className="text-xs font-semibold text-slate-500">{isPeca && autoedit ? 'Observação (opcional)' : 'Descreva a correção'}</span>
          <textarea className="input mt-1" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Ex.: a peça informada é laje do 3º pavimento, não do 2º." />
        </label>
        {erro ? <p className="text-sm font-semibold text-red-600">{erro}</p> : null}
      </div>
    </Modal>
  );
}
