import { useState } from 'react';
import { openDeferredTab } from '../../lib/pdf';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LaudosResultadosPanel } from '../../components/portal/LaudosResultadosPanel';
import type { PortalCorrecao, PortalCorrecaoConfig, PortalCorrecaoInput, PortalLaudoView, PortalResultadoRow } from '../../lib/portal/types';
import { env } from '../../lib/env';
import { useToast } from '../../lib/toast';

type PortalData = {
  laboratorio: string | null;
  cliente: { razao_social?: string | null; nome_fantasia?: string | null } | null;
  obras: { id: string; nome: string; codigo?: string | null; cidade?: string | null; uf?: string | null }[];
  concretagens: { id: string; codigo: string | null; status: string; data_real: string | null; data_programada: string | null; local_texto: string | null; volume_lancado_m3: number | null; fck_previsto: number | null }[];
  laudos: PortalLaudoView[];
  resultados: PortalResultadoRow[];
  correcoes: PortalCorrecao[];
  portal_config: PortalCorrecaoConfig | null;
};

async function callPortal(token: string, extra?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resp = await fetch(env.supabaseUrl + '/functions/v1/lab-client-portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey },
    body: JSON.stringify({ token, ...(extra ?? {}) }),
  });
  const txt = await resp.text();
  const payload = txt ? JSON.parse(txt) as Record<string, unknown> : {};
  if (!resp.ok || payload.ok === false) throw new Error(String(payload.error ?? 'Link inválido ou expirado.'));
  return payload;
}

type Tab = 'concretagens' | 'resultados';

export function PortalPublicoPage() {
  const { token = '' } = useParams<{ token: string }>();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('resultados');
  const q = useQuery({
    queryKey: ['portal-publico', token],
    queryFn: async (): Promise<PortalData> => {
      const p = await callPortal(token);
      return {
        laboratorio: (p.laboratorio as string | null) ?? null,
        cliente: (p.cliente as PortalData['cliente']) ?? null,
        obras: (p.obras as PortalData['obras']) ?? [],
        concretagens: (p.concretagens as PortalData['concretagens']) ?? [],
        laudos: (p.laudos as PortalLaudoView[]) ?? [],
        resultados: (p.resultados as PortalResultadoRow[]) ?? [],
        correcoes: (p.correcoes as PortalCorrecao[]) ?? [],
        portal_config: ((): PortalCorrecaoConfig => { const c = (p.portal_config as Record<string, unknown>) ?? {}; return { correcao_habilitada: c.correcao_habilitada !== false, correcao_auto_edicao_peca: c.correcao_auto_edicao_peca === true, correcao_resultado: c.correcao_resultado !== false }; })(),
      };
    },
    enabled: token.length >= 16,
    retry: false,
  });

  async function abrir(reportId: string) {
    const tab = openDeferredTab();
    try {
      const r = await callPortal(token, { lab_report_id: reportId });
      if (r.url) tab.set(String(r.url)); else tab.fail();
    } catch (e) { tab.fail(); toast((e as Error).message, 'error'); }
  }

  async function solicitar(input: PortalCorrecaoInput) {
    await callPortal(token, { action: 'solicitar_correcao', work_id: input.work_id, tipo: input.tipo, lab_report_id: input.lab_report_id ?? null, concretagem_id: input.concretagem_id ?? null, receipt_id: input.receipt_id ?? null, corpo_prova_id: input.corpo_prova_id ?? null, valor_proposto: input.valor_proposto ?? null, comentario: input.comentario ?? null });
    await q.refetch();
    toast('Pedido de correção enviado ao laboratório.', 'success');
  }

  const d = q.data;
  const clienteNome = d?.cliente?.nome_fantasia || d?.cliente?.razao_social || 'Cliente';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <div>
            <p className="kicker">Portal do cliente</p>
            <h1 className="text-xl display text-slate-950 dark:text-slate-50">{d?.laboratorio ?? 'Consulte GEO'}</h1>
          </div>
          <div className="text-right text-sm text-slate-500">{clienteNome}<div className="text-xs">Acesso por link · somente leitura</div></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {token.length < 16 ? <ErrorState message="Link inválido." /> : q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : !d ? <EmptyState /> : (
          <>
            <div role="tablist" aria-label="Seções do portal" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              <button role="tab" type="button" aria-selected={tab === 'concretagens'} onClick={() => setTab('concretagens')} className={'rounded-lg px-4 py-2 text-sm font-semibold ' + (tab === 'concretagens' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300')}>Concretagens</button>
              <button role="tab" type="button" aria-selected={tab === 'resultados'} onClick={() => setTab('resultados')} className={'rounded-lg px-4 py-2 text-sm font-semibold ' + (tab === 'resultados' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300')}>Resultados &amp; Laudos</button>
            </div>
            {tab === 'concretagens' ? (
              <Card>
                <CardHeader title="Concretagens">Programações e concretagens registradas para suas obras.</CardHeader>
                {d.concretagens.length === 0 ? <EmptyState /> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{d.concretagens.map((c) => <div key={c.id} className="p-4 text-sm"><div className="flex flex-wrap items-center gap-2 font-black text-slate-950 dark:text-slate-50">{c.codigo ?? '(sem código)'} <StatusBadge status={c.status} domain="concretagem" /></div><div className="mt-1 text-slate-500">{c.data_real ?? c.data_programada ?? '-'} · {c.local_texto ?? '-'}{c.fck_previsto ? ' · FCK ' + c.fck_previsto : ''}{c.volume_lancado_m3 ? ' · ' + c.volume_lancado_m3 + ' m³' : ''}</div></div>)}</div>}
              </Card>
            ) : (
              <LaudosResultadosPanel
                works={d.obras.map((w) => ({ id: w.id, nome: w.nome }))}
                laudos={d.laudos}
                resultados={d.resultados}
                onDownload={(id) => abrir(id)}
                fileLabel="resultados"
                onSolicitarCorrecao={solicitar}
                correcaoConfig={d.portal_config}
                meusPedidos={d.correcoes}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
