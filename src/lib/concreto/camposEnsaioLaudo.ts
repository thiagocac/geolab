// Catálogos de campos configuráveis do GEOLAB.
// Persistência: config_lab.ensaio_campos, laudo_campos, recebimento_campos e concretagem_campos.
export type CampoCatalogo = { key: string; label: string; hint?: string; on: boolean; indent?: boolean; required?: boolean };

export const CAMPOS_ENSAIO: CampoCatalogo[] = [
  { key: 'tipo_ruptura', label: 'Tipo de ruptura (A-F, NBR 5739)', hint: 'Coluna por CP na tela de rompimento.', on: false },
  { key: 'prensa', label: 'Prensa utilizada (rastreabilidade)', hint: 'Seletor por leva; vincula o equipamento calibrado (A1).', on: false },
  { key: 'capeamento', label: 'Capeamento / bases', hint: 'Retífica, enxofre ou neoprene; aplicado à leva.', on: false },
  { key: 'massa_cp_g', label: 'Massa do CP (g)', hint: 'Para densidade; coluna por CP. Em geral desligado.', on: false },
];

export const CAMPOS_RECEBIMENTO: CampoCatalogo[] = [
  { key: 'placa', label: 'Placa do caminhão / betoneira', hint: 'Rastreabilidade do recebimento em campo.', on: true },
  { key: 'motorista', label: 'Motorista', hint: 'Opcional; útil em fichas de laboratório e ocorrências.', on: false },
  { key: 'volume_m3', label: 'Volume da nota / caminhão (m³)', hint: 'Valor informativo para ficha e laudo.', on: true },
  { key: 'horarios_transporte', label: 'Horários de transporte', hint: 'Saída da usina e chegada à obra.', on: true },
  { key: 'horarios_descarga', label: 'Horários de descarga', hint: 'Início e fim da descarga.', on: true },
  { key: 'hora_moldagem', label: 'Horário da moldagem', hint: 'Hora real da coleta dos CPs.', on: true },
  { key: 'slump', label: 'Abatimento / slump medido (cm)', hint: 'Campo central do recebimento NBR 7212.', on: true },
  { key: 'temperatura_concreto', label: 'Temperatura do concreto (°C)', on: false },
  { key: 'agua_adicionada', label: 'Água adicionada na obra', hint: 'Registra sim/não e litros adicionados.', on: false },
  { key: 'rejeicao', label: 'Caminhão rejeitado + motivo', hint: 'Registro simples de rejeição/ressalva.', on: false },
  { key: 'elementos_concretados', label: 'Elementos concretados por caminhão', hint: 'Texto livre quando a obra não usa estrutura cadastrada.', on: true },
  { key: 'observacoes_caminhao', label: 'Observações por caminhão', on: false },
];

export const CAMPOS_CONCRETAGEM: CampoCatalogo[] = [
  { key: 'fornecedor', label: 'Fornecedor / concreteira / central', hint: 'Na v1 é da concretagem, não de cada caminhão.', on: true },
  { key: 'data_hora', label: 'Data e hora programada/real', hint: 'Base da agenda do laboratório e da ficha.', on: true },
  { key: 'local_peca', label: 'Local / peça concretada', hint: 'Texto livre ou peça da estrutura da obra.', on: true },
  { key: 'volume_programado', label: 'Volume programado / lançado (m³)', on: true },
  { key: 'moldador', label: 'Moldador responsável', hint: 'Colaborador do laboratório que atende a obra.', on: true },
  { key: 'clima', label: 'Clima / condição no momento da moldagem', on: false },
  { key: 'temperatura_ambiente', label: 'Temperatura ambiente (°C)', on: false },
  { key: 'dimensao_cp', label: 'Dimensão dos corpos de prova', hint: 'Ex.: 100×200 mm ou 150×300 mm.', on: true },
  { key: 'bombeado', label: 'Tipo de lançamento / bombeado', on: false },
  { key: 'observacoes', label: 'Observações gerais da concretagem', on: true },
  { key: 'padrao_moldagem', label: 'Padrão de moldagem da concretagem', hint: 'Usado como padrão manual quando não há traço cadastrado.', on: true },
];

export const CAMPOS_LAUDO: CampoCatalogo[] = [
  { key: 'dim_hd', label: 'Dimensões d×h e relação h/d', on: true },
  { key: 'tipo_ruptura', label: 'Coluna “Tipo de ruptura”', on: true },
  { key: 'dados_concreto', label: 'Bloco “Dados do concreto”', hint: 'Cimento, consumo, brita, a/c, cura.', on: true },
  { key: 'cimento', label: '— Tipo e consumo de cimento', on: true, indent: true },
  { key: 'aditivo', label: '— Aditivo', on: false, indent: true },
  { key: 'dmax', label: '— Dimensão máxima do agregado', on: false, indent: true },
  { key: 'cura', label: '— Método de cura', on: true, indent: true },
  { key: 'elemento', label: 'Elemento / peça concretada (por NF)', hint: 'Onde cada caminhão foi aplicado.', on: true },
  { key: 'usina', label: 'Usina / central do concreto', on: true },
  { key: 'amostragem', label: 'Detalhe de amostragem (total · condição)', on: true },
  { key: 'aceitacao', label: 'Barra de aceitação (NBR 12655)', hint: 'fck,est × fck na idade de controle.', on: true },
  { key: 'carga', label: 'Coluna “Carga de ruptura (kN)”', on: false },
  { key: 'contato', label: 'Contato do solicitante (nome/e-mail)', on: false },
  { key: 'temperatura', label: 'Temperatura do concreto (por NF)', on: false },
  { key: 'ficha_moldagem', label: 'Ficha de moldagem (nº)', on: false },
  { key: 'observacoes', label: 'Observações da concretagem', on: false },
  { key: 'incerteza', label: 'Incerteza de medição (equipamento)', on: false },
  { key: 'local_ensaio', label: 'Local de realização dos ensaios', on: false },
  { key: 'moldador', label: 'Responsável pela moldagem', on: false },
  { key: 'componentes', label: 'Composição do traço (areia/água/britas)', hint: 'Sub-bloco com marca e procedência dos componentes.', on: false },
  { key: 'recebimento', label: 'Bloco “Recebimento dos caminhões”', hint: 'Mostra os campos habilitados em Campos do recebimento.', on: true },
  { key: 'equipamentos', label: 'Bloco “Equipamentos utilizados”', hint: 'Prensa + certificado de calibração.', on: true },
  { key: 'acreditacao', label: 'Acreditação CGCRE/ABNT no cabeçalho', on: false },
  { key: 'responsavel_tecnico', label: 'Responsável técnico + CREA + ART', on: true },
  { key: 'qr_validacao', label: 'QR / validação pública', on: true },
  { key: 'logo_laboratorio', label: 'Logo do laboratório no cabeçalho', on: true },
];

export function initCampoState(cat: CampoCatalogo[], cfg: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  const source = cfg ?? {};
  for (const f of cat) next[f.key] = source[f.key] === undefined ? f.on : source[f.key] !== false;
  return next;
}

export function campoOn(cfg: Record<string, unknown> | null | undefined, key: string, fallback = false): boolean {
  if (!cfg || cfg[key] === undefined) return fallback;
  return cfg[key] !== false;
}
