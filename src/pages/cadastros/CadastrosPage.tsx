import { useState } from 'react';
import { AdminListPage } from '../../components/patterns/AdminListPage';
import { Button } from '../../components/ui/Button';
import type { Column, FieldSpec, DomainRow } from '../../lib/api/types';
import { MateriaisPage } from './MateriaisPage';
import { ColaboradoresPage } from './ColaboradoresPage';

const ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((u) => ({ value: u, label: u }));

type Tab = { key: string; label: string; table: string; description: string; sort: string; columns: Column<DomainRow>[]; fields: FieldSpec[] };

const tabs: Tab[] = [
  { key: 'clientes', label: 'Clientes', table: 'lab_clients', description: 'Construtoras atendidas pelo laboratorio.', sort: 'razao_social',
    columns: [{ key: 'razao_social', header: 'Razao social', sortable: true }, { key: 'nome_fantasia', header: 'Fantasia' }, { key: 'cnpj_cpf', header: 'CNPJ/CPF' }, { key: 'cidade', header: 'Cidade' }, { key: 'uf', header: 'UF' }],
    fields: [{ key: 'tipo', label: 'Tipo', type: 'select', required: true, options: [{ value: 'PJ', label: 'PJ' }, { value: 'PF', label: 'PF' }] }, { key: 'razao_social', label: 'Razao social', required: true }, { key: 'nome_fantasia', label: 'Nome fantasia' }, { key: 'cnpj_cpf', label: 'CNPJ/CPF', lookup: { kind: 'cnpj', map: { razao_social: 'razao_social', nome_fantasia: 'nome_fantasia', email: 'email', telefone: 'telefone', cep: 'cep', endereco: 'endereco', bairro: 'bairro', cidade: 'cidade', uf: 'uf' } } }, { key: 'email', label: 'E-mail' }, { key: 'telefone', label: 'Telefone' }, { key: 'celular', label: 'Celular' }, { key: 'cep', label: 'CEP', lookup: { kind: 'cep', map: { endereco: 'endereco', bairro: 'bairro', cidade: 'cidade', uf: 'uf' } } }, { key: 'endereco', label: 'Endereco' }, { key: 'bairro', label: 'Bairro' }, { key: 'cidade', label: 'Cidade' }, { key: 'uf', label: 'UF', type: 'select', options: ufs }, { key: 'observacoes', label: 'Observacoes', type: 'textarea' }] },
  { key: 'obras', label: 'Obras', table: 'client_works', description: 'Obras dos clientes.', sort: 'nome',
    columns: [{ key: 'codigo', header: 'Codigo', sortable: true }, { key: 'nome', header: 'Obra', sortable: true }, { key: 'cidade', header: 'Cidade' }, { key: 'uf', header: 'UF' }, { key: 'status', header: 'Status' }],
    fields: [{ key: 'client_id', label: 'Cliente', type: 'reference', refTable: 'lab_clients', refLabel: 'razao_social', required: true }, { key: 'codigo', label: 'Codigo' }, { key: 'nome', label: 'Nome da obra', required: true }, { key: 'cep', label: 'CEP', lookup: { kind: 'cep', map: { endereco: 'endereco', bairro: 'bairro', cidade: 'cidade', uf: 'uf' } } }, { key: 'endereco', label: 'Endereco' }, { key: 'bairro', label: 'Bairro' }, { key: 'cidade', label: 'Cidade' }, { key: 'uf', label: 'UF', type: 'select', options: ufs }, { key: 'tipo', label: 'Tipo' }, { key: 'etapa', label: 'Etapa' }, { key: 'responsavel_tecnico', label: 'Responsavel tecnico' }, { key: 'crea', label: 'CREA' }, { key: 'estrutura_habilitada', label: 'Habilitar estrutura (pecas)', type: 'boolean' }, { key: 'traco_habilitado', label: 'Habilitar tracos por obra', type: 'boolean' }] },
  { key: 'contatos', label: 'Contatos', table: 'client_contacts', description: 'Contatos dos clientes e obras.', sort: 'nome',
    columns: [{ key: 'nome', header: 'Nome', sortable: true }, { key: 'cargo', header: 'Cargo' }, { key: 'email', header: 'E-mail' }, { key: 'telefone', header: 'Telefone' }],
    fields: [{ key: 'client_id', label: 'Cliente', type: 'reference', refTable: 'lab_clients', refLabel: 'razao_social', required: true }, { key: 'work_id', label: 'Obra (opcional)', type: 'reference', refTable: 'client_works' }, { key: 'nome', label: 'Nome', required: true }, { key: 'cargo', label: 'Cargo' }, { key: 'email', label: 'E-mail' }, { key: 'telefone', label: 'Telefone' }] },
  { key: 'contratos', label: 'Contratos', table: 'lab_contracts', description: 'Contratos (referencia: anexo + vinculo).', sort: 'numero',
    columns: [{ key: 'numero', header: 'Numero', sortable: true }, { key: 'descricao', header: 'Descricao' }, { key: 'vigencia_inicio', header: 'Inicio', type: 'date' }, { key: 'vigencia_fim', header: 'Fim', type: 'date' }, { key: 'status', header: 'Status' }],
    fields: [{ key: 'client_id', label: 'Cliente', type: 'reference', refTable: 'lab_clients', refLabel: 'razao_social', required: true }, { key: 'numero', label: 'Numero' }, { key: 'descricao', label: 'Descricao', type: 'textarea' }, { key: 'vigencia_inicio', label: 'Vigencia inicio', type: 'date' }, { key: 'vigencia_fim', label: 'Vigencia fim', type: 'date' }, { key: 'status', label: 'Status' }] },
  { key: 'equipamentos', label: 'Equipamentos', table: 'equipamentos', description: 'Equipamentos e calibracao.', sort: 'tipo',
    columns: [{ key: 'tipo', header: 'Tipo', sortable: true }, { key: 'marca_modelo', header: 'Marca/Modelo' }, { key: 'numero_serie', header: 'No serie' }, { key: 'validade_calibracao', header: 'Validade calib.', type: 'date' }],
    fields: [{ key: 'tipo', label: 'Tipo', type: 'select', required: true, options: [{ value: 'prensa', label: 'Prensa' }, { value: 'balanca', label: 'Balanca' }, { value: 'molde', label: 'Molde' }, { value: 'paquimetro', label: 'Paquimetro' }, { value: 'outro', label: 'Outro' }] }, { key: 'marca_modelo', label: 'Marca/Modelo' }, { key: 'numero_serie', label: 'No serie' }, { key: 'capacidade_kn', label: 'Capacidade (kN)', type: 'number' }, { key: 'classe', label: 'Classe' }, { key: 'numero_certificado', label: 'No certificado' }, { key: 'data_calibracao', label: 'Data calibracao', type: 'date' }, { key: 'validade_calibracao', label: 'Validade calibracao', type: 'date' }, { key: 'lab_calibrador', label: 'Lab. calibrador' }, { key: 'incerteza_mpa', label: 'Incerteza (MPa)', type: 'number' }] },
  { key: 'tipos_ensaio', label: 'Tipos de ensaio', table: 'material_test_types', description: 'Catalogo de ensaios do controle tecnologico (NBR 5739: idade de controle, dimensoes do CP, consolidacao).', sort: 'codigo',
    columns: [{ key: 'codigo', header: 'Codigo', sortable: true }, { key: 'nome', header: 'Descricao', sortable: true }, { key: 'ensaio_grupo', header: 'Grupo' }, { key: 'unidade_resultado', header: 'Unidade' }, { key: 'idade_controle', header: 'Idade ctrl', type: 'number' }, { key: 'tipo_resultado_consolidado', header: 'Consolidado' }],
    fields: [{ key: 'codigo', label: 'Codigo', required: true, help: 'Sigla curta, ex.: COMP.' }, { key: 'nome', label: 'Descricao / nome do ensaio', required: true }, { key: 'descricao_curta', label: 'Descricao curta' }, { key: 'material_kind', label: 'Material', type: 'select', required: true, options: [{ value: 'concreto', label: 'Concreto' }, { value: 'argamassa', label: 'Argamassa' }, { value: 'graute', label: 'Graute' }, { value: 'bloco_estrutural', label: 'Bloco estrutural' }, { value: 'solos', label: 'Solos' }, { value: 'cbuq', label: 'CBUQ' }] }, { key: 'ensaio_grupo', label: 'Grupo do ensaio', type: 'select', required: true, options: [{ value: 'endurecido', label: 'Endurecido' }, { value: 'fresco', label: 'Fresco' }] }, { key: 'unidade_resultado', label: 'Unidade do resultado', help: 'Ex.: MPa.' }, { key: 'tipo_resultado_consolidado', label: 'Resultado consolidado (exemplar)', type: 'select', required: true, options: [{ value: 'maximo', label: 'Maximo (maior do par)' }, { value: 'minimo', label: 'Minimo' }, { value: 'media', label: 'Media' }, { value: 'mediana', label: 'Mediana' }] }, { key: 'idade_controle', label: 'Idade de controle', type: 'number', help: 'Idade de aceitacao, ex.: 28.' }, { key: 'idade_controle_unidade', label: 'Unidade da idade', type: 'select', required: true, options: [{ value: 'dia', label: 'Dias' }, { value: 'hora', label: 'Horas' }] }, { key: 'cp_diametro_padrao_mm', label: 'Diametro padrao do CP (mm)', type: 'number' }, { key: 'cp_altura_padrao_mm', label: 'Altura padrao do CP (mm)', type: 'number' }, { key: 'descarte_automatico', label: 'Descarte automatico', type: 'boolean' }, { key: 'gera_nc', label: 'Gera nao conformidade', type: 'boolean' }, { key: 'enviar_email', label: 'Enviar e-mail de resultado insatisfatorio', type: 'boolean' }, { key: 'email_idades', label: 'Idades de e-mail (texto livre)' }, { key: 'padrao', label: 'Ensaio padrao', type: 'boolean' }, { key: 'observacao', label: 'Observacao', type: 'textarea' }] },
];

export function CadastrosPage() {
  const [active, setActive] = useState(0);
  const COLAB = tabs.length;
  const MATERIAIS = tabs.length + 1;
  const isColab = active === COLAB;
  const isMateriais = active === MATERIAIS;
  const t = tabs[Math.min(active, tabs.length - 1)];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map((tab, i) => <Button key={tab.key} variant={i === active ? 'primary' : 'ghost'} onClick={() => setActive(i)}>{tab.label}</Button>)}
        <Button variant={isColab ? 'primary' : 'ghost'} onClick={() => setActive(COLAB)}>Colaboradores</Button>
        <Button variant={isMateriais ? 'primary' : 'ghost'} onClick={() => setActive(MATERIAIS)}>Materiais e ensaios</Button>
      </div>
      {isColab
        ? <ColaboradoresPage />
        : isMateriais
        ? <MateriaisPage />
        : <AdminListPage key={t.key} title={t.label} kicker="Cadastros" description={t.description} table={t.table} columns={t.columns} fields={t.fields} initialSort={t.sort} canDelete />}
    </div>
  );
}
