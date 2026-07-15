import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/State';
import { openDeferredTab } from '../../lib/pdf';
import { gerarEtiquetas, listEtiquetaLotes, etiquetaLotePdfUrl, cancelarEtiquetaLote, listConcretagensParaEtiqueta, codigoEtiqueta, type GerarEtiquetasResult, type ConcretagemEtiqueta } from '../../lib/api/etiquetasLote';

const dataBR = (s: string | null) => (s && s.length >= 10 ? s.slice(0, 10).split('-').reverse().join('/') : '—');
const intOf = (v: string) => Math.max(0, Math.round(Number(v) || 0));

export function EtiquetasPage() {
  const { member, can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const podeGerar = can('etiqueta.gerenciar');

  const [modo, setModo] = useState<'avulsa' | 'concretagem'>('avulsa');
  const [qtd, setQtd] = useState('50');
  const [obs, setObs] = useState('');
  const [concId, setConcId] = useState('');
  const [previstos, setPrevistos] = useState('');
  const [cpc, setCpc] = useState('');
  const [extraCam, setExtraCam] = useState('2');
  const [busy, setBusy] = useState(false);
  const [ultimo, setUltimo] = useState<GerarEtiquetasResult | null>(null);

  const lotes = useQuery({ queryKey: ['etiqueta-lotes'], queryFn: listEtiquetaLotes });
  const concs = useQuery({ queryKey: ['etiqueta-concs'], queryFn: listConcretagensParaEtiqueta, enabled: modo === 'concretagem' });

  const conc = useMemo(() => (concs.data ?? []).find((c) => c.id === concId) ?? null, [concs.data, concId]);

  function selecionarConc(c: ConcretagemEtiqueta | null) {
    setConcId(c?.id ?? '');
    if (c) { setPrevistos(String(c.caminhoesPrevistos)); setCpc(String(c.cpsPorCaminhao)); setExtraCam('2'); }
  }

  const nPrev = intOf(previstos);
  const nCpc = intOf(cpc);
  const nExtra = intOf(extraCam);
  const baseConc = nPrev * nCpc;
  const folgaConc = nExtra * nCpc;
  const totalConc = baseConc + folgaConc;
  const totalAvulsa = intOf(qtd);

  async function gerar() {
    if (!member) return;
    setBusy(true);
    try {
      let r: GerarEtiquetasResult;
      if (modo === 'avulsa') {
        if (totalAvulsa < 1) { toast('Informe uma quantidade maior que zero.', 'error'); setBusy(false); return; }
        r = await gerarEtiquetas({ quantidade: totalAvulsa, observacao: obs || null });
      } else {
        if (!concId) { toast('Selecione a concretagem.', 'error'); setBusy(false); return; }
        if (baseConc < 1) { toast('Verifique caminhões previstos e CPs por caminhão.', 'error'); setBusy(false); return; }
        r = await gerarEtiquetas({ quantidade: baseConc, extra: folgaConc, concretagemId: concId, observacao: obs || null, caminhoesPrevistos: nPrev, caminhoesExtra: nExtra, cpsPorCaminhao: nCpc });
      }
      setUltimo(r);
      setObs('');
      await qc.invalidateQueries({ queryKey: ['etiqueta-lotes'] });
      toast('Etiquetas geradas: ' + (r.codigo_inicial ?? '') + ' a ' + (r.codigo_final ?? '') + '.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  function imprimir(loteId: string, layout: 'rolo' | 'a4') {
    const tab = openDeferredTab('Gerando etiquetas...');
    etiquetaLotePdfUrl(loteId, layout).then((u) => tab.set(u)).catch((e) => { tab.fail(); toast((e as Error).message, 'error'); });
  }

  async function cancelar(id: string) {
    if (!(await confirm({ title: 'Cancelar lote', message: 'Cancelar este lote de etiquetas? A faixa de números permanece reservada (não será reutilizada).', danger: true, confirmLabel: 'Cancelar lote' }))) return;
    try { await cancelarEtiquetaLote(id); await qc.invalidateQueries({ queryKey: ['etiqueta-lotes'] }); toast('Lote cancelado.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Concreto" title="Etiquetas" description="Gere etiquetas adesivas pré-numeradas (NNNNNN/AA por ano) com QR para colar nos corpos de prova. Normalmente em uma grande sequência avulsa; opcionalmente por concretagem, já com folga para caminhões além do previsto." />

      {podeGerar ? (
        <Card className="p-5">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <Button variant={modo === 'avulsa' ? 'primary' : 'secondary'} onClick={() => { setModo('avulsa'); setUltimo(null); }}>Avulsas (sequencia)</Button>
            <Button variant={modo === 'concretagem' ? 'primary' : 'secondary'} onClick={() => { setModo('concretagem'); setUltimo(null); }}>Por concretagem</Button>
          </div>

          {modo === 'avulsa' ? (
            <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
              <Field label="Quantidade de etiquetas" required type="number" min={1} step={1} value={qtd} onChange={(e) => setQtd(e.target.value)} hint="Uma grande sequência sem vinculo a obra/concretagem." />
              <TextArea label="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
              <div><Button onClick={() => void gerar()} disabled={busy}>{busy ? 'Gerando…' : 'Gerar ' + totalAvulsa + ' etiqueta(s)'}</Button></div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
              <SelectField label="Concretagem" required value={concId} onChange={(e) => selecionarConc((concs.data ?? []).find((c) => c.id === e.target.value) ?? null)}>
                <option value="">Selecione...</option>
                {(concs.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.codigo}{c.obra ? ' - ' + c.obra : ''}{c.data ? ' - ' + dataBR(c.data) : ''}</option>)}
              </SelectField>
              {conc ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Caminhoes previstos" type="number" min={0} step={1} value={previstos} onChange={(e) => setPrevistos(e.target.value)} />
                    <Field label="CPs por caminhão" type="number" min={0} step={1} value={cpc} onChange={(e) => setCpc(e.target.value)} />
                    <Field label="Caminhoes extra (folga)" type="number" min={0} step={1} value={extraCam} onChange={(e) => setExtraCam(e.target.value)} />
                  </div>
                  <div className="text-sm" style={{ color: 'var(--ink-faint)' }}>
                    Previsto {baseConc} + folga {folgaConc} = <strong style={{ color: 'var(--ink)' }}>{totalConc} etiqueta(s)</strong> ({nPrev + nExtra} caminhões x {nCpc} CP)
                  </div>
                  <div><Button onClick={() => void gerar()} disabled={busy}>{busy ? 'Gerando…' : 'Gerar ' + totalConc + ' etiqueta(s)'}</Button></div>
                </>
              ) : concs.isLoading ? <LoadingState /> : null}
            </div>
          )}

          {ultimo && ultimo.ok ? (
            <div className="mt-4 rounded-2xl bg-slate-100 dark:bg-slate-800" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div className="text-xs font-bold uppercase" style={{ color: 'var(--ink-faint)' }}>Lote gerado</div>
                <div className="text-lg font-black">{ultimo.codigo_inicial} — {ultimo.codigo_final}</div>
                <div className="text-sm" style={{ color: 'var(--ink-faint)' }}>{ultimo.total} etiqueta(s)</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="secondary" onClick={() => ultimo.id && imprimir(ultimo.id, 'rolo')}>Imprimir rolo 60x40</Button>
                <Button variant="secondary" onClick={() => ultimo.id && imprimir(ultimo.id, 'a4')}>Imprimir A4</Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="text-lg font-black text-slate-950 dark:text-slate-50" style={{ marginBottom: 12 }}>Lotes gerados</h2>
        {lotes.isLoading ? <LoadingState /> : lotes.isError ? <ErrorState message={(lotes.error as Error).message} /> : (lotes.data ?? []).length === 0 ? <EmptyState /> : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Data</th><th>Origem</th><th>Faixa</th><th style={{ textAlign: 'right' }}>Total</th><th>Status</th><th></th></tr></thead>
              <tbody>{(lotes.data ?? []).map((l) => (
                <tr key={l.id} style={l.status === 'cancelado' ? { opacity: 0.5 } : undefined}>
                  <td>{dataBR(l.created_at)}</td>
                  <td>{l.origem === 'concretagem' ? (l.obra ?? 'Concretagem') + (l.conc_rel ? ' - ' + l.conc_rel : (l.conc_codigo ? ' - ' + l.conc_codigo : '')) : 'Avulsa'}</td>
                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{codigoEtiqueta(l.seq_inicial, l.ano)} — {codigoEtiqueta(l.seq_final, l.ano)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800 }}>{l.total}</td>
                  <td>{l.status === 'cancelado' ? <span style={{ color: 'var(--magenta)' }}>Cancelado</span> : 'Ativo'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Button variant="ghost" onClick={() => imprimir(l.id, 'rolo')}>Rolo</Button>
                    <Button variant="ghost" onClick={() => imprimir(l.id, 'a4')}>A4</Button>
                    {podeGerar && l.status !== 'cancelado' ? <Button variant="ghost" onClick={() => void cancelar(l.id)}>Cancelar</Button> : null}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
