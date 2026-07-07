import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AdminListPage } from '../../components/patterns/AdminListPage';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { duplicarObra } from '../../lib/api/obras';
import { Button } from '../../components/ui/Button';
import type { Column, FieldSpec, DomainRow } from '../../lib/api/types';
import { ColaboradoresPage } from './ColaboradoresPage';
import { EquipamentosPage } from './EquipamentosPage';

const ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((u) => ({ value: u, label: u }));

type Tab = { key: string; label: string; table: string; description: string; sort: string; columns: Column<DomainRow>[]; fields: FieldSpec[]; dedicated?: boolean; canCreate?: boolean };

const tabs: Tab[] = [
  { key: 'clientes', label: 'Clientes', table: 'lab_clients', description: 'Construtoras atendidas pelo laboratório.', sort: 'razao_social',
    columns: [{ key: 'razao_social', header: 'Razão social', sortable: true }, { key: 'nome_fantasia', header: 'Fantasia' }, { key: 'cnpj_cpf', header: 'CNPJ/CPF' }, { key: 'cidade', header: 'Cidade' }, { key: 'uf', header: 'UF' }],
    fields: [{ key: 'tipo', label: 'Tipo', type: 'select', required: true, options: [{ value: 'PJ', label: 'PJ' }, { value: 'PF', label: 'PF' }] }, { key: 'razao_social', label: 'Razão social', required: true }, { key: 'nome_fantasia', label: 'Nome fantasia' }, { key: 'cnpj_cpf', label: 'CNPJ/CPF', lookup: { kind: 'cnpj', map: { razao_social: 'razao_social', nome_fantasia: 'nome_fantasia', email: 'email', telefone: 'telefone', cep: 'cep', endereco: 'endereco', bairro: 'bairro', cidade: 'cidade', uf: 'uf' } } }, { key: 'email', label: 'E-mail' }, { key: 'telefone', label: 'Telefone' }, { key: 'celular', label: 'Celular' }, { key: 'cep', label: 'CEP', lookup: { kind: 'cep', map: { endereco: 'endereco', bairro: 'bairro', cidade: 'cidade', uf: 'uf' } } }, { key: 'endereco', label: 'Endereço' }, { key: 'bairro', label: 'Bairro' }, { key: 'cidade', label: 'Cidade' }, { key: 'uf', label: 'UF', type: 'select', options: ufs }, { key: 'observacoes', label: 'Observações', type: 'textarea' }] },
  { key: 'obras', label: 'Obras', table: 'client_works', description: 'Obras dos clientes. Para criar uma obra nova, use "Nova obra" (wizard).', sort: 'nome', canCreate: false,
    columns: [{ key: 'codigo', header: 'Código', sortable: true }, { key: 'sigla', header: 'Sigla' }, { key: 'nome', header: 'Obra', sortable: true }, { key: 'cidade', header: 'Cidade' }, { key: 'uf', header: 'UF' }, { key: 'status', header: 'Status' }],
    fields: [{ key: 'client_id', label: 'Cliente', type: 'reference', refTable: 'lab_clients', refLabel: 'razao_social', required: true }, { key: 'codigo', label: 'Código' }, { key: 'nome', label: 'Nome da obra', required: true }, { key: 'sigla', label: 'Sigla (prefixo do Nº de relatório)', help: 'Gerada das 4 primeiras letras do nome; editável.', derive: { from: 'nome', transform: 'first4letters' } }, { key: 'cep', label: 'CEP', lookup: { kind: 'cep', map: { endereco: 'endereco', bairro: 'bairro', cidade: 'cidade', uf: 'uf' } } }, { key: 'endereco', label: 'Endereço' }, { key: 'bairro', label: 'Bairro' }, { key: 'cidade', label: 'Cidade' }, { key: 'uf', label: 'UF', type: 'select', options: ufs }, { key: 'tipo', label: 'Tipo' }, { key: 'etapa', label: 'Etapa' }, { key: 'responsavel_tecnico', label: 'Responsavel tecnico' }, { key: 'crea', label: 'CREA' }, { key: 'estrutura_habilitada', label: 'Habilitar estrutura (pecas)', type: 'boolean' }] },
  { key: 'contatos', label: 'Contatos', table: 'client_contacts', description: 'Contatos dos clientes e obras.', sort: 'nome',
    columns: [{ key: 'nome', header: 'Nome', sortable: true }, { key: 'cargo', header: 'Cargo' }, { key: 'email', header: 'E-mail' }, { key: 'telefone', header: 'Telefone' }],
    fields: [{ key: 'client_id', label: 'Cliente', type: 'reference', refTable: 'lab_clients', refLabel: 'razao_social', required: true }, { key: 'work_id', label: 'Obra (opcional)', type: 'reference', refTable: 'client_works' }, { key: 'nome', label: 'Nome', required: true }, { key: 'cargo', label: 'Cargo' }, { key: 'email', label: 'E-mail' }, { key: 'telefone', label: 'Telefone' }] },
  { key: 'contratos', label: 'Contratos', table: 'lab_contracts', description: 'Contratos (referência: anexo + vínculo).', sort: 'numero',
    columns: [{ key: 'numero', header: 'Número', sortable: true }, { key: 'descricao', header: 'Descrição' }, { key: 'vigencia_inicio', header: 'Início', type: 'date' }, { key: 'vigencia_fim', header: 'Fim', type: 'date' }, { key: 'status', header: 'Status' }],
    fields: [{ key: 'client_id', label: 'Cliente', type: 'reference', refTable: 'lab_clients', refLabel: 'razao_social', required: true }, { key: 'numero', label: 'Número' }, { key: 'descricao', label: 'Descrição', type: 'textarea' }, { key: 'vigencia_inicio', label: 'Vigência início', type: 'date' }, { key: 'vigencia_fim', label: 'Vigência fim', type: 'date' }, { key: 'status', label: 'Status' }] },
  { key: 'equipamentos', label: 'Equipamentos', table: 'equipamentos', description: 'Equipamentos e calibração.', sort: 'tipo', dedicated: true, columns: [], fields: [] },
];

export function CadastrosPage() {
  const [sp, setSp] = useSearchParams();
  const [active, setActive] = useState(() => {
    const k = sp.get('tab');
    if (k) { const i = tabs.findIndex((t) => t.key === k); if (i >= 0) return i; if (k === 'colaboradores') return tabs.length; }
    return 0;
  });
  const COLAB = tabs.length;
  const isColab = active === COLAB;
  const t = tabs[Math.min(active, tabs.length - 1)];
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const obrasActions = [{ label: 'Duplicar', run: async (row: DomainRow) => {
    if (!(await confirm({ title: 'Duplicar obra', message: 'Criar uma cópia desta obra com estrutura, traços e configuração? Dados operacionais (concretagens, CPs, laudos) não são copiados.', confirmLabel: 'Duplicar' }))) return;
    try { await duplicarObra(String(row.id)); await qc.invalidateQueries(); toast('Obra duplicada.', 'success'); } catch (e) { toast((e as Error).message, 'error'); }
  } }];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map((tab, i) => <Button key={tab.key} variant={i === active ? 'primary' : 'ghost'} onClick={() => { setActive(i); setSp({ tab: tab.key }, { replace: true }); }}>{tab.label}</Button>)}
        <Button variant={isColab ? 'primary' : 'ghost'} onClick={() => { setActive(COLAB); setSp({ tab: 'colaboradores' }, { replace: true }); }}>Colaboradores</Button>
      </div>
      {isColab
        ? <ColaboradoresPage />
        : t.dedicated && t.key === 'equipamentos'
        ? <EquipamentosPage />
        : <AdminListPage key={t.key} title={t.label} kicker="Cadastros" description={t.description} table={t.table} columns={t.columns} fields={t.fields} initialSort={t.sort} canDelete canCreate={t.canCreate} rowActions={t.key === 'obras' ? obrasActions : undefined} />}
    </div>
  );
}
