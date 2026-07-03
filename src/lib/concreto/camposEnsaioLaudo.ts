// Catálogos de campos configuráveis do GEOLAB.
// Persistência: config_lab.ensaio_campos, laudo_campos, recebimento_campos e concretagem_campos.
// Os defaults `on` espelham os defaults dos CONSUMIDORES (tela de rompimento e EF de laudo/ficha),
// para que a tela de configuração reflita exatamente o que o sistema faz quando a chave não foi salva.
export type CampoCatalogo = { key: string; label: string; hint?: string; on: boolean; indent?: boolean; required?: boolean };

export const CAMPOS_ENSAIO: CampoCatalogo[] = [
  { key: 'tipo_ruptura', label: 'Tipo de ruptura (A-F, NBR 5739)', hint: 'Coluna por CP na tela de rompimento.', on: false },
  { key: 'prensa', label: 'Prensa utilizada (rastreabilidade)', hint: 'Seletor por leva; vincula o equipamento calibrado e alimenta o gate de calibração.', on: false },
  { key: 'capeamento', label: 'Capeamento / bases', hint: 'Retífica, enxofre ou neoprene; aplicado à leva.', on: false },
  { key: 'massa_cp_g', label: 'Massa do CP (g)', hint: 'Para densidade; coluna por CP. Em geral desligado.', on: false },
  { key: 'operador', label: 'Operador (quem rompeu)', hint: 'Quem realizou o rompimento; gravado por CP e alimenta o gate de certificacao. Desligado por padrao.', on: false },
  { key: 'numeracao_lab', label: 'Numeracao do laboratorio (por CP)', hint: 'Botao "+ numeracao lab" em cada CP na tela de rompimento, para registrar a numeracao interna do laboratorio. Ligado por padrao.', on: true },
];

export const CAMPOS_RECEBIMENTO: CampoCatalogo[] = [
  { key: 'placa', label: 'Placa do caminhão / betoneira', hint: 'Rastreabilidade do recebimento em campo.', on: true },
  { key: 'motorista', label: 'Motorista', hint: 'Opcional; útil em fichas de laboratório e ocorrências.', on: true },
  { key: 'volume_m3', label: 'Volume da nota / caminhão (m³)', hint: 'Valor informativo para ficha e laudo.', on: true },
  { key: 'horarios_transporte', label: 'Horários de transporte', hint: 'Saída da usina e chegada à obra.', on: true },
  { key: 'horarios_descarga', label: 'Horários de descarga', hint: 'Início e fim da descarga.', on: true },
  { key: 'hora_moldagem', label: 'Horário da moldagem', hint: 'Hora real da coleta dos CPs.', on: true },
  { key: 'slump', label: 'Abatimento / slump medido (cm)', hint: 'Campo central do recebimento NBR 7212.', on: true },
  { key: 'temperatura_concreto', label: 'Temperatura do concreto (°C)', hint: 'Medida no recebimento (tela e ficha). A exibição no laudo é controlada na aba Laudo (“Temperatura do concreto”).', on: true },
  { key: 'agua_adicionada', label: 'Água adicionada na obra', hint: 'Registra sim/não e litros adicionados.', on: true },
  { key: 'rejeicao', label: 'Caminhão rejeitado + motivo', hint: 'Registro simples de rejeição/ressalva.', on: true },
  { key: 'elementos_concretados', label: 'Elementos concretados por caminhão', hint: 'Texto livre quando a obra não usa estrutura cadastrada.', on: true },
  { key: 'observacoes_caminhao', label: 'Observações por caminhão', hint: 'Texto livre por caminhão/NF.', on: true },
  { key: 'numeracao_cp_manual', label: 'Numeração de CP manual (laboratório)', hint: 'Liga a numeração interna dos CPs na moldagem. Na tela de Caminhões + CPs aparece um campo por CP e o botão "Gerar numeração": digite o número do 1º CP (o de menor idade de controle) e o sistema preenche a sequência. Desligado por padrão.', on: false },
];

export const CAMPOS_CONCRETAGEM: CampoCatalogo[] = [
  { key: 'fornecedor', label: 'Fornecedor / concreteira / central', hint: 'Na v1 é da concretagem, não de cada caminhão.', on: true },
  { key: 'data_hora', label: 'Data e hora programada/real', hint: 'Base da agenda do laboratório e da ficha.', on: true },
  { key: 'local_peca', label: 'Local / peça concretada', hint: 'Texto livre ou peça da estrutura da obra.', on: true },
  { key: 'volume_programado', label: 'Volume programado / lançado (m³)', on: true },
  { key: 'moldador', label: 'Moldador responsável', hint: 'Colaborador do laboratório que atende a obra.', on: true },
  { key: 'clima', label: 'Clima / condição no momento da moldagem', hint: 'Sai no bloco de dados do laudo.', on: true },
  { key: 'temperatura_ambiente', label: 'Temperatura ambiente (°C)', hint: 'Sai no bloco de dados do laudo.', on: true },
  { key: 'dimensao_cp', label: 'Dimensão dos corpos de prova', hint: 'Ex.: 100×200 mm ou 150×300 mm.', on: true },
  { key: 'bombeado', label: 'Tipo de lançamento / bombeado', hint: 'Bombeado x convencional.', on: true },
  { key: 'observacoes', label: 'Observações gerais da concretagem', on: true },
  { key: 'padrao_moldagem', label: 'Padrão de moldagem da concretagem', hint: 'Usado como padrão manual quando não há traço cadastrado.', on: true },
  { key: 'ficha_contato_equipe', label: 'Ficha: contato, equipe e ref. no cabeçalho', hint: 'Mostra os campos Contato, Equipe e Ref. no cabeçalho da ficha de moldagem (em branco, para preenchimento manual). Aplica-se só à ficha. Desligado por padrão.', on: false },
  { key: 'ficha_dosagem', label: 'Ficha: dados da dosagem detalhada (puxa do traço)', hint: 'Adiciona à ficha a linha de composição do traço (cimento, consumo, D.máx, a/c, areia, pedra, água, aditivo), pré-preenchida a partir do traço cadastrado. Aplica-se só à ficha. Desligado por padrão.', on: false },
];

export const CAMPOS_LAUDO: CampoCatalogo[] = [
  { key: 'dim_hd', label: 'Dimensões d×h e relação h/d', hint: 'Colunas d×h e h/d na tabela de resultados.', on: true },
  { key: 'tipo_ruptura', label: 'Coluna “Tipo de ruptura”', hint: 'Coluna A-F por CP (lançada no rompimento).', on: true },
  { key: 'dados_concreto', label: 'Bloco “Dados do concreto”', hint: 'Cimento, consumo, brita, a/c, cura, dimensão do CP, clima.', on: true },
  { key: 'cimento', label: '— Tipo e consumo de cimento', on: true, indent: true },
  { key: 'aditivo', label: '— Aditivo', on: false, indent: true },
  { key: 'dmax', label: '— Dimensão máxima do agregado', on: false, indent: true },
  { key: 'cura', label: '— Método de cura', on: true, indent: true },
  { key: 'elemento', label: 'Elemento / peça concretada (por NF)', hint: 'Onde cada caminhão foi aplicado.', on: true },
  { key: 'usina', label: 'Usina / central do concreto', hint: 'Fornecedor/central no bloco de dados.', on: true },
  { key: 'amostragem', label: 'Detalhe de amostragem (total · condição)', hint: 'Amostragem total e condição (A/B).', on: true },
  { key: 'aceitacao', label: 'Bloco de aceitação (fck,est × fck + veredito)', hint: 'Faixa final com a aceitação NBR 12655 e o status Conforme / Não conforme. Desligue para omitir o veredito no corpo do laudo.', on: true },
  { key: 'carga', label: 'Coluna “Carga de ruptura (kN)”', hint: 'Coluna de carga (kN) por CP.', on: false },
  { key: 'contato', label: 'Contato do solicitante (nome/e-mail)', hint: 'E-mail do cliente no cabeçalho.', on: false },
  { key: 'temperatura', label: 'Temperatura do concreto (por NF)', hint: 'Sai na linha de cada caminhão no laudo; usa o valor registrado no recebimento.', on: false },
  { key: 'ficha_moldagem', label: 'Ficha de moldagem (nº)', hint: 'Número/external_key da ficha por exemplar.', on: false },
  { key: 'observacoes', label: 'Observações da concretagem', hint: 'Observações gerais lançadas na concretagem.', on: false },
  { key: 'incerteza', label: 'Incerteza de medição (equipamento)', hint: 'Declarada no certificado de calibração da prensa.', on: false },
  { key: 'local_ensaio', label: 'Local de realização dos ensaios', hint: 'Configurado em Preferências.', on: false },
  { key: 'moldador', label: 'Responsável pela moldagem', hint: 'Colaborador que moldou os CPs.', on: false },
  { key: 'componentes', label: 'Composição do traço (areia/água/britas)', hint: 'Sub-bloco com marca e procedência dos componentes.', on: false },
  { key: 'recebimento', label: 'Bloco “Recebimento dos caminhões”', hint: 'Mostra os campos habilitados na aba Recebimento.', on: true },
  { key: 'equipamentos', label: 'Bloco “Equipamentos utilizados”', hint: 'Prensa + certificado de calibração.', on: true },
  { key: 'acreditacao', label: 'Acreditação (CGCRE/INMETRO) no cabeçalho', hint: 'Usa o nº de acreditação configurado em Preferências.', on: false },
  { key: 'responsavel_tecnico', label: 'Responsável técnico + CREA + ART', hint: 'Identificação configurada em Preferências.', on: true },
  { key: 'qr_validacao', label: 'QR / validação pública', hint: 'QR e link público de validação do laudo.', on: true },
  { key: 'logo_laboratorio', label: 'Logo do laboratório no cabeçalho', hint: 'Logo enviado em Preferências.', on: true },
  { key: 'certificacoes', label: 'Bloco “Certificações do laboratório”', hint: 'Lista cadastrada em Preferências (tipo, número, validade) — sai no corpo do laudo.', on: false },
  { key: 'norma_5739', label: 'Norma NBR 5739:2018 — compressão de CP', hint: 'Referência citada no laudo.', on: true },
  { key: 'norma_5738', label: 'Norma NBR 5738:2015 — moldagem e cura', hint: 'Referência citada no laudo.', on: true },
  { key: 'norma_16889', label: 'Norma NBR 16889:2020 — abatimento (slump)', hint: 'Referência citada no laudo.', on: true },
  { key: 'norma_16886', label: 'Norma NBR 16886:2020 — amostragem do concreto fresco', hint: 'Referência citada no laudo.', on: true },
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
