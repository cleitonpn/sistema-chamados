import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  arrayUnion  // NOVO: Para atualizar arrays no Firestore
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AREAS } from './userService';
import { emailService } from './emailService';

// Status dos chamados
export const TICKET_STATUS = {
  OPEN: 'aberto',                                    // Chamado criado
  IN_ANALYSIS: 'em_analise',                         // Produtor analisando
  SENT_TO_AREA: 'enviado_para_area',                // Enviado para área específica
  IN_EXECUTION: 'em_execucao',                       // Produtor executando no pavilhão
  IN_TREATMENT: 'em_tratativa',                      // Operador dando tratativa
  AWAITING_APPROVAL: 'aguardando_aprovacao',         // Escalado para gerência
  APPROVED: 'aprovado',                              // Aprovado pela gerência
  REJECTED: 'rejeitado',                             // Rejeitado pela gerência
  EXECUTED_AWAITING_VALIDATION: 'executado_aguardando_validacao', // Área executou, aguarda validação
  ESCALATED_TO_OTHER_AREA: 'escalado_para_outra_area', // Escalado para outra área
  COMPLETED: 'concluido',                            // Chamado finalizado
  CANCELLED: 'cancelado'                             // Chamado cancelado
};

// Funções/Perfis de usuário
export const USER_ROLES = {
  CONSULTOR: 'consultor',
  PRODUTOR: 'produtor', 
  GERENTE: 'gerente',
  OPERADOR: 'operador',
  ADMINISTRADOR: 'administrador'
};

// Tipos de chamado
export const TICKET_TYPES = {
  FREIGHT: 'frete',
  FURNITURE_CHANGE: 'troca_mobiliario',
  WAREHOUSE_MATERIAL: 'material_almoxarifado',
  VISUAL_COMMUNICATION: 'comunicacao_visual',
  RENTAL: 'locacao',
  PURCHASE: 'compra',
  MAINTENANCE: 'manutencao',
  MAINTENANCE_PRODUCTION: 'manutencao_producao',
  MAINTENANCE_FURNITURE: 'manutencao_mobiliario',
  MAINTENANCE_VISUAL: 'manutencao_comunicacao_visual',
  PAYMENT_FREIGHT: 'pagamento_frete', // ✅ NOVO: Tipo para pagamento de frete
  OTHER: 'outro'
};

// Prioridades
export const PRIORITIES = {
  LOW: 'baixa',
  MEDIUM: 'media',
  HIGH: 'alta',
  URGENT: 'urgente'
};

export const ticketService = {
  // ✅ MODIFICADO: Criar chamado com suporte a vinculação (mantendo lógica original)
  async createTicket(ticketData) {
    try {
      // Importar AREAS para usar constante correta
      const { AREAS } = await import('./userService');
      
      // ✅ MANTIDO: Roteamento baseado em quem criou o chamado (LÓGICA ORIGINAL)
      const finalTicketData = {
        ...ticketData,
        status: TICKET_STATUS.OPEN,
        createdAt: new Date(),
        updatedAt: new Date(),
        slaOperacao: null,
        slaValidacao: null,
        executadoEm: null,
        validadoEm: null,
        // NOVO: Inicializar histórico de status
        historicoStatus: [{
          statusAnterior: null,
          novoStatus: TICKET_STATUS.OPEN,
          data: new Date(),
          responsavel: ticketData.criadoPor,
          comentario: 'Chamado criado'
        }],
        // ✅ NOVO: Campos para vinculação (SEM ALTERAR LÓGICA ORIGINAL)
        chamadoVinculado: ticketData.chamadoVinculado || null,
        isVinculado: !!ticketData.chamadoVinculado,
        tipoVinculacao: ticketData.chamadoVinculado ? 'pagamento_frete' : null,
        // ✅ MANTIDO: Roteamento inteligente baseado no criador (LÓGICA ORIGINAL)
        areaOriginal: ticketData.area, // Salva área original para escalação posterior
        area: (() => {
          // Se foi criado por consultor, sempre vai para produção primeiro (triagem)
          if (ticketData.criadoPorFuncao === 'consultor') {
            return AREAS.PRODUCTION;
          }
          // Se foi criado por produtor ou operador operacional, vai direto para a área especificada
          else if (ticketData.criadoPorFuncao === 'produtor' || ticketData.criadoPorFuncao === 'operador') {
            return ticketData.area;
          }
          // Fallback para área especificada
          return ticketData.area;
        })(),
        // ✅ MANTIDO: Definir responsável atual baseado no criador (LÓGICA ORIGINAL)
        responsavelAtual: (() => {
          if (ticketData.criadoPorFuncao === 'consultor') {
            return 'produtor'; // Consultor -> Produtor (triagem)
          } else if (ticketData.criadoPorFuncao === 'produtor') {
            return 'operador'; // Produtor -> Operador da área
          } else if (ticketData.criadoPorFuncao === 'operador') {
            return 'operador'; // Operador -> Operador da área (pode ser ele mesmo ou outro)
          }
          return 'operador'; // Fallback
        })()
      };
      
      const docRef = await addDoc(collection(db, 'chamados'), finalTicketData);
      
      const ticketId = docRef.id;
      
      // ✅ NOVO: Se é um chamado vinculado, atualizar o chamado original
      if (ticketData.chamadoVinculado) {
        try {
          await this.linkTickets(ticketData.chamadoVinculado.id, ticketId);
          console.log('✅ Vinculação entre chamados criada com sucesso');
        } catch (linkError) {
          console.error('❌ Erro ao criar vinculação:', linkError);
          // Não falhar a criação do chamado por causa da vinculação
        }
      }
      
      // ✅ MANTIDO: Enviar notificações (LÓGICA ORIGINAL)
      try {
        // Importar serviços dinamicamente para evitar dependência circular
        const { userService } = await import('./userService');
        const { projectService } = await import('./projectService');
        const { unifiedNotificationService } = await import('./unifiedNotificationService');
        
        // Buscar nome do projeto
        let projectName = 'Projeto não identificado';
        if (ticketData.projetoId) {
          const project = await projectService.getProjectById(ticketData.projetoId);
          if (project) {
            projectName = project.nome;
          }
        }
        
        // Enviar notificações via sistema unificado (SendGrid)
        const ticketWithId = { ...ticketData, id: ticketId };
        
        // ✅ NOVO: Notificação específica para chamados vinculados
        if (ticketData.chamadoVinculado) {
          await unifiedNotificationService.notifyLinkedTicketCreated(ticketWithId, ticketData.chamadoVinculado);
        } else {
          await unifiedNotificationService.notifyTicketCreated(ticketWithId);
        }
        
        console.log('✅ Notificações de criação SendGrid enviadas com sucesso');
        
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificações (não crítico):', notificationError);
        // Não falhar a criação do chamado por causa das notificações
      }
      
      return ticketId;
    } catch (error) {
      console.error('Erro ao criar chamado:', error);
      throw error;
    }
  },

  // ✅ NOVO: Função para vincular dois chamados
  async linkTickets(originalTicketId, newTicketId) {
    try {
      // Atualizar chamado original com referência ao novo
      const originalTicketRef = doc(db, 'chamados', originalTicketId);
      await updateDoc(originalTicketRef, {
        chamadosVinculados: arrayUnion(newTicketId),
        temChamadosVinculados: true,
        updatedAt: new Date()
      });

      // Atualizar novo chamado com referência ao original
      const newTicketRef = doc(db, 'chamados', newTicketId);
      await updateDoc(newTicketRef, {
        chamadoOriginal: originalTicketId,
        isVinculado: true,
        updatedAt: new Date()
      });

      console.log('✅ Vinculação criada entre chamados:', originalTicketId, '<->', newTicketId);
    } catch (error) {
      console.error('❌ Erro ao vincular chamados:', error);
      throw error;
    }
  },

  // ✅ NOVO: Buscar chamados vinculados
  async getLinkedTickets(ticketId) {
    try {
      const ticket = await this.getTicketById(ticketId);
      if (!ticket) return [];

      const linkedTickets = [];

      // Se tem chamados vinculados (é o original)
      if (ticket.chamadosVinculados && ticket.chamadosVinculados.length > 0) {
        for (const linkedId of ticket.chamadosVinculados) {
          const linkedTicket = await this.getTicketById(linkedId);
          if (linkedTicket) {
            linkedTickets.push({
              ...linkedTicket,
              tipoRelacao: 'vinculado'
            });
          }
        }
      }

      // Se é um chamado vinculado (buscar o original)
      if (ticket.chamadoOriginal) {
        const originalTicket = await this.getTicketById(ticket.chamadoOriginal);
        if (originalTicket) {
          linkedTickets.push({
            ...originalTicket,
            tipoRelacao: 'original'
          });
        }
      }

      return linkedTickets;
    } catch (error) {
      console.error('Erro ao buscar chamados vinculados:', error);
      return [];
    }
  },

  // ✅ NOVO: Verificar se um chamado pode ser vinculado
  canLinkTicket(ticket, userProfile) {
    // Apenas operadores de logística podem vincular chamados ao executar
    return (
      userProfile.area === 'logistica' &&
      userProfile.funcao === 'operador' &&
      ticket.status === TICKET_STATUS.IN_TREATMENT
    );
  },

  // ✅ MANTIDO: Buscar chamado por ID (LÓGICA ORIGINAL)
  async getTicketById(ticketId) {
    try {
      const docRef = doc(db, 'chamados', ticketId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Erro ao buscar chamado:', error);
      throw error;
    }
  },

  // ✅ MANTIDO: Listar todos os chamados (LÓGICA ORIGINAL)
  async getAllTickets() {
    try {
      const querySnapshot = await getDocs(
        collection(db, 'chamados')
      );
      
      const tickets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar por data de criação (mais recente primeiro)
      return tickets.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Erro ao listar chamados:', error);
      throw error;
    }
  },

  // ✅ MANTIDO: Buscar chamados por projeto (LÓGICA ORIGINAL)
  async getTicketsByProject(projectId) {
    try {
      if (!projectId || typeof projectId !== 'string') {
        console.warn('getTicketsByProject: projectId inválido:', projectId);
        return [];
      }

      const q = query(
        collection(db, 'chamados'), 
        where('projetoId', '==', projectId)
      );
      const querySnapshot = await getDocs(q);
      
      const tickets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar por data de criação (mais recente primeiro)
      return tickets.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Erro ao buscar chamados por projeto:', error);
      throw error;
    }
  },

  // ✅ MANTIDO: Buscar chamados por múltiplos projetos (LÓGICA ORIGINAL)
  async getTicketsByProjects(projectIds) {
    try {
      if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
        console.warn('getTicketsByProjects: projectIds inválido:', projectIds);
        return [];
      }

      // Filtrar IDs válidos
      const validProjectIds = projectIds.filter(id => id && typeof id === 'string');
      if (validProjectIds.length === 0) {
        console.warn('getTicketsByProjects: nenhum projectId válido encontrado');
        return [];
      }

      // Firestore tem limite de 10 itens no array 'in', então vamos fazer consultas em lotes
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < validProjectIds.length; i += batchSize) {
        const batch = validProjectIds.slice(i, i + batchSize);
        batches.push(batch);
      }

      const allTickets = [];
      
      for (const batch of batches) {
        const q = query(
          collection(db, 'chamados'),
          where('projetoId', 'in', batch)
        );
        
        const querySnapshot = await getDocs(q);
        const batchTickets = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        allTickets.push(...batchTickets);
      }

      // Ordenar todos os chamados por data de criação (mais recente primeiro)
      return allTickets.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Erro ao buscar chamados por projetos:', error);
      throw error;
    }
  },

  // ✅ MANTIDO: Buscar chamados por área (LÓGICA ORIGINAL PRESERVADA)
  async getTicketsByArea(area) {
    try {
      if (!area || typeof area !== 'string') {
        console.warn('getTicketsByArea: area inválida:', area);
        return [];
      }

      // ✅ MANTIDO: Buscar chamados da área E chamados escalados para gerência da área (LÓGICA ORIGINAL)
      const queries = [
        // Chamados normais da área
        query(collection(db, 'chamados'), where('area', '==', area)),
        // Chamados escalados para gerência (se for gerente)
        query(collection(db, 'chamados'), where('areaGerencia', '==', `gerente_${area}`))
      ];

      const [normalTickets, managementTickets] = await Promise.all(
        queries.map(q => getDocs(q))
      );
      
      const allTickets = [
        ...normalTickets.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...managementTickets.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      ];

      // Remover duplicatas (caso um chamado apareça em ambas as consultas)
      const uniqueTickets = allTickets.filter((ticket, index, self) => 
        index === self.findIndex(t => t.id === ticket.id)
      );

      // Ordenar por data de criação (mais recente primeiro)
      return uniqueTickets.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Erro ao buscar chamados por área:', error);
      throw error;
    }
  },

  // ✅ MANTIDO: Buscar chamados por status (LÓGICA ORIGINAL)
  async getTicketsByStatus(status) {
    try {
      if (!status || typeof status !== 'string') {
        console.warn('getTicketsByStatus: status inválido:', status);
        return [];
      }

      const q = query(
        collection(db, 'chamados'), 
        where('status', '==', status)
      );
      const querySnapshot = await getDocs(q);
      
      const tickets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar por data de criação (mais recente primeiro)
      return tickets.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Erro ao buscar chamados por status:', error);
      throw error;
    }
  },

  // ✅ MANTIDO: Buscar chamados por usuário (LÓGICA ORIGINAL)
  async getTicketsByUser(userId) {
    try {
      if (!userId || typeof userId !== 'string') {
        console.warn('getTicketsByUser: userId inválido:', userId);
        return [];
      }

      const q = query(
        collection(db, 'chamados'), 
        where('criadoPor', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      
      const tickets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar por data de criação (mais recente primeiro)
      return tickets.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Erro ao buscar chamados por usuário:', error);
      throw error;
    }
  },

  // ✅ MANTIDO: Atualizar status do chamado (LÓGICA ORIGINAL)
  async updateTicketStatus(ticketId, newStatus, userId, comment, ticket) {
    try {
      if (!ticketId || !newStatus || !userId) {
        throw new Error('Parâmetros obrigatórios não fornecidos');
      }

      // Obter status anterior
      const oldStatus = ticket?.status || 'desconhecido';

      const docRef = doc(db, 'chamados', ticketId);
      const updateData = {
        status: newStatus,
        updatedAt: new Date(),
        updatedBy: userId
      };

      // NOVO: Adicionar entrada ao histórico de status
      const historicoEntry = {
        statusAnterior: oldStatus,
        novoStatus: newStatus,
        data: new Date(),
        responsavel: userId,
        comentario: comment || null
      };

      // Se já existe histórico, adicionar nova entrada; senão, criar array
      if (ticket?.historicoStatus) {
        updateData.historicoStatus = [...ticket.historicoStatus, historicoEntry];
      } else {
        updateData.historicoStatus = [historicoEntry];
      }

      // Adicionar timestamps específicos baseados no status
      if (newStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
        updateData.executadoEm = new Date();
        if (ticket && ticket.createdAt) {
          // Certifique-se de que ticket.createdAt é um objeto Timestamp antes de usar toDate()
          const createdAtDate = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt);
          updateData.slaOperacao = this.calculateSLA(createdAtDate, new Date());
        }
      } else if (newStatus === TICKET_STATUS.COMPLETED) {
        updateData.validadoEm = new Date();
        if (ticket && ticket.executadoEm) {
          const executadoEmDate = ticket.executadoEm?.toDate ? ticket.executadoEm.toDate() : new Date(ticket.executadoEm);
          updateData.slaValidacao = this.calculateSLA(executadoEmDate, new Date());
        }
      }

      await updateDoc(docRef, updateData);

      // Adicionar mensagem ao chat do chamado sobre a atualização de status
      if (comment) {
        // Importar messageService dinamicamente para evitar dependência circular
        const { messageService } = await import('./messageService');
        await messageService.sendMessage(ticketId, {
          texto: `Status atualizado para: ${newStatus.replace(/_/g, ' ').toUpperCase()}. Comentário: ${comment}`,
          autorId: userId,
          autorNome: 'Sistema'
        });
      }

      // Enviar notificações (não bloquear se falhar)
      try {
        // Importar serviços dinamicamente para evitar dependência circular
        const { userService } = await import('./userService');
        const { projectService } = await import('./projectService');
        const { unifiedNotificationService } = await import('./unifiedNotificationService');
        
        // Buscar nome do projeto
        let projectName = 'Projeto não identificado';
        if (ticket?.projetoId) {
          const project = await projectService.getProjectById(ticket.projetoId);
          if (project) {
            projectName = project.nome;
          }
        }
        
        // Enviar notificações via sistema unificado (SendGrid)
        const ticketWithId = { ...ticket, id: ticketId, status: newStatus };
        
        // Determinar tipo de evento baseado no status
        if (newStatus === 'concluido') {
          await unifiedNotificationService.notifyTicketCompleted(ticketWithId);
        } else {
          await unifiedNotificationService.notifyTicketUpdated(ticketWithId);
        }
        
        console.log('✅ Notificações de atualização SendGrid enviadas com sucesso');
        
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificações (não crítico):', notificationError);
        // Não falhar a atualização por causa das notificações
      }

      return true;
    } catch (error) {
      console.error('Erro ao atualizar status do chamado:', error);
      throw error;
    }
  },

  // ✅ MANTIDO: Atualizar chamado (LÓGICA ORIGINAL)
  async updateTicket(ticketId, updateData) {
    try {
      const docRef = doc(db, 'chamados', ticketId);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      console.error('Erro ao atualizar chamado:', error);
      throw error;
    }
  },

  // ✅ MANTIDO: Deletar chamado (LÓGICA ORIGINAL)
  async deleteTicket(ticketId) {
    try {
      const docRef = doc(db, 'chamados', ticketId);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error('Erro ao deletar chamado:', error);
      throw error;
    }
  },

  // ✅ MANTIDO: Calcular SLA (LÓGICA ORIGINAL)
  calculateSLA(startDate, endDate) {
    const diffInMs = endDate - startDate;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    return Math.round(diffInHours * 100) / 100; // Arredondar para 2 casas decimais
  },

  // ✅ MANTIDO: Escutar mudanças em tempo real (LÓGICA ORIGINAL)
  subscribeToTicket(ticketId, callback) {
    const docRef = doc(db, 'chamados', ticketId);
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() });
      } else {
        callback(null);
      }
    });
  },

  // ✅ MANTIDO: Escutar mudanças em chamados por área (LÓGICA ORIGINAL)
  subscribeToTicketsByArea(area, callback) {
    const q = query(
      collection(db, 'chamados'),
      where('area', '==', area),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const tickets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(tickets);
    });
  }
};

