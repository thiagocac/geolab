import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import {
  generateDocumentPdf,
  issueInvoiceFromMeasurement,
  listMeasurementItems,
  listMeasurementsV2,
  materializeMeasurementItems,
  sendCommercialDocument,
  type JsonObject,
  type MeasurementSummary,
} from '../../lib/api/productEvolution';
import { useToast } from '../../lib/toast';
import { openDeferredTab } from '../../lib/pdf';
import { dateBr, money, MetricCard, Pill, TableShell, Td, Th } from './product/ProductUi';

const text = (row: JsonObject, key: string) => String(row[key] ?? '');
const num = (row: JsonObject, key: string) => Number(row[key]) || 0;

export function MedicaoV2Page() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const measurements = useQuery({ queryKey: ['measurements-v213'], queryFn: listMeasurementsV2 });
  const [selected, setSelected] = useState<MeasurementSummary | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const items = useQuery({ queryKey: ['measurement-items-v213', selected?.id], enabled: !!selected, queryFn: () => listMeasurementItems(selected!.id) });
  const rows = measurements.data ?? [];
  const summary = useMemo(() => ({ open: rows.filter((row) => ['rascunho', 'aberta', 'em_conferencia', 'contestada_cliente'].includes(row.status)).length, sent: rows.filter((row) => row.enviada_at).length, total: rows.reduce((sum, row) => sum + row.valor_total, 0), contested: rows.filter((row) => row.decisao_cliente === 'contestada' || row.status.includes('contestada')).length }), [rows]);

  async function materialize(row: MeasurementSummary) {
    setBusy(`materialize:${row.id}`);
    try { await materializeMeasurementItems(row.id); await Promise.all([queryClient.invalidateQueries({ queryKey: ['measurements-v213'] }), queryClient.invalidateQueries({ queryKey: ['measurement-items-v213', row.id] })]); toast('Itens da medição materializados.', 'success'); } catch (error) { toast((error as Error).message, 'error'); } finally { setBusy(null); }
  }
  async function pdf(row: MeasurementSummary) {
    setBusy(`pdf:${row.id}`);
    const tab = openDeferredTab('Gerando PDF da medição…');
    try { const result = await generateDocumentPdf({ entity_type: 'medicao', entity_id: row.id }); tab.openBlob(result.blob, result.file_name); } catch (error) { tab.fail(); toast((error as Error).message, 'error'); } finally { setBusy(null); }
  }
  async function send() {
    if (!selected || !email.trim()) return toast('Informe o e-mail do destinatário.', 'error');
    setBusy(`send:${selected.id}`);
    try { await sendCommercialDocument({ entity_type: 'medicao', entity_id: selected.id, email: email.trim() }); await queryClient.invalidateQueries({ queryKey: ['measurements-v213'] }); setSendOpen(false); toast('Medição enviada com link seguro.', 'success'); } catch (error) { toast((error as Error).message, 'error'); } finally { setBusy(null); }
  }
  async function invoice(row: MeasurementSummary) {
    const due = window.prompt('Vencimento da fatura (AAAA-MM-DD):', new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10));
    if (!due) return;
    setBusy(`invoice:${row.id}`);
    try { await issueInvoiceFromMeasurement(row.id, due); toast('Fatura emitida e enviada ao contas a receber.', 'success'); } catch (error) { toast((error as Error).message, 'error'); } finally { setBusy(null); }
  }

  return <div className="space-y-5">
    <PageHeader kicker="Financeiro" title="Medições" description="Snapshot de itens, documento versionado, envio seguro, decisão do cliente e integração com faturamento." />
    <div className="grid gap-3 md:grid-cols-4"><MetricCard label="Em conferência" value={summary.open} /><MetricCard label="Enviadas" value={summary.sent} /><MetricCard label="Valor acumulado" value={money(summary.total)} /><MetricCard label="Contestadas" value={summary.contested} tone={summary.contested ? 'warn' : 'good'} /></div>
    {measurements.isLoading ? <LoadingState /> : measurements.isError ? <ErrorState message={(measurements.error as Error).message} /> : !rows.length ? <EmptyState /> : <TableShell><thead><tr><Th>Número / competência</Th><Th>Cliente / obra</Th><Th>Período</Th><Th>Itens</Th><Th>Total</Th><Th>Status</Th><Th>Ações</Th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><Td><strong>{row.numero || row.competencia}</strong><div className="text-xs text-slate-500">Revisão {row.revisao}</div></Td><Td>{row.cliente || row.client_id}<div className="text-xs text-slate-500">{row.obra || 'Sem obra específica'}</div></Td><Td>{dateBr(row.periodo_inicio)} a {dateBr(row.periodo_fim)}</Td><Td>{row.total_itens}</Td><Td>{money(row.valor_total)}</Td><Td><Pill tone={row.status.includes('aprovada') || row.status === 'faturada' ? 'good' : row.status.includes('contestada') ? 'bad' : row.enviada_at ? 'info' : 'neutral'}>{row.status}</Pill>{row.decisao_cliente ? <div className="mt-1 text-xs text-slate-500">Cliente: {row.decisao_cliente}</div> : null}</Td><Td><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => setSelected(row)}>Detalhes</Button><Button variant="secondary" disabled={busy !== null} onClick={() => void materialize(row)}>{busy === `materialize:${row.id}` ? 'Processando…' : 'Materializar'}</Button><Button variant="secondary" disabled={busy !== null} onClick={() => void pdf(row)}>PDF</Button><Button variant="secondary" disabled={busy !== null} onClick={() => { setSelected(row); setEmail(''); setSendOpen(true); }}>Enviar</Button>{['aprovada_cliente', 'fechada', 'aprovada'].includes(row.status) ? <Button disabled={busy !== null} onClick={() => void invoice(row)}>Faturar</Button> : null}</div></Td></tr>)}</tbody></TableShell>}
    <Drawer wide open={!!selected && !sendOpen} title={`Medição ${selected?.numero || selected?.competencia || ''}`} onClose={() => setSelected(null)} footer={<Button variant="ghost" onClick={() => setSelected(null)}>Fechar</Button>}>
      {items.isLoading ? <LoadingState /> : items.isError ? <ErrorState message={(items.error as Error).message} /> : !(items.data ?? []).length ? <EmptyState /> : <TableShell><thead><tr><Th>Código</Th><Th>Descrição</Th><Th>Origem</Th><Th>Quantidade</Th><Th>Preço</Th><Th>Total</Th></tr></thead><tbody>{(items.data ?? []).map((item, index) => <tr key={text(item, 'id') || String(index)}><Td>{text(item, 'item_code')}</Td><Td>{text(item, 'descricao')}</Td><Td>{text(item, 'source_type') || 'manual'}</Td><Td>{num(item, 'quantidade')} {text(item, 'unidade')}</Td><Td>{money(num(item, 'preco_unitario'))}</Td><Td>{money(num(item, 'valor_total'))}</Td></tr>)}</tbody></TableShell>}
    </Drawer>
    <Modal open={sendOpen} title="Enviar medição" onClose={() => { setSendOpen(false); setSelected(null); }} footer={<><Button variant="ghost" onClick={() => { setSendOpen(false); setSelected(null); }}>Cancelar</Button><Button disabled={busy !== null} onClick={() => void send()}>Enviar</Button></>}><Field label="E-mail do destinatário" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Modal>
  </div>;
}
