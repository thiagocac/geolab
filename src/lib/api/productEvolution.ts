import { env } from '../env';
import { supabase } from '../supabase';
import { invokeEdgeFunction } from '../telemetry/edge';

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type JsonObject = Record<string, unknown>;
export type RefOption = { id: string; label: string; extra?: string | null };

const text = (value: unknown): string => String(value ?? '');
const nullableText = (value: unknown): string | null => value == null || value === '' ? null : String(value);
const numberValue = (value: unknown): number => Number(value ?? 0) || 0;
const boolValue = (value: unknown): boolean => value === true;

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}


// Shared references.
export async function listClientsRef(): Promise<RefOption[]> {
  const { data, error } = await db.from('lab_clients')
    .select('id,razao_social,nome_fantasia,cnpj_cpf')
    .is('deleted_at', null)
    .order('razao_social');
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id),
    label: text(row.nome_fantasia || row.razao_social),
    extra: nullableText(row.cnpj_cpf),
  }));
}

export async function listWorksRef(clientId?: string): Promise<Array<RefOption & { client_id: string }>> {
  let query = db.from('client_works').select('id,client_id,codigo,nome').is('deleted_at', null).order('nome');
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id), client_id: text(row.client_id), label: text(row.nome), extra: nullableText(row.codigo),
  }));
}

export async function listCollaboratorsRef(): Promise<RefOption[]> {
  const { data, error } = await db.from('colaboradores').select('id,nome,funcoes').eq('ativo', true).is('deleted_at', null).order('nome');
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id), label: text(row.nome), extra: Array.isArray(row.funcoes) ? row.funcoes.map(String).join(', ') : null,
  }));
}

export async function listEquipmentRef(): Promise<RefOption[]> {
  const { data, error } = await db.from('equipamentos')
    .select('id,apelido,tipo,marca_modelo,numero_serie')
    .eq('ativo', true)
    .is('deleted_at', null)
    .order('tipo');
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id), label: text(row.apelido || row.marca_modelo || row.tipo), extra: nullableText(row.numero_serie),
  }));
}

// Cross-module overview.
export type ProductSnapshot = {
  document_templates: number;
  catalog_services: number;
  proposals_open: number;
  contracts_active: number;
  measurements_open: number;
  accounts_receivable: number;
  capacity_conflicts: number;
  stock_low: number;
  iso_findings_open: number;
  bonus_cycles_pending: number;
};

export async function getProductSnapshot(): Promise<ProductSnapshot> {
  const row = await rpc<JsonObject>('product_v213_snapshot');
  return {
    document_templates: numberValue(row.document_templates),
    catalog_services: numberValue(row.catalog_services),
    proposals_open: numberValue(row.proposals_open),
    contracts_active: numberValue(row.contracts_active),
    measurements_open: numberValue(row.measurements_open),
    accounts_receivable: numberValue(row.accounts_receivable),
    capacity_conflicts: numberValue(row.capacity_conflicts),
    stock_low: numberValue(row.stock_low),
    iso_findings_open: numberValue(row.iso_findings_open),
    bonus_cycles_pending: numberValue(row.bonus_cycles_pending),
  };
}

// SPEC-01 — versioned document templates.
export type TemplateBlock = { type: string; text?: string; level?: number; source?: string; columns?: string[]; label?: string } & JsonObject;
export type TemplateVersion = {
  id: string;
  template_id: string;
  version: number;
  status: string;
  title_template: string;
  body_template: string;
  blocks: TemplateBlock[];
  placeholders: string[];
  sample_data: JsonObject;
  published_at: string | null;
  created_at: string;
};
export type DocumentTemplate = {
  id: string;
  key: string;
  nome: string;
  escopo: string;
  descricao: string | null;
  ativo: boolean;
  versions: TemplateVersion[];
};

export async function listDocumentTemplates(): Promise<DocumentTemplate[]> {
  const { data: templates, error } = await db.from('document_templates')
    .select('id,key,nome,escopo,descricao,ativo')
    .is('deleted_at', null)
    .order('nome');
  if (error) throw new Error(error.message);
  const base = (templates ?? []) as JsonObject[];
  const ids = base.map((row) => text(row.id));
  let versions: JsonObject[] = [];
  if (ids.length) {
    const result = await db.from('document_template_versions')
      .select('id,template_id,version,status,title_template,body_template,blocks,placeholders,sample_data,published_at,created_at')
      .in('template_id', ids)
      .is('deleted_at', null)
      .order('version', { ascending: false });
    if (result.error) throw new Error(result.error.message);
    versions = (result.data ?? []) as JsonObject[];
  }
  return base.map((row) => ({
    id: text(row.id), key: text(row.key), nome: text(row.nome), escopo: text(row.escopo),
    descricao: nullableText(row.descricao), ativo: row.ativo !== false,
    versions: versions.filter((version) => text(version.template_id) === text(row.id)).map((version) => ({
      id: text(version.id), template_id: text(version.template_id), version: numberValue(version.version), status: text(version.status),
      title_template: text(version.title_template),
      body_template: text(version.body_template),
      blocks: Array.isArray(version.blocks) ? version.blocks as TemplateBlock[] : [],
      placeholders: Array.isArray(version.placeholders) ? version.placeholders.map(String) : [],
      sample_data: version.sample_data && typeof version.sample_data === 'object' ? version.sample_data as JsonObject : {},
      published_at: nullableText(version.published_at), created_at: text(version.created_at),
    })),
  }));
}

export async function saveDocumentTemplate(payload: {
  id?: string;
  key: string;
  nome: string;
  escopo: string;
  descricao?: string;
  title_template: string;
  body_template: string;
  blocks: TemplateBlock[];
  placeholders: string[];
  sample_data?: JsonObject;
  ativo?: boolean;
}): Promise<{ template_id: string; version_id: string; version: number }> {
  const row = await rpc<JsonObject>('save_document_template', { p_payload: payload });
  return { template_id: text(row.template_id), version_id: text(row.version_id), version: numberValue(row.version) };
}

export async function publishDocumentTemplate(templateId: string, versionId: string): Promise<void> {
  await rpc('publish_document_template', { p_template_id: templateId, p_version_id: versionId });
}

// Adaptado (v222): a NOSSA generate-document-pdf renderiza o template de BLOCOS publicado do
// escopo e responde o PDF binário (trilha nos headers x-job-id/x-storage-path). Retorna o Blob
// para abrir com openDeferredTab (padrão v80) — sem signed_url.
export async function generateDocumentPdf(payload: {
  entity_type: 'proposta' | 'contrato' | 'aditivo' | 'medicao';
  entity_id: string;
}): Promise<{ blob: Blob; job_id: string; storage_path: string; file_name: string }> {
  const escopo = payload.entity_type === 'aditivo' ? 'contrato' : payload.entity_type;
  const { data: tplv, error: tplError } = await db.from('document_template_versions')
    .select('id, document_templates!inner(escopo, ativo, deleted_at)')
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('document_templates.escopo', escopo)
    .eq('document_templates.ativo', true)
    .is('document_templates.deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (tplError) throw new Error(tplError.message);
  const versionId = String((tplv as JsonObject | null)?.id ?? '');
  if (!versionId) throw new Error(`Nenhum template publicado para ${escopo}. Publique um em Gestão → Templates de documentos.`);
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? '';
  const resp = await fetch(`${env.supabaseUrl}/functions/v1/generate-document-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ template_version_id: versionId, entity_type: payload.entity_type, entity_id: payload.entity_id }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as JsonObject;
    let msg = typeof err.error === 'string' && err.error ? err.error : 'Não foi possível gerar o PDF.';
    if (Array.isArray(err.campos) && err.campos.length) msg += ' Campos: ' + (err.campos as string[]).join(', ');
    throw new Error(msg);
  }
  return {
    blob: await resp.blob(),
    job_id: text(resp.headers.get('x-job-id')),
    storage_path: text(resp.headers.get('x-storage-path')),
    file_name: `${payload.entity_type}-${payload.entity_id}.pdf`,
  };
}

// SPEC-02 — master service catalog.
export type ServiceCatalogItem = {
  id: string;
  code: string;
  nome: string;
  descricao: string | null;
  material_kind: string;
  categoria: string;
  unidade: string;
  tipo_cobranca: string;
  preco_sugerido: number;
  custo_estimado: number;
  margem_valor: number;
  margem_pct: number | null;
  base_normativa: string | null;
  regra_operacional: JsonObject;
  ativo: boolean;
};

export async function listServiceCatalog(onlyActive = false): Promise<ServiceCatalogItem[]> {
  let query = db.from('service_catalog_items').select('*').is('deleted_at', null).order('nome');
  if (onlyActive) query = query.eq('ativo', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => {
    const price = numberValue(row.preco_sugerido);
    const cost = numberValue(row.custo_estimado);
    return {
      id: text(row.id), code: text(row.code), nome: text(row.nome), descricao: nullableText(row.descricao),
      material_kind: text(row.material_kind || 'concreto'), categoria: text(row.categoria || 'ensaio'), unidade: text(row.unidade || 'un'),
      tipo_cobranca: text(row.tipo_cobranca || 'avulso'), preco_sugerido: price, custo_estimado: cost,
      margem_valor: price - cost, margem_pct: price > 0 ? Math.round(((price - cost) / price) * 10000) / 100 : null,
      base_normativa: nullableText(row.base_normativa),
      regra_operacional: row.regra_operacional && typeof row.regra_operacional === 'object' ? row.regra_operacional as JsonObject : {},
      ativo: row.ativo !== false,
    };
  });
}

export async function saveServiceCatalogItem(payload: JsonObject): Promise<string> {
  return text(await rpc('upsert_service_catalog_item', { p_payload: payload }));
}

export async function seedServiceCatalogDefaults(): Promise<number> {
  const defaults: JsonObject[] = [
    { code: 'CONC-CP', nome: 'Ensaio de compressão de corpo de prova', categoria: 'ensaio', material_kind: 'concreto', unidade: 'cp', tipo_cobranca: 'por_cp_ensaiado', base_normativa: 'ABNT NBR 5739' },
    { code: 'CONC-MOLD', nome: 'Moldagem de corpos de prova', categoria: 'campo', material_kind: 'concreto', unidade: 'cp', tipo_cobranca: 'por_cp_moldado', base_normativa: 'ABNT NBR 5738' },
    { code: 'CONC-SLUMP', nome: 'Ensaio de abatimento (slump)', categoria: 'campo', material_kind: 'concreto', unidade: 'visita', tipo_cobranca: 'por_visita', base_normativa: 'ABNT NBR 16889' },
    { code: 'DOC-LAUDO', nome: 'Emissão de laudo técnico', categoria: 'documento', material_kind: 'concreto', unidade: 'laudo', tipo_cobranca: 'por_laudo' },
  ];
  let created = 0;
  for (const item of defaults) {
    const existing = (await listServiceCatalog()).some((row) => row.code === item.code);
    if (existing) continue;
    await saveServiceCatalogItem({ ...item, preco_sugerido: 0, custo_estimado: 0, ativo: true });
    created += 1;
  }
  return created;
}

// SPEC-04 — contract lifecycle.
export type ContractBalance = {
  contract_id: string;
  client_id: string;
  work_id: string | null;
  numero: string | null;
  descricao: string | null;
  status: string;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  valor_limite: number;
  valor_medido: number;
  valor_faturado: number;
  saldo_a_medir: number;
  consumo_pct: number;
};
export type ContractItem = {
  id: string;
  catalog_item_id: string | null;
  item_code: string;
  descricao: string;
  unidade: string;
  tipo_cobranca: string;
  preco_unitario: number;
  regra: JsonObject;
  ativo: boolean;
};
export type ContractAddendum = {
  id: string;
  numero: string;
  tipo: string;
  descricao: string;
  effective_date: string;
  delta_amount: number;
  new_total_amount: number | null;
  status: string;
  approved_at: string | null;
  document_job_id: string | null;
};

export async function listContractBalances(): Promise<ContractBalance[]> {
  const { data, error } = await db.from('v_contract_balance').select('*').order('vigencia_fim');
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    contract_id: text(row.id), client_id: text(row.client_id), work_id: nullableText(row.work_id), numero: nullableText(row.numero),
    descricao: nullableText(row.descricao), status: text(row.status), vigencia_inicio: nullableText(row.vigencia_inicio), vigencia_fim: nullableText(row.vigencia_fim),
    valor_limite: numberValue(row.valor_limite), valor_medido: numberValue(row.valor_medido), valor_faturado: numberValue(row.valor_faturado),
    saldo_a_medir: numberValue(row.saldo_a_medir), consumo_pct: numberValue(row.consumo_pct),
  }));
}

export async function getContractDetail(contractId: string): Promise<{ contract: JsonObject; items: ContractItem[]; work_ids: string[]; addenda: ContractAddendum[] }> {
  const { data: contract, error } = await db.from('lab_contracts').select('*').eq('id', contractId).is('deleted_at', null).single();
  if (error) throw new Error(error.message);
  const [itemsResult, worksResult, addendaResult] = await Promise.all([
    db.from('lab_contract_price_items').select('*').eq('contract_id', contractId).is('deleted_at', null).order('item_code'),
    db.from('contract_works').select('work_id').eq('contract_id', contractId),
    db.from('contract_addenda').select('*').eq('contract_id', contractId).is('deleted_at', null).order('created_at', { ascending: false }),
  ]);
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  if (worksResult.error) throw new Error(worksResult.error.message);
  if (addendaResult.error) throw new Error(addendaResult.error.message);
  return {
    contract: contract as JsonObject,
    items: ((itemsResult.data ?? []) as JsonObject[]).map((row) => ({
      id: text(row.id), catalog_item_id: nullableText(row.catalog_item_id), item_code: text(row.item_code), descricao: text(row.descricao),
      unidade: text(row.unidade), tipo_cobranca: text(row.tipo_cobranca), preco_unitario: numberValue(row.preco_unitario),
      regra: row.regra && typeof row.regra === 'object' ? row.regra as JsonObject : {}, ativo: row.ativo !== false,
    })),
    work_ids: ((worksResult.data ?? []) as JsonObject[]).map((row) => text(row.work_id)),
    addenda: ((addendaResult.data ?? []) as JsonObject[]).map((row) => ({
      id: text(row.id), numero: text(row.numero), tipo: text(row.tipo), descricao: text(row.descricao), effective_date: text(row.effective_date),
      delta_amount: numberValue(row.delta_amount), new_total_amount: row.new_total_amount == null ? null : numberValue(row.new_total_amount),
      status: text(row.status), approved_at: nullableText(row.approved_at), document_job_id: nullableText(row.document_job_id),
    })),
  };
}

export async function saveContractStructured(payload: JsonObject): Promise<string> {
  return text(await rpc('save_contract_v2', { p_payload: payload }));
}
export async function createContractAddendum(payload: JsonObject): Promise<string> {
  return text(await rpc('create_contract_addendum', { p_payload: payload }));
}
export async function approveContractAddendum(id: string): Promise<void> {
  await rpc('approve_contract_addendum', { p_addendum_id: id });
}
export async function convertAcceptedProposal(id: string, number?: string): Promise<string> {
  return text(await rpc('convert_accepted_proposal_v2', { p_proposal_id: id, p_contract_number: number ?? null }));
}

// SPEC-05 — measurement v2.
export type MeasurementSummary = {
  id: string;
  numero: string | null;
  client_id: string;
  cliente: string | null;
  work_id: string | null;
  obra: string | null;
  contract_id: string | null;
  competencia: string;
  periodo_inicio: string;
  periodo_fim: string;
  status: string;
  revisao: number;
  valor_itens: number;
  valor_adicionais: number;
  valor_total: number;
  total_itens: number;
  decisao_cliente: string | null;
  enviada_at: string | null;
  pdf_storage_path: string | null;
};

export async function listMeasurementsV2(): Promise<MeasurementSummary[]> {
  const { data, error } = await db.from('v_measurement_summary').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id), numero: nullableText(row.numero), client_id: text(row.client_id), cliente: nullableText(row.cliente),
    work_id: nullableText(row.work_id), obra: nullableText(row.obra), contract_id: nullableText(row.contract_id), competencia: text(row.competencia),
    periodo_inicio: text(row.periodo_inicio), periodo_fim: text(row.periodo_fim), status: text(row.status), revisao: numberValue(row.revisao),
    valor_itens: numberValue(row.valor_itens), valor_adicionais: numberValue(row.valor_adicionais), valor_total: numberValue(row.valor_total),
    total_itens: numberValue(row.total_itens), decisao_cliente: nullableText(row.decisao_cliente), enviada_at: nullableText(row.enviada_at),
    pdf_storage_path: nullableText(row.pdf_storage_path),
  }));
}

export async function listMeasurementItems(id: string): Promise<JsonObject[]> {
  const { data, error } = await db.from('medicao_itens').select('*').eq('medicao_id', id).is('deleted_at', null).order('ordem');
  if (error) throw new Error(error.message);
  return (data ?? []) as JsonObject[];
}
export async function materializeMeasurementItems(id: string): Promise<JsonObject> {
  return rpc('materialize_measurement_items', { p_medicao_id: id });
}
export async function issueInvoiceFromMeasurement(id: string, dueDate?: string): Promise<JsonObject> {
  return rpc('emitir_fatura', { p_medicao_id: id, p_vencimento: dueDate ?? null });
}

// SPEC-06 — AR/AP and cashflow.
export type FinanceEntry = {
  id: string;
  tipo: 'receita' | 'despesa';
  descricao: string;
  competencia: string | null;
  data_emissao: string;
  data_vencimento: string | null;
  valor: number;
  valor_liquidado: number;
  status: string;
  contraparte: string | null;
  client_id: string | null;
  work_id: string | null;
  contract_id: string | null;
  forma_pagamento: string | null;
  installment_group_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
};
export type FinanceCashflow = {
  mes: string;
  receitas_previstas: number;
  despesas_previstas: number;
  receitas_realizadas: number;
  despesas_realizadas: number;
  saldo_realizado: number;
};

export async function listFinanceEntries(limit = 500): Promise<FinanceEntry[]> {
  const { data, error } = await db.from('finance_entries').select('*').is('deleted_at', null).order('data_vencimento', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id), tipo: text(row.tipo) === 'despesa' ? 'despesa' : 'receita', descricao: text(row.descricao), competencia: nullableText(row.competencia),
    data_emissao: text(row.data_emissao), data_vencimento: nullableText(row.data_vencimento), valor: numberValue(row.valor), valor_liquidado: numberValue(row.valor_liquidado),
    status: text(row.status), contraparte: nullableText((row.metadata as JsonObject | undefined)?.contraparte), client_id: nullableText(row.client_id),
    work_id: nullableText(row.work_id), contract_id: nullableText(row.contract_id), forma_pagamento: nullableText(row.forma_pagamento),
    installment_group_id: nullableText(row.installment_group_id), installment_number: row.installment_number == null ? null : numberValue(row.installment_number),
    installment_total: row.installment_total == null ? null : numberValue(row.installment_total),
  }));
}
export async function listFinanceCashflow(): Promise<FinanceCashflow[]> {
  const { data, error } = await db.from('v_finance_cashflow_monthly').select('*').order('mes');
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    mes: text(row.mes), receitas_previstas: numberValue(row.receitas_previstas), despesas_previstas: numberValue(row.despesas_previstas),
    receitas_realizadas: numberValue(row.receitas_realizadas), despesas_realizadas: numberValue(row.despesas_realizadas), saldo_realizado: numberValue(row.saldo_realizado),
  }));
}
export async function saveFinanceEntry(payload: JsonObject): Promise<string> {
  return text(await rpc('save_finance_entry', { p_payload: payload }));
}
export async function settleFinanceEntry(id: string, value: number, date: string, method?: string): Promise<JsonObject> {
  return rpc('settle_finance_entry', { p_id: id, p_valor: value, p_data: date, p_forma: method ?? null });
}
export async function createFinanceInstallments(payload: JsonObject, installments: number, intervalMonths = 1): Promise<JsonObject> {
  return rpc('create_finance_installments', { p_payload: payload, p_installments: installments, p_interval_months: intervalMonths });
}

// SPEC-07 — people/equipment capacity.
export type CapacityRow = {
  data: string;
  resource_type: string;
  equipamento_id: string | null;
  equipamento: string | null;
  colaborador_id: string | null;
  colaborador: string | null;
  capacidade: number | null;
  capacidade_unidade: string | null;
  reservado: number;
  reservas: number;
  utilizacao_pct: number | null;
  conflito: boolean;
};
export type CapacitySnapshot = { from: string; to: string; rows: CapacityRow[]; conflicts: number; shifts: JsonObject[] };

export async function getCapacitySnapshot(from: string, to: string): Promise<CapacitySnapshot> {
  const raw = await rpc<JsonObject>('capacity_weekly_snapshot', { p_from: from, p_to: to });
  return {
    from: text(raw.from || from), to: text(raw.to || to), conflicts: numberValue(raw.conflicts),
    rows: Array.isArray(raw.rows) ? (raw.rows as JsonObject[]).map((row) => ({
      data: text(row.data), resource_type: text(row.resource_type), equipamento_id: nullableText(row.equipamento_id), equipamento: nullableText(row.equipamento),
      colaborador_id: nullableText(row.colaborador_id), colaborador: nullableText(row.colaborador), capacidade: row.capacidade == null ? null : numberValue(row.capacidade),
      capacidade_unidade: nullableText(row.capacidade_unidade), reservado: numberValue(row.reservado), reservas: numberValue(row.reservas),
      utilizacao_pct: row.utilizacao_pct == null ? null : numberValue(row.utilizacao_pct), conflito: boolValue(row.conflito),
    })) : [],
    shifts: Array.isArray(raw.shifts) ? raw.shifts as JsonObject[] : [],
  };
}
export async function saveTeamShift(payload: JsonObject): Promise<string> { return text(await rpc('save_team_shift', { p_payload: payload })); }
export async function saveResourceCapacity(payload: JsonObject): Promise<string> { return text(await rpc('save_resource_capacity', { p_payload: payload })); }

// SPEC-08 — consumables inventory plus forms overview.
export type StockBalance = {
  stock_item_id: string;
  code: string;
  nome: string;
  categoria: string;
  unidade: string;
  saldo_minimo: number;
  custo_medio: number;
  saldo: number;
  valor_estoque: number;
  consumo_mes: number;
  abaixo_minimo: boolean;
  ativo: boolean;
};
export type StockMovement = {
  id: string;
  stock_item_id: string;
  tipo: string;
  quantidade: number;
  unit_cost: number | null;
  data: string;
  work_id: string | null;
  observacao: string | null;
};

export async function listStockBalances(): Promise<StockBalance[]> {
  const { data, error } = await db.from('v_stock_balance').select('*').order('nome');
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    stock_item_id: text(row.stock_item_id), code: text(row.code), nome: text(row.nome), categoria: text(row.categoria), unidade: text(row.unidade),
    saldo_minimo: numberValue(row.saldo_minimo), custo_medio: numberValue(row.custo_medio), saldo: numberValue(row.saldo),
    valor_estoque: numberValue(row.valor_estoque), consumo_mes: numberValue(row.consumo_mes),
    abaixo_minimo: numberValue(row.saldo) < numberValue(row.saldo_minimo), ativo: row.ativo !== false,
  }));
}
export async function listStockMovements(limit = 500): Promise<StockMovement[]> {
  const { data, error } = await db.from('stock_movements').select('*').is('deleted_at', null).order('data', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id), stock_item_id: text(row.stock_item_id), tipo: text(row.tipo), quantidade: numberValue(row.quantidade),
    unit_cost: row.unit_cost == null ? null : numberValue(row.unit_cost), data: text(row.data), work_id: nullableText(row.work_id), observacao: nullableText(row.observacao),
  }));
}
export async function saveStockItem(payload: JsonObject): Promise<string> { return text(await rpc('save_stock_item', { p_payload: payload })); }
export async function registerStockMovement(payload: JsonObject): Promise<string> { return text(await rpc('register_stock_movement', { p_payload: payload })); }
export async function suggestStockConsumption(concretagemId: string): Promise<JsonObject[]> {
  return rpc('suggest_stock_consumption', { p_concretagem_id: concretagemId });
}

// SPEC-09 — ISO/IEC 17025 readiness (management support, not certification).
export type IsoAssessment = { id: string; titulo: string; referencia: string; data_inicio: string; data_fim: string | null; status: string; observacoes: string | null };
export type IsoSnapshot = {
  assessment_id: string;
  titulo: string;
  status: string;
  score: number;
  conforme: number;
  parcial: number;
  nao_conforme: number;
  nao_avaliado: number;
  items: JsonObject[];
};

export async function listIsoAssessments(): Promise<IsoAssessment[]> {
  const { data, error } = await db.from('iso_assessments').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id), titulo: text(row.titulo), referencia: text(row.referencia), data_inicio: text(row.data_inicio), data_fim: nullableText(row.data_fim),
    status: text(row.status), observacoes: nullableText(row.observacoes),
  }));
}
export async function createIsoAssessment(title: string, responsibleId?: string): Promise<string> {
  return text(await rpc('create_iso_assessment', { p_titulo: title, p_responsavel: responsibleId ?? null }));
}
export async function getIsoSnapshot(assessmentId: string): Promise<IsoSnapshot> {
  const [row, itemsResult] = await Promise.all([
    rpc<JsonObject>('iso_readiness_snapshot', { p_assessment_id: assessmentId }),
    db.from('iso_assessment_items')
      .select('id,assessment_id,requirement_code,situacao,nota,comentario,avaliado_at,iso_requirement_catalog(code,clause,titulo,descricao,categoria,peso)')
      .eq('assessment_id', assessmentId)
      .order('requirement_code'),
  ]);
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  return {
    assessment_id: text(row.assessment_id), titulo: text(row.titulo), status: text(row.status), score: numberValue(row.score),
    conforme: numberValue(row.conformes), parcial: numberValue(row.parciais), nao_conforme: numberValue(row.nao_conformes), nao_avaliado: numberValue(row.nao_avaliados),
    items: (itemsResult.data ?? []) as JsonObject[],
  };
}
export async function updateIsoAssessmentItem(id: string, situation: string, comment?: string): Promise<void> {
  const { error } = await db.from('iso_assessment_items').update({ situacao: situation, comentario: comment ?? null, avaliado_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function createIsoFinding(payload: JsonObject): Promise<string> {
  const { data, error } = await db.from('iso_findings').insert(payload).select('id').single();
  if (error) throw new Error(error.message);
  return text(data.id);
}
export async function listIsoFindings(): Promise<JsonObject[]> {
  const { data, error } = await db.from('v_iso_open_findings').select('*').order('prazo');
  if (error) throw new Error(error.message);
  return (data ?? []) as JsonObject[];
}
export async function convertIsoFindingToNc(id: string, workId?: string): Promise<string> {
  return text(await rpc('convert_iso_finding_to_nc', { p_finding_id: id, p_work_id: workId ?? null }));
}
export async function listCompetenceRecords(): Promise<JsonObject[]> {
  const { data, error } = await db.from('competence_matrix').select('*,colaboradores(nome)').is('deleted_at', null).order('valid_until');
  if (error) throw new Error(error.message);
  return (data ?? []) as JsonObject[];
}
export async function saveCompetenceRecord(payload: JsonObject): Promise<string> { return text(await rpc('save_competence_record', { p_payload: payload })); }
export async function listProficiencyRounds(): Promise<JsonObject[]> {
  const { data, error } = await db.from('proficiency_rounds').select('*').is('deleted_at', null).order('data_inicio', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as JsonObject[];
}
export async function saveProficiencyRound(payload: JsonObject): Promise<string> { return text(await rpc('save_proficiency_round', { p_payload: payload })); }
export async function listInternalAudits(): Promise<JsonObject[]> {
  const { data, error } = await db.from('internal_audits').select('*').is('deleted_at', null).order('data_planejada', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as JsonObject[];
}
export async function saveInternalAudit(payload: JsonObject): Promise<string> { return text(await rpc('save_internal_audit', { p_payload: payload })); }

// SPEC-10 — transparent bonus cycles.
export type BonusPlan = {
  id: string;
  nome: string;
  descricao: string | null;
  periodicidade: string;
  valor_base: number;
  teto_multiplicador: number;
  elegibilidade_funcoes: string[];
  ativo: boolean;
};
export type BonusRule = {
  id: string;
  plan_id: string;
  metric_key: string;
  nome: string;
  peso: number;
  meta: number;
  direcao: string;
  gate_qualidade: boolean;
  ativo: boolean;
};
export type BonusCycle = {
  id: string;
  plan_id: string;
  plano: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  status: string;
  colaboradores: number;
  elegiveis: number;
  valor_calculado: number;
  valor_aprovado: number;
  score_medio: number;
};
export type BonusResult = {
  id: string;
  cycle_id: string;
  colaborador_id: string;
  colaborador_nome: string | null;
  score: number;
  multiplicador: number;
  valor: number;
  aprovado_valor: number | null;
  elegivel: boolean;
  bloqueio_motivo: string | null;
  metricas: JsonObject;
};

export async function listBonusPlans(): Promise<BonusPlan[]> {
  const { data, error } = await db.from('bonus_plans').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id), nome: text(row.nome), descricao: nullableText(row.descricao), periodicidade: text(row.periodicidade),
    valor_base: numberValue(row.valor_base), teto_multiplicador: numberValue(row.teto_multiplicador),
    elegibilidade_funcoes: Array.isArray(row.elegibilidade_funcoes) ? row.elegibilidade_funcoes.map(String) : [], ativo: row.ativo !== false,
  }));
}
export async function saveBonusPlan(tenantId: string, payload: JsonObject): Promise<string> {
  const id = nullableText(payload.id);
  const values = { ...payload, tenant_id: tenantId, id: undefined, deleted_at: null };
  const query = id ? db.from('bonus_plans').update(values).eq('id', id).eq('tenant_id', tenantId).select('id').single() : db.from('bonus_plans').insert(values).select('id').single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return text(data.id);
}
export async function listBonusRules(planId: string): Promise<BonusRule[]> {
  const { data, error } = await db.from('bonus_rules').select('*').eq('plan_id', planId).is('deleted_at', null).order('ordem');
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id), plan_id: text(row.plan_id), metric_key: text(row.metric_key), nome: text(row.nome), peso: numberValue(row.peso), meta: numberValue(row.meta),
    direcao: text(row.direcao), gate_qualidade: boolValue(row.gate_qualidade), ativo: row.ativo !== false,
  }));
}
export async function saveBonusRule(tenantId: string, payload: JsonObject): Promise<string> {
  const id = nullableText(payload.id);
  const values = { ...payload, tenant_id: tenantId, id: undefined, deleted_at: null };
  const query = id ? db.from('bonus_rules').update(values).eq('id', id).eq('tenant_id', tenantId).select('id').single() : db.from('bonus_rules').insert(values).select('id').single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return text(data.id);
}
export async function listBonusCycles(): Promise<BonusCycle[]> {
  const { data, error } = await db.from('v_bonus_cycle_summary').select('*').order('periodo_inicio', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id), plan_id: text(row.plan_id), plano: nullableText(row.plano), periodo_inicio: text(row.periodo_inicio), periodo_fim: text(row.periodo_fim),
    status: text(row.status), colaboradores: numberValue(row.colaboradores), elegiveis: numberValue(row.elegiveis),
    valor_calculado: numberValue(row.valor_calculado), valor_aprovado: numberValue(row.valor_aprovado), score_medio: numberValue(row.score_medio),
  }));
}
export async function createBonusCycle(tenantId: string, payload: JsonObject): Promise<string> {
  const { data, error } = await db.from('bonus_cycles').insert({ ...payload, tenant_id: tenantId, deleted_at: null }).select('id').single();
  if (error) throw new Error(error.message);
  return text(data.id);
}
export async function listBonusResults(cycleId: string): Promise<BonusResult[]> {
  const { data, error } = await db.from('bonus_results').select('*,colaboradores(nome)').eq('cycle_id', cycleId).order('valor', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as JsonObject[]).map((row) => ({
    id: text(row.id), cycle_id: text(row.cycle_id), colaborador_id: text(row.colaborador_id),
    colaborador_nome: nullableText((row.colaboradores as JsonObject | undefined)?.nome), score: numberValue(row.score), multiplicador: numberValue(row.multiplicador),
    valor: numberValue(row.valor), aprovado_valor: row.aprovado_valor == null ? null : numberValue(row.aprovado_valor), elegivel: row.elegivel !== false,
    bloqueio_motivo: nullableText(row.bloqueio_motivo), metricas: row.metricas && typeof row.metricas === 'object' ? row.metricas as JsonObject : {},
  }));
}
export async function calculateBonusCycle(id: string): Promise<JsonObject> { return rpc('calculate_bonus_cycle', { p_cycle_id: id }); }
export async function approveBonusCycle(id: string, comment?: string): Promise<JsonObject> { return rpc('approve_bonus_cycle', { p_cycle_id: id, p_observacao: comment ?? null }); }
// [W4] envia o ciclo calculado para o workflow de aprovação (mig wf07); ao aprovar no fluxo, o ciclo é efetivado.
export async function submitBonusCycle(id: string, comment?: string): Promise<JsonObject> { return rpc('submit_bonus_cycle_for_approval', { p_cycle_id: id, p_observacao: comment ?? null }); }

// Shared commercial delivery and public decision flows.
export async function sendCommercialDocument(
  entityTypeOrPayload: 'proposta' | 'contrato' | 'medicao' | { entity_type: 'proposta' | 'contrato' | 'medicao'; entity_id: string; email?: string | null; recipient_name?: string; template_version_id?: string | null },
  entityId?: string,
  email?: string | null,
): Promise<JsonObject> {
  const payload = typeof entityTypeOrPayload === 'string'
    ? { entity_type: entityTypeOrPayload, entity_id: String(entityId ?? ''), email: email ?? undefined }
    : entityTypeOrPayload;
  const { data } = await invokeEdgeFunction<JsonObject>('send-commercial-document', payload, {
    action: 'document.send', ids: { entity_type: payload.entity_type, entity_id: payload.entity_id },
    failureEvent: 'documento.envio_falhou', failMessage: 'Não foi possível enviar o documento.',
  });
  return data;
}

export type CommercialPublicKind = 'proposal' | 'measurement';
const publicKind = (kind: CommercialPublicKind) => kind === 'proposal' ? 'proposta' : 'medicao';

async function callPublicCommercial(kind: CommercialPublicKind, token: string, action: string, comment?: string): Promise<JsonObject> {
  const response = await fetch(`${env.supabaseUrl}/functions/v1/commercial-public-action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: env.supabaseAnonKey },
    body: JSON.stringify({ kind: publicKind(kind), token, action, comment: comment ?? '' }),
  });
  const payload = await response.json().catch(() => ({})) as JsonObject;
  if (!response.ok || payload.ok === false) throw new Error(typeof payload.error === 'string' ? payload.error : 'Não foi possível processar o documento.');
  return payload;
}

export async function readCommercialPublic(kind: CommercialPublicKind, token: string): Promise<JsonObject> {
  const payload = await callPublicCommercial(kind, token, 'read');
  return payload.document && typeof payload.document === 'object' ? { ...(payload.document as JsonObject), ok: true } : payload;
}
export async function decideCommercialPublic(kind: CommercialPublicKind, token: string, decision: string, comment?: string): Promise<JsonObject> {
  const action = kind === 'proposal' ? (decision === 'aceita' ? 'accept' : 'reject') : (decision === 'aceita' || decision === 'aprovada' ? 'accept' : 'contest');
  return callPublicCommercial(kind, token, action, comment);
}
