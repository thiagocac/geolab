// Vocabulário único de status do fluxo (record_status + status de domínio do RAC/CP/concretagem),
// conforme o Design System. Renderizar com <StatusBadge status={...} /> — nunca cor sozinha
// (dot + bg + texto). Toda label/tom de status vive AQUI; nada de status fora deste mapa + StatusBadge.
export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const META: Record<string, { label: string; tone: StatusTone }> = {
  // genéricos / record_status
  rascunho: { label: 'Rascunho', tone: 'neutral' },
  draft: { label: 'Rascunho', tone: 'neutral' },
  registrado: { label: 'Registrado', tone: 'info' },
  pendente: { label: 'Pendente', tone: 'warning' },
  triagem: { label: 'Em triagem', tone: 'warning' },
  aprovado: { label: 'Aprovado', tone: 'success' },
  reprovado: { label: 'Reprovado', tone: 'danger' },
  concluida: { label: 'Concluída', tone: 'success' },
  concluido: { label: 'Concluído', tone: 'success' },
  aberta: { label: 'Aberta', tone: 'brand' },
  encerrada: { label: 'Encerrada', tone: 'neutral' },
  cancelada: { label: 'Cancelada', tone: 'neutral' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
  bloqueado: { label: 'Bloqueado', tone: 'danger' },
  ativa: { label: 'Ativa', tone: 'success' },
  inativa: { label: 'Inativa', tone: 'neutral' },
  ativo: { label: 'Ativo', tone: 'success' },
  inativo: { label: 'Inativo', tone: 'neutral' },

  // programação / concretagem
  programada: { label: 'Programada', tone: 'info' },
  planejado: { label: 'Planejado', tone: 'info' },
  scheduled: { label: 'Agendado', tone: 'info' },
  retroativa: { label: 'Retroativa', tone: 'neutral' },
  concreting: { label: 'Em concretagem', tone: 'warning' },

  // RAC (workflow corretivo de 8 estados)
  aberto: { label: 'Aberto', tone: 'brand' },
  analise_causa: { label: 'Análise de causa', tone: 'info' },
  plano_definido: { label: 'Plano definido', tone: 'info' },
  em_execucao: { label: 'Em execução', tone: 'warning' },
  aguardando_validacao: { label: 'Aguardando validação', tone: 'warning' },
  eficaz: { label: 'Eficaz', tone: 'success' },
  ineficaz: { label: 'Ineficaz', tone: 'danger' },
  encerrado: { label: 'Encerrado', tone: 'success' },

  // corpos de prova / ensaio
  descartado: { label: 'Descartado', tone: 'neutral' },
  ausente: { label: 'Ausente', tone: 'neutral' },
  falhou: { label: 'Falha', tone: 'danger' },
  endurecido: { label: 'Endurecido', tone: 'info' },
  fresco: { label: 'Fresco', tone: 'info' },

  // lote (aceitação estatística NBR 12655)
  aceito: { label: 'Aceito', tone: 'success' },
  rejeitado: { label: 'Rejeitado', tone: 'danger' },
  em_analise: { label: 'Em análise', tone: 'warning' },

  // laudo / financeiro
  emitido: { label: 'Emitido', tone: 'success' },
  emitida: { label: 'Emitida', tone: 'warning' },
  paga: { label: 'Paga', tone: 'success' },

  // medição
  fechada: { label: 'Fechada', tone: 'success' },
  faturada: { label: 'Faturada', tone: 'info' },
};

export function recordStatusMeta(status?: string | null): { label: string; tone: StatusTone } {
  const key = (status ?? '').toLowerCase();
  return META[key] ?? { label: status ? String(status) : '—', tone: 'neutral' };
}
