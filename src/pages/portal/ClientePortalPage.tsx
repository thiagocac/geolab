import { useState } from 'react';
import { openDeferredTab } from '../../lib/pdf';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { FileText } from '../../components/ui/icons';
import { useToast } from '../../lib/toast';
import { LaudosResultadosPanel } from '../../components/portal/LaudosResultadosPanel';
import { listPortalWorks, submitPortalProgramacoes, listPortalConcretagens, openPortalLaudo, uploadPortalAnexo, downloadPortalAnexo, type PortalProgramacaoInput, type PortalAnexo } from '../../lib/api/portalCliente';
import { listPortalResultados, listPortalLaudosView } from '../../lib/api/portalResultados';

const blank = (): PortalProgramacaoInput & { key: string } => ({ key: Math.random().toString(36).slice(2), work_id: '', data_programada: '', hora_programada: '', local_texto: '', traco_texto: '', fck_previsto: null, fornecedor_texto: '', volume_programado_m3: null, observacoes: '' });
const str = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown): number | null => { const s = str(v).replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const anexosDe = (md: unknown): PortalAnexo[] => { const o = md as Record<string, unknown> | null; return o && Array.isArray(o.anexos) ? o.anexos as PortalAnexo[] : []; };

type Tab = 'programacao' | 'resultados';

export function ClientePortalPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('programacao');
  const [rows, setRows] = useState([blank()]);
  const [busy, setBusy] = useState(false);
  const [anexBusy, setAnexBusy] = useState<string | null>(null);

  const works = useQuery({ queryKey: ['portal-works'], queryFn: listPortalWorks });
  const concretagens = useQuery({ queryKey: ['portal-concretagens-status'], queryFn: () => listPortalConcretagens('') });
  const laudos = useQuery({ queryKey: ['portal-laudos-view'], queryFn: () => listPortalLaudosView(), enabled: tab === 'resultados' });
  const resultados = useQuery({ queryKey: ['portal-resultados'], queryFn: () => listPortalResultados(), enabled: tab === 'resultados' });

  function patch(key: string, field: keyof PortalProgramacaoInput, value: unknown) { setRows((list) => list.map((r) => r.key === key ? { ...r, [field]: value } : r)); }
  async function enviar() {
    setBusy(true);
    try {
      const payload = rows.filter((r) => r.work_id && r.data_programada).map((r) => ({ ...r, fck_previsto: num(r.fck_previsto), volume_programado_m3: num(r.volume_programado_m3) }));
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
      </div>

      {tab === 'programacao' ? (
        <>
          <Card>
            <CardHeader title="Nova programação de concretagem">Preencha uma linha por concretagem e envie tudo para confirmação do laboratório.</CardHeader>
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-2 py-2">Obra*</th><th>Data*</th><th>Hora</th><th>Local / peça</th><th>Traço / concreto</th><th>FCK</th><th>Fornecedor</th><th>Volume</th><th>Obs.</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-2"><select className="input min-w-[190px]" value={r.work_id} onChange={(e) => patch(r.key, 'work_id', e.target.value)}><option value="">Selecione</option>{(works.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.nome}</option>)}</select></td>
                      <td><input className="input min-w-[140px]" type="date" value={r.data_programada} onChange={(e) => patch(r.key, 'data_programada', e.target.value)} /></td>
                      <td><input className="input min-w-[100px]" type="time" value={r.hora_programada ?? ''} onChange={(e) => patch(r.key, 'hora_programada', e.target.value)} /></td>
                      <td><input className="input min-w-[180px]" value={r.local_texto ?? ''} onChange={(e) => patch(r.key, 'local_texto', e.target.value)} placeholder="Ex.: laje torre A" /></td>
                      <td><input className="input min-w-[220px]" value={r.traco_texto ?? ''} onChange={(e) => patch(r.key, 'traco_texto', e.target.value)} placeholder="FCK 30 | BRITA 1 | SLUMP 10±2" /></td>
                      <td><input className="input w-24" type="number" value={r.fck_previsto ?? ''} onChange={(e) => patch(r.key, 'fck_previsto', e.target.value)} /></td>
                      <td><input className="input min-w-[160px]" value={r.fornecedor_texto ?? ''} onChange={(e) => patch(r.key, 'fornecedor_texto', e.target.value)} /></td>
                      <td><input className="input w-24" type="number" value={r.volume_programado_m3 ?? ''} onChange={(e) => patch(r.key, 'volume_programado_m3', e.target.value)} /></td>
                      <td><input className="input min-w-[180px]" value={r.observacoes ?? ''} onChange={(e) => patch(r.key, 'observacoes', e.target.value)} /></td>
                      <td className="p-2"><button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setRows((list) => list.length === 1 ? [blank()] : list.filter((x) => x.key !== r.key))}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 p-4 dark:border-slate-800"><Button variant="secondary" onClick={() => setRows((r) => [...r, blank()])}>+ Adicionar linha</Button><Button onClick={() => void enviar()} disabled={busy}>{busy ? 'Enviando...' : 'Enviar programações ao laboratório'}</Button></div>
          </Card>

          <Card>
            <CardHeader title="Minhas concretagens">Status das programações enviadas. Anexe a NF/DANFE ou documentos por concretagem.</CardHeader>
            {concretagens.isLoading ? <LoadingState /> : concretagens.isError ? <ErrorState message={(concretagens.error as Error).message} /> : (concretagens.data ?? []).length === 0 ? <EmptyState /> : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">{(concretagens.data ?? []).map((c) => {
                const anexos = anexosDe(c.metadata);
                return (
                  <div key={c.id} className="p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-black text-slate-950 dark:text-slate-50">{c.codigo ?? '(sem código)'}</span><StatusBadge status={c.status} /></div><div className="mt-1 text-slate-500">{c.client_works?.nome ?? '-'} · {c.data_real ?? c.data_programada ?? '-'} · {c.local_texto ?? '-'}</div></div>
                      <label className="btn btn-secondary cursor-pointer whitespace-nowrap">{anexBusy === c.id ? 'Enviando...' : '+ Anexar arquivo'}<input type="file" className="hidden" disabled={anexBusy === c.id} onChange={(e) => void anexar(c.id, e.target.files?.[0] ?? null)} /></label>
                    </div>
                    {anexos.length ? <div className="mt-2 flex flex-wrap gap-2">{anexos.map((a, i) => <button key={a.path || i} type="button" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200" onClick={() => void baixarAnexo(a.path)}><FileText size={13} /> {a.filename}</button>)}</div> : null}
                  </div>
                );
              })}</div>
            )}
          </Card>
        </>
      ) : (
        <LaudosResultadosPanel
          works={(works.data ?? []).map((w) => ({ id: w.id, nome: w.nome }))}
          laudos={laudos.data ?? []}
          resultados={resultados.data ?? []}
          loading={laudos.isLoading || resultados.isLoading}
          error={laudos.isError ? (laudos.error as Error).message : resultados.isError ? (resultados.error as Error).message : null}
          onDownload={(id) => abrir(id)}
          fileLabel="meus-resultados"
        />
      )}
    </section>
  );
}
