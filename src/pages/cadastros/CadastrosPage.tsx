import { useState } from 'react';
import { AdminListPage } from '../../components/patterns/AdminListPage';
import { Button } from '../../components/ui/Button';
import type { Column, FieldSpec, DomainRow } from '../../lib/api/types';
import { MateriaisPage } from './MateriaisPage';

const ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((u) => ({ value: u, label: u }));

type Tab = { key: string; label: string; table: string; description: string; sort: string; columns: Column<DomainRow>[]; fields: FieldSpec[] };

const tabs: Tab[] = [
  { key: 'clientes', label: 'Clientes', table: 'lab_clients', description: 'Construtoras atendidas pelo laboratorio.', sort: 'razao_social',
    columns: [{ key: 'razao_social', header: 'Razao social', sortable: true }, { key: 'nome_fantasia', header: 'Fantasia' }, { key: 'cnpj_cpf', header: 'CNPJ/CPF' }, { key: 'cidade', header: 'Cidade' }, { key: 'uf', header: 'UF' }],
    fields: [{ key: 'tipo', label: 'Tipo', type: 'select', required: true, options: [{ value: 'PJ', label: 'PJ' }, { value: 'PF', label: 'PF' }] }, { key: 'razao_social', label: 'Razao social', required: true }, { key: 'nome_fantasia', label: 'Nome fantasia' }, { key: 'cnpj_cpf', label: 'CNPJ/CPF' }, { key: 'email', label: 'E-mail' }, { key: 'telefone', label: 'Telefone' }, { key: 'celular', label: 'Celular' }, { key: 'cep', label: 'CEP' }, { key: 'endereco', label: 'Endereco' }, { key: 'bairro', label: 'Bairro' }, { key: 'cidade', label: 'Cidade' }, { key: 'uf', label: 'UF', type: 'select', options: ufs }, { key: 'observacoes', label: 'Observacoes', type: 'textarea' }] },
  { key: 'obras', label: 'Obras', table: 'client_works', description: 'Obras dos clientes.', sort: 'nome',
    columns: [{ key: 'codigo', header: 'Codigo', sortable: true }, { key: 'nome', header: 'Obra', sortable: true }, { key: 'cidade', header: 'Cidade' }, { key: 'uf', header: 'UF' }, { key: 'status', header: 'Status' }],
    fields: [{ key: 'client_id', label: 'Cliente', type: 'reference', refTable: 'lab_clients', refLabel: 'razao_social', required: true }, { key: 'codigo', label: 'Codigo' }, { key: 'nome', label: 'Nome da obra', required: true }, { key: 'endereco', label: 'Endereco' }, { key: 'cidade', label: 'Cidade' }, { key: 'uf', label: 'UF', type: 'select', options: ufs }, { key: 'tipo', label: 'Tipo' }, { key: 'etapa', label: 'Etapa' }, { key: 'responsavel_tecnico', label: 'Responsavel tecnico' }, { key: 'crea', label: 'CREA' }, { key: 'estrutura_habilitada', label: 'Habilitar estrutura (pecas)', type: 'boolean' }, { key: 'traco_habilitado', label: 'Habilitar tracos por obra', type: 'boolean' }] },
  { key: 'contatos', label: 'Contatos', table: 'client_contacts', description: 'Contatos dos clientes e obras.', sort: 'nome',
    columns: [{ key: 'nome', header: 'Nome', sortable: true }, { key: 'cargo', header: 'Cargo' }, { key: 'email', header: 'E-mail' }, { key: 'telefone', header: 'Telefone' }],
    fields: [{ key: 'client_id', label: 'Cliente', type: 'reference', refTable: 'lab_clients', refLabel: 'razao_social', required: true }, { key: 'work_id', label: 'Obra (opcional)', type: 'reference', refTable: 'client_works' }, { key: 'nome', label: 'Nome', required: true }, { key: 'cargo', label: 'Cargo' }, { key: 'email', label: 'E-mail' }, { key: 'telefone', label: 'Telefone' }] },
  { key: 'colaboradores', label: 'Colaboradores', table: 'colaboradores', description: 'Moldadores, laboratoristas, RT.', sort: 'nome',
    columns: [{ key: 'nome', header: 'Nome', sortable: true }, { key: 'documento', header: 'CPF' }, { key: 'registro_profissional', header: 'Registro' }],
    fields: [{ key: 'nome', label: 'Nome', required: true }, { key: 'documento', label: 'CPF' }, { key: 'registro_profissional', label: 'Registro (CREA/CRQ/TER)' }] },
  { key: 'contratos', label: 'Contratos', table: 'lab_contracts', description: 'Contratos (referencia: anexo + vinculo).', sort: 'numero',
    columns: [{ key: 'numero', header: 'Numero', sortable: true }, { key: 'descricao', header: 'Descricao' }, { key: 'vigencia_inicio', header: 'Inicio', type: 'date' }, { key: 'vigencia_fim', header: 'Fim', type: 'date' }, { key: 'status', header: 'Status' }],
    fields: [{ key: 'client_id', label: 'Cliente', type: 'reference', refTable: 'lab_clients', refLabel: 'razao_social', required: true }, { key: 'numero', label: 'Numero' }, { key: 'descricao', label: 'Descricao', type: 'textarea' }, { key: 'vigencia_inicio', label: 'Vigencia inicio', type: 'date' }, { key: 'vigencia_fim', label: 'Vigencia fim', type: 'date' }, { key: 'status', label: 'Status' }] },
  { key: 'equipamentos', label: 'Equipamentos', table: 'equipamentos', description: 'Equipamentos e calibracao.', sort: 'tipo',
    columns: [{ key: 'tipo', header: 'Tipo', sortable: true }, { key: 'marca_modelo', header: 'Marca/Modelo' }, { key: 'numero_serie', header: 'No serie' }, { key: 'validade_calibracao', header: 'Validade calib.', type: 'date' }],
    fields: [{ key: 'tipo', label: 'Tipo', type: 'select', required: true, options: [{ value: 'prensa', label: 'Prensa' }, { value: 'balanca', label: 'Balanca' }, { value: 'molde', label: 'Molde' }, { value: 'paquimetro', label: 'Paquimetro' }, { value: 'outro', label: 'Outro' }] }, { key: 'marca_modelo', label: 'Marca/Modelo' }, { key: 'numero_serie', label: 'No serie' }, { key: 'capacidade_kn', label: 'Capacidade (kN)', type: 'number' }, { key: 'classe', label: 'Classe' }, { key: 'numero_certificado', label: 'No certificado' }, { key: 'data_calibracao', label: 'Data calibracao', type: 'date' }, { key: 'validade_calibracao', label: 'Validade calibracao', type: 'date' }, { key: 'lab_calibrador', label: 'Lab. calibrador' }, { key: 'incerteza_mpa', label: 'Incerteza (MPa)', type: 'number' }] },
];

export function CadastrosPage() {
  const [active, setActive] = useState(0);
  const MATERIAIS = tabs.length;
  const isMateriais = active === MATERIAIS;
  const t = tabs[Math.min(active, tabs.length - 1)];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map((tab, i) => <Button key={tab.key} variant={i === active ? 'primary' : 'ghost'} onClick={() => setActive(i)}>{tab.label}</Button>)}
        <Button variant={isMateriais ? 'primary' : 'ghost'} onClick={() => setActive(MATERIAIS)}>Materiais e ensaios</Button>
      </div>
      {isMateriais
        ? <MateriaisPage />
        : <AdminListPage key={t.key} title={t.label} kicker="Cadastros" description={t.description} table={t.table} columns={t.columns} fields={t.fields} initialSort={t.sort} canDelete />}
    </div>
  );
}
