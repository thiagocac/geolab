import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SelectField } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/State';
import { listLaudos, listConcretagensComResultado, gerarLaudo, downloadUrl, aprovarLaudo, reabrirLaudo, notifyLaudoPronto } from '../../lib/api/laudo';

export function LaudosPage() {
  const { hasRole, member } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const podeAprovar = hasRole('admin', 'admin_consulte', 'gestor_qualidade');
  const [novo, setNovo] = useState(false);
  const [concId, setConcId] = useState('');
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ['laudos'], queryFn: listLaudos });
  const elegiveis = useQuery({ queryKey: ['conc-result'], queryFn: listConcretagensComResultado, enabled: novo });

  function abrirBlob(blob: Blob) { const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener'); }

  async function gerar() {
    if (!concId) { toast('Selecione uma concretagem.', 'error'); return; }
    setBusy(true);
    try {
      const { blob, labReportId } = await gerarLaudo(concId);
      abrirBlob(blob);
      if (labReportId && member) { try { await notifyLaudoPronto(member.tenant_id, labReportId); } catch { /* notificacao e best-effort */ } }
      await qc.invalidateQueries({ queryKey: ['laudos'] }); toast('Laudo gerado.', 'success'); setNovo(false); setConcId('');
    }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function baixar(path: string | null) {
    if (!path) { toast('Laudo ainda nao persistido.', 'error'); return; }
    try { const url = await downloadUrl(path); window.open(url, '_blank', 'noopener'); } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function aprovar(id: string) {
    try { await aprovarLaudo(id); await qc.invalidateQueries({ queryKey: ['laudos'] }); toast('Laudo emitido.', 'success'); } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function reabrir(id: string) {
    try { await reabrirLaudo(id); await qc.invalidateQueries({ queryKey: ['laudos'] }); toast('Laudo reaberto.', 'success'); } catch (e) { toast((e as Error).message, 'error'); }
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
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #eef0f3', borderRadius: 8 }}>
                <span style={{ fontSize: 13 }}><strong>{r.numero}</strong>{r.revisao > 0 ? ' R' + r.revisao : ''} - {r.client_works?.nome ?? '-'} - {r.data_emissao ?? 's/ emissao'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusBadge status={r.status} />
                  <Button variant="ghost" onClick={() => void baixar(r.storage_path)}>Baixar</Button>
                  {podeAprovar && r.status !== 'emitido' ? <Button onClick={() => void aprovar(r.id)}>Emitir</Button> : null}
                  {podeAprovar && r.status === 'emitido' ? <Button variant="ghost" onClick={() => void reabrir(r.id)}>Reabrir</Button> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Modal open={novo} title="Novo laudo" onClose={() => setNovo(false)} footer={<><Button variant="ghost" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={() => void gerar()} disabled={busy}>{busy ? 'Gerando...' : 'Gerar PDF'}</Button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <SelectField label="Concretagem (com resultados lancados)" value={concId} onChange={(e) => setConcId(e.target.value)}>
            <option value="">Selecione...</option>
            {(elegiveis.data ?? []).map((c) => <option key={c.id} value={c.id}>{(c.codigo ?? c.id.slice(0, 8)) + ' - ' + (c.work_nome ?? '-')}</option>)}
          </SelectField>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>O laudo agrupa os exemplares (NF) da concretagem; aceitacao por exemplar na idade de controle. Sai como rascunho ate a aprovacao.</p>
        </div>
      </Modal>
    </div>
  );
}
