import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listLaudos, listConcretagensComResultado, gerarLaudo, downloadUrl, aprovarLaudo, reabrirLaudo, notifyLaudoPronto, criarLinkAprovacao, enviarLaudoCliente, listLaudosClassificacao, notificarLaudoEmitido, type LaudoRow } from '../../lib/api/laudo';
import { ParcialFinalBadge } from '../../components/portal/ParcialFinalBadge';
import type { ParcialFinal } from '../../lib/portal/types';
import { saveUrl, openDeferredTab, blobUrlAutoRevoke } from '../../lib/pdf';

export function LaudosPage() {
  const { hasRole, member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const podeAprovar = hasRole('admin', 'admin_consulte', 'gestor_qualidade');
  const [novo, setNovo] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);

  const q = useQuery({ queryKey: ['laudos'], queryFn: listLaudos });
  const cls = useQuery({ queryKey: ['laudos-cls'], queryFn: listLaudosClassificacao });
  const elegiveis = useQuery({ queryKey: ['conc-result'], queryFn: listConcretagensComResultado, enabled: novo });

  function toggle(cid: string) { setSel((s) => { const n = new Set(s); if (n.has(cid)) n.delete(cid); else n.add(cid); return n; }); }
  function fecharNovo() { setNovo(false); setSel(new Set()); setProg(null); }
  async function previewOne() {
    const ids = [...sel]; if (ids.length !== 1) { toast('Selecione exatamente uma concretagem para pré-visualizar.', 'error'); return; }
    setBusy(true);
    const tab = openDeferredTab();
    try { const { blob } = await gerarLaudo(ids[0], false); tab.go(blobUrlAutoRevoke(blob)); toast('Pré-visualização gerada (não persistida).', 'info'); }
    catch (e) { tab.fail(); toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function gerar() {
    const ids = [...sel]; if (!ids.length) { toast('Selecione ao menos uma concretagem.', 'error'); return; }
    setBusy(true); setProg({ done: 0, total: ids.length });
    const tab = ids.length === 1 ? openDeferredTab() : null;
    let ok = 0; const erros: string[] = [];
    for (const cid of ids) {
      try {
        const { blob, labReportId } = await gerarLaudo(cid, true);
        if (tab) tab.go(blobUrlAutoRevoke(blob));
        if (labReportId && member) { try { await notifyLaudoPronto(member.tenant_id, labReportId); } catch { /* best-effort */ } }
        ok += 1;
      } catch (e) { erros.push((e as Error).message); }
      setProg((pr) => pr ? { ...pr, done: pr.done + 1 } : pr);
    }
    if (tab && ok === 0) tab.fail();
    await qc.invalidateQueries({ queryKey: ['laudos'] });
    if (ok) toast(ok + ' laudo(s) gerado(s)' + (erros.length ? ' · ' + erros.length + ' com erro' : '') + '.', erros.length ? 'warning' : 'success');
    else toast('Falha ao gerar: ' + (erros[0] ?? 'erro'), 'error');
    setBusy(false); setProg(null);
    if (ok) fecharNovo();
  }
  async function baixar(r: LaudoRow) {
    if (!r.storage_path) { toast('Laudo ainda nao persistido.', 'error'); return; }
    const filename = 'Laudo ' + r.numero.replace('/', '-') + (r.revisao > 0 ? ' R' + r.revisao : '') + '.pdf';
    try { const url = await downloadUrl(r.storage_path, filename); saveUrl(url, filename); } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function aprovar(row: LaudoRow) {
    try {
      await aprovarLaudo(row.id);
      await Promise.all([qc.invalidateQueries({ queryKey: ['laudos'] }), qc.invalidateQueries({ queryKey: ['laudos-cls'] })]);
      void notificarLaudoEmitido(row.work_id ?? '', row.numero);
      if (cls.data?.[row.id] === 'final') {
        try { const r = await enviarLaudoCliente(row.id); toast(r.sent ? ('Laudo Final emitido e enviado ao cliente (' + (r.to ?? '') + ').') : ('Laudo Final emitido. Envio ao cliente: ' + (r.reason ?? 'verifique as configuracoes de e-mail.')), r.sent ? 'success' : 'info'); }
        catch { toast('Laudo Final emitido. Falha ao enviar ao cliente.', 'warning'); }
      } else { toast('Laudo emitido.', 'success'); }
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function reabrir(id: string) {
    try { await reabrirLaudo(id); await qc.invalidateQueries({ queryKey: ['laudos'] }); toast('Laudo reaberto.', 'success'); } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function gerarLink(id: string) {
    try {
      const url = await criarLinkAprovacao(id);
      try { await navigator.clipboard.writeText(url); toast('Link de aprovacao copiado para a area de transferencia.', 'success'); }
      catch { toast('Link de aprovacao: ' + url, 'info'); }
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function enviarCliente(id: string) {
    try {
      const r = await enviarLaudoCliente(id);
      if (r.sent) toast('Laudo enviado ao cliente (' + (r.to ?? '') + ').', 'success');
      else toast('Nao enviado: ' + (r.reason ?? 'verifique as configuracoes de e-mail.'), 'info');
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  const rows = q.data ?? [];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader kicker="Concreto" title="Laudos" description="Emissao de relatorios de ensaio (NBR 5739)." />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={() => setNovo(true)}>Novo laudo</Button></div>
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message={(q.error as Error).message} /> : rows.length === 0 ? <EmptyState /> : (
        <Card>
          <div style={{ display: 'grid', gap: 6 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
                <span style={{ fontSize: 13 }}><strong>{r.numero}</strong>{r.revisao > 0 ? ' R' + r.revisao : ''} - {r.client_works?.nome ?? '-'} - {r.data_emissao ?? 's/ emissao'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ParcialFinalBadge value={(cls.data?.[r.id] ?? 'sem_resultados') as ParcialFinal} />
                  <StatusBadge status={r.status} />
                  <Button variant="ghost" onClick={() => void baixar(r)}>Baixar</Button>
                  {podeAprovar && r.status !== 'emitido' ? <Button onClick={() => void aprovar(r)}>Emitir</Button> : null}
                  {podeAprovar && r.status !== 'emitido' ? <Button variant="ghost" onClick={() => void gerarLink(r.id)}>Link aprovação</Button> : null}
                  {podeAprovar && r.status === 'emitido' ? <Button variant="ghost" onClick={() => void reabrir(r.id)}>Reabrir</Button> : null}
                  {podeAprovar && r.status === 'emitido' ? <Button variant="ghost" onClick={() => void enviarCliente(r.id)}>Enviar ao cliente</Button> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Modal open={novo} wide title="Novo laudo (individual ou em lote)" onClose={fecharNovo} footer={<><Button variant="ghost" onClick={fecharNovo}>Cancelar</Button><Button variant="secondary" onClick={() => void previewOne()} disabled={busy || sel.size !== 1}>Pré-visualizar</Button><Button onClick={() => void gerar()} disabled={busy || sel.size === 0}>{busy ? (prog ? ('Gerando ' + prog.done + '/' + prog.total + '...') : 'Gerando...') : ('Gerar ' + (sel.size || '') + ' laudo' + (sel.size === 1 ? '' : 's')).replace('  ', ' ').trim()}</Button></>}>
        <div style={{ display: 'grid', gap: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>Selecione uma ou mais concretagens com resultados lancados. <strong>Pre-visualizar</strong> gera o PDF sem persistir (apenas com 1 selecionada). <strong>Gerar</strong> persiste como rascunho e dispara a notificacao interna. Aceitacao por exemplar (NF) na idade de controle.</p>
          {elegiveis.isLoading ? <LoadingState /> : (elegiveis.data ?? []).length === 0 ? <EmptyState /> : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                <input type="checkbox" checked={sel.size > 0 && sel.size === (elegiveis.data ?? []).length} onChange={(e) => setSel(e.target.checked ? new Set((elegiveis.data ?? []).map((c) => c.id)) : new Set())} /> Selecionar todas ({(elegiveis.data ?? []).length})
              </label>
              <div style={{ display: 'grid', gap: 4, maxHeight: 320, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
                {(elegiveis.data ?? []).map((c) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 6px', borderRadius: 6, background: sel.has(c.id) ? 'var(--surface-2, rgba(0,0,0,0.05))' : 'transparent' }}>
                    <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                    <span>{(c.codigo ?? c.id.slice(0, 8)) + ' · ' + (c.work_nome ?? '-')}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
