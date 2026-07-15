import { useState } from 'react';
import { openDeferredTab } from '../../lib/pdf';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { clampNum } from '../../lib/validacao';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { FileText } from '../../components/ui/icons';
import { useToast } from '../../lib/toast';
import { LaudosResultadosPanel } from '../../components/portal/LaudosResultadosPanel';
import { listPortalWorks, submitPortalProgramacoes, listPortalConcretagens, openPortalLaudo, uploadPortalAnexo, downloadPortalAnexo, listPortalTracos, type PortalTraco, type PortalProgramacaoInput, type PortalAnexo } from '../../lib/api/portalCliente';
import { listPortalResultados, listPortalLaudosView } from '../../lib/api/portalResultados';
import { submitPortalCorrecao, getPortalCorrecaoConfig, listMeusPedidosCorrecao } from '../../lib/api/portalCorrecao';
import type { PortalCorrecaoInput } from '../../lib/portal/types';
import { PortalEstruturaTab } from './PortalEstruturaTab';
import { Modal } from '../../components/ui/Modal';
import { MoldingStandardEditor } from '../../components/domain/MoldingStandardEditor';
import { normalizePadroes, padroesToDb, type PadraoMoldagem } from '../../lib/concreto';
import { listPortalEstruturas } from '../../lib/api/portalEstrutura';
import { PortalFinancePanel } from '../../components/portal/PortalFinancePanel';

type LinhaProg = PortalProgramacaoInput & { key: string; padrao?: PadraoMoldagem[] };
const blank = (): LinhaProg => ({ key: Math.random().toString(36).slice(2), work_id: '', data_programada: '', hora_programada: '', local_texto: '', traco_texto: '', fck_previsto: null, fornecedor_texto: '', volume_programado_m3: null, observacoes: '' });
// Resumo curto do padrão de moldagem para o botão da linha (ex.: "2×7d + 4×28d").
const resumoPadrao = (p?: PadraoMoldagem[]): string => {
  if (!p?.length) return 'Padrão Lab';
  return p.map((i) => `${i.quantidadeCp || 0}×${i.idadeControle}${i.unidadeIdade === 'horas' ? 'h' : 'd'}`).join(' + ');
};
const str = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown): number | null => { const s = str(v).replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const anexosDe = (md: unknown): PortalAnexo[] => { const o = md as Record<string, unknown> | null; return o && Array.isArray(o.anexos) ? o.anexos as PortalAnexo[] : []; };

type Tab = 'programacao' | 'resultados' | 'estrutura' | 'financeiro';

// Célula "Local / peça" da tabela de programação: se a obra tem estrutura, mostra Estrutura + Peça
// (preenchem o texto); senão, texto livre.
function PortalLocalCell({ workId, value, onChange }: { workId: string; value: string; onChange: (v: string) => void }) {
  const est = useQuery({ queryKey: ['portal-estruturas', workId], queryFn: () => listPortalEstruturas(workId), enabled: !!workId });
  const [estId, setEstId] = useState('');
  const [pecaId, setPecaId] = useState('');
  const lista = est.data ?? [];
  const cur = lista.find((e) => e.id === estId) ?? null;
  return (
    <div className="min-w-[200px] space-y-1">
      {lista.length ? (
        <div className="flex gap-1">
          <select className="input !min-h-9 w-1/2 px-1 text-xs" value={estId} onChange={(e) => { setEstId(e.target.value); setPecaId(''); }} aria-label="Estrutura"><option value="">Estrutura</option>{lista.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select>
          <select className="input !min-h-9 w-1/2 px-1 text-xs" value={pecaId} disabled={!cur} onChange={(e) => { const id = e.target.value; setPecaId(id); const p = cur?.pecas.find((x) => x.id === id); if (p && cur) onChange(cur.nome + ' · ' + p.nome); }} aria-label="Peça"><option value="">Peça</option>{(cur?.pecas ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        </div>
      ) : null}
      <input aria-label="Local da concretagem" className="input min-w-[180px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Ex.: laje torre A" />
    </div>
  );
}

function PortalTracoCell({ workId, workClientId, tracos, value, onText, onPick }: { workId: string; workClientId: string; tracos: PortalTraco[]; value: string; onText: (v: string) => void; onPick: (t: PortalTraco) => void }) {
  const daObra = tracos.filter((t) => !!t.work_id && t.work_id === workId);
  const daConstr = tracos.filter((t) => !t.work_id && !!t.client_id && t.client_id === workClientId);
  const rot = (t: PortalTraco) => t.label + (t.fck != null ? ' · FCK ' + t.fck : '');
  return (
    <div className="min-w-[240px] space-y-1">
      {(daObra.length || daConstr.length) ? (
        <select className="input !min-h-9 px-2 text-xs" value="" disabled={!workId} aria-label="Selecionar traço" onChange={(e) => { const t = [...daObra, ...daConstr].find((x) => x.value === e.target.value); if (t) onPick(t); }}>
          <option value="">Selecionar traço…</option>
          {daObra.length ? <optgroup label="Desta obra">{daObra.map((t) => <option key={t.value} value={t.value}>{rot(t)}</option>)}</optgroup> : null}
          {daConstr.length ? <optgroup label="Da construtora">{daConstr.map((t) => <option key={t.value} value={t.value}>{rot(t)}</option>)}</optgroup> : null}
        </select>
      ) : null}
      <input aria-label="Traço" className="input min-w-[220px]" value={value} onChange={(e) => onText(e.target.value)} placeholder="FCK 30 | BRITA 1 | SLUMP 10±2" />
    </div>
  );
}

export function ClientePortalPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('programacao');
  const [rows, setRows] = useState([blank()]);
  const [moldKey, setMoldKey] = useState<string | null>(null);
  const [moldDraft, setMoldDraft] = useState<PadraoMoldagem[]>([]);
  const [busy, setBusy] = useState(false);
  const [anexBusy, setAnexBusy] = useState<string | null>(null);

  const works = useQuery({ queryKey: ['portal-works'], queryFn: listPortalWorks });
  const tracos = useQuery({ queryKey: ['portal-tracos'], queryFn: listPortalTracos, enabled: (works.data ?? []).length > 0 });
  const concretagens = useQuery({ queryKey: ['portal-concretagens-status'], queryFn: () => listPortalConcretagens('') });
  const laudos = useQuery({ queryKey: ['portal-laudos-view'], queryFn: () => listPortalLaudosView(), enabled: tab === 'resultados' });
  const resultados = useQuery({ queryKey: ['portal-resultados'], queryFn: () => listPortalResultados(), enabled: tab === 'resultados' });
  const correcaoCfg = useQuery({ queryKey: ['portal-correcao-config'], queryFn: getPortalCorrecaoConfig, enabled: tab === 'resultados' });
  const meusPedidos = useQuery({ queryKey: ['portal-meus-pedidos'], queryFn: () => listMeusPedidosCorrecao(), enabled: tab === 'resultados' });
  async function solicitarCorrecao(input: PortalCorrecaoInput) { await submitPortalCorrecao(input); await qc.invalidateQueries({ queryKey: ['portal-meus-pedidos'] }); toast('Pedido de correção enviado ao laboratório.', 'success'); }

  function patch(key: string, field: keyof PortalProgramacaoInput, value: unknown) { setRows((list) => list.map((r) => r.key === key ? { ...r, [field]: value } : r)); }
  function aplicarTraco(key: string, t: PortalTraco) { setRows((list) => list.map((r) => r.key === key ? { ...r, traco_texto: t.label, fck_previsto: t.fck != null ? t.fck : r.fck_previsto, padrao: t.padrao_moldagem.length ? normalizePadroes(t.padrao_moldagem, t.fck) : r.padrao } : r)); }
  function abrirMoldagem(r: LinhaProg) {
    setMoldDraft(r.padrao?.length ? r.padrao : normalizePadroes([{ idade: 28, unidade: 'dia', quantidade: 2 }], num(r.fck_previsto)));
    setMoldKey(r.key);
  }
  function salvarMoldagem() {
    if (!moldKey) return;
    setRows((list) => list.map((r) => (r.key === moldKey ? { ...r, padrao: moldDraft } : r)));
    setMoldKey(null);
  }
  function limparMoldagem() {
    if (!moldKey) return;
    setRows((list) => list.map((r) => (r.key === moldKey ? { ...r, padrao: undefined } : r)));
    setMoldKey(null);
  }
  async function enviar() {
    setBusy(true);
    try {
      const payload = rows.filter((r) => r.work_id && r.data_programada).map(({ key: _k, padrao, ...r }) => ({ ...r, fck_previsto: num(r.fck_previsto), volume_programado_m3: num(r.volume_programado_m3), padrao_moldagem: padrao?.length ? padroesToDb(padrao) : undefined }));
      if (!payload.length) throw new Error('Preencha ao menos obra e data prevista em uma linha.');
      const inserted = await submitPortalProgramacoes(payload);
      setRows([blank()]);
      await Promise.all([qc.invalidateQueries({ queryKey: ['portal-concretagens-status'] }), qc.invalidateQueries({ queryKey: ['programacoes'] })]);
      toast(inserted + ' programação(ões) enviada(s) ao laboratório.', 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function abrir(reportId: string) { const tab = openDeferredTab(); try { tab.set(await openPortalLaudo(reportId)); } catch (e) { tab.fail(); toast((e as Error).message, 'error'); } }
  async function anexar(concId: string, file: File | null) {
    if (!file) return;
    setAnexBusy(concId);
    try { await uploadPortalAnexo(concId, file); await qc.invalidateQueries({ queryKey: ['portal-concretagens-status'] }); toast('Anexo enviado.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setAnexBusy(null); }
  }
  async function baixarAnexo(path: string) { const tab = openDeferredTab(); try { tab.set(await downloadPortalAnexo(path)); } catch (e) { tab.fail(); toast((e as Error).message, 'error'); } }

  return (
    <section className="space-y-5">
      <PageHeader kicker="Portal do cliente" title="Programações, resultados e laudos" description="Solicite concretagens e acompanhe resultados e laudos emitidos pelo laboratório." />

      <div role="tablist" aria-label="Seções do portal" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        <button role="tab" type="button" aria-selected={tab === 'programacao'} onClick={() => setTab('programacao')} className={'rounded-lg px-4 py-2 text-sm font-semibold ' + (tab === 'programacao' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300')}>Programação</button>
        <button role="tab" type="button" aria-selected={tab === 'resultados'} onClick={() => setTab('resultados')} className={'rounded-lg px-4 py-2 text-sm font-semibold ' + (tab === 'resultados' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300')}>Resultados &amp; Laudos</button>
        <button role="tab" type="button" aria-selected={tab === 'estrutura'} onClick={() => setTab('estrutura')} className={'rounded-lg px-4 py-2 text-sm font-semibold ' + (tab === 'estrutura' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300')}>Estrutura da Obra</button>
        <button role="tab" type="button" aria-selected={tab === 'financeiro'} onClick={() => setTab('financeiro')} className={'rounded-lg px-4 py-2 text-sm font-semibold ' + (tab === 'financeiro' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300')}>Financeiro</button>
      </div>

      {tab === 'programacao' ? (
        <>
          <Card>
            <CardHeader title="Nova programação de concretagem">Preencha uma linha por concretagem e envie tudo para confirmação do laboratório.</CardHeader>
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[1260px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-2 py-2">Obra*</th><th>Data*</th><th>Hora</th><th>Local / peça</th><th>Traço / concreto</th><th>FCK</th><th>Moldagem</th><th>Fornecedor</th><th>Volume</th><th>Obs.</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-2"><select aria-label="Obra" className="input min-w-[190px]" value={r.work_id} onChange={(e) => patch(r.key, 'work_id', e.target.value)}><option value="">Selecione</option>{(works.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.nome}</option>)}</select></td>
                      <td><input aria-label="Data programada" className="input min-w-[140px]" type="date" value={r.data_programada} onChange={(e) => patch(r.key, 'data_programada', e.target.value)} /></td>
                      <td><input aria-label="Hora programada" className="input min-w-[100px]" type="time" value={r.hora_programada ?? ''} onChange={(e) => patch(r.key, 'hora_programada', e.target.value)} /></td>
                      <td><PortalLocalCell workId={r.work_id} value={r.local_texto ?? ''} onChange={(v) => patch(r.key, 'local_texto', v)} /></td>
                      <td><PortalTracoCell workId={r.work_id} workClientId={(works.data ?? []).find((w) => w.id === r.work_id)?.client_id ?? ''} tracos={tracos.data ?? []} value={r.traco_texto ?? ''} onText={(v) => patch(r.key, 'traco_texto', v)} onPick={(t) => aplicarTraco(r.key, t)} /></td>
                      <td><input aria-label="FCK previsto (MPa)" className="input w-24" type="number" inputMode="numeric" min={1} max={150} step="1" value={r.fck_previsto ?? ''} onChange={(e) => patch(r.key, 'fck_previsto', e.target.value)} onBlur={(e) => patch(r.key, 'fck_previsto', clampNum(e.target.value, { min: 1, max: 150, dec: 0 })?.toString() ?? '')} /></td>
                      <td><button type="button" onClick={() => abrirMoldagem(r)} title="Padrão de moldagem: quantos corpos de prova moldar por caminhão em cada idade de controle (ex.: 1×7 dias; 2×28 dias; 1×63 dias). Se não alterar, usa o Padrão Lab: 2×28 dias." className={'min-h-9 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ' + (r.padrao?.length ? 'border-slate-300 text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800' : 'border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800')}>{resumoPadrao(r.padrao)}</button></td>
                      <td><input aria-label="Fornecedor" className="input min-w-[160px]" value={r.fornecedor_texto ?? ''} onChange={(e) => patch(r.key, 'fornecedor_texto', e.target.value)} /></td>
                      <td><input aria-label="Volume programado (m³)" className="input w-24" type="number" inputMode="decimal" min={0} max={999} step="0.01" value={r.volume_programado_m3 ?? ''} onChange={(e) => patch(r.key, 'volume_programado_m3', e.target.value)} onBlur={(e) => patch(r.key, 'volume_programado_m3', clampNum(e.target.value, { min: 0, max: 999, dec: 2 })?.toString() ?? '')} /></td>
                      <td><input aria-label="Observações" className="input min-w-[180px]" value={r.observacoes ?? ''} onChange={(e) => patch(r.key, 'observacoes', e.target.value)} /></td>
                      <td className="p-2"><button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setRows((list) => list.length === 1 ? [blank()] : list.filter((x) => x.key !== r.key))}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 p-4 dark:border-slate-800"><Button variant="secondary" onClick={() => setRows((r) => [...r, blank()])}>+ Adicionar linha</Button><Button onClick={() => void enviar()} busy={busy}>{busy ? 'Enviando...' : 'Enviar programações ao laboratório'}</Button></div>
          <Modal open={!!moldKey} wide title="Padrão de moldagem da concretagem" onClose={() => setMoldKey(null)}
            footer={<><Button variant="ghost" onClick={limparMoldagem}>Usar Padrão Lab</Button><Button variant="ghost" onClick={() => setMoldKey(null)}>Cancelar</Button><Button onClick={salvarMoldagem}>Aplicar à linha</Button></>}>
            <div className="grid gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">O padrão de moldagem define <b>quantos corpos de prova são moldados por caminhão em cada idade de controle</b> (ex.: 1×7 dias; 2×28 dias; 1×63 dias). Se você não alterar, o laboratório aplica o <b>Padrão Lab</b> (2×28 dias).</p>
              <MoldingStandardEditor value={moldDraft} onChange={setMoldDraft} fck={moldKey ? num(rows.find((r) => r.key === moldKey)?.fck_previsto) : null} />
            </div>
          </Modal>
          </Card>

          <Card>
            <CardHeader title="Minhas concretagens">Status das programações enviadas. Anexe a NF/DANFE ou documentos por concretagem.</CardHeader>
            {concretagens.isLoading ? <LoadingState /> : concretagens.isError ? <ErrorState message={(concretagens.error as Error).message} /> : (concretagens.data ?? []).length === 0 ? <EmptyState /> : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">{(concretagens.data ?? []).map((c) => {
                const anexos = anexosDe(c.metadata);
                return (
                  <div key={c.id} className="p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-black text-slate-950 dark:text-slate-50">{c.codigo ?? '(sem código)'}</span><StatusBadge status={c.status} domain="concretagem" /></div><div className="mt-1 text-slate-500">{c.client_works?.nome ?? '-'} · {c.data_real ?? c.data_programada ?? '-'} · {c.local_texto ?? '-'}</div></div>
                      <label className="btn btn-secondary cursor-pointer whitespace-nowrap">{anexBusy === c.id ? 'Enviando...' : '+ Anexar arquivo'}<input type="file" className="hidden" disabled={anexBusy === c.id} onChange={(e) => void anexar(c.id, e.target.files?.[0] ?? null)} /></label>
                    </div>
                    {anexos.length ? <div className="mt-2 flex flex-wrap gap-2">{anexos.map((a, i) => <button key={a.path || i} type="button" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200" onClick={() => void baixarAnexo(a.path)}><FileText size={13} /> {a.filename}</button>)}</div> : null}
                  </div>
                );
              })}</div>
            )}
          </Card>
        </>
      ) : tab === 'estrutura' ? (
        <PortalEstruturaTab works={(works.data ?? []).map((w) => ({ id: w.id, nome: w.nome }))} />
      ) : tab === 'financeiro' ? (
        <PortalFinancePanel />
      ) : (
        <LaudosResultadosPanel
          works={(works.data ?? []).map((w) => ({ id: w.id, nome: w.nome }))}
          laudos={laudos.data ?? []}
          resultados={resultados.data ?? []}
          loading={laudos.isLoading || resultados.isLoading}
          error={laudos.isError ? (laudos.error as Error).message : resultados.isError ? (resultados.error as Error).message : null}
          onDownload={(id) => abrir(id)}
          fileLabel="meus-resultados"
          onSolicitarCorrecao={solicitarCorrecao}
          correcaoConfig={correcaoCfg.data ?? null}
          meusPedidos={meusPedidos.data ?? []}
        />
      )}
    </section>
  );
}
