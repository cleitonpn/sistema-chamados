import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext'; // CORRIGIDO
import { ticketService, TICKET_STATUS } from '@/services/ticketService'; // CORRIGIDO
import { projectService } from '@/services/projectService'; // CORRIGIDO
import { userService, AREAS } from '@/services/userService'; // CORRIGIDO
import { messageService } from '@/services/messageService'; // CORRIGIDO
import notificationService from '@/services/notificationService'; // CORRIGIDO
import ImageUpload from '@/components/ImageUpload'; // CORRIGIDO
import Header from '@/components/Header'; // CORRIGIDO
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Clock,
  User,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Camera,
  Calendar,
  MapPin,
  Loader2,
  ExternalLink,
  Upload,
  X,
  Image as ImageIcon,
  Settings,
  AtSign,
  Lock // ✅ ADIÇÃO: Importando o ícone de cadeado
} from 'lucide-react';

const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  // Estados principais
  const [ticket, setTicket] = useState(null);
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  // ✅ ADIÇÃO: Novo estado para controlar o acesso negado
  const [accessDenied, setAccessDenied] = useState(false);


  // Estados do chat
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatImages, setChatImages] = useState([]);

  // Estados de atualização de status
  const [newStatus, setNewStatus] = useState('');
  const [conclusionImages, setConclusionImages] = useState([]);
  const [conclusionDescription, setConclusionDescription] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [showAreaSelector, setShowAreaSelector] = useState(false);

  // Estados para escalação separada
  const [escalationArea, setEscalationArea] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);

  // Estados para escalação para gerência
  const [managementArea, setManagementArea] = useState('');
  const [managementReason, setManagementReason] = useState('');
  const [isEscalatingToManagement, setIsEscalatingToManagement] = useState(false);

  // Estados para escalação para consultor
  const [consultorReason, setConsultorReason] = useState('');
  const [isEscalatingToConsultor, setIsEscalatingToConsultor] = useState(false);

  // Estados para menções de usuários
  const [users, setUsers] = useState([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);

  // Função para carregar dados do chamado (sem alterações)
  const loadTicketData = async () => {
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false); // Reseta o estado de acesso negado

      console.log('Carregando dados do chamado:', ticketId);

      const ticketData = await ticketService.getTicketById(ticketId);
      if (!ticketData) {
        throw new Error('Chamado não encontrado');
      }

      setTicket(ticketData);
      console.log('Dados do chamado carregados:', ticketData);

      if (ticketData.projetoId) {
        try {
          const projectData = await projectService.getProjectById(ticketData.projetoId);
          setProject(projectData);
        } catch (err) {
          console.warn('Erro ao carregar projeto:', err);
        }
      }

      try {
        const messagesData = await messageService.getMessagesByTicket(ticketId);
        setMessages(messagesData || []);
      } catch (err) {
        console.warn('Erro ao carregar mensagens:', err);
        setMessages([]);
      }

    } catch (err) {
      console.error('Erro ao carregar dados do chamado:', err);
      setError(err.message || 'Erro ao carregar chamado');
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados na inicialização (sem alterações)
  useEffect(() => {
    if (ticketId && user) {
      loadTicketData();
      markNotificationsAsRead();
    }
  }, [ticketId, user]);

  // ✅ ADIÇÃO: Novo useEffect para verificar permissões após o carregamento do chamado
  useEffect(() => {
    if (ticket && userProfile && user) {
      // Se o chamado for confidencial, verifica as permissões
      if (ticket.isConfidential) {
        const isCreator = ticket.criadoPor === user.uid;
        const isAdmin = userProfile.funcao === 'administrador';
        // Permite acesso se o usuário for um operador da área de destino OU da área de origem
        const isInvolvedOperator = userProfile.funcao === 'operador' && 
                                   (userProfile.area === ticket.area || userProfile.area === ticket.areaDeOrigem);

        // Se o usuário não se encaixa em nenhuma das regras, nega o acesso
        if (!isCreator && !isAdmin && !isInvolvedOperator) {
          console.warn('ACESSO NEGADO: Usuário não autorizado a ver este chamado confidencial.');
          setAccessDenied(true);
        }
      }
    }
  }, [ticket, userProfile, user]);


  const markNotificationsAsRead = async () => {
    if (!user?.uid || !ticketId) return;

    try {
      await notificationService.markTicketNotificationsAsRead(user.uid, ticketId);
      console.log('✅ Notificações marcadas como lidas para o chamado:', ticketId);
    } catch (error) {
      console.error('❌ Erro ao marcar notificações como lidas:', error);
    }
  };

  // Carregar usuários para menções (sem alterações)
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await userService.getAllUsers();
        setUsers(allUsers);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };

    loadUsers();
  }, []);

  // Demais funções (detectMentions, insertMention, etc.) permanecem inalteradas...
  const detectMentions = (text, position) => {
    const beforeCursor = text.substring(0, position);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const filtered = users.filter(user =>
        user.nome.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      ).slice(0, 5);

      setMentionQuery(query);
      setMentionSuggestions(filtered);
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
      setMentionSuggestions([]);
      setMentionQuery('');
    }
  };

  const insertMention = (user) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = newMessage;
    const beforeCursor = text.substring(0, cursorPosition);
    const afterCursor = text.substring(cursorPosition);

    const mentionStart = beforeCursor.lastIndexOf('@');
    const beforeMention = text.substring(0, mentionStart);
    const mention = `@${user.nome} `;

    const newText = beforeMention + mention + afterCursor;
    setNewMessage(newText);

    setTimeout(() => {
      const newPosition = beforeMention.length + mention.length;
      textarea.setSelectionRange(newPosition, newPosition);
      textarea.focus();
    }, 0);

    setShowMentionSuggestions(false);
  };

  const extractMentions = (text) => {
    const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionedName = match[1];
      const mentionedUser = users.find(user =>
        user.nome.toLowerCase() === mentionedName.toLowerCase()
      );

      if (mentionedUser) {
        mentions.push(mentionedUser);
      }
    }

    return mentions;
  };

  const processTextWithMentions = (text) => {
    const mentionRegex = /@(\w+(?:\s+\w+)*)/g;

    return text.replace(mentionRegex, (match, name) => {
      const mentionedUser = users.find(user =>
        user.nome.toLowerCase() === name.toLowerCase()
      );

      if (mentionedUser) {
        return `<span class="mention bg-blue-100 text-blue-800 px-1 rounded">@${name}</span>`;
      }

      return match;
    });
  };

  useEffect(() => {
    if (newStatus === TICKET_STATUS.ESCALATED_TO_OTHER_AREA || newStatus === 'escalado_para_outra_area') {
      setShowAreaSelector(true);
    } else {
      setShowAreaSelector(false);
      setSelectedArea('');
    }
  }, [newStatus]);

  const getAvailableStatuses = () => {
    if (!ticket || !userProfile) return [];
    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;
    if (userRole === 'administrador') {
      const allOptions = [];
      if (currentStatus === TICKET_STATUS.OPEN || currentStatus === TICKET_STATUS.IN_ANALYSIS) {
        allOptions.push(
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Enviar para Área', description: 'Enviar para operador da área específica' },
          { value: TICKET_STATUS.IN_EXECUTION, label: 'Em Execução', description: 'Resolver no pavilhão' },
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Finalizar chamado diretamente' }
        );
      }
      if (currentStatus === TICKET_STATUS.OPEN || currentStatus === TICKET_STATUS.SENT_TO_AREA || currentStatus === TICKET_STATUS.APPROVED || currentStatus === TICKET_STATUS.IN_TREATMENT || currentStatus === TICKET_STATUS.ESCALATED_TO_OTHER_AREA) {
        allOptions.push(
          { value: TICKET_STATUS.IN_TREATMENT, label: 'Tratativa', description: 'Dar andamento ao chamado' },
          { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado para validação' },
          { value: TICKET_STATUS.AWAITING_APPROVAL, label: 'Escalar para Gerência', description: 'Escalar para aprovação gerencial' }
        );
      }
      if (currentStatus === TICKET_STATUS.AWAITING_APPROVAL) {
        allOptions.push(
          { value: TICKET_STATUS.APPROVED, label: 'Aprovar', description: 'Aprovar e retornar para área' },
          { value: TICKET_STATUS.REJECTED, label: 'Reprovar', description: 'Reprovar e encerrar (motivo obrigatório)' }
        );
      }
      if (currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
        allOptions.push(
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Validar e finalizar chamado' },
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Rejeitar', description: 'Rejeitar e voltar para área (motivo obrigatório)' }
        );
      }
      const uniqueOptions = allOptions.filter((option, index, self) =>
        index === self.findIndex(o => o.value === option.value)
      );
      return uniqueOptions;
    }
    if (userRole === 'consultor') {
      if (currentStatus === 'escalado_para_consultor' && ticket.consultorId === user.uid) {
        return [
          { value: 'devolver_para_area', label: 'Devolver para Área', description: 'Retornar para área de origem após tratativa' },
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Finalizar chamado diretamente' }
        ];
      }
      if (currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION &&
          ticket.criadoPorFuncao === 'consultor' &&
          ticket.criadoPor === user.uid) {
        return [
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Validar e finalizar chamado' }
        ];
      }
      return [];
    }
    if (userRole === 'produtor') {
      const isProjectProducer = project && (project.produtorId === user.uid || project.consultorId === user.uid);
      const isCurrentResponsible = ticket.responsavelAtual === 'produtor' ||
                                   ticket.responsavelAtual === 'consultor_produtor' ||
                                   ticket.responsavelId === user.uid;
      if (!isCurrentResponsible) {
        return [];
      }
      if (currentStatus === TICKET_STATUS.OPEN && ticket.criadoPorFuncao === 'consultor') {
        return [
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Enviar para Área', description: 'Enviar para operador da área responsável' },
          { value: TICKET_STATUS.IN_EXECUTION, label: 'Em Execução', description: 'Resolver no pavilhão' },
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Finalizar chamado diretamente' }
        ];
      }
      if (currentStatus === TICKET_STATUS.OPEN && ticket.criadoPorFuncao === 'produtor') {
        return [
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Enviar para Área', description: 'Enviar para operador da área responsável' },
          { value: TICKET_STATUS.IN_EXECUTION, label: 'Em Execução', description: 'Resolver no pavilhão' },
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Finalizar chamado diretamente' }
        ];
      }
      if (currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
        const options = [
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Rejeitar', description: 'Devolver para área com motivo' }
        ];
        if (ticket.criadoPorFuncao === 'consultor') {
          options.push({ value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Validar e finalizar chamado' });
        } else {
          options.push({ value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Validar e finalizar chamado' });
        }
        return options;
      }
      if (currentStatus === 'executado_aguardando_validacao_operador' && ticket.criadoPor === user.uid) {
        return [
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Rejeitar', description: 'Devolver para área com motivo' },
          { value: TICKET_STATUS.COMPLETED, label: 'Validar e Concluir', description: 'Validar e finalizar chamado' }
        ];
      }
      if (currentStatus === TICKET_STATUS.IN_EXECUTION && ticket.executandoNoPavilhao) {
        return [
          { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado para validação' }
        ];
      }
      if (currentStatus === 'enviado_para_area' && ticket.area === 'producao' && ticket.transferidoParaProdutor) {
        return [
          { value: TICKET_STATUS.IN_TREATMENT, label: 'Tratativa', description: 'Dar andamento ao chamado' },
          { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado para validação' },
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Finalizar chamado diretamente' }
        ];
      }
    }
    if (userRole === 'operador') {
      if (
        (ticket.status === 'executado_aguardando_validacao_operador' ||
         ticket.status === 'executado_aguardando_validacao') &&
        user.uid === ticket.criadoPor
      ) {
        return [
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Validar e finalizar chamado' },
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Rejeitar', description: 'Rejeitar e voltar para área (motivo obrigatório)' }
        ];
      }
      const isCurrentArea = ticket.area === userProfile.area;
      const isOriginArea = ticket.areaDeOrigem === userProfile.area;
      if (!isCurrentArea && !isOriginArea && ticket.criadoPor !== user.uid) {
        return [];
      }
      if (isOriginArea && !isCurrentArea) {
        return [];
      }
      if (isCurrentArea) {
        if (currentStatus === TICKET_STATUS.OPEN ||
            currentStatus === TICKET_STATUS.SENT_TO_AREA ||
            currentStatus === TICKET_STATUS.APPROVED ||
            currentStatus === TICKET_STATUS.ESCALATED_TO_OTHER_AREA) {
          return [
            { value: TICKET_STATUS.IN_TREATMENT, label: 'Tratativa', description: 'Dar andamento ao chamado' },
            { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado para validação' }
          ];
        }
        if (currentStatus === TICKET_STATUS.IN_TREATMENT) {
          return [
            { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado para validação' }
          ];
        }
        if (ticket.criadoPor === user.uid &&
            (currentStatus === 'executado_aguardando_validacao_operador' ||
             (currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION &&
              ticket.criadoPorFuncao && ticket.criadoPorFuncao.startsWith('operador_')))) {
          return [
            { value: TICKET_STATUS.SENT_TO_AREA, label: 'Rejeitar', description: 'Devolver para área com motivo' },
            { value: TICKET_STATUS.COMPLETED, label: 'Validar e Concluir', description: 'Validar e finalizar chamado' }
          ];
        }
        if (ticket.criadoPor === user.uid && currentStatus === TICKET_STATUS.COMPLETED) {
          return [
            { value: TICKET_STATUS.COMPLETED, label: 'Finalizar', description: 'Confirmar finalização do chamado' }
          ];
        }
      }
    }
    if (userRole === 'gerente') {
      const isEscalatedToManager = currentStatus === TICKET_STATUS.AWAITING_APPROVAL &&
                                   ticket.areaGerencia &&
                                   isManagerForArea(userProfile.area, ticket.areaGerencia);
      if (isEscalatedToManager) {
        return [
          { value: TICKET_STATUS.APPROVED, label: 'Aprovar', description: 'Aprovar e retornar para área' },
          { value: TICKET_STATUS.REJECTED, label: 'Reprovar', description: 'Reprovar e encerrar chamado' }
        ];
      }
      return [];
    }
    if (userRole === 'consultor' && ticket.criadoPor === user.uid) {
      if (currentStatus === TICKET_STATUS.COMPLETED) {
        return [
          { value: TICKET_STATUS.COMPLETED, label: 'Finalizar', description: 'Confirmar finalização do chamado' }
        ];
      }
    }
    return [];
  };

  const handleEscalation = async () => {
    if (!escalationArea) {
      alert('Por favor, selecione uma área de destino');
      return;
    }
    if (!escalationReason.trim()) {
      alert('Por favor, descreva o motivo da escalação');
      return;
    }
    setIsEscalating(true);
    try {
      const updateData = {
        status: TICKET_STATUS.ESCALATED_TO_OTHER_AREA || 'escalado_para_outra_area',
        area: escalationArea || null,
        escalationReason: escalationReason || '',
        userRole: userProfile?.funcao || 'operador',
        areaDestino: escalationArea || null,
        motivoEscalonamento: escalationReason || '',
        atualizadoPor: user?.uid || null,
        updatedAt: new Date()
      };
      await ticketService.escalateTicketToArea(ticketId, escalationArea, updateData);
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `🔄 **Chamado escalado para ${escalationArea.replace('_', ' ').toUpperCase()}**\n\n**Motivo:** ${escalationReason}`,
        criadoEm: new Date(),
        type: 'escalation'
      };
      await messageService.sendMessage(ticketId, escalationMessage);
      await loadTicketData();
      setEscalationArea('');
      setEscalationReason('');
      alert('Chamado escalado com sucesso!');
    } catch (error) {
      console.error('Erro ao escalar chamado:', error);
      alert('Erro ao escalar chamado: ' + error.message);
    } finally {
      setIsEscalating(false);
    }
  };

  const handleManagementEscalation = async () => {
    if (!managementArea) {
      alert('Por favor, selecione uma gerência de destino');
      return;
    }
    if (!managementReason.trim()) {
      alert('Por favor, descreva o motivo da escalação para gerência');
      return;
    }
    setIsEscalatingToManagement(true);
    try {
      const sanitizeValue = (value, defaultValue = null) => {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'string' && value.trim() === '') return defaultValue;
        return value;
      };
      const rawUpdateData = {
        status: 'aguardando_aprovacao',
        areaGerencia: managementArea,
        escalationReason: managementReason?.trim(),
        escaladoParaGerencia: true,
        escaladoPor: user?.uid,
        escaladoEm: new Date().toISOString(),
        userRole: userProfile?.funcao
      };
      const updateData = {};
      updateData.status = sanitizeValue(rawUpdateData.status, 'aguardando_aprovacao');
      updateData.escaladoParaGerencia = sanitizeValue(rawUpdateData.escaladoParaGerencia, true);
      updateData.escaladoEm = sanitizeValue(rawUpdateData.escaladoEm, new Date().toISOString());
      const areaGerencia = sanitizeValue(rawUpdateData.areaGerencia);
      if (areaGerencia) updateData.areaGerencia = areaGerencia;
      const escalationReason = sanitizeValue(rawUpdateData.escalationReason);
      if (escalationReason) updateData.escalationReason = escalationReason;
      const escaladoPor = sanitizeValue(rawUpdateData.escaladoPor);
      if (escaladoPor) updateData.escaladoPor = escaladoPor;
      const userRole = sanitizeValue(rawUpdateData.userRole);
      if (userRole) updateData.userRole = userRole;
      const hasUndefined = Object.entries(updateData).some(([key, value]) => {
        const isUndefined = value === undefined;
        if (isUndefined) {
          console.error(`ERRO: Campo ${key} está undefined:`, value);
        }
        return isUndefined;
      });
      if (hasUndefined) {
        throw new Error('Dados contêm valores undefined após sanitização');
      }
      await ticketService.escalateTicketToArea(ticketId, 'gerencia', updateData);
      const gerenciaNames = {
        'gerente_operacional': 'Gerência Operacional',
        'gerente_comercial': 'Gerência Comercial',
        'gerente_producao': 'Gerência Produção',
        'gerente_financeiro': 'Gerência Financeira'
      };
      const gerenciaNome = gerenciaNames[managementArea] || managementArea;
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `👨‍💼 **Chamado escalado para ${gerenciaNome}**\n\n**Motivo:** ${managementReason}`,
        criadoEm: new Date(),
        type: 'management_escalation'
      };
      await messageService.sendMessage(ticketId, escalationMessage);
      await loadTicketData();
      setManagementArea('');
      setManagementReason('');
      alert('Chamado escalado para gerência com sucesso!');
    } catch (error) {
      console.error('Erro ao escalar para gerência:', error);
      alert('Erro ao escalar para gerência: ' + error.message);
    } finally {
      setIsEscalatingToManagement(false);
    }
  };

  const handleConsultorEscalation = async () => {
    if (!consultorReason.trim()) {
      alert('Por favor, descreva o motivo da escalação para consultor');
      return;
    }
    if (!project?.consultorId) {
      alert('Este projeto não possui um consultor definido');
      return;
    }
    setIsEscalatingToConsultor(true);
    try {
      const updateData = {
        status: 'escalado_para_consultor',
        responsavelAtual: 'consultor',
        areaDeOrigem: ticket.area,
        escalationReason: consultorReason,
        escaladoParaConsultor: true,
        escaladoPor: user.uid,
        escaladoEm: new Date().toISOString(),
        consultorId: project.consultorId,
        userRole: userProfile.funcao
      };
      const filteredUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );
      await ticketService.escalateTicketToArea(ticketId, 'consultor', filteredUpdateData);
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `👨‍💼 **Chamado escalado para CONSULTOR**\n\n**Motivo:** ${consultorReason}\n\n**Área de origem:** ${ticket.area?.replace('_', ' ').toUpperCase()}`,
        criadoEm: new Date(),
        type: 'consultor_escalation'
      };
      await messageService.sendMessage(ticketId, escalationMessage);
      await loadTicketData();
      setConsultorReason('');
      alert('Chamado escalado para consultor com sucesso!');
    } catch (error) {
      console.error('Erro ao escalar para consultor:', error);
      alert('Erro ao escalar para consultor: ' + error.message);
    } finally {
      setIsEscalatingToConsultor(false);
    }
  };

  const handleTransferToProducer = async () => {
    if (!project?.produtorId) {
      alert('Erro: Produtor do projeto não identificado');
      return;
    }
    try {
      setUpdating(true);
      const updateData = {
        responsavelAtual: 'produtor',
        responsavelId: project.produtorId,
        status: 'enviado_para_area',
        area: 'producao',
        transferidoParaProdutor: true,
        transferidoEm: new Date().toISOString(),
        transferidoPor: user.uid,
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      const transferMessage = {
        ticketId,
        remetenteId: user.uid,
        remetenteFuncao: userProfile.funcao,
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `🏭 **Chamado transferido para PRODUTOR**\n\n**Produtor responsável:** ${users.find(u => u.uid === project.produtorId)?.nome || 'Não identificado'}\n\n**Transferido por:** ${userProfile.nome || user.email} (${userProfile.funcao})`,
        criadoEm: new Date(),
        type: 'producer_transfer'
      };
      await messageService.sendMessage(ticketId, transferMessage);
      await loadTicketData();
      alert('Chamado transferido para produtor com sucesso!');
    } catch (error) {
      console.error('Erro ao transferir para produtor:', error);
      alert('Erro ao transferir para produtor: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus || updating) return;
    if ((newStatus === TICKET_STATUS.REJECTED || (newStatus === TICKET_STATUS.SENT_TO_AREA && ticket.status === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION)) && !conclusionDescription.trim()) {
      setError('Motivo da rejeição é obrigatório');
      return;
    }
    if (newStatus === TICKET_STATUS.ESCALATED_TO_OTHER_AREA && !selectedArea) {
      setError('Selecione a área de destino');
      return;
    }
    try {
      setUpdating(true);
      const updateData = {
        status: newStatus,
        atualizadoPor: user.uid,
        atualizadoPorFuncao: userProfile.funcao,
        userRole: userProfile.funcao,
        atualizadoEm: new Date().toISOString()
      };
      if (newStatus === TICKET_STATUS.COMPLETED) {
        updateData.conclusaoDescricao = conclusionDescription;
        updateData.conclusaoImagens = conclusionImages;
      }
      if (newStatus === TICKET_STATUS.REJECTED || (newStatus === TICKET_STATUS.SENT_TO_AREA && ticket.status === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION)) {
        updateData.motivoRejeicao = conclusionDescription;
        updateData.rejeitadoPor = user.uid;
        updateData.rejeitadoEm = new Date().toISOString();
      }
      if (newStatus === TICKET_STATUS.ESCALATED_TO_OTHER_AREA) {
        updateData.areaAnterior = ticket.area;
        updateData.escaladoPara = selectedArea;
        updateData.escaladoPor = user.uid;
        updateData.escaladoEm = new Date().toISOString();
        await ticketService.escalateTicketToArea(ticketId, selectedArea, updateData);
      } else {
        const comment = conclusionDescription || '';
        await ticketService.updateTicketStatus(ticketId, newStatus, user.uid, comment, ticket);
      }
      if (newStatus === TICKET_STATUS.AWAITING_APPROVAL) {
        updateData.escaladoParaGerencia = true;
        updateData.escaladoPor = user.uid;
        updateData.escaladoEm = new Date().toISOString();
        const gerenteUid = getManagerUidByArea(managementArea);
        updateData.gerenteResponsavelId = gerenteUid;
        updateData.areaGerencia = managementArea;
      }
      if (newStatus === 'devolver_para_area') {
        updateData.status = TICKET_STATUS.SENT_TO_AREA;
        updateData.area = ticket.areaDeOrigem;
        updateData.responsavelAtual = 'operador';
        updateData.escaladoParaConsultor = false;
        updateData.consultorId = null;
        updateData.areaDeOrigem = null;
        updateData.devolvidoPeloConsultor = true;
        updateData.devolvidoEm = new Date().toISOString();
        updateData.devolvidoPor = user.uid;
      }
      await ticketService.updateTicket(ticketId, updateData);
      try {
        await notificationService.notifyStatusChange(ticketId, ticket, {
          novoStatus: getStatusText(newStatus),
          statusAnterior: getStatusText(ticket.status),
        }, user.uid);
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de status:', notificationError);
      }
      if (newStatus === TICKET_STATUS.APPROVED || newStatus === TICKET_STATUS.REJECTED) {
        const isApproval = newStatus === TICKET_STATUS.APPROVED;
        const managerName = userProfile?.nome || user?.email || 'Gerente';
        const approvalMessage = {
          ticketId,
          remetenteId: user.uid,
          remetenteFuncao: userProfile.funcao,
          remetenteNome: managerName,
          conteudo: isApproval 
            ? `✅ **Chamado aprovado pelo gerente ${managerName}**\n\nO chamado foi aprovado e retornará para a área responsável para execução.`
            : `❌ **Chamado reprovado pelo gerente ${managerName}**\n\n**Motivo:** ${conclusionDescription}\n\nO chamado foi encerrado devido à reprovação gerencial.`,
          criadoEm: new Date().toISOString(),
          type: isApproval ? 'manager_approval' : 'manager_rejection'
        };
        await messageService.sendMessage(ticketId, approvalMessage);
      }
      await loadTicketData();
      setNewStatus('');
      setConclusionDescription('');
      setConclusionImages([]);
      setSelectedArea('');
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      setError('Erro ao atualizar status do chamado');
    } finally {
      setUpdating(false);
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && chatImages.length === 0) || sendingMessage) return;
    try {
      setSendingMessage(true);
      const messageData = {
        ticketId,
        remetenteId: user.uid,
        remetenteFuncao: userProfile.funcao,
        remetenteNome: userProfile.nome || user.email,
        conteudo: newMessage.trim(),
        imagens: chatImages,
        criadoEm: new Date().toISOString()
      };
      await messageService.sendMessage(ticketId, messageData);
      try {
        await notificationService.notifyNewMessage(ticketId, ticket, messageData, user.uid);
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de mensagem:', notificationError);
      }
      const messagesData = await messageService.getMessagesByTicket(ticketId);
      setMessages(messagesData || []);
      setNewMessage('');
      setChatImages([]);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setError('Erro ao enviar mensagem');
    } finally {
      setSendingMessage(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Data não disponível';
    try {
      if (dateString.toDate && typeof dateString.toDate === 'function') {
        return dateString.toDate().toLocaleString('pt-BR');
      }
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  const getManagerUidByArea = (managementArea) => {
    let resultado;
    switch (managementArea) {
      case 'gerente_operacional': 
        resultado = 'I21CyL98Eua2WmkLh50OGjvivb83';
        break;
      default: 
        resultado = user.uid;
        break;
    }
    return resultado;
  };

  const getManagerAreaByTicketArea = (ticketArea) => {};
  const isManagerForArea = (managerArea, targetManagerArea) => {};
  const getStatusColor = (status) => {};
  const getStatusText = (status) => {};

  // Renderização de loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando detalhes do chamado...</p>
        </div>
      </div>
    );
  }

  // Renderização de erro
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar chamado</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ✅ ADIÇÃO: Nova renderização para quando o acesso for negado
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <Lock className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h2>
          <p className="text-gray-600 mb-6">
            Este é um chamado confidencial e você não tem permissão para visualizá-lo.
          </p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Renderização se chamado não encontrado
  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Chamado não encontrado</h2>
          <p className="text-gray-600 mb-4">O chamado solicitado não existe ou você não tem permissão para visualizá-lo.</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const availableStatuses = getAvailableStatuses();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={`Chamado #${ticket.numero || ticketId.slice(-8)}`} />
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="mb-3 sm:mb-4 p-2 sm:p-3"
          >
            <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="text-sm sm:text-base">Voltar ao Dashboard</span>
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 break-words">
                {ticket.titulo || 'Título não disponível'}
              </h2>
              <p className="text-gray-600 mt-1">
                Criado em {formatDate(ticket.criadoEm)} por {ticket.criadoPorNome || 'Usuário desconhecido'}
              </p>
            </div>
            <div className="flex items-center">
              {/* ✅ ADIÇÃO: Badge para indicar que o chamado é confidencial */}
              {ticket.isConfidential && (
                <Badge variant="outline" className="mr-2 border-orange-400 bg-orange-50 text-orange-700">
                  <Lock className="h-3 w-3 mr-1.5" />
                  Confidencial
                </Badge>
              )}
              <Badge className={getStatusColor(ticket.status)}>
                {getStatusText(ticket.status)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Detalhes do Chamado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div>
                  <Label className="text-xs sm:text-sm font-medium text-gray-700">Título</Label>
                  <p className="text-sm sm:text-base text-gray-900 break-words">{ticket.titulo || 'Título não disponível'}</p>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm font-medium text-gray-700">Descrição</Label>
                  <p className="text-sm sm:text-base text-gray-900 whitespace-pre-wrap break-words">{ticket.descricao || 'Descrição não disponível'}</p>
                </div>
                {ticket.imagens && ticket.imagens.length > 0 && (
                  <div>
                    <Label className="text-xs sm:text-sm font-medium text-gray-700 mb-2 block">📷 Imagens Anexadas</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {ticket.imagens.map((imagem, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imagem.url}
                            alt={imagem.name || `Imagem do chamado ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-75 transition-opacity shadow-sm hover:shadow-md"
                            onClick={() => window.open(imagem.url, '_blank')}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="hidden w-full h-32 bg-gray-100 rounded-lg border border-gray-200 items-center justify-center">
                            <div className="text-center">
                              <ImageIcon className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                              <p className="text-xs text-gray-500">Erro ao carregar</p>
                            </div>
                          </div>
                          {imagem.name && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="truncate">{imagem.name}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {ticket.isExtra && (
                  <div className="p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-orange-600 font-semibold text-sm sm:text-base">🔥 ITEM EXTRA</span>
                    </div>
                    {ticket.motivoExtra && (
                      <div>
                        <Label className="text-xs sm:text-sm font-medium text-orange-700">Motivo do Item Extra</Label>
                        <p className="text-sm sm:text-base text-orange-900 whitespace-pre-wrap break-words">{ticket.motivoExtra}</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Área</Label>
                    <p className="text-gray-900">{ticket.area || 'Não especificada'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Tipo</Label>
                    <p className="text-gray-900">{ticket.tipo || 'Não especificado'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Criado em</Label>
                    <p className="text-gray-900">{formatDate(ticket.createdAt || ticket.criadoEm)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Criado por</Label>
                    <p className="text-gray-900">{ticket.criadoPorNome || 'Não disponível'}</p>
                  </div>
                </div>
                {ticket.imagensIniciais && ticket.imagensIniciais.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Imagens Iniciais</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {ticket.imagensIniciais.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-75 transition-opacity"
                            onClick={() => window.open(imageUrl, '_blank')}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="hidden w-full h-24 bg-gray-100 rounded-lg border border-gray-200 items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Conversas ({messages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nenhuma mensagem ainda</p>
                  ) : (
                    messages.map((message, index) => (
                      <div key={index} className="flex space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {message.remetenteNome || 'Usuário'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(message.criadoEm)}
                            </span>
                          </div>
                          {message.conteudo && (
                            <p className="text-sm text-gray-700 mt-1">{message.conteudo}</p>
                          )}
                          {message.imagens && message.imagens.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {message.imagens.map((imageUrl, imgIndex) => (
                                <img
                                  key={imgIndex}
                                  src={imageUrl}
                                  alt={`Anexo ${imgIndex + 1}`}
                                  className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-75"
                                  onClick={() => window.open(imageUrl, '_blank')}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t pt-4">
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      rows={3}
                    />
                    <ImageUpload
                      onImagesUploaded={setChatImages}
                      existingImages={chatImages}
                      maxImages={3}
                      buttonText="Anexar ao Chat"
                      className="border-t pt-3"
                    />
                    <div className="flex items-center justify-end">
                      <Button
                        onClick={handleSendMessage}
                        disabled={sendingMessage || (!newMessage.trim() && chatImages.length === 0)}
                      >
                        {sendingMessage ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Enviar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Projeto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div>
                  <Label className="text-xs sm:text-sm font-medium text-gray-700">Nome</Label>
                  <p className="text-sm sm:text-base text-gray-900 break-words">{project?.nome || 'Projeto não encontrado'}</p>
                </div>
                {project?.cliente && (
                  <div>
                    <Label className="text-xs sm:text-sm font-medium text-gray-700">Cliente</Label>
                    <p className="text-sm sm:text-base text-gray-900 break-words">{project.cliente}</p>
                  </div>
                )}
                {project?.local && (
                  <div>
                    <Label className="text-xs sm:text-sm font-medium text-gray-700">Local</Label>
                    <p className="text-sm sm:text-base text-gray-900 break-words">{project.local}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            {availableStatuses.length > 0 && (
              <Card>
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Ações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  <div>
                    <Label className="text-xs sm:text-sm font-medium text-gray-700">Alterar Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione uma ação" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(newStatus === TICKET_STATUS.COMPLETED || newStatus === TICKET_STATUS.REJECTED || (newStatus === TICKET_STATUS.SENT_TO_AREA && ticket.status === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION)) && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="conclusion-description">
                          {newStatus === TICKET_STATUS.COMPLETED ? 'Descrição da Conclusão' : 'Motivo da Rejeição'}
                        </Label>
                        <Textarea
                          id="conclusion-description"
                          placeholder={newStatus === TICKET_STATUS.COMPLETED ? "Descreva como o problema foi resolvido..." : "Explique o motivo da rejeição..."}
                          value={conclusionDescription}
                          onChange={(e) => setConclusionDescription(e.target.value)}
                          rows={3}
                          className={(newStatus === TICKET_STATUS.REJECTED || (newStatus === TICKET_STATUS.SENT_TO_AREA && ticket.status === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION)) ? "border-red-300 focus:border-red-500" : ""}
                        />
                        {(newStatus === TICKET_STATUS.REJECTED || (newStatus === TICKET_STATUS.SENT_TO_AREA && ticket.status === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION)) && (
                          <p className="text-xs text-red-600 mt-1">* Campo obrigatório para rejeição</p>
                        )}
                      </div>
                      {newStatus === TICKET_STATUS.COMPLETED && (
                        <div>
                          <Label>Evidências (Imagens)</Label>
                          <ImageUpload
                            onImagesUploaded={setConclusionImages}
                            existingImages={conclusionImages}
                            maxImages={5}
                            buttonText="Anexar Evidências"
                            className="mt-2"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={!newStatus || updating}
                    className={`w-full ${newStatus === TICKET_STATUS.REJECTED ? 'bg-red-600 hover:bg-red-700' : ''}`}
                    variant={newStatus === TICKET_STATUS.REJECTED ? 'destructive' : 'default'}
                  >
                    {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : newStatus === TICKET_STATUS.REJECTED ? <XCircle className="h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    {updating ? 'Atualizando...' : 'Confirmar Ação'}
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Histórico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">Chamado criado</p>
                      <p className="text-xs text-gray-500">{formatDate(ticket.criadoEm)}</p>
                    </div>
                  </div>
                  {ticket.atualizadoEm && ticket.atualizadoEm !== ticket.criadoEm && (
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Última atualização</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.atualizadoEm)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            {userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><span className="text-2xl">🔄</span>Escalar Chamado</CardTitle>
                  <CardDescription>Transfira este chamado para outra área quando necessário</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="escalation-area" className="text-base font-semibold">🎯 Área de Destino *</Label>
                      <Select value={escalationArea} onValueChange={setEscalationArea}>
                        <SelectTrigger className="mt-2 h-12 border-2 border-blue-300 focus:border-blue-500">
                          <SelectValue placeholder="👆 Selecione a área que deve receber o chamado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="logistica">🚚 Logística</SelectItem>
                          <SelectItem value="almoxarifado">📦 Almoxarifado</SelectItem>
                          <SelectItem value="comunicacao_visual">🎨 Comunicação Visual</SelectItem>
                          <SelectItem value="locacao">🏢 Locação</SelectItem>
                          <SelectItem value="compras">🛒 Compras</SelectItem>
                          <SelectItem value="producao">🏭 Produção</SelectItem>
                          <SelectItem value="comercial">💼 Comercial</SelectItem>
                          <SelectItem value="operacional">⚙️ Operacional</SelectItem>
                          <SelectItem value="financeiro">💰 Financeiro</SelectItem>
                          <SelectItem value="logotipia">🎨 Logotipia</SelectItem>
                          <SelectItem value="detalhamento_tecnico">🔧 Detalhamento Técnico</SelectItem>
                          <SelectItem value="sub_locacao">🏗️ Sub-locação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="escalation-reason" className="text-base font-semibold">📝 Motivo da Escalação *</Label>
                      <Textarea
                        id="escalation-reason"
                        value={escalationReason}
                        onChange={(e) => setEscalationReason(e.target.value)}
                        placeholder="Descreva o motivo pelo qual está escalando este chamado para outra área..."
                        className="mt-2 min-h-[100px] border-2 border-blue-300 focus:border-blue-500"
                      />
                    </div>
                    {escalationArea && escalationReason.trim() && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-semibold">✅ Pronto para escalar para: <span className="font-bold">{escalationArea}</span></p>
                      </div>
                    )}
                    <Button
                      onClick={handleEscalation}
                      disabled={!escalationArea || !escalationReason.trim() || isEscalating}
                      className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {isEscalating ? <><span className="animate-spin mr-2">⏳</span>Escalando...</> : <><span className="mr-2">🚀</span>Enviar Escalação</>}
                    </Button>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">⚠️ <strong>Atenção:</strong> Ao escalar, o chamado será transferido para a área selecionada e sairá da sua lista de responsabilidades.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && project?.consultorId && (userProfile.funcao === 'administrador' || ticket.area === userProfile.area) && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><span className="text-2xl">👨‍🎯</span>Escalar para Consultor</CardTitle>
                  <CardDescription>Escale este chamado para o consultor do projeto para tratativa específica</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="consultor-reason" className="text-base font-semibold">📝 Motivo da Escalação para Consultor *</Label>
                      <Textarea
                        id="consultor-reason"
                        value={consultorReason}
                        onChange={(e) => setConsultorReason(e.target.value)}
                        placeholder="Descreva o motivo pelo qual está escalando este chamado para o consultor do projeto..."
                        className="mt-2 min-h-[100px] border-2 border-green-300 focus:border-green-500"
                      />
                    </div>
                    {consultorReason.trim() && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-semibold">✅ Pronto para escalar para: <span className="font-bold">CONSULTOR DO PROJETO</span></p>
                        <p className="text-xs text-green-700 mt-1">Área de origem será salva para retorno: <span className="font-bold">{ticket.area?.replace('_', ' ').toUpperCase()}</span></p>
                      </div>
                    )}
                    <Button
                      onClick={handleConsultorEscalation}
                      disabled={!consultorReason.trim() || isEscalatingToConsultor}
                      className="w-full h-12 text-lg font-semibold bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                    >
                      {isEscalatingToConsultor ? <><span className="animate-spin mr-2">⏳</span>Escalando para Consultor...</> : <><span className="mr-2">👨‍🎯</span>Enviar para Consultor</>}
                    </Button>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">⚠️ <strong>Fluxo:</strong> O chamado irá para o consultor do projeto. Após a ação do consultor, retornará automaticamente para sua área ({ticket.area?.replace('_', ' ').toUpperCase()}) para continuidade.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && (userProfile.funcao === 'administrador' || ticket.area === userProfile.area) && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><span className="text-2xl">👨‍💼</span>Escalar para Gerência</CardTitle>
                  <CardDescription>Escale este chamado para qualquer gerência quando necessário</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="management-area" className="text-base font-semibold">👔 Gerência de Destino *</Label>
                      <Select value={managementArea} onValueChange={setManagementArea}>
                        <SelectTrigger className="mt-2 h-12 border-2 border-purple-300 focus:border-purple-500">
                          <SelectValue placeholder="👆 Selecione a gerência que deve receber o chamado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gerente_operacional">👨‍💼 Gerência Operacional</SelectItem>
                          <SelectItem value="gerente_comercial">💼 Gerência Comercial</SelectItem>
                          <SelectItem value="gerente_producao">🏭 Gerência Produção</SelectItem>
                          <SelectItem value="gerente_financeiro">💰 Gerência Financeira</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="management-reason" className="text-base font-semibold">📝 Motivo da Escalação para Gerência *</Label>
                      <Textarea
                        id="management-reason"
                        value={managementReason}
                        onChange={(e) => setManagementReason(e.target.value)}
                        placeholder="Descreva o motivo pelo qual está escalando este chamado para a gerência..."
                        className="mt-2 min-h-[100px] border-2 border-purple-300 focus:border-purple-500"
                      />
                    </div>
                    {managementArea && managementReason.trim() && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm text-purple-800 font-semibold">✅ Pronto para escalar para: <span className="font-bold">{managementArea.replace('gerente_', '').replace('_', ' ').toUpperCase()}</span></p>
                      </div>
                    )}
                    <Button
                      onClick={handleManagementEscalation}
                      disabled={!managementArea || !managementReason.trim() || isEscalatingToManagement}
                      className="w-full h-12 text-lg font-semibold bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400"
                    >
                      {isEscalatingToManagement ? <><span className="animate-spin mr-2">⏳</span>Escalando para Gerência...</> : <><span className="mr-2">👨‍💼</span>Enviar para Gerência</>}
                    </Button>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm text-purple-800">⚠️ <strong>Atenção:</strong> Ao escalar para gerência, o chamado aguardará aprovação gerencial antes de retornar para execução.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {userProfile && userProfile.funcao === 'operador' && project?.produtorId && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><span className="text-2xl">🏭</span>Transferir para Produtor</CardTitle>
                  <CardDescription>Transfira este chamado para o produtor do projeto para continuidade e finalização</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 mb-2"><strong>Produtor do Projeto:</strong> {users.find(u => u.uid === project.produtorId)?.nome || 'Não identificado'}</p>
                      <p className="text-xs text-blue-600">O chamado será transferido para o produtor responsável por este projeto.</p>
                    </div>
                    <Button
                      onClick={handleTransferToProducer}
                      disabled={updating}
                      className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {updating ? <><span className="animate-spin mr-2">⏳</span>Transferindo...</> : <><span className="mr-2">🏭</span>Enviar para Produtor</>}
                    </Button>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">ℹ️ <strong>Informação:</strong> O chamado será transferido para o produtor do projeto para dar continuidade e finalização.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;
