import type { PendChave } from './api/pendencias';

// Metadados de navegacao das pendencias (T13): compartilhados entre a PendenciasPage
// (cards com deep-link) e o badge do menu no Layout. Contagens vem da RPC pendencias_resumo.
export type PendItem = { chave: PendChave; titulo: string; descricao: string; rota: string; roles: string[] };
export type PendSecao = { area: string; itens: PendItem[] };

export const PEND_LAB_ROLES = ['admin', 'admin_consulte', 'gestor_qualidade', 'laboratorista', 'operador_campo'];
export const PEND_QUALIDADE_ROLES = ['admin', 'admin_consulte', 'gestor_qualidade'];

export const PEND_SECOES: PendSecao[] = [
  { area: 'Opera\u00e7\u00e3o', itens: [
    { chave: 'cp_hoje', titulo: 'CPs a romper hoje', descricao: 'Corpos de prova com rompimento previsto para hoje.', rota: '/rompimentos?janela=hoje', roles: PEND_LAB_ROLES },
    { chave: 'cp_atrasado', titulo: 'CPs atrasados', descricao: 'Pendentes com data prevista j\u00e1 vencida.', rota: '/rompimentos?janela=atrasados', roles: PEND_LAB_ROLES },
    { chave: 'cp_pendente', titulo: 'CPs pendentes (total)', descricao: 'Todos os CPs aguardando rompimento.', rota: '/rompimentos?janela=pendentes', roles: PEND_LAB_ROLES },
    { chave: 'prog_sem_caminhao', titulo: 'Programa\u00e7\u00f5es sem caminh\u00e3o', descricao: 'Concretagens programadas sem nenhum caminh\u00e3o/NF lan\u00e7ado.', rota: '/concretagens?filtro=sem_caminhao', roles: PEND_LAB_ROLES },
    { chave: 'importacao_pendente', titulo: 'Importa\u00e7\u00f5es pendentes', descricao: 'Lotes de importa\u00e7\u00e3o extra\u00eddos aguardando confirma\u00e7\u00e3o.', rota: '/importacoes', roles: PEND_LAB_ROLES },
  ] },
  { area: 'Qualidade', itens: [
    { chave: 'insatisfatorio', titulo: 'Resultados insatisfat\u00f3rios', descricao: 'Exemplares abaixo do fck na idade de controle.', rota: '/rompimentos?janela=insatisfatorios', roles: PEND_QUALIDADE_ROLES },
    { chave: 'laudo_aprovar', titulo: 'Laudos a aprovar/emitir', descricao: 'Laudos em rascunho aguardando aprova\u00e7\u00e3o.', rota: '/laudos?status=pendente', roles: PEND_QUALIDADE_ROLES },
    { chave: 'nc_aberta', titulo: 'N\u00e3o conformidades abertas', descricao: 'NCs com status aberto, aguardando tratativa.', rota: '/nao-conformidades?status=aberta', roles: PEND_QUALIDADE_ROLES },
    { chave: 'conc_sem_laudo', titulo: 'Concretagens sem laudo', descricao: 'Ensaios conclu\u00eddos (sem CP pendente) e ainda sem laudo emitido.', rota: '/laudos', roles: PEND_QUALIDADE_ROLES },
  ] },
  { area: 'Conformidade', itens: [
    { chave: 'cal_vencida', titulo: 'Calibra\u00e7\u00f5es vencidas', descricao: 'Equipamentos ativos com calibra\u00e7\u00e3o vencida.', rota: '/cadastros?tab=equipamentos&cal=vencida', roles: PEND_LAB_ROLES },
    { chave: 'cal_vencendo', titulo: 'Calibra\u00e7\u00f5es a vencer (30d)', descricao: 'Equipamentos ativos com calibra\u00e7\u00e3o vencendo em at\u00e9 30 dias.', rota: '/cadastros?tab=equipamentos&cal=vence30', roles: PEND_LAB_ROLES },
    { chave: 'cert_vencida', titulo: 'Certifica\u00e7\u00f5es vencidas', descricao: 'Colaboradores ativos com certifica\u00e7\u00e3o vencida.', rota: '/cadastros?tab=colaboradores&cert=vencida', roles: PEND_QUALIDADE_ROLES },
    { chave: 'cert_vencendo', titulo: 'Certifica\u00e7\u00f5es a vencer (30d)', descricao: 'Colaboradores ativos com certifica\u00e7\u00e3o vencendo em at\u00e9 30 dias.', rota: '/cadastros?tab=colaboradores&cert=vence30', roles: PEND_QUALIDADE_ROLES },
  ] },
];
