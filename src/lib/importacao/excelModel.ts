import { CAMPOS_CONCRETAGEM, CAMPOS_RECEBIMENTO, CAMPOS_ENSAIO, initCampoState, type CampoCatalogo } from '../concreto/camposEnsaioLaudo';

export type ImportResource = 'tracos' | 'concretagens' | 'recebimentos' | 'resultados';
export type ImportSeverity = 'erro' | 'aviso';
export type ImportIssue = { row: number; field: string; severity: ImportSeverity; message: string };
export type ParsedImport = { resource: ImportResource; rows: Array<Record<string, unknown>>; issues: ImportIssue[]; validRows: number; invalidRows: number };
export type ImportField = { key: string; header: string; required?: boolean; type: 'text' | 'number' | 'date' | 'time' | 'boolean'; hint?: string; example?: string; enabled?: boolean };

const asState = (cat: CampoCatalogo[], cfg: Record<string, unknown> | undefined) => initCampoState(cat, cfg ?? {});
const has = (state: Record<string, boolean>, key: string) => state[key] !== false;

export function fieldsForResource(resource: ImportResource, cfg?: { concretagem_campos?: Record<string, unknown>; recebimento_campos?: Record<string, unknown>; ensaio_campos?: Record<string, unknown> }): ImportField[] {
  const cc = asState(CAMPOS_CONCRETAGEM, cfg?.concretagem_campos);
  const rc = asState(CAMPOS_RECEBIMENTO, cfg?.recebimento_campos);
  const ec = asState(CAMPOS_ENSAIO, cfg?.ensaio_campos);
  if (resource === 'tracos') return [
    { key: 'codigo', header: 'codigo', type: 'text', required: true, example: 'TR-25-BRITA1' },
    { key: 'nome', header: 'nome', type: 'text', required: true, example: 'FCK 25 MPa - Brita 1' },
    { key: 'fck_mpa', header: 'fck_mpa', type: 'number', required: true, example: '25' },
    { key: 'slump_previsto_mm', header: 'slump_previsto_mm', type: 'number', example: '100' },
    { key: 'slump_tolerancia_mm', header: 'slump_tolerancia_mm', type: 'number', example: '20' },
    { key: 'idade_controle_dias', header: 'idade_controle_dias', type: 'number', example: '28' },
    { key: 'condicao_preparo', header: 'condicao_preparo', type: 'text', example: 'A' },
    { key: 'cimento_tipo', header: 'cimento_tipo', type: 'text', example: 'CP II-E-32' },
    { key: 'consumo_cimento_kg_m3', header: 'consumo_cimento_kg_m3', type: 'number', example: '320' },
    { key: 'fator_ac', header: 'fator_ac', type: 'number', example: '0,55' },
    { key: 'brita', header: 'brita', type: 'text', example: 'Brita 1' },
    { key: 'metodo_cura', header: 'metodo_cura', type: 'text', example: 'Câmara úmida' },
    { key: 'ativo', header: 'ativo', type: 'boolean', example: 'sim' },
  ];
  if (resource === 'concretagens') return ([
    { key: 'external_key', header: 'external_key', type: 'text', required: true, example: 'PLAN-2026-0001' },
    { key: 'cliente_nome', header: 'cliente_nome', type: 'text', required: true, example: 'Construtora Exemplo' },
    { key: 'obra_nome', header: 'obra_nome', type: 'text', required: true, example: 'Obra Centro' },
    { key: 'data_programada', header: 'data_programada', type: 'date', required: true, example: '2026-07-01' },
    { key: 'hora_programada', header: 'hora_programada', type: 'time', enabled: has(cc, 'data_hora'), example: '08:00' },
    { key: 'traco_codigo', header: 'traco_codigo', type: 'text', example: 'TR-25-BRITA1' },
    { key: 'traco_texto', header: 'traco_texto', type: 'text', example: '25 MPa' },
    { key: 'fck_previsto', header: 'fck_previsto', type: 'number', required: true, example: '25' },
    { key: 'fornecedor_texto', header: 'fornecedor_texto', type: 'text', enabled: has(cc, 'fornecedor'), example: 'Concreteira Alfa' },
    { key: 'local_texto', header: 'local_texto', type: 'text', enabled: has(cc, 'local_peca'), example: 'Bloco A - Laje 3' },
    { key: 'volume_programado_m3', header: 'volume_programado_m3', type: 'number', enabled: has(cc, 'volume_programado'), example: '24' },
    { key: 'dimensao_cp', header: 'dimensao_cp', type: 'text', enabled: has(cc, 'dimensao_cp'), example: '100x200' },
    { key: 'clima', header: 'clima', type: 'text', enabled: has(cc, 'clima'), example: 'Nublado' },
    { key: 'temperatura_ambiente_c', header: 'temperatura_ambiente_c', type: 'number', enabled: has(cc, 'temperatura_ambiente'), example: '27' },
    { key: 'bombeado', header: 'bombeado', type: 'boolean', enabled: has(cc, 'bombeado'), example: 'sim' },
    { key: 'observacoes', header: 'observacoes', type: 'text', enabled: has(cc, 'observacoes') },
  ] as ImportField[]).filter((f) => f.enabled !== false);
  if (resource === 'recebimentos') return ([
    { key: 'concretagem_codigo', header: 'concretagem_codigo', type: 'text', required: true, example: 'CONC-2026-000001' },
    { key: 'external_key', header: 'external_key', type: 'text', required: true, example: 'NF-12345-S1' },
    { key: 'nota_fiscal', header: 'nota_fiscal', type: 'text', required: true, example: '12345' },
    { key: 'serie', header: 'serie', type: 'text', example: '1' },
    { key: 'placa', header: 'placa', type: 'text', enabled: has(rc, 'placa'), example: 'ABC1D23' },
    { key: 'motorista', header: 'motorista', type: 'text', enabled: has(rc, 'motorista') },
    { key: 'volume_m3', header: 'volume_m3', type: 'number', enabled: has(rc, 'volume_m3'), example: '8' },
    { key: 'hora_saida_usina', header: 'hora_saida_usina', type: 'time', enabled: has(rc, 'horarios_transporte'), example: '07:30' },
    { key: 'hora_chegada_obra', header: 'hora_chegada_obra', type: 'time', enabled: has(rc, 'horarios_transporte'), example: '08:10' },
    { key: 'hora_inicio_descarga', header: 'hora_inicio_descarga', type: 'time', enabled: has(rc, 'horarios_descarga'), example: '08:20' },
    { key: 'hora_fim_descarga', header: 'hora_fim_descarga', type: 'time', enabled: has(rc, 'horarios_descarga'), example: '08:55' },
    { key: 'hora_moldagem', header: 'hora_moldagem', type: 'time', enabled: has(rc, 'hora_moldagem'), example: '08:35' },
    { key: 'slump_medido_mm', header: 'slump_medido_mm', type: 'number', enabled: has(rc, 'slump'), example: '110' },
    { key: 'temperatura_concreto_c', header: 'temperatura_concreto_c', type: 'number', enabled: has(rc, 'temperatura_concreto'), example: '28' },
    { key: 'houve_adicao_agua', header: 'houve_adicao_agua', type: 'boolean', enabled: has(rc, 'agua_adicionada'), example: 'não' },
    { key: 'agua_litros', header: 'agua_litros', type: 'number', enabled: has(rc, 'agua_adicionada'), example: '0' },
    { key: 'rejeitado', header: 'rejeitado', type: 'boolean', enabled: has(rc, 'rejeicao'), example: 'não' },
    { key: 'motivo_rejeicao', header: 'motivo_rejeicao', type: 'text', enabled: has(rc, 'rejeicao') },
    { key: 'elementos_concretados', header: 'elementos_concretados', type: 'text', enabled: has(rc, 'elementos_concretados') },
    { key: 'observacoes', header: 'observacoes', type: 'text', enabled: has(rc, 'observacoes_caminhao') },
  ] as ImportField[]).filter((f) => f.enabled !== false);
  return ([
    { key: 'cp_codigo', header: 'cp_codigo', type: 'text', required: true, example: 'CONC-2026-000001-28-1' },
    { key: 'concretagem_codigo', header: 'concretagem_codigo', type: 'text', example: 'CONC-2026-000001' },
    { key: 'data_rompimento', header: 'data_rompimento', type: 'date', required: true, example: '2026-07-29' },
    { key: 'idade_dias', header: 'idade_dias', type: 'number', required: true, example: '28' },
    { key: 'carga_ruptura_kn', header: 'carga_ruptura_kn', type: 'number', example: '545' },
    { key: 'resultado_mpa', header: 'resultado_mpa', type: 'number', example: '34,7' },
    { key: 'cp_diametro_mm', header: 'cp_diametro_mm', type: 'number', example: '100' },
    { key: 'cp_altura_mm', header: 'cp_altura_mm', type: 'number', example: '200' },
    { key: 'tipo_ruptura', header: 'tipo_ruptura', type: 'text', enabled: has(ec, 'tipo_ruptura'), example: 'A' },
    { key: 'capeamento', header: 'capeamento', type: 'text', enabled: has(ec, 'capeamento'), example: 'retificado' },
    { key: 'equipamento_numero_serie', header: 'equipamento_numero_serie', type: 'text', enabled: has(ec, 'prensa') },
    { key: 'operador_nome', header: 'operador_nome', type: 'text', enabled: has(ec, 'operador') },
    { key: 'observacao', header: 'observacao', type: 'text' },
  ] as ImportField[]).filter((f) => f.enabled !== false);
}

export const resourceLabel = (r: ImportResource) => ({ tracos: 'Traços', concretagens: 'Concretagens', recebimentos: 'Recebimentos', resultados: 'Resultados de rompimento' })[r];
