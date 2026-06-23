// Catálogos de campos configuráveis do ensaio de rompimento e do laudo v4.
// Persistência: config_lab.ensaio_campos e config_lab.laudo_campos.
export type CampoCatalogo = { key: string; label: string; hint?: string; on: boolean; indent?: boolean };

export const CAMPOS_ENSAIO: CampoCatalogo[] = [
  { key: 'tipo_ruptura', label: 'Tipo de ruptura (A-F, NBR 5739)', hint: 'Coluna por CP na tela de rompimento.', on: false },
  { key: 'prensa', label: 'Prensa utilizada (rastreabilidade)', hint: 'Seletor por leva; vincula o equipamento calibrado (A1).', on: false },
  { key: 'capeamento', label: 'Capeamento / bases', hint: 'Retífica, enxofre ou neoprene; aplicado à leva.', on: false },
  { key: 'massa_cp_g', label: 'Massa do CP (g)', hint: 'Para densidade; coluna por CP. Em geral desligado.', on: false },
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
  { key: 'carga', label: 'Coluna “Carga de ruptura (kN)”', on: false },
  { key: 'contato', label: 'Contato do solicitante (nome/e-mail)', on: false },
  { key: 'temperatura', label: 'Temperatura do concreto (por NF)', on: false },
  { key: 'ficha_moldagem', label: 'Ficha de moldagem (nº)', on: false },
  { key: 'observacoes', label: 'Observações da concretagem', on: false },
  { key: 'incerteza', label: 'Incerteza de medição (equipamento)', on: false },
  { key: 'local_ensaio', label: 'Local de realização dos ensaios', on: false },
  { key: 'moldador', label: 'Responsável pela moldagem', on: false },
  { key: 'componentes', label: 'Composição do traço (areia/água/britas)', hint: 'Sub-bloco com marca e procedência dos componentes.', on: false },
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
