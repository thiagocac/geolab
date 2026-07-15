// Recebimento de CPs no laboratório (Grupo A · check-in físico).
// Lista CPs moldados ainda sem data_recebimento_lab, agrupados por concretagem; o laboratorista
// marca OK / quebrado / faltante por CP, informa a localização de cura e confirma em lote
// (RPC receber_cps_lote — quebrado→descartado, faltante→extraviado).
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listCpsAReceber, receberCpsLote, type ReceberItem } from '../../lib/api/cpFisico';

const dbr = (s: string | null) => { if (!s) return '—'; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
type Marca = 'ok' | 'quebrado' | 'faltante';

export function RecebimentoCpsPage() {
  const { member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Map<string, Marca>>(new Map());
  const [localizacao, setLocalizacao] = useState('');
  const [busy, setBusy] = useState(false);

  const cpsQ = useQuery({ queryKey: ['cps-a-receber', member?.tenant_id], enabled: !!member, queryFn: listCpsAReceber });
  const cps = cpsQ.data ?? [];
  const filtro = busca.toLowerCase().trim();
  const visiveis = filtro ? cps.filter((c) => [c.numeracao_lab, c.codigo, c.concretagem_codigo, c.obra].some((x) => (x ?? '').toLowerCase().includes(filtro))) : cps;
  const grupos = useMemo(() => {
    const m = new Map<string, typeof visiveis>();
    for (const c of visiveis) { const k = c.concretagem_id; const arr = m.get(k) ?? []; arr.push(c); m.set(k, arr); }
    return [...m.values()];
  }, [visiveis]);

  function marcar(id: string, marca: Marca | null) {
    setSel((s) => { const n = new Map(s); if (marca == null) n.delete(id); else n.set(id, marca); return n; });
  }
  function marcarGrupo(ids: string[], on: boolean) {
    setSel((s) => { const n = new Map(s); for (const id of ids) { if (on) n.set(id, n.get(id) ?? 'ok'); else n.delete(id); } return n; });
  }

  async function confirmar() {
    if (!member || sel.size === 0) return;
    const items: ReceberItem[] = [...sel.entries()].map(([cp_id, resultado]) => ({
      cp_id, resultado,
      ...(resultado === 'ok' && localizacao.trim() ? { localizacao: localizacao.trim() } : {}),
      ...(resultado === 'quebrado' ? { motivo: 'Danificado no transporte' } : {}),
    }));
    setBusy(true);
    try {
      const r = await receberCpsLote(member.tenant_id, member.id, items);
      setSel(new Map());
      await qc.invalidateQueries({ queryKey: ['cps-a-receber'] });
      toast(`${r.recebidos} CP(s) recebido(s)` + (r.divergencias ? ` · ${r.divergencias} divergência(s) registrada(s)` : '') + '.', r.divergencias ? 'warning' : 'success');
    } catch (error) { toast((error as Error).message, 'error'); } finally { setBusy(false); }
  }

  const nSel = sel.size;
  const nDiv = [...sel.values()].filter((v) => v !== 'ok').length;

  return (
    <div className="space-y-5">
      <PageHeader kicker="Concreto" title="Recebimento de CPs" description="Check-in físico dos corpos de prova que chegam do campo: confirme, aponte quebra ou falta e informe onde ficam curando." />
      <div className="flex flex-wrap items-end gap-3">
        <input aria-label="Buscar CP" className="input max-w-[280px]" placeholder="Buscar por numeração, CP, concretagem ou obra" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="max-w-[260px]"><Field label="Localização no lab (aplicada aos OK)" value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} placeholder="Ex.: Tanque 2 · prateleira B" /></div>
        <div className="ml-auto flex items-center gap-3">
          {nSel ? <span className="text-sm text-slate-600 dark:text-slate-300"><strong>{nSel}</strong> selecionado(s){nDiv ? ` · ${nDiv} divergência(s)` : ''}</span> : null}
          <Button busy={busy} disabled={!nSel} onClick={() => void confirmar()}>{busy ? 'Recebendo...' : 'Receber selecionados'}</Button>
        </div>
      </div>

      {cpsQ.isLoading ? <LoadingState /> : cpsQ.isError ? <ErrorState message={(cpsQ.error as Error).message} /> : grupos.length === 0 ? (
        <EmptyState title="Nada aguardando recebimento" description="Todos os CPs moldados já deram entrada no laboratório." />
      ) : grupos.map((grupo) => {
        const head = grupo[0];
        const ids = grupo.map((c) => c.id);
        const todos = ids.every((id) => sel.has(id));
        return (
          <Card key={head.concretagem_id}>
            <CardHeader kicker={head.obra ?? 'Obra'} title={(head.concretagem_codigo ?? 'Concretagem') + ' · moldagem ' + dbr(head.data_moldagem)} />
            <div className="px-4 pb-2"><label className="flex items-center gap-2 text-xs font-bold text-slate-500"><input type="checkbox" checked={todos} onChange={(e) => marcarGrupo(ids, e.target.checked)} /> selecionar todos ({grupo.length})</label></div>
            <div className="grid gap-2 p-4 pt-1 md:grid-cols-2 xl:grid-cols-3">
              {grupo.map((c) => {
                const marca = sel.get(c.id) ?? null;
                return (
                  <div key={c.id} className={'rounded-xl border p-3 ' + (marca === 'quebrado' ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30' : marca === 'faltante' ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : marca === 'ok' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700')}>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={marca != null} onChange={(e) => marcar(c.id, e.target.checked ? 'ok' : null)} />
                      <span className="font-black text-slate-900 dark:text-slate-50">{c.numeracao_lab ?? c.codigo ?? 'CP'}</span>
                      <span className="ml-auto text-xs text-slate-500">{c.codigo ?? ''}</span>
                    </label>
                    {marca != null ? (
                      <div className="mt-2 flex gap-1">
                        {(['ok', 'quebrado', 'faltante'] as Marca[]).map((m) => (
                          <button key={m} type="button" onClick={() => marcar(c.id, m)} className={'rounded-full px-2.5 py-0.5 text-xs font-bold ' + (marca === m ? (m === 'ok' ? 'bg-emerald-600 text-white' : m === 'quebrado' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white') : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
                            {m === 'ok' ? 'OK' : m === 'quebrado' ? 'Quebrado' : 'Faltante'}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      <p className="text-xs text-slate-500">Quebrado → CP vira <strong>descartado</strong> (motivo "Danificado no transporte"). Faltante → vira <strong>extraviado</strong>. Ambos aparecem como divergência e saem da agenda de rompimentos.</p>
    </div>
  );
}
