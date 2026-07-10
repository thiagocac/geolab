// Descarte de CPs pós-laudo (Grupo A · cadeia física).
// Lista os CPs elegíveis (rompidos, com laudo emitido — RPC cps_descartaveis), descarta em lote
// com motivo (descartar_cps_lote) e emite o Termo de Descarte em PDF (EF generate-cp-descarte-pdf).
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { openDeferredTab } from '../../lib/pdf';
import { listCpsDescartaveis, descartarCpsLote, listDescarteLotes, termoDescartePdf } from '../../lib/api/cpFisico';

const dbr = (s: string | null) => { if (!s) return '—'; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

export function DescarteCpsPage() {
  const { member } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [motivo, setMotivo] = useState('Descarte programado pós-laudo');
  const [busy, setBusy] = useState(false);

  const descQ = useQuery({ queryKey: ['cps-descartaveis', member?.tenant_id], enabled: !!member, queryFn: () => listCpsDescartaveis(member!.tenant_id) });
  const lotesQ = useQuery({ queryKey: ['cp-descarte-lotes', member?.tenant_id], enabled: !!member, queryFn: listDescarteLotes });
  const rows = descQ.data ?? [];

  function toggle(id: string) { setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleTodos() { setSel((s) => (s.size === rows.length ? new Set<string>() : new Set(rows.map((r) => r.cp_id)))); }

  async function descartar() {
    if (!member || sel.size === 0) return;
    const ok = await confirm({ title: 'Descartar CPs', message: `${sel.size} corpo(s) de prova serão marcados como descartados e sairão do estoque físico. A ação fica registrada em lote com termo em PDF.`, confirmLabel: 'Descartar' });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await descartarCpsLote(member.tenant_id, member.id, [...sel], motivo.trim());
      setSel(new Set());
      await Promise.all([qc.invalidateQueries({ queryKey: ['cps-descartaveis'] }), qc.invalidateQueries({ queryKey: ['cp-descarte-lotes'] })]);
      toast(`${r.descartados} CP(s) descartado(s). Lote registrado.`, 'success');
      const tab = openDeferredTab('Gerando termo de descarte…');
      try { tab.openBlob(await termoDescartePdf(r.loteId), 'termo-descarte-cps.pdf'); } catch (error) { tab.fail(); toast((error as Error).message, 'error'); }
    } catch (error) { toast((error as Error).message, 'error'); } finally { setBusy(false); }
  }

  async function abrirTermo(loteId: string) {
    const tab = openDeferredTab('Gerando termo de descarte…');
    try { tab.openBlob(await termoDescartePdf(loteId), 'termo-descarte-cps.pdf'); } catch (error) { tab.fail(); toast((error as Error).message, 'error'); }
  }

  return (
    <div className="space-y-5">
      <PageHeader kicker="Concreto" title="Descarte de CPs" description="Corpos de prova rompidos e com laudo emitido, liberados para descarte com registro em lote e termo assinável." />

      <div className="flex flex-wrap items-end gap-3">
        <div className="max-w-[360px] grow"><Field label="Motivo do descarte" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        <div className="ml-auto flex items-center gap-3">
          {sel.size ? <span className="text-sm text-slate-600 dark:text-slate-300"><strong>{sel.size}</strong> selecionado(s)</span> : null}
          <Button variant="danger" disabled={!sel.size || busy} onClick={() => void descartar()}>{busy ? 'Descartando...' : 'Descartar selecionados'}</Button>
        </div>
      </div>

      {descQ.isLoading ? <LoadingState /> : descQ.isError ? <ErrorState message={(descQ.error as Error).message} /> : rows.length === 0 ? (
        <EmptyState title="Nenhum CP liberado para descarte" description="Só entram aqui CPs rompidos cujos resultados já saíram em laudo emitido." />
      ) : (
        <Card>
          <div className="px-4 pt-3"><label className="flex items-center gap-2 text-xs font-bold text-slate-500"><input type="checkbox" checked={sel.size === rows.length && rows.length > 0} onChange={toggleTodos} /> selecionar todos ({rows.length})</label></div>
          <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => (
              <label key={r.cp_id} className={'flex items-start gap-2 rounded-xl border p-3 ' + (sel.has(r.cp_id) ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30' : 'border-slate-200 dark:border-slate-700')}>
                <input type="checkbox" className="mt-0.5" checked={sel.has(r.cp_id)} onChange={() => toggle(r.cp_id)} />
                <span className="min-w-0">
                  <span className="block font-black text-slate-900 dark:text-slate-50">{r.numeracao_lab ?? r.codigo ?? 'CP'}</span>
                  <span className="block text-xs text-slate-500">laudo {dbr(r.data_laudo)} · há {r.dias_desde_laudo}d{r.localizacao ? ' · ' + r.localizacao : ''}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader kicker="Histórico" title="Lotes de descarte" />
        <div className="divide-y divide-slate-100 p-2 dark:divide-slate-800">
          {(lotesQ.data ?? []).length ? (lotesQ.data ?? []).map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-2.5">
              <div className="min-w-0">
                <span className="font-bold text-slate-900 dark:text-slate-50">{l.numero ?? 'Lote'} · {dbr(l.data_descarte)}</span>
                <span className="ml-2 text-xs text-slate-500">{l.total_cps} CP(s){l.motivo ? ' · ' + l.motivo : ''}</span>
              </div>
              <Button variant="secondary" onClick={() => void abrirTermo(l.id)}>Termo (PDF)</Button>
            </div>
          )) : <p className="px-2 py-3 text-sm text-slate-500">Nenhum lote registrado ainda.</p>}
        </div>
      </Card>
    </div>
  );
}
