// Constantes de status dos chamados
export const TICKET_STATUS = {
  OPEN: 'aberto',
  IN_TREATMENT: 'em_tratativa',
  EXECUTED_AWAITING_VALIDATION: 'executado_aguardando_validacao',
  EXECUTED_AWAITING_VALIDATION_OPERATOR: 'executado_aguardando_validacao_operador',
  COMPLETED: 'concluido',
  SENT_TO_AREA: 'enviado_para_area',
  AWAITING_CONSULTANT: 'aguardando_consultor',
  AWAITING_MANAGEMENT_APPROVAL: 'aguardando_aprovacao_gerencial',
  CANCELLED: 'cancelado',
  ARCHIVED: 'arquivado'
};

// Labels dos status em português
export const TICKET_STATUS_LABELS = {
  [TICKET_STATUS.OPEN]: 'Aberto',
  [TICKET_STATUS.IN_TREATMENT]: 'Em Tratativa',
  [TICKET_STATUS.EXECUTED_AWAITING_VALIDATION]: 'Executado - Aguardando Validação',
  [TICKET_STATUS.EXECUTED_AWAITING_VALIDATION_OPERATOR]: 'Executado - Aguardando Validação do Operador',
  [TICKET_STATUS.COMPLETED]: 'Concluído',
  [TICKET_STATUS.SENT_TO_AREA]: 'Enviado para Área',
  [TICKET_STATUS.AWAITING_CONSULTANT]: 'Aguardando Consultor',
  [TICKET_STATUS.AWAITING_MANAGEMENT_APPROVAL]: 'Aguardando Aprovação Gerencial',
  [TICKET_STATUS.CANCELLED]: 'Cancelado',
  [TICKET_STATUS.ARCHIVED]: 'Arquivado'
};

// Cores dos status para badges
export const TICKET_STATUS_COLORS = {
  [TICKET_STATUS.OPEN]: 'bg-blue-100 text-blue-800',
  [TICKET_STATUS.IN_TREATMENT]: 'bg-yellow-100 text-yellow-800',
  [TICKET_STATUS.EXECUTED_AWAITING_VALIDATION]: 'bg-purple-100 text-purple-800',
  [TICKET_STATUS.EXECUTED_AWAITING_VALIDATION_OPERATOR]: 'bg-purple-100 text-purple-800',
  [TICKET_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
  [TICKET_STATUS.SENT_TO_AREA]: 'bg-orange-100 text-orange-800',
  [TICKET_STATUS.AWAITING_CONSULTANT]: 'bg-cyan-100 text-cyan-800',
  [TICKET_STATUS.AWAITING_MANAGEMENT_APPROVAL]: 'bg-indigo-100 text-indigo-800',
  [TICKET_STATUS.CANCELLED]: 'bg-red-100 text-red-800',
  [TICKET_STATUS.ARCHIVED]: 'bg-gray-100 text-gray-800'
};

// Função para obter o label de um status
export const getStatusLabel = (status) => {
  return TICKET_STATUS_LABELS[status] || status;
};

// Função para obter a cor de um status
export const getStatusColor = (status) => {
  return TICKET_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
};

// Status que indicam que o chamado está ativo
export const ACTIVE_STATUSES = [
  TICKET_STATUS.OPEN,
  TICKET_STATUS.IN_TREATMENT,
  TICKET_STATUS.EXECUTED_AWAITING_VALIDATION,
  TICKET_STATUS.EXECUTED_AWAITING_VALIDATION_OPERATOR,
  TICKET_STATUS.SENT_TO_AREA,
  TICKET_STATUS.AWAITING_CONSULTANT,
  TICKET_STATUS.AWAITING_MANAGEMENT_APPROVAL
];

// Status que indicam que o chamado está finalizado
export const FINISHED_STATUSES = [
  TICKET_STATUS.COMPLETED,
  TICKET_STATUS.CANCELLED,
  TICKET_STATUS.ARCHIVED
];

// Função para verificar se um status é ativo
export const isActiveStatus = (status) => {
  return ACTIVE_STATUSES.includes(status);
};

// Função para verificar se um status é finalizado
export const isFinishedStatus = (status) => {
  return FINISHED_STATUSES.includes(status);
};

export default TICKET_STATUS;

