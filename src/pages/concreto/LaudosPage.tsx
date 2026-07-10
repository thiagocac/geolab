import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { openDeferredTab } from '../../lib/pdf';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Badge } from '../../components/ui/Badge';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listLaudosPaged, listConcretagensComResultado, gerarLaudo, aprovarLaudo, reabrirLaudo, notifyLaudoPronto, criarLinkAprovacao, enviarLaudoCliente, listLaudosClassificacao, assinarLaudo, baixarLaudoUrl, conformidadeControle, type ExemplarControle } from '../../lib/api/laudo';
import { listReference } from '../../lib/api/client';
import { temDelegacaoAprovacao } from '../../lib/api/delegacoes';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { ParcialFinalBadge } from '../../components/portal/ParcialFinalBadge';
import { CorrecoesStaffPanel } from '../../components/portal/CorrecoesStaffPanel';
import type { ParcialFinal } from '../../lib/portal/types';
import { captureException, trackDomainEvent } from '../../lib/telemetry';

export function LaudosPage() {
  const { can, member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const podeAprovar = can('laudo.aprovar');
  const delegQ = useQuery({ queryKey: ['deleg-aprovacao', member?.id], queryFn: temDelegacaoAprovacao, staleTime: 60_000 });
  const podeEmitir = podeAprovar || (delegQ.data ?? false);
  const [novo, setNovo] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [verConc, setVerConc] = useState<{ codigo: string; idade: number; exemplares: ExemplarControle[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const init = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const [busca, setBusca] = useState(() => init.get('q') ?? '');
  const [buscaQ, setBuscaQ] = useState(() => init.get('q') ?? '');
  const [obraFiltro, setObraFiltro] = useState(() => init.get('obra') ?? '');
  const [statusFiltro, setStatusFiltro] = useState(() => init.get('st') ?? '');
  const [spL, setSpL] = useSearchParams();
  // biome-ignore lint/correctness/useExhaustiveDependencies: seed único no mount
  useEffect(() => {
    const s = spL.get('status');
    if (s) { setStatusFiltro(s); spL.delete('status'); setSpL(spL, { replace: true }); }
  }, []);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const next = new URLSearchParams();
    if (buscaQ) next.set('q', buscaQ);
    if (obraFiltro) next.set('obra', obraFiltro);
    if (statusFiltro) next.set('st', statusFiltro);
    if (next.toString() !== spL.toString()) setSpL(next, { replace: true });
  }, [buscaQ, obraFiltro, statusFiltro, spL, setSpL]);
  const PAGE = 25;
  useEffect(() => { const t = setTimeout(() => { setBuscaQ(busca.trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [busca]);

  const q = useQuery({ queryKey: ['laudos', member?.tenant_id, obraFiltro, buscaQ, statusFiltro, page], queryFn: () => listLaudosPaged({ status: statusFiltro as '' | 'pendente' | 'emitido', tenantId: member?.tenant_id, workId: obraFiltro || undefined, search: buscaQ || undefined, page, pageSize: PAGE }), placeholderData: keepPreviousData });
  const worksFiltro = useQuery({ queryKey: ['ref', 'client_works', 'all'], queryFn: () => listReference('client_works', 'nome') });
  const cls = useQuery({ queryKey: ['laudos-cls'], queryFn: listLaudosClassificacao });
  const elegiveis = useQuery({ queryKey: ['conc-result', member?.tenant_id], queryFn: () => listConcretagensComResultado(member?.tenant_id), enabled: novo });
  const idsEleg = (elegiveis.data ?? []).map((c) => c.id);
  const confQ = useQuery({ queryKey: ['conf-ctrl', idsEleg.join(',')], queryFn: () => conformidadeControle(idsEleg), enabled: novo && idsEleg.length > 0 });


  function toggle(cid: string) { setSel((s) => { const n = new Set(s); if (n.has(cid)) n.delete(cid); else n.add(cid); return n; }); }
  function fecharNovo() { setNovo(false); setSel(new Set()); setProg(null); }
  async function previewOne() {
    const ids = [...sel]; if (ids.length !== 1) { toast('Selecione exatamente uma concretagem para pré-visualizar.', 'error'); return; }
    setBusy(true);
    const tab = openDeferredTab('Gerando pré-visualização do laudo…');
    try { const { blob } = await gerarLaudo(ids[0], false); tab.openBlob(blob, 'laudo-previa.pdf'); toast('Pré-visualização gerada (não persistida).', 'info'); }
    catch (e) { tab.fail(); toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function gerar() {
    const ids = [...sel]; if (!ids.length) { toast('Selecione ao menos uma concretagem.', 'error'); return; }
    setBusy(true); setProg({ done: 0, total: ids.length });
    let ok = 0; const erros: string[] = [];
    const tab = ids.length === 1 ? openDeferredTab('Gerando laudo…') : null;
    for (const cid of ids) {
      try {
        const { blob, labReportId } = await gerarLaudo(cid, true);
        if (tab) tab.openBlob(blob, 'laudo.pdf');
        if (labReportId && member) { try { await notifyLaudoPronto(member.tenant_id, labReportId); } catch { /* best-effort */ } }
        ok += 1;
      } catch (e) { tab?.fail(); erros.push((e as Error).message); }
      setProg((pr) => pr ? { ...pr, done: pr.done + 1 } : pr);
    }
    await qc.invalidateQueries({ queryKey: ['laudos'] });
    if (ok) toast(ok + ' laudo(s) gerado(s)' + (erros.length ? ' · ' + erros.length + ' com erro' : '') + '.', erros.length ? 'warning' : 'success');
    else toast('Falha ao gerar: ' + (erros[0] ?? 'erro'), 'error');
    setBusy(false); setProg(null);
    if (ok) fecharNovo();
  }
  async function baixar(id: string, path: string | null) {
    const tab = openDeferredTab(); try { tab.set(await baixarLaudoUrl(id, path)); } catch (e) { tab.fail(); toast((e as Error).message, 'error'); }
  }
  async function aprovar(id: string) {
    const ehFinal = cls.data?.[id] === 'final';
    if (!(await confirm({ title: 'Emitir laudo', message: ehFinal ? 'Emitir este laudo Final? Ele será enviado automaticamente ao cliente por e-mail (conforme a configuração de despacho).' : 'Emitir este laudo? Após a emissão ele fica disponível para download e envio ao cliente.', confirmLabel: 'Emitir' }))) return;
    try {
      await aprovarLaudo(id);
      try {
        await assinarLaudo(id);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        captureException(e, { category: 'domain', metadata: { action: 'laudo.assinar.best_effort', lab_report_id: id, reason } });
        trackDomainEvent('laudo.assinar_falhou', { lab_report_id: id, reason, best_effort: true });
      }
      await Promise.all([qc.invalidateQueries({ queryKey: ['laudos'] }), qc.invalidateQueries({ queryKey: ['laudos-cls'] })]);
      if (cls.data?.[id] === 'final') {
        try {
          const r = await enviarLaudoCliente(id);
          toast(r.sent ? ('Laudo Final emitido e enviado ao cliente (' + (r.to ?? '') + ').') : ('Laudo Final emitido. Envio ao cliente: ' + (r.reason ?? 'verifique as configurações de e-mail.')), r.sent ? 'success' : 'info');
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          captureException(e, { category: 'domain', metadata: { action: 'laudo.enviar_final', lab_report_id: id, reason } });
          trackDomainEvent('laudo.enviar_falhou', { lab_report_id: id, reason, automatico_final: true });
          toast('Laudo Final emitido. Falha ao enviar ao cliente.', 'warning');
        }
      } else { toast('Laudo emitido.', 'success'); }
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function reabrir(id: string) {
    if (!(await confirm({ title: 'Reabrir laudo', message: 'Reabrir este laudo emitido? Ele volta a rascunho e precisará ser emitido novamente.', danger: true, confirmLabel: 'Reabrir' }))) return;
    try { await reabrirLaudo(id); await qc.invalidateQueries({ queryKey: ['laudos'] }); toast('Laudo reaberto.', 'success'); } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function gerarLink(id: string) {
    try {
      const url = await criarLinkAprovacao(id);
      try { await navigator.clipboard.writeText(url); toast('Link de aprovação copiado para a área de transferência.', 'success'); }
      catch { toast('Link de aprovacao: ' + url, 'info'); }
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function enviarCliente(id: string) {
    try {
      const r = await enviarLaudoCliente(id);
      if (r.sent) toast('Laudo enviado ao cliente (' + (r.to ?? '') + ').', 'success');
      else toast('Nao enviado: ' + (r.reason ?? 'verifique as configurações de e-mail.'), 'info');
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      captureException(e, { category: 'domain', metadata: { action: 'laudo.enviar_manual', lab_report_id: id, reason } });
      trackDomainEvent('laudo.enviar_falhou', { lab_report_id: id, reason, automatico_final: false });
      toast(reason, 'error');
    }
  }

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Concreto" title="Laudos" description="Emissão de relatorios de ensaio (NBR 5739)." />
      {podeAprovar ? <CorrecoesStaffPanel /> : null}
      {!podeAprovar && (delegQ.data ?? false) ? <Card className="border-blue-200 bg-blue-50/60 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">Você pode <strong>emitir laudos</strong> por uma delegação ativa de aprovação. As demais ações (reabrir, enviar, link) seguem com o gestor/RT.</Card> : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><input className="input" placeholder="Buscar por Nº do relatório" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 280 }} /><select className="input" value={obraFiltro} onChange={(e) => { setObraFiltro(e.target.value); setPage(0); }} style={{ maxWidth: 240 }}><option value="">Todas as obras</option>{(worksFiltro.data ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><select className="input" value={statusFiltro} onChange={(e) => { setStatusFiltro(e.target.value); setPage(0); }} style={{ maxWidth: 180 }} title="Status do laudo"><option value="">Todos os status</option><option value="pendente">A aprovar/emitir</option><option value="emitido">Emitidos</option></select></div><Button onClick={() => setNovo(true)}>Novo laudo</Button></div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
        <Card>
          <div style={{ display: 'grid', gap: 6 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, minWidth: 0 }}><strong>{r.numero}</strong>{r.revisao > 0 ? ' R' + r.revisao : ''} - {r.client_works?.nome ?? '-'} - {r.data_emissao ?? 's/ emissão'}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <ParcialFinalBadge value={(cls.data?.[r.id] ?? 'sem_resultados') as ParcialFinal} />
                  <StatusBadge status={r.status} />
                  {r.assinatura_status === 'assinado' ? <Badge tone="success">Assinado</Badge> : (r.assinatura_status === 'pendente' || r.assinatura_status === 'em_processo') ? <Badge tone="info">Assinatura pendente</Badge> : null}
                  <Button variant="ghost" onClick={() => void baixar(r.id, r.storage_path)}>Baixar</Button>
                  {podeEmitir && r.status !== 'emitido' ? <Button onClick={() => void aprovar(r.id)}>Emitir</Button> : null}
                  {podeAprovar && r.status !== 'emitido' ? <Button variant="ghost" onClick={() => void gerarLink(r.id)}>Link aprovação</Button> : null}
                  {podeAprovar && r.status === 'emitido' ? <Button variant="ghost" onClick={() => void reabrir(r.id)}>Reabrir</Button> : null}
                  {podeAprovar && r.status === 'emitido' ? <Button variant="ghost" onClick={() => void enviarCliente(r.id)}>Enviar ao cliente</Button> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {!q.isLoading && !q.isError && total > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{total} laudo(s) · página {page + 1} de {pageCount}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
            <Button variant="ghost" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      ) : null}
      <Modal open={novo} wide title="Novo laudo (individual ou em lote)" onClose={fecharNovo} footer={<><Button variant="ghost" onClick={fecharNovo}>Cancelar</Button><Button variant="secondary" onClick={() => void previewOne()} disabled={busy || sel.size !== 1}>Pré-visualizar</Button><Button onClick={() => void gerar()} disabled={busy || sel.size === 0}>{busy ? (prog ? ('Gerando ' + prog.done + '/' + prog.total + '...') : 'Gerando...') : ('Gerar ' + (sel.size || '') + ' laudo' + (sel.size === 1 ? '' : 's')).replace('  ', ' ').trim()}</Button></>}>
        <div style={{ display: 'grid', gap: 10 }}>
          {(() => { const nc = [...sel].filter((id) => confQ.data?.[id]?.algum_nao_conforme).length; return nc > 0 ? (<div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.35)' }} className="text-sm text-red-700 dark:text-red-300"><strong>Atenção:</strong> {nc} concretagem(ns) selecionada(s) com resultado na idade de controle <strong>abaixo do fck</strong>. Analise antes de emitir.</div>) : null; })()}
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>Selecione uma ou mais concretagens com resultados lançados. <strong>Pré-visualizar</strong> gera o PDF sem persistir (apenas com 1 selecionada). <strong>Gerar</strong> persiste como rascunho e dispara a notificacao interna. Aceitação por exemplar (NF) na idade de controle.</p>
          {elegiveis.isLoading ? <LoadingState /> : (elegiveis.data ?? []).length === 0 ? <EmptyState /> : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                <input type="checkbox" checked={sel.size > 0 && sel.size === (elegiveis.data ?? []).length} onChange={(e) => setSel(e.target.checked ? new Set((elegiveis.data ?? []).map((c) => c.id)) : new Set())} /> Selecionar todas ({(elegiveis.data ?? []).length})
              </label>
              <div style={{ display: 'grid', gap: 4, maxHeight: 320, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
                {(elegiveis.data ?? []).map((c) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 6px', borderRadius: 6, background: sel.has(c.id) ? 'var(--surface-2, rgba(0,0,0,0.05))' : 'transparent' }}>
                    <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                    <span style={{ flex: 1 }}>{(c.codigo ?? c.id.slice(0, 8)) + ' · ' + (c.work_nome ?? '-')}</span>
                    {confQ.data?.[c.id]?.algum_nao_conforme ? (<><Badge tone="danger">Abaixo do fck ({confQ.data[c.id].idade_controle}d)</Badge><Button variant="ghost" onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); const d = confQ.data![c.id]; setVerConc({ codigo: c.codigo ?? c.id.slice(0, 8), idade: d.idade_controle, exemplares: d.exemplares }); }}>Ver resultados</Button></>) : null}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={!!verConc} title={'Resultados na idade de controle' + (verConc ? ' · ' + verConc.codigo : '')} onClose={() => setVerConc(null)} footer={<Button onClick={() => setVerConc(null)}>Fechar</Button>}>
        {verConc ? (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>NF / Exemplar</th><th>Resistência ({verConc.idade}d)</th><th>fck</th><th>Situação</th></tr></thead>
              <tbody>
                {verConc.exemplares.map((e, i) => (<tr key={i}><td>{e.nf}</td><td>{e.exemplar.toFixed(1)} MPa</td><td>{e.fck.toFixed(1)} MPa</td><td>{e.nao_conforme ? <Badge tone="danger">Abaixo do fck</Badge> : <Badge tone="success">Conforme</Badge>}</td></tr>))}
                {!verConc.exemplares.length ? <tr><td colSpan={4} className="text-sm" style={{ color: 'var(--ink-faint)' }}>Sem resultados na idade de controle.</td></tr> : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
