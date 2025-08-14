// ==== BASE: TicketDetailPage_FINAL.jsx ====
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService, TICKET_STATUS } from '@/services/ticketService';
import { projectService } from '@/services/projectService';
import { userService, AREAS } from '@/services/userService';
import { messageService } from '@/services/messageService';
import notificationService from '@/services/notificationService';
import ImageUpload from '@/components/ImageUpload';
import Header from '@/components/Header';
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
  Lock,
  UserCheck,
  PlusCircle,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Archive, // ✅ ÍCONE ADICIONADO
  ArchiveRestore // ✅ ÍCONE ADICIONADO
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

  // Estados para menções de usuários e histórico
  const [users, setUsers] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);

  const loadTicketData = async () => {
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);

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

  useEffect(() => {
    if (ticketId && user) {
      loadTicketData();
      markNotificationsAsRead();
    }
  }, [ticketId, user]);

  useEffect(() => {
    if (ticket && userProfile && user) {
      if (ticket.isConfidential) {
        const isCreator = ticket.criadoPor === user.uid;
        const isAdmin = userProfile.funcao === 'administrador';
        const isInvolvedOperator = userProfile.funcao === 'operador' &&
                                   (userProfile.area === ticket.area || userProfile.area === ticket.areaDeOrigem);

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
    
  // ✅ NOVA FUNÇÃO PARA ARQUIVAR
  const handleArchiveTicket = async () => {
    if (!window.confirm('Tem certeza que deseja arquivar este chamado? Ele sairá da visualização principal e só poderá ser consultado.')) {
        return;
    }

    setUpdating(true);
    try {
        await ticketService.updateTicket(ticketId, {
            status: 'arquivado',
            arquivadoEm: new Date(),
            arquivadoPor: user.uid,
            dataUltimaAtualizacao: new Date()
        });
        alert('Chamado arquivado com sucesso!');
        navigate('/dashboard');
    } catch (error) {
        console.error('Erro ao arquivar chamado:', error);
        alert('Ocorreu um erro ao arquivar o chamado.');
        setUpdating(false);
    }
  };

  // ✅ NOVA FUNÇÃO PARA DESARQUIVAR
  const handleUnarchiveTicket = async () => {
    if (!window.confirm('Deseja desarquivar este chamado? Ele voltará para a lista de concluídos.')) {
        return;
    }

    setUpdating(true);
    try {
        await ticketService.updateTicket(ticketId, {
            status: 'concluido',
            arquivadoEm: null,
            arquivadoPor: null,
            dataUltimaAtualizacao: new Date()
        });
        alert('Chamado desarquivado com sucesso!');
        loadTicketData();
    } catch (error) {
        console.error('Erro ao desarquivar chamado:', error);
        alert('Ocorreu um erro ao desarquivar o chamado.');
    } finally {
        setUpdating(false);
    }
  };

  const getUserNameById = (userId) => {
      if (!users || !userId) return 'Sistema';
      const userFound = users.find(u => u.uid === userId || u.id === userId);
      return userFound?.nome || 'Usuário desconhecido';
  };

  useEffect(() => {
    if (ticket && users.length > 0) {
        const events = [];

        if (ticket.criadoEm) {
            events.push({
                date: ticket.criadoEm,
                description: 'Chamado criado por',
                userName: ticket.criadoPorNome || getUserNameById(ticket.criadoPor),
                Icon: PlusCircle,
                color: 'text-blue-500'
            });
        }

        if (ticket.escaladoEm && ticket.motivoEscalonamentoGerencial) {
             events.push({
                date: ticket.escaladoEm,
                description: 'Escalado para gerência por',
                userName: getUserNameById(ticket.escaladoPor),
                Icon: Shield,
                color: 'text-purple-500'
            });
        }

        if (ticket.aprovadoEm) {
            events.push({
                date: ticket.aprovadoEm,
                description: 'Aprovado por',
                userName: getUserNameById(ticket.aprovadoPor),
                Icon: ThumbsUp,
                color: 'text-green-500'
            });
        }

        if (ticket.rejeitadoEm) {
            events.push({
                date: ticket.rejeitadoEm,
                description: 'Rejeitado / Devolvido por',
                userName: getUserNameById(ticket.rejeitadoPor),
                Icon: ThumbsDown,
                color: 'text-red-500'
            });
        }

        if (ticket.concluidoEm) {
            events.push({
                date: ticket.concluidoEm,
                description: 'Concluído por',
                userName: getUserNameById(ticket.concluidoPor),
                Icon: CheckCircle,
                color: 'text-green-600'
            });
        }

        const sortedEvents = events.sort((a, b) => {
            const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
            return dateA - dateB;
        });

        setHistoryEvents(sortedEvents);
    }
  }, [ticket, users]);

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
    const beforeCursor = newMessage.substring(0, cursorPosition);
    const afterCursor = newMessage.substring(cursorPosition);
    const beforeMention = beforeCursor.replace(/@\w*$/, '');
    const newText = beforeMention + `@${user.nome} ` + afterCursor;

    setNewMessage(newText);
    setShowMentionSuggestions(false);
    setMentionSuggestions([]);
    setMentionQuery('');

    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = beforeMention.length + user.nome.length + 2;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleTextareaChange = (e) => {
    const value = e.target.value;
    const position = e.target.selectionStart;

    setNewMessage(value);
    setCursorPosition(position);
    detectMentions(value, position);
  };

  const handleTextareaKeyDown = (e) => {
    if (showMentionSuggestions) {
      if (e.key === 'Escape') {
        setShowMentionSuggestions(false);
        setMentionSuggestions([]);
        setMentionQuery('');
      }
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Data não disponível';

    try {
      let dateObj;
      if (date.toDate && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }

      if (isNaN(dateObj.getTime())) {
        return 'Data inválida';
      }

      return dateObj.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return 'Erro na data';
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'aberto': 'bg-blue-100 text-blue-800',
      'em_tratativa': 'bg-yellow-100 text-yellow-800',
      'em_execucao': 'bg-blue-100 text-blue-800',
      'enviado_para_area': 'bg-purple-100 text-purple-800',
      'escalado_para_area': 'bg-purple-100 text-purple-800',
      'escalado_para_outra_area': 'bg-purple-100 text-purple-800',
      'aguardando_aprovacao': 'bg-orange-100 text-orange-800',
      'executado_aguardando_validacao': 'bg-indigo-100 text-indigo-800',
      'concluido': 'bg-green-100 text-green-800',
      'cancelado': 'bg-red-100 text-red-800',
      'devolvido': 'bg-pink-100 text-pink-800',
      'aprovado': 'bg-green-100 text-green-800',
      'reprovado': 'bg-red-100 text-red-800',
      'arquivado': 'bg-gray-100 text-gray-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const statusTexts = {
      'aberto': 'Aberto',
      'em_tratativa': 'Em Tratativa',
      'em_execucao': 'Em Execução',
      'enviado_para_area': 'Enviado para Área',
      'escalado_para_area': 'Escalado para Área',
      'escalado_para_outra_area': 'Escalado para Outra Área',
      'aguardando_aprovacao': 'Aguardando Aprovação',
      'executado_aguardando_validacao': 'Executado - Aguardando Validação',
      'concluido': 'Concluído',
      'cancelado': 'Cancelado',
      'devolvido': 'Devolvido',
      'aprovado': 'Aprovado',
      'reprovado': 'Reprovado',
      'arquivado': 'Arquivado'
    };
    return statusTexts[status] || status;
  };

  const getAvailableStatuses = () => {
    if (!ticket || !userProfile || !user) {
      return [];
    }

    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;
    const isCreator = ticket.criadoPor === user.uid;

    const isProjectProducer = userProfile.funcao === 'produtor' && project && project.produtorId === user.uid;
    const isConsultantTicketForProducer = ticket.criadoPorFuncao === 'consultor';

    if (isProjectProducer && isConsultantTicketForProducer && (ticket.status === 'aberto' || ticket.status === 'em_tratativa')) {
        const producerActions = [];
        if (ticket.status === 'aberto') {
            producerActions.push({ value: TICKET_STATUS.IN_TREATMENT, label: 'Iniciar Tratativa', description: 'Começar a trabalhar no chamado' });
        }
        producerActions.push({ value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado para validação do consultor' });

        producerActions.push({ value: 'send_to_area', label: 'Enviar para a Área', description: 'Encaminhar o chamado para a área final' });

        return producerActions;
    }

    if (isCreator && currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
        return [
            { value: TICKET_STATUS.COMPLETED, label: 'Validar e Concluir', description: 'O chamado foi resolvido corretamente.' },
            { value: TICKET_STATUS.SENT_TO_AREA, label: 'Rejeitar / Devolver', description: 'Devolver para a área responsável com um motivo.' }
        ];
    }

    if (userRole === 'administrador') {
      if (currentStatus === TICKET_STATUS.OPEN) {
        return [
          { value: TICKET_STATUS.IN_TREATMENT, label: 'Iniciar Tratativa', description: 'Começar a trabalhar no chamado' }
        ];
      }
      if (currentStatus === TICKET_STATUS.IN_TREATMENT) {
        return [
          { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado para validação' }
        ];
      }
      if (currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION && !isCreator) {
        return [
          { value: TICKET_STATUS.COMPLETED, label: 'Forçar Conclusão (Admin)', description: 'Finalizar chamado como administrador.' }
        ];
      }
      if (currentStatus === 'aguardando_aprovacao') {
        return [
          { value: TICKET_STATUS.APPROVED, label: 'Aprovar', description: 'Aprovar e retornar para área' },
          { value: TICKET_STATUS.REJECTED, label: 'Reprovar', description: 'Reprovar e encerrar chamado' }
        ];
      }
    }

    if (userRole === 'operador') {
      const isFromUserArea = ticket.area === userProfile.area;
      const isAssignedToUser = ticket.atribuidoA === user.uid;
      const canManage = isFromUserArea || isAssignedToUser;

      if (canManage) {
        if (currentStatus === TICKET_STATUS.OPEN) {
          return [
            { value: TICKET_STATUS.IN_TREATMENT, label: 'Iniciar Tratativa', description: 'Começar a trabalhar no chamado' }
          ];
        }
        if (currentStatus === TICKET_STATUS.IN_TREATMENT) {
          return [
            { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado para validação' }
          ];
        }
      }
    }

    if (userRole === 'gerente') {
      const isManagerOfArea = userProfile.area === 'producao';
      const isEscalatedToThisManager = currentStatus === 'aguardando_aprovacao' &&
                                       (ticket.gerenteResponsavelId === user.uid ||
                                        (!ticket.gerenteResponsavelId && isManagerOfArea));

      if (isEscalatedToThisManager) {
        return [
          { value: TICKET_STATUS.APPROVED, label: 'Aprovar', description: 'Aprovar e retornar para área' },
          { value: TICKET_STATUS.REJECTED, label: 'Reprovar', description: 'Reprovar e encerrar chamado' }
        ];
      }
      return [];
    }

    if (userRole === 'consultor' && isCreator) {
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

    const targetArea = managementArea.replace('gerente_', '');
    const targetManager = users.find(u => u.funcao === 'gerente' && u.area === targetArea);

    if (!targetManager) {
      alert(`Erro: Nenhum gerente encontrado para a área "${targetArea}". Verifique o cadastro de usuários.`);
      return;
    }

    setIsEscalatingToManagement(true);
    try {
      const updateData = {
        status: 'aguardando_aprovacao',
        areaDeOrigem: ticket.area,
        gerenteResponsavelId: targetManager.uid,
        motivoEscalonamentoGerencial: managementReason,
        escaladoPor: user.uid,
        escaladoEm: new Date(),
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };

      const managementNames = {
        'gerente_operacional': 'Gerência Operacional',
        'gerente_comercial': 'Gerência Comercial',
        'gerente_producao': 'Gerência Produção',
        'gerente_financeiro': 'Gerência Financeira'
      };

      await ticketService.updateTicket(ticketId, updateData);

      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `👨‍💼 **Chamado escalado para ${managementNames[managementArea]}**\n\n**Motivo:** ${managementReason}\n\n**Gerente Responsável:** ${targetManager.nome}`,
        criadoEm: new Date(),
        type: 'management_escalation'
      };
      await messageService.sendMessage(ticketId, escalationMessage);

      try {
        await notificationService.notifyManagementEscalation(
          ticketId,
          ticket,
          targetManager.uid,
          user.uid,
          managementReason
        );
        console.log('✅ Notificação de escalação gerencial enviada');
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificação de escalação gerencial:', notificationError);
      }

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
      alert('Por favor, descreva o motivo da escalação para o consultor');
      return;
    }
    if (!project?.consultorId) {
      alert('Erro: Consultor do projeto não encontrado');
      return;
    }
    setIsEscalatingToConsultor(true);
    try {
      const updateData = {
        status: 'escalado_para_consultor',
        areaDeOrigem: ticket.area,
        consultorResponsavelId: project.consultorId,
        motivoEscalonamentoConsultor: consultorReason,
        escaladoPor: user.uid,
        escaladoEm: new Date(),
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `👨‍🎯 **Chamado escalado para CONSULTOR DO PROJETO**\n\n**Motivo:** ${consultorReason}\n\n**Área de Origem:** ${ticket.area?.replace('_', ' ').toUpperCase()}`,
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
      alert('Erro: Produtor do projeto não encontrado');
      return;
    }
    setUpdating(true);
    try {
      const updateData = {
        status: 'transferido_para_produtor',
        produtorResponsavelId: project.produtorId,
        transferidoPor: user.uid,
        transferidoEm: new Date(),
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      const transferMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `🏭 **Chamado transferido para PRODUTOR DO PROJETO**\n\nO chamado foi transferido para o produtor responsável para continuidade e finalização.`,
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
    if (!newStatus) return;

    if ((newStatus === TICKET_STATUS.REJECTED || (newStatus === TICKET_STATUS.SENT_TO_AREA && ticket.status === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION)) && !conclusionDescription.trim()) {
      alert('Por favor, forneça um motivo para a rejeição');
      return;
    }

    setUpdating(true);
    try {
      let updateData = {};
      let systemMessageContent = '';

      if (newStatus === 'send_to_area') {
        const targetArea = ticket.areaDestinoOriginal;

        if (!targetArea) {
            alert('Erro Crítico: A área de destino original não foi encontrada neste chamado. O chamado não pode ser enviado. Por favor, contate o suporte. (O campo areaDestinoOriginal está faltando no ticket).');
            setUpdating(false);
            return;
        }

        const newAreasEnvolvidas = [...new Set([...(ticket.areasEnvolvidas || []), targetArea])];

        updateData = {
          status: TICKET_STATUS.OPEN,
          area: targetArea,
          areasEnvolvidas: newAreasEnvolvidas,
          atualizadoPor: user.uid,
          updatedAt: new Date(),
        };
        systemMessageContent = `📲 **Chamado enviado pelo produtor para a área de destino: ${targetArea.replace('_', ' ').toUpperCase()}.**`;

      } else {
        updateData = {
          status: newStatus,
          atualizadoPor: user.uid,
          updatedAt: new Date()
        };

        if (newStatus === TICKET_STATUS.COMPLETED) {
          updateData.conclusaoDescricao = conclusionDescription;
          updateData.conclusaoImagens = conclusionImages;
          updateData.concluidoEm = new Date();
          updateData.concluidoPor = user.uid;
          systemMessageContent = `✅ **Chamado concluído**\n\n**Descrição:** ${conclusionDescription}`;
        } else if (newStatus === TICKET_STATUS.REJECTED) {
          updateData.motivoRejeicao = conclusionDescription;
          updateData.rejeitadoEm = new Date();
          updateData.rejeitadoPor = user.uid;
          const managerName = userProfile?.nome || user?.email || 'Gerente';
          systemMessageContent = `❌ **Chamado reprovado pelo gerente ${managerName}**\n\n**Motivo:** ${conclusionDescription}\n\nO chamado foi encerrado devido à reprovação gerencial.`;
        } else if (newStatus === TICKET_STATUS.SENT_TO_AREA && ticket.status === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
          updateData.motivoRejeicao = conclusionDescription;
          updateData.rejeitadoEm = new Date();
          updateData.rejeitadoPor = user.uid;
          updateData.area = ticket.areaDeOrigem || ticket.area;
          systemMessageContent = `🔄 **Status atualizado para:** ${getStatusText(newStatus)}`;
        } else if (newStatus === TICKET_STATUS.APPROVED) {
            if (ticket.status === 'aguardando_aprovacao' && userProfile.funcao === 'gerente') {
                const targetArea = ticket.areaDeOrigem || ticket.area;
                updateData.status = 'em_tratativa';
                updateData.area = targetArea;
                updateData.aprovadoEm = new Date();
                updateData.aprovadoPor = user.uid;
                const managerName = userProfile?.nome || user?.email || 'Gerente';
                systemMessageContent = `✅ **Chamado aprovado pelo gerente ${managerName}**\n\nO chamado foi aprovado e retornará para a área responsável para execução.`;
            }
        } else {
            systemMessageContent = `🔄 **Status atualizado para:** ${getStatusText(newStatus)}`;
        }
      }

      await ticketService.updateTicket(ticketId, updateData);

      const statusMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: systemMessageContent,
        criadoEm: new Date(),
        type: 'status_update'
      };
      await messageService.sendMessage(ticketId, statusMessage);

      try {
        await notificationService.notifyStatusChange(
          ticketId,
          ticket,
          updateData.status,
          ticket.status,
          user.uid
        );
        console.log('✅ Notificação de mudança de status enviada');
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificação de mudança de status:', notificationError);
      }

      await loadTicketData();
      setNewStatus('');
      setConclusionDescription('');
      setConclusionImages([]);
      alert('Status atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && chatImages.length === 0) return;

    setSendingMessage(true);
    try {
      const messageData = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: newMessage.trim(),
        imagens: chatImages,
        criadoEm: new Date(),
        type: 'user_message'
      };

      await messageService.sendMessage(ticketId, messageData);

      try {
        await notificationService.notifyNewMessage(
          ticketId,
          ticket,
          messageData,
          user.uid
        );
        console.log('✅ Notificação de nova mensagem enviada');
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificação de nova mensagem:', notificationError);
      }

      await loadTicketData();
      setNewMessage('');
      setChatImages([]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem: ' + error.message);
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando chamado...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Erro ao Carregar</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

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
  const isArchived = ticket.status === 'arquivado';

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

        {isArchived && (
          <Alert variant="default" className="mb-6 bg-gray-100 border-gray-300">
              <Archive className="h-4 w-4" />
              <AlertDescription>
                  Este chamado está arquivado e é somente para consulta. Para fazer alterações, é preciso desarquivá-lo.
              </AlertDescription>
          </Alert>
        )}

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
                    <div className="relative">
                      <Textarea
                        ref={textareaRef}
                        placeholder={isArchived ? "Este chamado está arquivado e não permite novas mensagens." : "Digite sua mensagem..."}
                        value={newMessage}
                        onChange={handleTextareaChange}
                        onKeyDown={handleTextareaKeyDown}
                        rows={3}
                        disabled={isArchived || sendingMessage}
                      />
                      {showMentionSuggestions && mentionSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {mentionSuggestions.map((user, index) => (
                            <button
                              key={index}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center space-x-2"
                              onClick={() => insertMention(user)}
                            >
                              <AtSign className="h-4 w-4 text-gray-400" />
                              <span className="font-medium">{user.nome}</span>
                              <span className="text-sm text-gray-500">({user.email})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {!isArchived && (
                        <ImageUpload
                          onImagesUploaded={setChatImages}
                          existingImages={chatImages}
                          maxImages={3}
                          buttonText="Anexar ao Chat"
                          className="border-t pt-3"
                        />
                    )}
                    <div className="flex items-center justify-end">
                      <Button
                        onClick={handleSendMessage}
                        disabled={isArchived || sendingMessage || (!newMessage.trim() && chatImages.length === 0)}
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

            {!isArchived && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && (
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
                      <Label htmlFor="escalation-reason" className="text-base font-semibold">📝 Motivo *</Label>
                      <Textarea
                        id="escalation-reason"
                        value={escalationReason}
                        onChange={(e) => setEscalationReason(e.target.value)}
                        placeholder="Descreva o motivo pelo qual está enviando este chamado para outra área..."
                        className="mt-2 min-h-[100px] border-2 border-blue-300 focus:border-blue-500"
                      />
                    </div>
                    {escalationArea && escalationReason.trim() && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-semibold">✅ Pronto para enviar para: <span className="font-bold">{escalationArea}</span></p>
                      </div>
                    )}
                    <Button
                      onClick={handleEscalation}
                      disabled={!escalationArea || !escalationReason.trim() || isEscalating}
                      className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {isEscalating ? <><span className="animate-spin mr-2">⏳</span>Enviando...</> : <><span className="mr-2">🚀</span>Enviar para Área</>}
                    </Button>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">⚠️ <strong>Atenção:</strong> Ao enviar, o chamado será transferido para a área selecionada e sairá da sua lista de responsabilidades.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}


            {!isArchived && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && project?.consultorId && (userProfile.funcao === 'administrador' || ticket.area === userProfile.area) && (
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

            {!isArchived && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && (userProfile.funcao === 'administrador' || ticket.area === userProfile.area) && (
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

            {!isArchived && userProfile && userProfile.funcao === 'operador' && project?.produtorId && (
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

          {/* Sidebar */}
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
                {project && (
                  <div className="pt-3 mt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(`/projeto/${project.id}`)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Acessar Detalhes do Projeto
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {isArchived && userProfile?.funcao === 'administrador' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <ArchiveRestore className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Ações de Arquivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleUnarchiveTicket} disabled={updating} className="w-full">
                    {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArchiveRestore className="h-4 w-4 mr-2" />}
                    Desarquivar Chamado
                  </Button>
                </CardContent>
              </Card>
            )}

            {!isArchived && availableStatuses.length > 0 && (
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

            {!isArchived && userProfile?.funcao === 'administrador' && ticket.status === 'concluido' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Archive className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Ações de Arquivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleArchiveTicket} disabled={updating} variant="outline" className="w-full">
                    {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
                    Arquivar Chamado
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Histórico do Chamado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {historyEvents.length > 0 ? (
                    historyEvents.map((event, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="flex flex-col items-center">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ${event.color}`}>
                            <event.Icon className="h-5 w-5" />
                          </span>
                          {index < historyEvents.length - 1 && (
                            <div className="h-6 w-px bg-gray-200" />
                          )}
                        </div>
                        <div className="flex-1 pt-1.5">
                          <p className="text-sm text-gray-800">
                            {event.description}{' '}
                            <span className="font-semibold text-gray-900">{event.userName}</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDate(event.date)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Nenhum evento de histórico registrado.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;


// ==== TicketDetailPage (49).jsx (Possíveis atualizações recentes) ====
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService } from '@/services/ticketService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { messageService } from '@/services/messageService';
import notificationService from '@/services/notificationService';
import ImageUpload from '@/components/ImageUpload';
import Header from '@/components/Header';
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
  Lock,
  UserCheck,
  PlusCircle,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Archive,
  ArchiveRestore,
  Link as LinkIcon,
  ClipboardEdit, // Ícone adicionado
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

  // Estados para menções de usuários e histórico
  const [users, setUsers] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);
  
  // Estados para o fluxo de correção e reenvio
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');

  // Estado para exibir link do chamado pai
  const [parentTicketForLink, setParentTicketForLink] = useState(null);

  const loadTicketData = async () => {
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);

      const ticketData = await ticketService.getTicketById(ticketId);
      if (!ticketData) {
        throw new Error('Chamado não encontrado');
      }

      setTicket(ticketData);

      if (ticketData.chamadoPaiId) {
          const parentTicketData = await ticketService.getTicketById(ticketData.chamadoPaiId);
          setParentTicketForLink(parentTicketData);
      }

      if (ticketData.projetoId) {
        const projectData = await projectService.getProjectById(ticketData.projetoId);
        setProject(projectData);
      }

      const messagesData = await messageService.getMessagesByTicket(ticketId);
      setMessages(messagesData || []);

    } catch (err) {
      setError(err.message || 'Erro ao carregar chamado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId && user) {
      loadTicketData();
      markNotificationsAsRead();
    }
  }, [ticketId, user]);

  useEffect(() => {
    if (ticket && userProfile && user) {
      if (ticket.isConfidential) {
        const isCreator = ticket.criadoPor === user.uid;
        const isAdmin = userProfile.funcao === 'administrador';
        const isInvolvedOperator = userProfile.funcao === 'operador' &&
                                   (userProfile.area === ticket.area || userProfile.area === ticket.areaDeOrigem);

        if (!isCreator && !isAdmin && !isInvolvedOperator) {
          setAccessDenied(true);
        }
      }
    }
  }, [ticket, userProfile, user]);

  const markNotificationsAsRead = async () => {
    if (!user?.uid || !ticketId) return;
    try {
      await notificationService.markTicketNotificationsAsRead(user.uid, ticketId);
    } catch (error) {
      console.error('❌ Erro ao marcar notificações como lidas:', error);
    }
  };

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
    
  const handleArchiveTicket = async () => {
    if (!window.confirm('Tem certeza que deseja arquivar este chamado? Ele sairá da visualização principal e só poderá ser consultado.')) return;
    setUpdating(true);
    try {
        await ticketService.updateTicket(ticketId, {
            status: 'arquivado',
            arquivadoEm: new Date(),
            arquivadoPor: user.uid,
            dataUltimaAtualizacao: new Date()
        });
        alert('Chamado arquivado com sucesso!');
        navigate('/dashboard');
    } catch (error) {
        alert('Ocorreu um erro ao arquivar o chamado.');
        setUpdating(false);
    }
  };

  const handleUnarchiveTicket = async () => {
    if (!window.confirm('Deseja desarquivar este chamado? Ele voltará para a lista de concluídos.')) return;
    setUpdating(true);
    try {
        await ticketService.updateTicket(ticketId, {
            status: 'concluido',
            arquivadoEm: null,
            arquivadoPor: null,
            dataUltimaAtualizacao: new Date()
        });
        alert('Chamado desarquivado com sucesso!');
        loadTicketData();
    } catch (error) {
        alert('Ocorreu um erro ao desarquivar o chamado.');
    } finally {
        setUpdating(false);
    }
  };
    
  const getUserNameById = (userId) => {
      if (!users || !userId) return 'Sistema';
      const userFound = users.find(u => u.uid === userId || u.id === userId);
      return userFound?.nome || 'Usuário desconhecido';
  };
  
  useEffect(() => {
    if (ticket && users.length > 0) {
        const events = [];
        if (ticket.criadoEm) { events.push({ date: ticket.criadoEm, description: 'Chamado criado por', userName: ticket.criadoPorNome || getUserNameById(ticket.criadoPor), Icon: PlusCircle, color: 'text-blue-500' }); }
        if (ticket.escaladoEm && ticket.motivoEscalonamentoGerencial) { events.push({ date: ticket.escaladoEm, description: 'Escalado para gerência por', userName: getUserNameById(ticket.escaladoPor), Icon: Shield, color: 'text-purple-500' }); }
        if (ticket.aprovadoEm) { events.push({ date: ticket.aprovadoEm, description: 'Aprovado por', userName: getUserNameById(ticket.aprovadoPor), Icon: ThumbsUp, color: 'text-green-500' }); }
        if (ticket.rejeitadoEm) { events.push({ date: ticket.rejeitadoEm, description: 'Rejeitado / Devolvido por', userName: getUserNameById(ticket.rejeitadoPor), Icon: ThumbsDown, color: 'text-red-500' }); }
        if (ticket.concluidoEm) { events.push({ date: ticket.concluidoEm, description: 'Concluído por', userName: getUserNameById(ticket.concluidoPor), Icon: CheckCircle, color: 'text-green-600' }); }
        const sortedEvents = events.sort((a, b) => (a.date.toDate ? a.date.toDate() : new Date(a.date)) - (b.date.toDate ? b.date.toDate() : new Date(b.date)));
        setHistoryEvents(sortedEvents);
    }
  }, [ticket, users]);

  const detectMentions = (text, position) => {
    const beforeCursor = text.substring(0, position);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const filtered = users.filter(user => user.nome.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)).slice(0, 5);
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
    const beforeCursor = newMessage.substring(0, cursorPosition);
    const afterCursor = newMessage.substring(cursorPosition);
    const beforeMention = beforeCursor.replace(/@\w*$/, '');
    const newText = beforeMention + `@${user.nome} ` + afterCursor;
    setNewMessage(newText);
    setShowMentionSuggestions(false);
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = beforeMention.length + user.nome.length + 2;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleTextareaChange = (e) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setNewMessage(value);
    setCursorPosition(position);
    detectMentions(value, position);
  };

  const handleTextareaKeyDown = (e) => {
    if (showMentionSuggestions && e.key === 'Escape') {
      setShowMentionSuggestions(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Data não disponível';
    try {
      let dateObj = (date.toDate && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
      if (isNaN(dateObj.getTime())) return 'Data inválida';
      return dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Erro na data';
    }
  };

  const getStatusColor = (status) => {
    const colors = { 
        'aberto': 'bg-blue-100 text-blue-800', 
        'em_tratativa': 'bg-yellow-100 text-yellow-800', 
        'em_execucao': 'bg-blue-100 text-blue-800', 
        'enviado_para_area': 'bg-purple-100 text-purple-800', 
        'escalado_para_area': 'bg-purple-100 text-purple-800', 
        'escalado_para_outra_area': 'bg-purple-100 text-purple-800', 
        'aguardando_aprovacao': 'bg-orange-100 text-orange-800', 
        'executado_aguardando_validacao': 'bg-indigo-100 text-indigo-800', 
        'concluido': 'bg-green-100 text-green-800', 
        'cancelado': 'bg-red-100 text-red-800', 
        'devolvido': 'bg-pink-100 text-pink-800', 
        'aprovado': 'bg-green-100 text-green-800', 
        'reprovado': 'bg-red-100 text-red-800', 
        'arquivado': 'bg-gray-100 text-gray-700', 
        'executado_pelo_consultor': 'bg-yellow-100 text-yellow-800', 
        'escalado_para_consultor': 'bg-cyan-100 text-cyan-800',
        'executado_aguardando_validacao_operador': 'bg-indigo-100 text-indigo-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const statusTexts = { 
        'aberto': 'Aberto', 
        'em_tratativa': 'Em Tratativa', 
        'em_execucao': 'Em Execução', 
        'enviado_para_area': 'Enviado para Área', 
        'escalado_para_area': 'Escalado para Área', 
        'escalado_para_outra_area': 'Escalado para Outra Área', 
        'aguardando_aprovacao': 'Aguardando Aprovação', 
        'executado_aguardando_validacao': 'Aguardando Validação', 
        'concluido': 'Concluído', 
        'cancelado': 'Cancelado', 
        'devolvido': 'Devolvido', 
        'aprovado': 'Aprovado', 
        'reprovado': 'Reprovado', 
        'arquivado': 'Arquivado', 
        'executado_pelo_consultor': 'Executado pelo Consultor', 
        'escalado_para_consultor': 'Escalado para Consultor',
        'executado_aguardando_validacao_operador': 'Aguardando Validação do Operador'
    };
    return statusTexts[status] || status;
  };

  const getAvailableStatuses = () => {
    if (!ticket || !userProfile || !user) return [];
    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;
    const isCreator = ticket.criadoPor === user.uid;

    if (isCreator && (currentStatus === 'executado_aguardando_validacao' || currentStatus === 'executado_aguardando_validacao_operador')) {
        return [ { value: 'concluido', label: 'Validar e Concluir' }, { value: 'enviado_para_area', label: 'Rejeitar / Devolver' } ];
    }

    if (userRole === 'administrador') {
      if (currentStatus === 'aberto' || currentStatus === 'escalado_para_outra_area' || currentStatus === 'enviado_para_area') return [ { value: 'em_tratativa', label: 'Iniciar Tratativa' } ];
      if (currentStatus === 'em_tratativa') return [ { value: 'executado_aguardando_validacao', label: 'Executado' } ];
      if (currentStatus === 'executado_aguardando_validacao' && !isCreator) return [ { value: 'concluido', label: 'Forçar Conclusão (Admin)' } ];
      if (currentStatus === 'aguardando_aprovacao') return [ { value: 'aprovado', label: 'Aprovar' }, { value: 'rejeitado', label: 'Reprovar' } ];
    }
    
    if (userRole === 'operador') {
      if ((ticket.area === userProfile.area || ticket.atribuidoA === user.uid)) {
        if (currentStatus === 'aberto' || currentStatus === 'escalado_para_outra_area' || currentStatus === 'enviado_para_area') {
            const actions = [ { value: 'em_tratativa', label: 'Iniciar Tratativa' } ];
            if (ticket.areaDeOrigem) {
                actions.push({ value: 'enviado_para_area', label: 'Rejeitar / Devolver' });
            }
            return actions;
        }
        if (currentStatus === 'em_tratativa') {
            return [ { value: 'executado_aguardando_validacao_operador', label: 'Executado' } ];
        }
        if (currentStatus === 'executado_pelo_consultor') {
            return [
                { value: 'em_tratativa', label: 'Continuar Tratativa' },
                { value: 'executado_aguardando_validacao', label: 'Finalizar Execução' }
            ];
        }
      }
    }

    if (userRole === 'consultor' && ticket.consultorResponsavelId === user.uid) {
        if (ticket.status === 'escalado_para_consultor') {
            return [{ value: 'executado_pelo_consultor', label: 'Executar e Devolver para a Área' }];
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
        status: 'escalado_para_outra_area',
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

    const targetArea = managementArea.replace('gerente_', '');
    const targetManager = users.find(u => u.funcao === 'gerente' && u.area === targetArea);

    if (!targetManager) {
      alert(`Erro: Nenhum gerente encontrado para a área "${targetArea}". Verifique o cadastro de usuários.`);
      return;
    }

    setIsEscalatingToManagement(true);
    try {
      const updateData = {
        status: 'aguardando_aprovacao',
        areaDeOrigem: ticket.area,
        gerenteResponsavelId: targetManager.uid,
        motivoEscalonamentoGerencial: managementReason,
        escaladoPor: user.uid,
        escaladoEm: new Date(),
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };

      const managementNames = {
        'gerente_operacional': 'Gerência Operacional',
        'gerente_comercial': 'Gerência Comercial',
        'gerente_producao': 'Gerência Produção',
        'gerente_financeiro': 'Gerência Financeira'
      };

      await ticketService.updateTicket(ticketId, updateData);

      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `👨‍💼 **Chamado escalado para ${managementNames[managementArea]}**\n\n**Motivo:** ${managementReason}\n\n**Gerente Responsável:** ${targetManager.nome}`,
        criadoEm: new Date(),
        type: 'management_escalation'
      };
      await messageService.sendMessage(ticketId, escalationMessage);

      try {
        await notificationService.notifyManagementEscalation(
          ticketId,
          ticket,
          targetManager.uid,
          user.uid,
          managementReason
        );
        console.log('✅ Notificação de escalação gerencial enviada');
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificação de escalação gerencial:', notificationError);
      }

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
      alert('Por favor, descreva o motivo da escalação para o consultor');
      return;
    }
    if (!project?.consultorId) {
      alert('Erro: Consultor do projeto não encontrado');
      return;
    }
    setIsEscalatingToConsultor(true);
    try {
      const updateData = {
        status: 'escalado_para_consultor',
        areaDeOrigem: ticket.area,
        consultorResponsavelId: project.consultorId,
        motivoEscalonamentoConsultor: consultorReason,
        escaladoPor: user.uid,
        escaladoEm: new Date(),
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `👨‍🎯 **Chamado escalado para CONSULTOR DO PROJETO**\n\n**Motivo:** ${consultorReason}\n\n**Área de Origem:** ${ticket.area?.replace('_', ' ').toUpperCase()}`,
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
      alert('Erro: Produtor do projeto não encontrado');
      return;
    }
    setUpdating(true);
    try {
      const updateData = {
        status: 'transferido_para_produtor',
        produtorResponsavelId: project.produtorId,
        transferidoPor: user.uid,
        transferidoEm: new Date(),
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      const transferMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `🏭 **Chamado transferido para PRODUTOR DO PROJETO**\n\nO chamado foi transferido para o produtor responsável para continuidade e finalização.`,
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
    if (!newStatus) return;
    await proceedWithStatusUpdate(newStatus);
  };
    
  const proceedWithStatusUpdate = async (statusToUpdate) => {
    if ((statusToUpdate === 'rejeitado' || statusToUpdate === 'enviado_para_area') && !conclusionDescription.trim()) {
      alert('Por favor, forneça um motivo para a rejeição/devolução');
      return;
    }
    setUpdating(true);
    try {
      let updateData = {};
      let systemMessageContent = '';
      
      updateData = { status: statusToUpdate, atualizadoPor: user.uid, updatedAt: new Date() };
      if (statusToUpdate === 'concluido') {
        updateData.conclusaoDescricao = conclusionDescription;
        updateData.conclusaoImagens = conclusionImages;
        updateData.concluidoEm = new Date();
        updateData.concluidoPor = user.uid;
        systemMessageContent = `✅ **Chamado concluído**\n\n**Descrição:** ${conclusionDescription}`;
      } else if (statusToUpdate === 'rejeitado') {
        updateData.motivoRejeicao = conclusionDescription;
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        systemMessageContent = `❌ **Chamado reprovado pelo gerente**\n\n**Motivo:** ${conclusionDescription}`;
      } else if (statusToUpdate === 'enviado_para_area') {
         if (!ticket.areaDeOrigem) {
           alert('Erro Crítico: A área de origem para devolução não foi encontrada.');
           setUpdating(false);
           return;
        }
        updateData.motivoRejeicao = conclusionDescription;
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        updateData.areaQueRejeitou = ticket.area;
        updateData.area = ticket.areaDeOrigem;
        systemMessageContent = `🔄 **Chamado devolvido para:** ${updateData.area.replace(/_/g, ' ')}\n\n**Motivo:** ${conclusionDescription}`;
      } else if (statusToUpdate === 'aprovado') {
          if (ticket.status === 'aguardando_aprovacao' && userProfile.funcao === 'gerente') {
              updateData.status = 'em_tratativa';
              updateData.area = ticket.areaDeOrigem || ticket.area;
              updateData.aprovadoEm = new Date();
              updateData.aprovadoPor = user.uid;
              systemMessageContent = `✅ **Chamado aprovado pelo gerente** e retornado para a área responsável.`;
          }
      } else if (statusToUpdate === 'executado_pelo_consultor') {
          updateData.area = ticket.areaDeOrigem;
          updateData.consultorResponsavelId = null; 
          systemMessageContent = `👨‍🎯 **Chamado executado pelo consultor e devolvido para:** ${ticket.areaDeOrigem?.replace('_', ' ').toUpperCase()}`;
      }
      else {
          systemMessageContent = `🔄 **Status atualizado para:** ${getStatusText(statusToUpdate)}`;
      }

      await ticketService.updateTicket(ticketId, updateData);
      const statusMessage = { userId: user.uid, remetenteNome: userProfile.nome || user.email, conteudo: systemMessageContent, criadoEm: new Date(), type: 'status_update' };
      await messageService.sendMessage(ticketId, statusMessage);
      await notificationService.notifyStatusChange(ticketId, ticket, updateData.status, ticket.status, user.uid);
      await loadTicketData();
      setNewStatus('');
      setConclusionDescription('');
      setConclusionImages([]);
      alert('Status atualizado com sucesso!');
    } catch (error) {
      alert('Erro ao atualizar status: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };
  
  const handleSendMessage = async () => {
    if (!newMessage.trim() && chatImages.length === 0) return;
    setSendingMessage(true);
    try {
      const messageData = { userId: user.uid, remetenteNome: userProfile.nome || user.email, conteudo: newMessage.trim(), imagens: chatImages, criadoEm: new Date(), type: 'user_message' };
      await messageService.sendMessage(ticketId, messageData);
      await notificationService.notifyNewMessage(ticketId, ticket, messageData, user.uid);
      await loadTicketData();
      setNewMessage('');
      setChatImages([]);
    } catch (error) {
      alert('Erro ao enviar mensagem: ' + error.message);
    } finally {
      setSendingMessage(false);
    }
  };
  
  const handleResubmitTicket = async () => {
    if (!additionalInfo.trim()) {
      alert('Por favor, preencha as informações solicitadas antes de reenviar.');
      return;
    }
    if (!ticket.areaQueRejeitou) {
      alert('Erro: Não foi possível identificar a área de destino para o reenvio.');
      return;
    }

    setIsResubmitting(true);
    try {
      const updateData = {
        status: 'aberto', 
        area: ticket.areaQueRejeitou,
        areaDeOrigem: ticket.area,
        areaQueRejeitou: null,
        descricao: `${ticket.descricao}\n\n--- INFORMAÇÕES ADICIONAIS (em ${new Date().toLocaleString('pt-BR')}) ---\n${additionalInfo}`,
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };

      await ticketService.updateTicket(ticketId, updateData);

      const resubmitMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `📬 **Chamado reenviado com informações adicionais para a área: ${ticket.areaQueRejeitou.replace('_', ' ').toUpperCase()}**\n\n**Informações adicionadas:**\n${additionalInfo}`,
        criadoEm: new Date(),
        type: 'status_update'
      };
      await messageService.sendMessage(ticketId, resubmitMessage);
      
      await loadTicketData();
      setAdditionalInfo('');
      alert('Chamado reenviado com sucesso!');

    } catch (error) {
      alert('Ocorreu um erro ao reenviar o chamado: ' + error.message);
    } finally {
      setIsResubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando chamado...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Erro ao Carregar</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

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
  const isArchived = ticket.status === 'arquivado';

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

        {parentTicketForLink && (
            <Card className="mb-6 bg-amber-50 border-amber-200">
                <CardHeader>
                    <CardTitle className="flex items-center text-base text-amber-900">
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Este chamado é vinculado ao Chamado Pai
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Link to={`/chamado/${parentTicketForLink.id}`} className="text-blue-600 hover:underline">
                        Ver Chamado Original: {parentTicketForLink.titulo}
                    </Link>
                </CardContent>
            </Card>
        )}

        {isArchived && (
          <Alert variant="default" className="mb-6 bg-gray-100 border-gray-300">
              <Archive className="h-4 w-4" />
              <AlertDescription>
                  Este chamado está arquivado e é somente para consulta. Para fazer alterações, é preciso desarquivá-lo.
              </AlertDescription>
          </Alert>
        )}

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

            {user && ticket.criadoPor === user.uid && ticket.status === 'enviado_para_area' && ticket.areaQueRejeitou && (
              <Card className="bg-yellow-50 border-yellow-300">
                <CardHeader>
                  <CardTitle className="flex items-center text-yellow-900">
                    <ClipboardEdit className="h-5 w-5 mr-2" />
                    Ação Necessária: Corrigir e Reenviar Chamado
                  </CardTitle>
                  <CardDescription className="text-yellow-800">
                    Este chamado foi devolvido pela área de{' '}
                    <strong className="font-semibold">{ticket.areaQueRejeitou.replace('_', ' ').toUpperCase()}</strong>. 
                    Por favor, adicione as informações solicitadas e reenvie.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {ticket.motivoRejeicao && (
                       <div className="p-3 bg-white border border-gray-200 rounded-md">
                         <Label className="text-xs font-medium text-gray-700">Motivo da Devolução</Label>
                         <p className="text-sm text-gray-800 whitespace-pre-wrap">{ticket.motivoRejeicao}</p>
                       </div>
                    )}
                    <div>
                      <Label htmlFor="additional-info" className="font-semibold text-gray-800">
                        Novas Informações / Correções *
                      </Label>
                      <Textarea
                        id="additional-info"
                        placeholder="Forneça aqui os detalhes ou correções solicitadas pela outra área..."
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                        rows={4}
                        className="mt-2"
                        disabled={isResubmitting}
                      />
                    </div>
                    <Button 
                      onClick={handleResubmitTicket} 
                      disabled={!additionalInfo.trim() || isResubmitting} 
                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      {isResubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Reenviar para {ticket.areaQueRejeitou.replace('_', ' ')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

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
                    <div className="relative">
                      <Textarea
                        ref={textareaRef}
                        placeholder={isArchived ? "Este chamado está arquivado e não permite novas mensagens." : "Digite sua mensagem..."}
                        value={newMessage}
                        onChange={handleTextareaChange}
                        onKeyDown={handleTextareaKeyDown}
                        rows={3}
                        disabled={isArchived || sendingMessage}
                      />
                      {showMentionSuggestions && mentionSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {mentionSuggestions.map((user, index) => (
                            <button
                              key={index}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center space-x-2"
                              onClick={() => insertMention(user)}
                            >
                              <AtSign className="h-4 w-4 text-gray-400" />
                              <span className="font-medium">{user.nome}</span>
                              <span className="text-sm text-gray-500">({user.email})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {!isArchived && (
                        <ImageUpload
                          onImagesUploaded={setChatImages}
                          existingImages={chatImages}
                          maxImages={3}
                          buttonText="Anexar ao Chat"
                          className="border-t pt-3"
                        />
                    )}
                    <div className="flex items-center justify-end">
                      <Button
                        onClick={handleSendMessage}
                        disabled={isArchived || sendingMessage || (!newMessage.trim() && chatImages.length === 0)}
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

            {!isArchived && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && (
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
                      <Label htmlFor="escalation-reason" className="text-base font-semibold">📝 Motivo *</Label>
                      <Textarea
                        id="escalation-reason"
                        value={escalationReason}
                        onChange={(e) => setEscalationReason(e.target.value)}
                        placeholder="Descreva o motivo pelo qual está enviando este chamado para outra área..."
                        className="mt-2 min-h-[100px] border-2 border-blue-300 focus:border-blue-500"
                      />
                    </div>
                    {escalationArea && escalationReason.trim() && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-semibold">✅ Pronto para enviar para: <span className="font-bold">{escalationArea}</span></p>
                      </div>
                    )}
                    <Button
                      onClick={handleEscalation}
                      disabled={!escalationArea || !escalationReason.trim() || isEscalating}
                      className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {isEscalating ? <><span className="animate-spin mr-2">⏳</span>Enviando...</> : <><span className="mr-2">🚀</span>Enviar para Área</>}
                    </Button>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">⚠️ <strong>Atenção:</strong> Ao enviar, o chamado será transferido para a área selecionada e sairá da sua lista de responsabilidades.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}


            {!isArchived && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && project?.consultorId && (userProfile.funcao === 'administrador' || ticket.area === userProfile.area) && (
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

            {!isArchived && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && (userProfile.funcao === 'administrador' || ticket.area === userProfile.area) && (
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

            {!isArchived && userProfile && userProfile.funcao === 'operador' && project?.produtorId && (
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
                {project && (
                  <div className="pt-3 mt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(`/projeto/${project.id}`)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Acessar Detalhes do Projeto
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {!isArchived && (
              <Card>
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <LinkIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Vincular Chamado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Crie um novo chamado para outra área que ficará vinculado a este.
                  </p>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => navigate('/novo-chamado', { state: { linkedTicketId: ticket.id } })}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Criar Chamado Vinculado
                  </Button>
                </CardContent>
              </Card>
            )}

            {!isArchived && availableStatuses.length > 0 && (
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
                  {(newStatus === 'concluido' || newStatus === 'rejeitado' || newStatus === 'enviado_para_area') && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="conclusion-description">
                          {newStatus === 'concluido' ? 'Descrição da Conclusão' : 'Motivo da Rejeição/Devolução'}
                        </Label>
                        <Textarea
                          id="conclusion-description"
                          placeholder={newStatus === 'concluido' ? "Descreva como o problema foi resolvido..." : "Explique o motivo..."}
                          value={conclusionDescription}
                          onChange={(e) => setConclusionDescription(e.target.value)}
                          rows={3}
                          className={(newStatus === 'rejeitado' || newStatus === 'enviado_para_area') ? "border-red-300 focus:border-red-500" : ""}
                        />
                        {(newStatus === 'rejeitado' || newStatus === 'enviado_para_area') && (
                          <p className="text-xs text-red-600 mt-1">* Campo obrigatório</p>
                        )}
                      </div>
                      {newStatus === 'concluido' && (
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
                    className={`w-full ${newStatus === 'rejeitado' || newStatus === 'enviado_para_area' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                    variant={newStatus === 'rejeitado' || newStatus === 'enviado_para_area' ? 'destructive' : 'default'}
                  >
                    {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    {updating ? 'Atualizando...' : 'Confirmar Ação'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {!isArchived && userProfile?.funcao === 'administrador' && ticket.status === 'concluido' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Archive className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Ações de Arquivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleArchiveTicket} disabled={updating} variant="outline" className="w-full">
                    {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
                    Arquivar Chamado
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Histórico do Chamado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {historyEvents.length > 0 ? (
                    historyEvents.map((event, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="flex flex-col items-center">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ${event.color}`}>
                            <event.Icon className="h-5 w-5" />
                          </span>
                          {index < historyEvents.length - 1 && (
                            <div className="h-6 w-px bg-gray-200" />
                          )}
                        </div>
                        <div className="flex-1 pt-1.5">
                          <p className="text-sm text-gray-800">
                            {event.description}{' '}
                            <span className="font-semibold text-gray-900">{event.userName}</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDate(event.date)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Nenhum evento de histórico registrado.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;


// ==== OBS: O terceiro arquivo enviado é do NewTicketForm, não TicketDetailPage_escalate_fix.jsx ====
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { projectService } from '../../services/projectService';
import { ticketService, TICKET_TYPES, PRIORITIES } from '../../services/ticketService';
import { userService, AREAS } from '../../services/userService';
import { imageService } from '../../services/imageService';
import { TICKET_CATEGORIES, getCategoriesByArea } from '../../constants/ticketCategories';
import notificationService from '../../services/notificationService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Upload, X, AlertCircle, Bot, Sparkles, RefreshCw, TrendingUp, Lock, Link as LinkIcon, Plus, Minus } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, getDoc, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

// A classe DynamicAITemplateService permanece inalterada
class DynamicAITemplateService {
  constructor() {
    this.templatesCollection = 'ai_templates';
    this.analyticsCollection = 'ai_analytics';
  }

  async loadAITemplates() {
    try {
      const templatesRef = collection(db, this.templatesCollection);
      const q = query(templatesRef, orderBy('confidence', 'desc'), limit(10));
      const snapshot = await getDocs(q);
      
      const templates = [];
      snapshot.forEach((doc) => {
        templates.push({ id: doc.id, ...doc.data() });
      });
      
      console.log('🤖 Templates IA carregados:', templates.length);
      return templates;
    } catch (error) {
      console.error('❌ Erro ao carregar templates IA:', error);
      return [];
    }
  }

  async analyzeAndUpdateTemplates() {
    try {
      console.log('🔍 Iniciando análise automática de chamados...');
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const ticketsRef = collection(db, 'tickets');
      const q = query(
        ticketsRef, 
        where('createdAt', '>=', thirtyDaysAgo),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      const tickets = [];
      snapshot.forEach((doc) => {
        tickets.push({ id: doc.id, ...doc.data() });
      });
      
      console.log('📊 Chamados analisados:', tickets.length);
      
      const patterns = {};
      tickets.forEach(ticket => {
        const key = `${ticket.area}_${ticket.tipo}`;
        if (!patterns[key]) {
          patterns[key] = {
            area: ticket.area,
            tipo: ticket.tipo,
            titles: [],
            descriptions: [],
            priorities: [],
            count: 0
          };
        }
        
        patterns[key].titles.push(ticket.titulo);
        patterns[key].descriptions.push(ticket.descricao);
        patterns[key].priorities.push(ticket.prioridade);
        patterns[key].count++;
      });
      
      const newTemplates = [];
      Object.entries(patterns).forEach(([key, pattern]) => {
        if (pattern.count >= 3) {
          const template = this.generateTemplateFromPattern(key, pattern);
          if (template) {
            newTemplates.push(template);
          }
        }
      });
      
      for (const template of newTemplates) {
        await this.saveTemplate(template);
      }
      
      console.log('✅ Templates atualizados:', newTemplates.length);
      return newTemplates;
    } catch (error) {
      console.error('❌ Erro na análise automática:', error);
      return [];
    }
  }

  generateTemplateFromPattern(key, pattern) {
    try {
      const mostCommonTitle = this.getMostCommonPhrase(pattern.titles);
      const mostCommonPriority = this.getMostCommon(pattern.priorities);
      const commonPhrases = this.extractCommonPhrases(pattern.descriptions);
      
      const template = {
        id: `auto_${key}_${Date.now()}`,
        area: pattern.area,
        tipo: pattern.tipo,
        titulo: mostCommonTitle || `Solicitação ${pattern.area}`,
        descricao: this.generateDescriptionTemplate(pattern.area, pattern.tipo, commonPhrases),
        prioridade: mostCommonPriority || 'media',
        confidence: Math.min(pattern.count / 10, 1),
        isAutoGenerated: true,
        createdAt: new Date(),
        usageCount: 0,
        icon: this.getIconForArea(pattern.area),
        tags: [pattern.area, pattern.tipo, 'auto-generated']
      };
      
      return template;
    } catch (error) {
      console.error('❌ Erro ao gerar template:', error);
      return null;
    }
  }

  getMostCommon(array) {
    const counts = {};
    array.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
  }

  getMostCommonPhrase(titles) {
    const words = titles.join(' ').toLowerCase().split(/\s+/);
    const phrases = [];
    
    for (let i = 0; i < words.length - 2; i++) {
      phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
    }
    
    return this.getMostCommon(phrases);
  }

  generateDescriptionTemplate(area, tipo, commonPhrases) {
    const templates = {
      'comunicacao_visual': {
        'arte_grafica': `Solicitação de arte gráfica.\n\nTipo: [ESPECIFICAR_TIPO]\nFormato: [DIMENSÕES]\nPrazo: [DATA_ENTREGA]\n\nDescrição detalhada:\n[DETALHES_DA_ARTE]`,
        'impressao': `Solicitação de impressão.\n\nMaterial: [TIPO_MATERIAL]\nQuantidade: [QTD]\nFormato: [TAMANHO]\nAcabamento: [ESPECIFICAR]`,
        'sinalizacao': `Solicitação de sinalização.\n\nTipo: [PLACA/BANNER/ADESIVO]\nLocal: [ONDE_INSTALAR]\nTexto: [CONTEÚDO]\nDimensões: [TAMANHO]`
      },
      'almoxarifado': {
        'pedido_material': `Solicitação de material do almoxarifado.\n\nMaterial: [TIPO_MATERIAL]\nQuantidade: [QTD]\nLocal de entrega: [LOCAL]\nPrazo: [DATA_NECESSÁRIA]\n\nJustificativa:\n[MOTIVO_DA_SOLICITAÇÃO]`,
        'pedido_mobiliario': `Pedido de mobiliário.\n\nItem: [ESPECIFICAR_MOBILIÁRIO]\nQuantidade: [QTD]\nLocal: [DESTINO]`
      }
    };
    
    return templates[area]?.[tipo] || `Solicitação relacionada a ${area} - ${tipo}.\n\nDescrição: [ESPECIFICAR]\nPrazo: [DATA]\nObservações: [INFORMAÇÕES_ADICIONAIS]`;
  }

  extractCommonPhrases(descriptions) {
    const allText = descriptions.join(' ').toLowerCase();
    const phrases = allText.match(/\b\w+\s+\w+\s+\w+\b/g) || [];
    
    const phraseCount = {};
    phrases.forEach(phrase => {
      phraseCount[phrase] = (phraseCount[phrase] || 0) + 1;
    });
    
    return Object.entries(phraseCount)
      .filter(([phrase, count]) => count > 1)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([phrase]) => phrase);
  }

  getIconForArea(area) {
    const icons = {
      'comunicacao_visual': '🎨',
      'producao': '🔧',
      'almoxarifado': '📦',
      'operacional': '⚙️',
      'logistica': '🚚',
      'locacao': '🏢',
      'compras': '🛒',
      'financeiro': '💰'
    };
    return icons[area] || '📋';
  }

  async saveTemplate(template) {
    try {
      const templateRef = doc(db, this.templatesCollection, template.id);
      await setDoc(templateRef, template);
      console.log('✅ Template salvo:', template.id);
    } catch (error) {
      console.error('❌ Erro ao salvar template:', error);
    }
  }

  async recordTemplateUsage(templateId, success = true) {
    try {
      const usageRef = doc(db, 'ai_template_usage', `${templateId}_${Date.now()}`);
      await setDoc(usageRef, {
        templateId,
        success,
        usedAt: new Date(),
        userId: 'current_user'
      });
    } catch (error) {
      console.error('❌ Erro ao registrar uso:', error);
    }
  }
}

const NewTicketForm = ({ projectId, onClose, onSuccess }) => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    area: '',
    tipo: '',
    prioridade: 'media',
    isExtra: false,
    motivoExtra: '',
    isConfidential: false,
    observacoes: ''
  });
  
  const [projects, setProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]); // ✅ MUDANÇA: Array para múltiplos projetos
  const [selectedEvent, setSelectedEvent] = useState('');
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState('');
  const [availableTypes, setAvailableTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState([]);
  
  const [aiTemplates, setAiTemplates] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiService] = useState(new DynamicAITemplateService());
  const [selectedAITemplate, setSelectedAITemplate] = useState('');
  
  const [linkedTicket, setLinkedTicket] = useState(null);
  const [loadingLinkedTicket, setLoadingLinkedTicket] = useState(true);

  useEffect(() => {
    const linkedTicketId = location.state?.linkedTicketId;
    if (linkedTicketId) {
      const fetchLinkedTicket = async () => {
        try {
          const ticketData = await ticketService.getTicketById(linkedTicketId);
          if (ticketData) {
            const projectData = await projectService.getProjectById(ticketData.projetoId);
            setLinkedTicket({ 
              ...ticketData, 
              projectName: projectData?.nome || 'N/A', 
              eventName: projectData?.feira || 'N/A' 
            });
            if (projectData) {
              setSelectedEvent(projectData.feira);
              setSelectedProjects([projectData.id]); // ✅ MUDANÇA: Array
            }
          }
        } catch (err) {
          console.error("Erro ao buscar chamado vinculado:", err);
        } finally {
          setLoadingLinkedTicket(false);
        }
      };
      fetchLinkedTicket();
    } else {
      setLoadingLinkedTicket(false);
    }
  }, [location.state]);

  useEffect(() => {
    loadProjects();
    loadAITemplates();
  }, []);

  const loadAITemplates = async () => {
    setLoadingAI(true);
    try {
      const templates = await aiService.loadAITemplates();
      setAiTemplates(templates);
    } catch (error) {
      console.error('❌ Erro ao carregar templates IA:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const updateAITemplates = async () => {
    setLoadingAI(true);
    try {
      await aiService.analyzeAndUpdateTemplates();
      await loadAITemplates();
    } catch (error) {
      console.error('❌ Erro ao atualizar templates IA:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  useEffect(() => {
    if (formData.area) {
      loadTypesByArea(formData.area);
      // ✅ MUDANÇA: Remover filtro do produtor - carregar operadores para to      loadOperatorsByArea(formData.area);
    } else {
      setAvailableTypes([]);
      setOperators([]);
      setSelectedOperator('');
    }
  }, [formData.area]);

  const loadProjects = async () => {
    try {
      const projectsData = await projectService.getAllProjects();
      let filteredProjects = [];
      
      if (userProfile?.funcao === 'administrador' || userProfile?.funcao === 'gerente' || userProfile?.funcao === 'operador') {
        filteredProjects = projectsData.filter(project => project.status !== 'encerrado');
      } else if (userProfile?.funcao === 'consultor') {
        const userId = userProfile.id || user.uid;
        filteredProjects = projectsData.filter(project => {
          const isAssigned = project.consultorId === userId ||
                            project.consultorUid === userId ||
                            project.consultorEmail === (userProfile.email || user.email) ||
                            project.consultorNome === userProfile.nome;
          return isAssigned && project.status !== 'encerrado';
        });
      } else if (userProfile?.funcao === 'produtor') {
        const userId = userProfile.id || user.uid;
        filteredProjects = projectsData.filter(project => {
          const isAssigned = project.produtorId === userId || 
                            project.produtorUid === userId ||
                            project.produtorEmail === userProfile.email ||
                            project.produtorNome === userProfile.nome;
          return isAssigned && project.status !== 'encerrado';
        });
      }
      
      setProjects(filteredProjects);
      
      if (projectId) {
        const project = filteredProjects.find(p => p.id === projectId);
        if (project) {
          setSelectedEvent(project.feira);
          setSelectedProjects([projectId]); // ✅ MUDANÇA: Array
        }
      }
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      setError('Erro ao carregar projetos');
    }
  };

  const loadTypesByArea = async (area) => {
    try {
      const categories = getCategoriesByArea(area);
      setAvailableTypes(categories);
    } catch (error) {
      console.error('Erro ao carregar tipos:', error);
    }
  };

  const loadOperatorsByArea = async (area) => {
    try {
      const users = await userService.getAllUsers();
      const areaOperators = users.filter(user => 
        user.funcao === 'operador' && 
        user.area === area && 
        user.ativo !== false
      );
      setOperators(areaOperators);
    } catch (error) {
      console.error('Erro ao carregar operadores:', error);
    }
  };

  const getUniqueEvents = () => {
    const events = [...new Set(projects.map(project => project.feira))];
    return events.filter(event => event);
  };

  const getProjectsByEvent = (event) => {
    return projects.filter(project => project.feira === event);
  };

  const handleEventChange = (event) => {
    setSelectedEvent(event);
    setSelectedProjects([]); // ✅ MUDANÇA: Limpar array de projetos
  };

  // ✅ NOVA FUNÇÃO: Gerenciar seleção múltipla de projetos
  const handleProjectToggle = (projectId) => {
    setSelectedProjects(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const applyAITemplate = (template) => {
    setFormData(prev => ({
      ...prev,
      titulo: template.titulo,
      descricao: template.descricao,
      area: template.area,
      tipo: template.tipo,
      prioridade: template.prioridade
    }));
    setSelectedAITemplate(template.id);
    aiService.recordTemplateUsage(template.id, true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.titulo.trim() || !formData.descricao.trim() || !formData.area || !formData.tipo) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    if (selectedProjects.length === 0) { // ✅ MUDANÇA: Verificar array
      setError('Selecione pelo menos um projeto');
      return;
    }

    if (formData.isExtra && !formData.motivoExtra.trim()) {
      setError('Informe o motivo do item extra');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let ticketId;
      
      // ✅ MUDANÇA: Criar chamado para múltiplos projetos
      const baseTicketData = {
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim(),
        area: formData.area,
        tipo: formData.tipo,
        prioridade: formData.prioridade,
        status: 'aberto',
        criadoPor: user.uid,
        criadoPorNome: userProfile?.nome || user.email,
        criadoPorFuncao: userProfile?.funcao || 'usuario',
        criadoEm: new Date(),
        itemExtra: formData.isExtra,
        motivoItemExtra: formData.isExtra ? formData.motivoExtra.trim() : null,
        confidencial: formData.isConfidential,
        observacoes: formData.observacoes.trim() || null,
        projetos: selectedProjects.map(pid => ({ id: pid, titulo: formData.titulo.trim(), tipo: formData.tipo, status: 'aberto', responsavelAtual: formData.area })), // ✅ MUDANÇA: array de objetos
        linkedTicketId: linkedTicket?.id || null,
        areaDeOrigem: formData.area
      };

      // Para compatibilidade, usar o primeiro projeto como principal
      const mainProject = projects.find(p => p.id === selectedProjects[0]);
      if (mainProject) {
        baseTicketData.projetoId = mainProject.id;
        baseTicketData.projetoNome = mainProject.nome;
        baseTicketData.evento = mainProject.feira;
      }

      // Regra: Consultor abre para Produção com tipo manutenção (tapeçaria/eléctrica/marcenaria) -> vai ao PRODUTOR iniciar tratativa
                  const isConsultor = (userProfile?.funcao === 'consultor');
      const isProducao = (formData.area === AREAS.PRODUCTION);
      const tipoRaw = (formData.tipo || '').toString();
      const tipoNorm = tipoRaw.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
      const targets = ['manutencao_tapecaria','manutencao_eletrica','manutencao_marcenaria'];
      const tipoComp = tipoNorm.replace(/[^a-z0-9_]/g,'_');
      const isMaintenanceType = isProducao && targets.some(k => tipoComp.includes(k));
      baseTicketData.areaInicial = formData.area;
      if (isConsultor && isMaintenanceType) {
        baseTicketData.status = 'transferido_para_produtor';
        baseTicketData.area = AREAS.PRODUCTION;
        baseTicketData.transferidoPor = user.uid;
        baseTicketData.transferidoEm = new Date();
        if (mainProject?.produtorId) baseTicketData.produtorResponsavelId = mainProject.produtorId;
        // Ajusta a lista de projetos para refletir o responsável correto
        baseTicketData.projetos = baseTicketData.projetos.map(p => ({ ...p, status: 'transferido_para_produtor', responsavelAtual: 'produtor' }));
      }


      // Atribuição manual: se um operador foi escolhido pelo criador
      if (selectedOperator) {
        Object.assign(baseTicketData, {
          atribuidoA: selectedOperator,
          atribuidoEm: new Date(),
          atribuidoPor: user.uid
        });
      }

      // Histórico inicial respeitando o status definido
      baseTicketData.historicoStatus = [{
        comentario: 'Chamado criado',
        data: new Date(),
        novoStatus: baseTicketData.status,
        responsavel: user.uid,
        statusAnterior: null
      }];
      
      ticketId = await ticketService.createTicket(baseTicketData);

      try {
        await notificationService.notifyNewTicket(ticketId, baseTicketData, user.uid);
      } catch (notificationError) {
        console.error('Falha não-crítica ao enviar notificação:', notificationError);
      }
      
      setTimeout(() => updateAITemplates(), 2000);

      if (images.length > 0) {
        try {
          const uploadedImages = await imageService.uploadMultipleImages(images.map(img => img.file), ticketId);
          await ticketService.updateTicket(ticketId, {
            imagens: uploadedImages.map(img => ({ url: img.url, name: img.name, path: img.path }))
          });
        } catch (uploadError) {
          alert('Chamado criado com sucesso, mas houve erro no upload das imagens.');
        }
      }
      
      if (onSuccess) {
        onSuccess(ticketId);
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Erro ao criar chamado:', error);
      setError('Erro ao criar chamado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  const areaOptions = [
    { value: AREAS.LOGISTICS, label: 'Logística' },
    { value: AREAS.WAREHOUSE, label: 'Almoxarifado' },
    { value: AREAS.VISUAL_COMMUNICATION, label: 'Comunicação Visual' },
    { value: AREAS.RENTAL, label: 'Locação' },
    { value: AREAS.PURCHASES, label: 'Compras' },
    { value: AREAS.PRODUCTION, label: 'Produção' },
    { value: AREAS.OPERATIONS, label: 'Operacional' },
    { value: AREAS.FINANCIAL, label: 'Financeiro' },
    { value: AREAS.PROJECTS, label: 'Projetos' },
    { value: AREAS.LOGOTIPIA, label: 'Logotipia' },
    { value: 'detalhamento_tecnico', label: 'Detalhamento Técnico' },
    { value: 'sub_locacao', label: 'Sub-locação' }
  ];

  const priorityOptions = [
    { value: PRIORITIES.LOW, label: 'Baixa', color: 'bg-gray-100 text-gray-800' },
    { value: PRIORITIES.MEDIUM, label: 'Média', color: 'bg-yellow-100 text-yellow-800' },
    { value: PRIORITIES.HIGH, label: 'Alta', color: 'bg-orange-100 text-orange-800' },
    { value: PRIORITIES.URGENT, label: 'Urgente', color: 'bg-red-100 text-red-800' }
  ];

  if (loadingLinkedTicket) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Novo Chamado
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          Preencha os dados para criar um novo chamado
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {linkedTicket && (
          <Card className="mb-6 bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center text-base text-amber-900">
                <LinkIcon className="h-4 w-4 mr-2" />
                Chamado Vinculado
              </CardTitle>
              <CardDescription>
                Este novo chamado será vinculado ao chamado abaixo.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>Título Original:</strong> {linkedTicket.titulo}</p>
              <p><strong>Projeto:</strong> {linkedTicket.projectName}</p>
              <p><strong>Evento:</strong> {linkedTicket.eventName}</p>
              <p><strong>ID do Chamado Original:</strong> 
                <Link to={`/chamado/${linkedTicket.id}`} className="text-blue-600 hover:underline ml-1">
                  {linkedTicket.id}
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="event">Selecione o Evento *</Label>
            <Select value={selectedEvent} onValueChange={handleEventChange} disabled={!!linkedTicket}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o evento" />
              </SelectTrigger>
              <SelectContent>
                {getUniqueEvents().map((event) => (
                  <SelectItem key={event} value={event}>
                    🎯 {event}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ✅ NOVA SEÇÃO: Seleção múltipla de projetos */}
          <div className="space-y-2">
            <Label htmlFor="projects">Selecione os Projetos * (múltipla seleção)</Label>
            <div className="text-sm text-gray-600 mb-2">
              Selecione um ou mais projetos para este chamado. Útil para compras em quantidade e divisão de centro de custo.
            </div>
            
            {selectedEvent ? (
              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                {getProjectsByEvent(selectedEvent).map((project) => (
                  <div key={project.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                    <Checkbox
                      id={`project-${project.id}`}
                      checked={selectedProjects.includes(project.id)}
                      onCheckedChange={() => handleProjectToggle(project.id)}
                      disabled={!!linkedTicket}
                    />
                    <label 
                      htmlFor={`project-${project.id}`} 
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{project.nome}</span>
                        <span className="text-xs text-gray-500">• {project.local}</span>
                      </div>
                      {project.produtorNome && (
                        <div className="text-xs text-gray-500 mt-1">
                          Produtor: {project.produtorNome}
                        </div>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border rounded-lg p-4 text-center text-gray-500">
                Primeiro selecione um evento
              </div>
            )}
            
            {/* Projetos selecionados */}
            {selectedProjects.length > 0 && (
              <div className="mt-3 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-blue-800">📋 Projetos Selecionados ({selectedProjects.length})</h4>
                  <Badge variant="secondary">{selectedEvent}</Badge>
                </div>
                <div className="space-y-2">
                  {selectedProjects.map(projectId => {
                    const project = projects.find(p => p.id === projectId);
                    return project ? (
                      <div key={projectId} className="flex items-center justify-between bg-white p-2 rounded border">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{project.nome}</div>
                          <div className="text-xs text-gray-500">{project.local} • {project.metragem}</div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleProjectToggle(projectId)}
                          disabled={!!linkedTicket}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="area">Área de Destino *</Label>
            <Select value={formData.area} onValueChange={(value) => handleInputChange('area', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a área" />
              </SelectTrigger>
              <SelectContent>
                {areaOptions.map((area) => (
                  <SelectItem key={area.value} value={area.value}>
                    {area.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.area && availableTypes.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Solicitação *</Label>
              <Select value={formData.tipo} onValueChange={(value) => handleInputChange('tipo', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ✅ MUDANÇA: Mostrar operadores para todas as áreas */}
          {operators.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="operator">Operador Responsável (opcional)</Label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um operador" />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((operator) => (
                    <SelectItem key={operator.id} value={operator.id}>
                      {operator.nome} - {operator.area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => handleInputChange('titulo', e.target.value)}
              placeholder="Título do chamado"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleInputChange('descricao', e.target.value)}
              placeholder="Descreva detalhadamente a solicitação"
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prioridade">Prioridade</Label>
            <Select value={formData.prioridade} onValueChange={(value) => handleInputChange('prioridade', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    <div className="flex items-center space-x-2">
                      <Badge className={priority.color}>{priority.label}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isExtra"
              checked={formData.isExtra}
              onCheckedChange={(checked) => handleInputChange('isExtra', checked)}
            />
            <Label htmlFor="isExtra">Item Extra</Label>
          </div>

          {formData.isExtra && (
            <div className="space-y-2">
              <Label htmlFor="motivoExtra">Motivo do Item Extra *</Label>
              <Textarea
                id="motivoExtra"
                value={formData.motivoExtra}
                onChange={(e) => handleInputChange('motivoExtra', e.target.value)}
                placeholder="Explique o motivo deste item ser considerado extra"
                rows={2}
                required
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="isConfidential"
              checked={formData.isConfidential}
              onCheckedChange={(checked) => handleInputChange('isConfidential', checked)}
            />
            <Label htmlFor="isConfidential" className="flex items-center">
              <Lock className="h-4 w-4 mr-1" />
              Chamado Confidencial
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações Adicionais</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => handleInputChange('observacoes', e.target.value)}
              placeholder="Informações adicionais (opcional)"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="images">Anexar Imagens</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('images').click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Selecionar Imagens
              </Button>
            </div>
            
            {images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={image.preview}
                      alt={image.name}
                      className="w-full h-24 object-cover rounded border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Templates IA */}
          {aiTemplates.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label>🤖 Templates Inteligentes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={updateAITemplates}
                  disabled={loadingAI}
                >
                  {loadingAI ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {aiTemplates.slice(0, 4).map((template) => (
                  <Button
                    key={template.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyAITemplate(template)}
                    className="text-left justify-start h-auto p-3"
                  >
                    <div className="flex items-start space-x-2">
                      <span className="text-lg">{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs truncate">{template.titulo}</div>
                        <div className="text-xs text-gray-500 truncate">{template.area} • {template.tipo}</div>
                        <div className="flex items-center mt-1">
                          <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                          <span className="text-xs text-green-600">{Math.round(template.confidence * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose || (() => navigate('/dashboard'))}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Chamado'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default NewTicketForm;

