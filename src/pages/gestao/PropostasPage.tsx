import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { Field, SelectField, TextArea } from '../../components/ui/Field';
import { NumField } from '../../components/ui/NumField';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { useAuth } from '../../lib/auth';
import { openDeferredTab } from '../../lib/pdf';
import { listClientesRef } from '../../lib/api/obras';
import {
  gerarRevisaoProposta,
  getProposta,
  listPropostas,
  PROPOSTA_STATUS,
  salvarProposta,
  softDeleteProposta,
  type PropostaItem,
} from '../../lib/api/propostas';
import {
  generateDocumentPdf,
  listDocumentTemplates,
  listServiceCatalog,
  sendCommercialDocument,
} from '../../lib/api/productEvolution';
import { convertProposalToContractWork } from '../../lib/api/proposalConversion';
import { useToast } from '../../lib/toast';
import { dateBr, money, Pill, TableShell, Td, Th } from './product/ProductUi';

const blankItem = (): PropostaItem => ({ descricao: '', unidade: 'un', tipo_cobranca: 'avulso', quantidade: 1, preco_unitario: 0 });

export function PropostasPage() {
  const { member, can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: '', numero: '', titulo: '', validade: '', status: 'rascunho', condicao_pagamento: '', observacoes: '',
    recipient_name: '', recipient_email: '', template_version_id: '', followup_at: '',
  });
  const [items, setItems] = useState<PropostaItem[]>([]);
  const [conversion, setConversion] = useState<{
    proposalId: string;
    existingWorkId: string | null;
    contractNumber: string;
    workName: string;
    workCode: string;
    address: string;
    city: string;
    uf: string;
    structureName: string;
  } | null>(null);

  const proposals = useQuery({ queryKey: ['propostas', member?.tenant_id], enabled: !!member, queryFn: listPropostas });
  const clients = useQuery({ queryKey: ['clientes-ref', member?.tenant_id], enabled: !!member, queryFn: listClientesRef });
  const catalog = useQuery({ queryKey: ['service-catalog-active', member?.tenant_id], enabled: !!member, queryFn: () => listServiceCatalog(true) });
  const templates = useQuery({ queryKey: ['document-templates-proposal', member?.tenant_id], enabled: !!member, queryFn: listDocumentTemplates });
  const detail = useQuery({ queryKey: ['proposta-detail', editId], enabled: drawerOpen && !!editId, queryFn: () => getProposta(editId as string) });

  useEffect(() => {
    if (!detail.data) return;
    const row = detail.data;
    setForm({
      client_id: row.client_id ?? '', numero: row.numero ?? '', titulo: row.titulo ?? '', validade: row.validade ?? '', status: row.status,
      condicao_pagamento: row.condicao_pagamento ?? '', observacoes: row.observacoes ?? '', recipient_name: row.recipient_name ?? '',
      recipient_email: row.recipient_email ?? '', template_version_id: row.template_version_id ?? '', followup_at: row.followup_at?.slice(0, 16) ?? '',
    });
    setItems(row.itens);
  }, [detail.data]);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.quantidade * item.preco_unitario, 0), [items]);
  const proposalTemplates = useMemo(() => templates.data?.filter((template) => template.escopo === 'proposta') ?? [], [templates.data]);

  function startNew() {
    setEditId(null);
    setForm({ client_id: '', numero: '', titulo: '', validade: '', status: 'rascunho', condicao_pagamento: '', observacoes: '', recipient_name: '', recipient_email: '', template_version_id: '', followup_at: '' });
    setItems([blankItem()]);
    setDrawerOpen(true);
  }

  function startEdit(id: string) {
    setEditId(id);
    setItems([]);
    setDrawerOpen(true);
  }

  function patchItem(index: number, patch: Partial<PropostaItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addCatalogItem(catalogId: string) {
    const service = catalog.data?.find((item) => item.id === catalogId);
    if (!service) return;
    setItems((current) => [...current, {
      catalog_item_id: service.id,
      descricao: service.nome,
      unidade: service.unidade,
      tipo_cobranca: service.tipo_cobranca,
      quantidade: 1,
      preco_unitario: service.preco_sugerido,
    }]);
  }

  async function save() {
    if (!member || !form.client_id) {
      toast('Selecione o cliente.', 'error');
      return;
    }
    setBusy('save');
    try {
      await salvarProposta({
        id: editId ?? undefined,
        ...form,
        validade: form.validade || null,
        followup_at: form.followup_at || null,
        recipient_name: form.recipient_name || null,
        recipient_email: form.recipient_email || null,
        template_version_id: form.template_version_id || null,
        itens: items.filter((item) => item.descricao.trim()).map((item, index) => ({ ...item, ordem: index })),
      });
      await queryClient.invalidateQueries({ queryKey: ['propostas'] });
      toast('Proposta salva.', 'success');
      setDrawerOpen(false);
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function generate(id: string) {
    const tab = openDeferredTab('Gerando PDF da proposta…');
    setBusy(`pdf:${id}`);
    try {
      await gerarRevisaoProposta(id);
      const result = await generateDocumentPdf({ entity_type: 'proposta', entity_id: id });
      tab.openBlob(result.blob, result.file_name);
      await queryClient.invalidateQueries({ queryKey: ['propostas'] });
      toast('Revisão e PDF gerados.', 'success');
    } catch (error) {
      tab.fail();
      toast((error as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function send(id: string, email: string | null) {
    const recipient = email || window.prompt('E-mail do destinatário:')?.trim() || '';
    if (!recipient) return;
    const accepted = await confirm({ title: 'Enviar proposta', message: `Enviar PDF e link seguro para ${recipient}?`, confirmLabel: 'Enviar' });
    if (!accepted) return;
    setBusy(`send:${id}`);
    try {
      await sendCommercialDocument('proposta', id, recipient);
      await queryClient.invalidateQueries({ queryKey: ['propostas'] });
      toast('Proposta enviada ou registrada na fila de envio.', 'success');
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  function openConversion(proposal: { id: string; work_id: string | null; numero: string | null; titulo: string | null }) {
    setConversion({
      proposalId: proposal.id,
      existingWorkId: proposal.work_id,
      contractNumber: proposal.numero ?? '',
      workName: proposal.work_id ? '' : (proposal.titulo ?? ''),
      workCode: '',
      address: '',
      city: '',
      uf: '',
      structureName: '',
    });
  }

  async function convertNow() {
    if (!conversion) return;
    if (!conversion.existingWorkId && !conversion.workName.trim()) {
      toast('Informe o nome da obra que será criada.', 'warning');
      return;
    }
    setBusy(`convert:${conversion.proposalId}`);
    try {
      const result = await convertProposalToContractWork({
        proposalId: conversion.proposalId,
        contractNumber: conversion.contractNumber.trim() || undefined,
        work: conversion.existingWorkId ? { id: conversion.existingWorkId } : {
          nome: conversion.workName.trim(),
          codigo: conversion.workCode.trim() || undefined,
          endereco: conversion.address.trim() || undefined,
          cidade: conversion.city.trim() || undefined,
          uf: conversion.uf.trim().toUpperCase() || undefined,
          estrutura_habilitada: !!conversion.structureName.trim(),
        },
        structures: conversion.structureName.trim() ? [{ nome: conversion.structureName.trim(), ordem: 1, pecas: [] }] : [],
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['propostas'] }),
        queryClient.invalidateQueries({ queryKey: ['contracts-v2'] }),
        queryClient.invalidateQueries({ queryKey: ['refs-works'] }),
      ]);
      setConversion(null);
      toast(result.idempotent ? 'A proposta já estava convertida.' : 'Contrato e obra criados com rastreabilidade.', 'success');
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function archive(id: string) {
    const accepted = await confirm({ title: 'Arquivar proposta', message: 'Apenas rascunhos podem ser arquivados diretamente.', danger: true, confirmLabel: 'Arquivar' });
    if (!accepted) return;
    try {
      await softDeleteProposta(id);
      await queryClient.invalidateQueries({ queryKey: ['propostas'] });
      toast('Proposta arquivada.', 'success');
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader kicker="Comercial" title="Propostas comerciais v2" description="Catálogo de serviços, revisões imutáveis, PDF padronizado, envio e aceite por link seguro." />
        {can('proposta.gerenciar') ? <Button onClick={startNew}>Nova proposta</Button> : null}
      </div>

      {proposals.isLoading ? <LoadingState /> : proposals.error ? <ErrorState message={(proposals.error as Error).message} /> : !proposals.data?.length ? <EmptyState /> : (
        <TableShell>
          <thead><tr><Th>Número / revisão</Th><Th>Cliente</Th><Th>Validade</Th><Th>Valor</Th><Th>Status</Th><Th>Follow-up</Th><Th>Ações</Th></tr></thead>
          <tbody>
            {proposals.data.map((proposal) => (
              <tr key={proposal.id}>
                <Td><strong>{proposal.numero || 'Sem número'}</strong><div className="text-xs text-slate-500">R{proposal.revision}</div></Td>
                <Td>{proposal.cliente || '-'}<div className="text-xs text-slate-500">{proposal.titulo || proposal.recipient_email || ''}</div></Td>
                <Td>{dateBr(proposal.validade)}</Td>
                <Td className="font-bold">{money(proposal.valor_total)}</Td>
                <Td><Pill tone={proposal.status === 'aceita' ? 'good' : proposal.status === 'recusada' || proposal.status === 'expirada' ? 'bad' : proposal.status === 'enviada' ? 'info' : 'neutral'}>{PROPOSTA_STATUS.find((item) => item.value === proposal.status)?.label ?? proposal.status}</Pill></Td>
                <Td>{proposal.followup_at ? dateBr(proposal.followup_at) : '-'}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {proposal.status === 'rascunho' || proposal.status === 'enviada' ? <Button variant="ghost" onClick={() => startEdit(proposal.id)}>Editar</Button> : null}
                    <Button variant="secondary" disabled={busy !== null} onClick={() => void generate(proposal.id)}>{busy === `pdf:${proposal.id}` ? 'Gerando...' : 'PDF'}</Button>
                    {can('proposta.enviar') && ['rascunho', 'enviada'].includes(proposal.status) ? <Button variant="secondary" disabled={busy !== null} onClick={() => void send(proposal.id, proposal.recipient_email)}>{busy === `send:${proposal.id}` ? 'Enviando...' : 'Enviar'}</Button> : null}
                    {can('proposta.converter') && proposal.status === 'aceita' && !proposal.contrato_id ? <Button disabled={busy !== null} onClick={() => openConversion(proposal)}>{busy === `convert:${proposal.id}` ? 'Convertendo...' : 'Criar contrato'}</Button> : null}
                    {proposal.status === 'rascunho' ? <Button variant="danger" onClick={() => void archive(proposal.id)}>Arquivar</Button> : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Drawer wide open={drawerOpen} title={editId ? 'Editar proposta' : 'Nova proposta'} onClose={() => setDrawerOpen(false)} footer={<><Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancelar</Button><Button disabled={busy === 'save'} onClick={() => void save()}>{busy === 'save' ? 'Salvando...' : 'Salvar'}</Button></>}>
        {detail.isLoading && editId ? <LoadingState /> : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Cliente" value={form.client_id} onChange={(event) => setForm((current) => ({ ...current, client_id: event.target.value }))}>
                <option value="">Selecione</option>
                {(clients.data ?? []).map((client) => <option key={client.value} value={client.value}>{client.label}</option>)}
              </SelectField>
              <Field label="Número" value={form.numero} onChange={(event) => setForm((current) => ({ ...current, numero: event.target.value }))} />
              <Field label="Título" value={form.titulo} onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))} />
              <Field label="Validade" type="date" value={form.validade} onChange={(event) => setForm((current) => ({ ...current, validade: event.target.value }))} />
              <SelectField label="Status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                {PROPOSTA_STATUS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </SelectField>
              <SelectField label="Template" value={form.template_version_id} onChange={(event) => setForm((current) => ({ ...current, template_version_id: event.target.value }))}>
                <option value="">Template publicado padrão</option>
                {proposalTemplates.flatMap((template) => template.versions.filter((version) => version.status === 'published').map((version) => <option key={version.id} value={version.id}>{template.nome} · v{version.version}</option>))}
              </SelectField>
              <Field label="Destinatário" value={form.recipient_name} onChange={(event) => setForm((current) => ({ ...current, recipient_name: event.target.value }))} />
              <Field label="E-mail" type="email" value={form.recipient_email} onChange={(event) => setForm((current) => ({ ...current, recipient_email: event.target.value }))} />
              <Field label="Follow-up" type="datetime-local" value={form.followup_at} onChange={(event) => setForm((current) => ({ ...current, followup_at: event.target.value }))} />
              <Field label="Condição de pagamento" value={form.condicao_pagamento} onChange={(event) => setForm((current) => ({ ...current, condicao_pagamento: event.target.value }))} />
            </div>
            <TextArea label="Observações" value={form.observacoes} onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))} />

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h3 className="font-bold">Itens · {money(total)}</h3>
                <div className="flex flex-wrap gap-2">
                  <SelectField label="Adicionar do catálogo" defaultValue="" onChange={(event) => { addCatalogItem(event.target.value); event.currentTarget.value = ''; }}>
                    <option value="">Selecione</option>
                    {(catalog.data ?? []).map((service) => <option key={service.id} value={service.id}>{service.code} · {service.nome}</option>)}
                  </SelectField>
                  <Button variant="secondary" onClick={() => setItems((current) => [...current, blankItem()])}>Item livre</Button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {items.map((item, index) => (
                  <div key={`${item.id ?? 'new'}-${index}`} className="grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-12 dark:bg-slate-900/40">
                    <div className="md:col-span-4"><Field label="Descrição" value={item.descricao} onChange={(event) => patchItem(index, { descricao: event.target.value })} /></div>
                    <div className="md:col-span-2"><Field label="Unidade" value={item.unidade ?? ''} onChange={(event) => patchItem(index, { unidade: event.target.value })} /></div>
                    <div className="md:col-span-2"><NumField label="Quantidade" value={item.quantidade} onCommit={(n) => patchItem(index, { quantidade: n ?? 0 })} min={0} max={99999} dec={3} soft={[0, 10000]} /></div>
                    <div className="md:col-span-2"><NumField label="Preço unitário" value={item.preco_unitario} onCommit={(n) => patchItem(index, { preco_unitario: n ?? 0 })} min={0} max={9999999} dec={2} soft={[0, 100000]} /></div>
                    <div className="flex items-end md:col-span-2"><Button variant="danger" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</Button></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={!!conversion}
        wide
        title="Converter proposta em contrato e obra"
        onClose={() => setConversion(null)}
        footer={<><Button variant="ghost" onClick={() => setConversion(null)}>Cancelar</Button><Button disabled={busy?.startsWith('convert:')} onClick={() => void convertNow()}>{busy?.startsWith('convert:') ? 'Convertendo...' : 'Criar contrato e obra'}</Button></>}
      >
        {conversion ? <div className="grid gap-4 md:grid-cols-2">
          <Field label="Número do contrato" value={conversion.contractNumber} onChange={(event) => setConversion({ ...conversion, contractNumber: event.target.value })} />
          {conversion.existingWorkId ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">A proposta já está vinculada a uma obra. O contrato será associado à obra existente.</div> : <>
            <Field label="Nome da obra" required value={conversion.workName} onChange={(event) => setConversion({ ...conversion, workName: event.target.value })} />
            <Field label="Código da obra" value={conversion.workCode} onChange={(event) => setConversion({ ...conversion, workCode: event.target.value })} />
            <Field label="Endereço" value={conversion.address} onChange={(event) => setConversion({ ...conversion, address: event.target.value })} />
            <Field label="Cidade" value={conversion.city} onChange={(event) => setConversion({ ...conversion, city: event.target.value })} />
            <Field label="UF" maxLength={2} value={conversion.uf} onChange={(event) => setConversion({ ...conversion, uf: event.target.value })} />
            <Field label="Estrutura inicial" value={conversion.structureName} onChange={(event) => setConversion({ ...conversion, structureName: event.target.value })} placeholder="Ex.: Torre A" />
          </>}
          <div className="md:col-span-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">A operação é transacional e idempotente: cria ou vincula a obra, converte os itens da proposta em contrato e registra a trilha de eventos.</div>
        </div> : null}
      </Modal>
    </div>
  );
}
