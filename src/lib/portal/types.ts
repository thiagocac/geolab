// Tipos compartilhados entre o portal autenticado (/portal-cliente, via RPC)
// e o portal publico por magic link (/portal/acesso/:token, via EF lab-client-portal).
export type ParcialFinal = 'final' | 'parcial' | 'sem_resultados';

export type PortalLaudoView = {
  id: string;
  numero: string;
  status: string;
  revisao: number;
  escopo: string | null;
  data_emissao: string | null;
  work_id: string | null;
  work_nome: string | null;
  concretagem_id: string | null;
  tem_pdf: boolean;
  parcial_final: ParcialFinal;
};

export type PortalResultadoRow = {
  work_id: string | null;
  work_nome: string | null;
  client_id: string | null;
  concretagem_id: string | null;
  concretagem_codigo: string | null;
  data_concretagem: string | null;
  local_texto: string | null;
  fornecedor_texto: string | null;
  fck_previsto: number | null;
  amostra_id: string | null;
  amostra_codigo: string | null;
  receipt_id: string | null;
  nota_fiscal: string | null;
  serie: string | null;
  elementos_concretados: string | null;
  cp_id: string;
  cp_codigo: string | null;
  numeracao_lab: string | null;
  idade_dias: number | null;
  idade_unidade: string | null;
  data_moldagem: string | null;
  data_prevista_rompimento: string | null;
  data_real_rompimento: string | null;
  situacao: string | null;
  material_test_type_id: string | null;
  idade_controle: number | null;
  resultado_valor: number | null;
  carga_ruptura_kn: number | null;
  cp_diametro_mm: number | null;
  cp_altura_mm: number | null;
  tipo_ruptura: string | null;
  data_rompimento: string | null;
  is_controle: boolean;
  fck_ref: number | null;
  conforme: boolean | null;
};

export type LaudoFiltro = { workId: string; texto: string; tipo: 'todos' | 'parcial' | 'final'; status: string; de: string; ate: string };
export type ResultadoFiltro = {
  workId: string;
  texto: string;
  idade: 'todas' | 'controle' | 'acompanhamento';
  conformidade: 'todas' | 'conforme' | 'nao_conforme';
  somenteComResultado: boolean;
  de: string;
  ate: string;
};

export type ExemplarResumo = {
  concretagem_codigo: string | null;
  work_nome: string | null;
  data: string | null;
  exemplar: string | null;
  nf: string | null;
  idade_controle: number | null;
  resistencia: number | null;
  fck: number | null;
  conforme: boolean | null;
  n_cps: number;
};

// --- Correcao de laudo (portal) ---
export type PortalCorrecaoTipo = 'local_peca' | 'elementos_caminhao' | 'resultado' | 'outro';
export type PortalCorrecaoConfig = { correcao_habilitada: boolean; correcao_auto_edicao_peca: boolean; correcao_resultado: boolean };
export type PortalCorrecaoInput = {
  work_id: string; tipo: PortalCorrecaoTipo; lab_report_id?: string | null; concretagem_id?: string | null;
  receipt_id?: string | null; corpo_prova_id?: string | null; valor_proposto?: string | null; comentario?: string | null;
};
export type PortalCorrecao = {
  id: string; tipo: PortalCorrecaoTipo | string; status: string; campo_alvo: string | null;
  valor_atual: string | null; valor_proposto: string | null; comentario_cliente: string | null;
  decisao_comentario: string | null; created_at: string | null; decided_at: string | null;
  nova_revisao: number | null; work_id: string | null; work_nome?: string | null;
  lab_report_numero?: string | null; lab_report_id?: string | null; concretagem_id?: string | null; concretagem_codigo?: string | null;
};
