import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService } from '@/services/ticketService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { messageService } from '@/services/messageService';
import notificationService from '@/services/notificationService';
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
  User,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
  PlusCircle,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Archive,
  ArchiveRestore,
  Link as LinkIcon,
  ClipboardEdit,
  Users,
  History,
  FolderOpen,
  Folder,
  AlertTriangle,
  Paperclip,
  ExternalLink,
  Loader2
} from 'lucide-react';

const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  // Estados unificados
  const [ticket, setTicket] = useState(null);
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [users, setUsers] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [parentTicketForLink, setParentTicketForLink] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatImages, setChatImages] = useState([]);
  const [newStatus, setNewStatus] = useState('');
  const [conclusionDescription, setConclusionDescription] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [showAreaSelector, setShowAreaSelector] = useState(false);
  const [escalationArea, setEscalationArea] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);
  const [managementArea, setManagementArea] = useState('');
  const [managementReason, setManagementReason] = useState('');
  const [isEscalatingToManagement, setIsEscalatingToManagement] = useState(false);
  const [consultorReason, setConsultorReason] = useState('');
  const [isEscalatingToConsultor, setIsEscalatingToConsultor] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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

      // Carregar chamado pai se existir
      if (ticketData.chamadoPaiId) {
        const parentTicketData = await ticketService.getTicketById(ticketData.chamadoPaiId);
        setParentTicketForLink(parentTicketData);
      }

      // Carregar projetos (suporte a múltiplos projetos)
      const projectsToLoad = [];
      
      // Formato antigo (projeto único)
      if (ticketData.projetoId) {
        try {
          const projectData = await projectService.getProjectById(ticketData.projetoId);
          if (projectData) {
            projectsToLoad.push(projectData);
          }
        } catch (err) {
          console.warn("Erro ao carregar projeto único:", err);
        }
      }
      // Formato novo (múltiplos projetos)
      else if (ticketData.projetos?.length > 0) {
        try {
          const projectsData = await Promise.allSettled(
            ticketData.projetos.map(projectId => {
              if (!projectId || typeof projectId !== 'string') return null;
              return projectService.getProjectById(projectId);
            })
          );
          
          projectsData.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
              projectsToLoad.push(result.value);
            }
          });
        } catch (err) {
          console.warn("Erro ao carregar múltiplos projetos:", err);
        }
      }

      setProjects(projectsToLoad);

      // Carregar mensagens
      try {
        const messagesData = await messageService.getMessagesByTicket(ticketId);
        setMessages(messagesData || []);
      } catch (err) {
        console.warn("Erro ao carregar mensagens:", err);
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
      loadUsers();
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
      console.error('Erro ao marcar notificações como lidas:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const usersData = await userService.getAllUsers();
      setUsers(usersData || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
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
            color: 'text-blue-500' 
          }); 
        }
        if (ticket.escaladoEm && ticket.motivoEscalonamentoGerencial) { 
          events.push({ 
            date: ticket.escaladoEm, 
            description: 'Escalado para gerência por', 
            userName: getUserNameById(ticket.escaladoPor),
            color: 'text-purple-500' 
          }); 
        }
        if (ticket.aprovadoEm) { 
          events.push({ 
            date: ticket.aprovadoEm, 
            description: 'Aprovado por', 
            userName: getUserNameById(ticket.aprovadoPor),
            color: 'text-green-500' 
          }); 
        }
        if (ticket.rejeitadoEm) { 
          events.push({ 
            date: ticket.rejeitadoEm, 
            description: 'Rejeitado / Devolvido por', 
            userName: getUserNameById(ticket.rejeitadoPor),
            color: 'text-red-500' 
          }); 
        }
        if (ticket.concluidoEm) { 
          events.push({ 
            date: ticket.concluidoEm, 
            description: 'Concluído por', 
            userName: getUserNameById(ticket.concluidoPor),
            color: 'text-green-600' 
          }); 
        }
        
        // Ordenar eventos por data
        const sortedEvents = events.sort((a, b) => 
          (a.date.toDate ? a.date.toDate() : new Date(a.date)) - 
          (b.date.toDate ? b.date.toDate() : new Date(b.date))
        );
        
        setHistoryEvents(sortedEvents);
    }
  }, [ticket, users]);

  const formatDate = (date) => {
    if (!date) return 'Data não disponível';
    try {
      let dateObj = (date.toDate && typeof date.toDate === 'function') 
        ? date.toDate() 
        : new Date(date);
      
      if (isNaN(dateObj.getTime())) return 'Data inválida';
      
      return dateObj.toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
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

    if (isCreator && currentStatus === 'enviado_para_area' && ticket.rejectedAt) {
      return [
        { value: 'cancelado', label: 'Cancelar Chamado', description: 'Cancelar este chamado' }
      ];
    }

    if (isCreator && (currentStatus === 'executado_aguardando_validacao' || currentStatus === 'executado_aguardando_validacao_operador')) {
        return [ 
          { value: 'concluido', label: 'Validar e Concluir' }, 
          { value: 'enviado_para_area', label: 'Rejeitar / Devolver' } 
        ];
    }

    if (userRole === 'administrador') {
      if (currentStatus === 'aberto' || currentStatus === 'escalado_para_outra_area' || currentStatus === 'enviado_para_area') 
        return [ { value: 'em_tratativa', label: 'Iniciar Tratativa' } ];
      
      if (currentStatus === 'em_tratativa') 
        return [ { value: 'executado_aguardando_validacao', label: 'Executado' } ];
      
      if (currentStatus === 'executado_aguardando_validacao' && !isCreator) 
        return [ { value: 'concluido', label: 'Forçar Conclusão (Admin)' } ];
      
      if (currentStatus === 'aguardando_aprovacao') 
        return [ { value: 'aprovado', label: 'Aprovar' }, { value: 'rejeitado', label: 'Reprovar' } ];
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() && chatImages.length === 0) return;
    setSendingMessage(true);
    try {
      const messageData = { 
        userId: user.uid, 
        remetenteNome: userProfile?.nome || user.email, 
        conteudo: newMessage.trim(), 
        imagens: chatImages, 
        criadoEm: new Date(), 
        type: 'user_message' 
      };
      
      await messageService.sendMessage(ticketId, messageData);
      
      // Notificar participantes
      await notificationService.notifyNewMessage(
        ticketId, 
        ticket, 
        messageData, 
        user.uid
      );
      
      setNewMessage('');
      setChatImages([]);
      await loadTicketData();
    } catch (error) {
      alert('Erro ao enviar mensagem: ' + error.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const proceedWithStatusUpdate = async (statusToUpdate) => {
    if ((statusToUpdate === 'rejeitado' || statusToUpdate === 'enviado_para_area') && !conclusionDescription.trim()) {
      alert('Por favor, forneça um motivo para a rejeição/devolução');
      return;
    }
    
    setUpdating(true);
    try {
      let updateData = { 
        status: statusToUpdate, 
        atualizadoPor: user.uid, 
        updatedAt: new Date() 
      };
      
      let systemMessageContent = `🔄 Status atualizado para: ${getStatusText(statusToUpdate)}`;

      if (statusToUpdate === 'concluido') {
        updateData.conclusaoDescricao = conclusionDescription;
        updateData.concluidoEm = new Date();
        updateData.concluidoPor = user.uid;
        systemMessageContent = `✅ Chamado concluído: ${conclusionDescription}`;
      } 
      else if (statusToUpdate === 'rejeitado') {
        updateData.motivoRejeicao = conclusionDescription;
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        systemMessageContent = `❌ Chamado reprovado: ${conclusionDescription}`;
      } 
      else if (statusToUpdate === 'enviado_para_area') {
        if (!ticket.areaDeOrigem) {
          throw new Error('A área de origem para devolução não foi encontrada.');
        }
        updateData.motivoRejeicao = conclusionDescription;
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        updateData.areaQueRejeitou = ticket.area;
        updateData.area = ticket.areaDeOrigem;
        systemMessageContent = `🔄 Chamado devolvido para ${updateData.area}: ${conclusionDescription}`;
      } 
      else if (statusToUpdate === 'aprovado' && userProfile.funcao === 'gerente') {
        updateData.status = 'em_tratativa';
        updateData.area = ticket.areaDeOrigem || ticket.area;
        updateData.aprovadoEm = new Date();
        updateData.aprovadoPor = user.uid;
        systemMessageContent = `✅ Chamado aprovado pelo gerente.`;
      } 
      else if (statusToUpdate === 'executado_pelo_consultor') {
        updateData.area = ticket.areaDeOrigem;
        updateData.consultorResponsavelId = null; 
        systemMessageContent = `👨‍🎯 Chamado executado pelo consultor e devolvido para a área de origem.`;
      }

      await ticketService.updateTicket(ticketId, updateData);
      
      // Enviar mensagem de sistema
      await messageService.sendMessage(ticketId, { 
        userId: user.uid, 
        remetenteNome: 'Sistema', 
        conteudo: systemMessageContent, 
        criadoEm: new Date(), 
        type: 'status_update' 
      });
      
      // Notificar mudança de status
      await notificationService.notifyStatusChange(
        ticketId, 
        ticket, 
        updateData.status, 
        ticket.status, 
        user.uid
      );
      
      setNewStatus('');
      setConclusionDescription('');
      await loadTicketData();
    } catch (error) {
      alert('Erro ao atualizar status: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    await proceedWithStatusUpdate(newStatus);
  };

  const handleConsultorEscalation = async () => {
    const mainProject = projects.length > 0 ? projects[0] : null;
    if (!consultorReason.trim()) {
      alert('Por favor, descreva o motivo da escalação para o consultor');
      return;
    }
    if (!mainProject?.consultorId) {
      alert('Erro: Consultor do projeto não encontrado');
      return;
    }
    
    setIsEscalatingToConsultor(true);
    try {
      const updateData = {
        status: 'escalado_para_consultor',
        areaDeOrigem: ticket.area,
        consultorResponsavelId: mainProject.consultorId,
        motivoEscalonamentoConsultor: consultorReason,
        escaladoPor: user.uid,
        escaladoEm: new Date(),
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      
      await ticketService.updateTicket(ticketId, updateData);
      setConsultorReason('');
      await loadTicketData();
    } catch (error) {
      alert('Erro ao escalar para consultor: ' + error.message);
    } finally {
      setIsEscalatingToConsultor(false);
    }
  };

  const handleResubmitTicket = async () => {
    if (!additionalInfo.trim() || !ticket.areaQueRejeitou) {
      alert('Informações insuficientes para o reenvio.');
      return;
    }
    
    setIsResubmitting(true);
    try {
      const updateData = {
        status: 'aberto', 
        area: ticket.areaQueRejeitou,
        areaDeOrigem: ticket.area,
        areaQueRejeitou: null,
        descricao: `${ticket.descricao}\n\n--- INFORMAÇÕES ADICIONAIS ---\n${additionalInfo}`,
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      
      await ticketService.updateTicket(ticketId, updateData);
      setAdditionalInfo('');
      await loadTicketData();
    } catch (error) {
      alert('Ocorreu um erro ao reenviar o chamado: ' + error.message);
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleCreateLinkedTicket = () => {
    if (!ticket) return;
    
    const linkedTicketData = {
      linkedTicketId: ticketId,
      linkedTicketTitle: ticket.titulo,
      linkedTicketDescription: ticket.descricao,
      linkedTicketCreator: ticket.criadoPorNome,
      linkedTicketArea: ticket.area,
      linkedTicketProject: projects.length > 0 ? projects[0]?.nome : '',
      linkedTicketEvent: projects.length > 0 ? projects[0]?.evento : ''
    };

    navigate('/novo-chamado', { state: linkedTicketData });
  };

  const handleRejectTicket = async () => {
    if (!rejectReason.trim()) {
      alert('Por favor, informe o motivo da rejeição/devolução.');
      return;
    }

    try {
      const updateData = {
        status: 'enviado_para_area',
        rejectReason: rejectReason,
        rejectedAt: new Date(),
        rejectedBy: user.uid,
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      await ticketService.updateTicket(ticketId, updateData);
      
      // Notificar o criador
      if (ticket.criadoPor !== user.uid) {
        await notificationService.createNotification({
          userId: ticket.criadoPor,
          type: 'ticket_rejected',
          title: 'Chamado Rejeitado/Devolvido',
          message: `Seu chamado "${ticket.titulo}" foi rejeitado/devolvido. Motivo: ${rejectReason}`,
          ticketId: ticketId
        });
      }

      setShowRejectModal(false);
      setRejectReason('');
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao rejeitar chamado:', error);
      alert('Erro ao rejeitar chamado');
    }
  };

  const renderMentions = (content) => {
    if (!content) return '';
    
    return content.replace(/@(\w+)/g, (match, username) => {
      return `<span class="bg-blue-100 text-blue-800 px-1 rounded">${match}</span>`;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p className="mt-2 text-gray-600">Carregando dados do chamado...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto p-6">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto p-6">
          <Alert className="border-red-200 bg-red-50">
            <Lock className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Você não tem permissão para visualizar este chamado confidencial.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Chamado não encontrado.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isArchived = ticket.status === 'arquivado';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto p-6">
        {/* Header do Chamado */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Chamado #{ticket.numero}
              </h1>
              <p className="text-gray-600">{ticket.titulo}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge className={getStatusColor(ticket.status)}>
              {getStatusText(ticket.status)}
            </Badge>
            {ticket.isConfidential && (
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                <Lock className="h-3 w-3 mr-1" />
                Confidencial
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detalhes do Chamado */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhes do Chamado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Descrição</h3>
                  <p className="text-gray-700 mt-1 whitespace-pre-wrap">{ticket.descricao}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Área</h4>
                    <p className="text-gray-700">{ticket.area}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Categoria</h4>
                    <p className="text-gray-700">{ticket.categoria}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Criado por</h4>
                    <p className="text-gray-700">{ticket.criadoPorNome}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Data de criação</h4>
                    <p className="text-gray-700">{formatDate(ticket.criadoEm)}</p>
                  </div>
                </div>

                {/* Flag de Item Extra */}
                {ticket.itemExtra && (
                  <div className="flex items-center space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-semibold text-orange-800">ITEM EXTRA</p>
                      {ticket.motivoItemExtra && (
                        <p className="text-sm text-orange-700">{ticket.motivoItemExtra}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Link para chamado pai */}
                {parentTicketForLink && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <LinkIcon className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Chamado Vinculado:</span>
                      <Link 
                        to={`/chamado/${parentTicketForLink.id}`}
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        #{parentTicketForLink.numero} - {parentTicketForLink.titulo}
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Múltiplos Projetos */}
            {projects.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    {projects.length > 1 ? (
                      <FolderOpen className="h-5 w-5 mr-2" />
                    ) : (
                      <Folder className="h-5 w-5 mr-2" />
                    )}
                    {projects.length > 1 ? `Projetos (${projects.length})` : 'Projeto'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projects.map((proj, index) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{proj.nome}</h3>
                            <p className="text-sm text-gray-600">{proj.evento}</p>
                            <p className="text-sm text-gray-500">
                              {proj.cidade} - {formatDate(proj.dataInicio)} a {formatDate(proj.dataFim)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/projeto/${proj.id}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conversas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Conversas ({messages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nenhuma mensagem ainda</p>
                  ) : (
                    messages.map((message, index) => (
                      <div key={index} className="flex space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold text-sm">{message.remetenteNome}</p>
                            <p className="text-xs text-gray-500">{formatDate(message.criadoEm)}</p>
                          </div>
                          <div 
                            className="mt-1"
                            dangerouslySetInnerHTML={{ __html: renderMentions(message.conteudo) }}
                          />
                          {message.imagens && message.imagens.length > 0 && (
                            <div className="mt-2 flex space-x-2">
                              {message.imagens.map((image, imgIndex) => (
                                <img
                                  key={imgIndex}
                                  src={image}
                                  alt={`Anexo ${imgIndex + 1}`}
                                  className="w-20 h-20 object-cover rounded cursor-pointer"
                                  onClick={() => window.open(image, '_blank')}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Nova mensagem */}
                <div className="mt-4 border-t pt-4">
                  <Textarea 
                    placeholder="Digite sua mensagem..." 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    disabled={sendingMessage || isArchived}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={sendingMessage || (!newMessage.trim() && chatImages.length === 0) || isArchived}
                    >
                      {sendingMessage ? 
                        <Loader2 className="h-4 w-4 animate-spin mr-2"/> : 
                        <Send className="h-4 w-4 mr-2" />
                      }
                      Enviar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Ações */}
            <Card>
              <CardHeader>
                <CardTitle>Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Botão Criar Chamado Vinculado */}
                {userProfile?.area === 'logistica' && (
                  <Button
                    onClick={handleCreateLinkedTicket}
                    className="w-full"
                    variant="outline"
                    disabled={isArchived}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Criar Chamado Vinculado
                  </Button>
                )}

                {/* Botão Rejeitar/Devolver */}
                <Button
                  onClick={() => setShowRejectModal(true)}
                  className="w-full"
                  variant="destructive"
                  disabled={isArchived}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar / Devolver
                </Button>

                {/* Atualizar Status */}
                {getAvailableStatuses().length > 0 && (
                  <div className="space-y-2">
                    <Label>Atualizar Status</Label>
                    <Select 
                      value={newStatus} 
                      onValueChange={setNewStatus}
                      disabled={isArchived}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um status" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableStatuses().map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {newStatus && (
                      <Button
                        onClick={handleStatusUpdate}
                        disabled={updating || isArchived}
                        className="w-full"
                      >
                        {updating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Atualizar
                      </Button>
                    )}
                  </div>
                )}

                {/* Seletor de Área */}
                {showAreaSelector && (
                  <div className="space-y-2">
                    <Label>Área de Destino</Label>
                    <Select value={selectedArea} onValueChange={setSelectedArea}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma área" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="operacao">Operação</SelectItem>
                        <SelectItem value="logistica">Logística</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="compras">Compras</SelectItem>
                        <SelectItem value="locacao">Locação</SelectItem>
                        <SelectItem value="almoxarifado">Almoxarifado</SelectItem>
                        <SelectItem value="comunicacao_visual">Comunicação Visual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Conclusão com observações */}
                {(newStatus === 'concluido' || newStatus === 'rejeitado' || newStatus === 'enviado_para_area') && (
                  <div className="space-y-2">
                    <Label>Observações / Motivo</Label>
                    <Textarea
                      value={conclusionDescription}
                      onChange={(e) => setConclusionDescription(e.target.value)}
                      placeholder="Descreva o motivo..."
                    />
                  </div>
                )}

                {/* Arquivar/Desarquivar */}
                {userProfile?.funcao === 'administrador' && (
                  <>
                    {ticket.status === 'arquivado' ? (
                      <Button
                        onClick={handleUnarchiveTicket}
                        disabled={updating}
                        variant="outline"
                        className="w-full"
                      >
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                        Desarquivar
                      </Button>
                    ) : ticket.status === 'concluido' && (
                      <Button
                        onClick={handleArchiveTicket}
                        disabled={updating}
                        variant="outline"
                        className="w-full"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Arquivar
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Escalações */}
            <Card>
              <CardHeader>
                <CardTitle>Escalações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Escalar para Área */}
                <div className="space-y-2">
                  <Label>Escalar para Área</Label>
                  <Select 
                    value={escalationArea} 
                    onValueChange={setEscalationArea}
                    disabled={isArchived}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma área" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="operacao">Operação</SelectItem>
                      <SelectItem value="logistica">Logística</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                      <SelectItem value="compras">Compras</SelectItem>
                      <SelectItem value="locacao">Locação</SelectItem>
                      <SelectItem value="almoxarifado">Almoxarifado</SelectItem>
                      <SelectItem value="comunicacao_visual">Comunicação Visual</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    placeholder="Motivo da escalação..."
                    disabled={isArchived}
                  />
                  <Button
                    onClick={handleEscalation}
                    disabled={isEscalating || !escalationArea || !escalationReason.trim() || isArchived}
                    className="w-full"
                    variant="outline"
                  >
                    {isEscalating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowLeft className="h-4 w-4 mr-2" />
                    )}
                    Escalar para Área
                  </Button>
                </div>

                {/* Escalar para Gerência */}
                <div className="space-y-2">
                  <Label>Escalar para Gerência</Label>
                  <Select 
                    value={managementArea} 
                    onValueChange={setManagementArea}
                    disabled={isArchived}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma gerência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gerente_operacional">Gerente Operacional</SelectItem>
                      <SelectItem value="gerente_comercial">Gerente Comercial</SelectItem>
                      <SelectItem value="gerente_producao">Gerente Produção</SelectItem>
                      <SelectItem value="gerente_financeiro">Gerente Financeiro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={managementReason}
                    onChange={(e) => setManagementReason(e.target.value)}
                    placeholder="Motivo da escalação..."
                    disabled={isArchived}
                  />
                  <Button
                    onClick={handleEscalationToManagement}
                    disabled={isEscalatingToManagement || !managementArea || !managementReason.trim() || isArchived}
                    className="w-full"
                    variant="outline"
                  >
                    {isEscalatingToManagement ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    Escalar para Gerência
                  </Button>
                </div>

                {/* Escalar para Consultor */}
                {projects.length > 0 && projects[0]?.consultorId && (
                  <div className="space-y-2">
                    <Label>Escalar para Consultor</Label>
                    <Textarea
                      value={consultorReason}
                      onChange={(e) => setConsultorReason(e.target.value)}
                      placeholder="Motivo da escalação..."
                      disabled={isArchived}
                    />
                    <Button
                      onClick={handleConsultorEscalation}
                      disabled={isEscalatingToConsultor || !consultorReason.trim() || isArchived}
                      className="w-full"
                      variant="outline"
                    >
                      {isEscalatingToConsultor ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4 mr-2" />
                      )}
                      Escalar para Consultor
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pessoas Envolvidas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Pessoas Envolvidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Criador */}
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <User className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-blue-800">{ticket.criadoPorNome}</p>
                      <p className="text-sm text-blue-600">Criador - {ticket.criadoPorFuncao}</p>
                    </div>
                    <Badge className="ml-auto bg-blue-100 text-blue-800">Criador</Badge>
                  </div>

                  {/* Consultor responsável */}
                  {projects.length > 0 && projects[0].consultorNome && (
                    <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <User className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-800">{projects[0].consultorNome}</p>
                        <p className="text-sm text-green-600">Consultor - {projects[0].consultorArea}</p>
                      </div>
                      <Badge className="ml-auto bg-green-100 text-green-800">Consultor</Badge>
                    </div>
                  )}

                  {/* Produtor responsável */}
                  {projects.length > 0 && projects[0].produtorNome && (
                    <div className="flex items-center space-x-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <User className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="font-semibold text-purple-800">{projects[0].produtorNome}</p>
                        <p className="text-sm text-purple-600">Produtor - {projects[0].produtorArea}</p>
                      </div>
                      <Badge className="ml-auto bg-purple-100 text-purple-800">Produtor</Badge>
                    </div>
                  )}

                  {/* Gerente responsável */}
                  {ticket.escalatedToManagement && (
                    <div className="flex items-center space-x-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <User className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="font-semibold text-orange-800">{ticket.escalatedToManagement}</p>
                        <p className="text-sm text-orange-600">Gerente Responsável</p>
                      </div>
                      <Badge className="ml-auto bg-orange-100 text-orange-800">Gerente</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Histórico Detalhado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="h-5 w-5 mr-2" />
                  Histórico Detalhado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Abertura do chamado */}
                  <div className="flex items-start space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="font-semibold text-blue-800">Chamado Aberto</p>
                      <p className="text-sm text-gray-600">por {ticket.criadoPorNome}</p>
                      <p className="text-xs text-gray-500">{formatDate(ticket.criadoEm)}</p>
                    </div>
                  </div>

                  {/* Escalações e movimentações */}
                  {ticket.escalatedAt && (
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-semibold text-yellow-800">Escalado para Área</p>
                        <p className="text-sm text-gray-600">para {ticket.area}</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.escalatedAt)}</p>
                        {ticket.escalationReason && (
                          <p className="text-sm text-gray-700 mt-1">Motivo: {ticket.escalationReason}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {ticket.escalatedToConsultorAt && (
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-semibold text-green-800">Escalado para Consultor</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.escalatedToConsultorAt)}</p>
                        {ticket.escalationConsultorReason && (
                          <p className="text-sm text-gray-700 mt-1">Motivo: {ticket.escalationConsultorReason}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {ticket.escalatedToManagementAt && (
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-orange-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-semibold text-orange-800">Escalado para Gerência</p>
                        <p className="text-sm text-gray-600">para {ticket.escalatedToManagement}</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.escalatedToManagementAt)}</p>
                        {ticket.escalationManagementReason && (
                          <p className="text-sm text-gray-700 mt-1">Motivo: {ticket.escalationManagementReason}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {ticket.transferredToProducerAt && (
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-semibold text-purple-800">Transferido para Produtor</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.transferredToProducerAt)}</p>
                      </div>
                    </div>
                  )}

                  {ticket.rejectedAt && (
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-semibold text-red-800">Chamado Rejeitado/Devolvido</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.rejectedAt)}</p>
                        {ticket.rejectReason && (
                          <p className="text-sm text-gray-700 mt-1">Motivo: {ticket.rejectReason}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {ticket.completedAt && (
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-green-600 rounded-full mt-2"></div>
                      <div>
                        <p className="font-semibold text-green-800">Chamado Concluído</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.completedAt)}</p>
                        {ticket.conclusionMessage && (
                          <p className="text-sm text-gray-700 mt-1">Observações: {ticket.conclusionMessage}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Conversas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Conversas ({messages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nenhuma mensagem ainda</p>
                  ) : (
                    messages.map((message, index) => (
                      <div key={index} className="flex space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold text-sm">{message.senderName}</p>
                            <p className="text-xs text-gray-500">{formatDate(message.timestamp)}</p>
                          </div>
                          <div className="mt-1">
                            {renderMentions(message.content)}
                          </div>
                          {message.images && message.images.length > 0 && (
                            <div className="mt-2 flex space-x-2">
                              {message.images.map((image, imgIndex) => (
                                <img
                                  key={imgIndex}
                                  src={image}
                                  alt={`Anexo ${imgIndex + 1}`}
                                  className="w-20 h-20 object-cover rounded cursor-pointer"
                                  onClick={() => window.open(image, '_blank')}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Nova mensagem */}
                <div className="mt-4 border-t pt-4">
                  <div className="relative">
                    <Textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={handleMentionInput}
                      placeholder="Digite sua mensagem... (use @ para mencionar usuários)"
                      className="min-h-[80px] pr-20"
                    />
                    
                    {/* Sugestões de menção */}
                    {showMentions && mentionSuggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 w-full bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                        {mentionSuggestions.map((user, index) => (
                          <div
                            key={index}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => insertMention(user)}
                          >
                            <p className="font-medium">{user.displayName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Imagens selecionadas */}
                  {selectedImages.length > 0 && (
                    <div className="mt-2 flex space-x-2">
                      {selectedImages.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Preview ${index + 1}`}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex space-x-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e)}
                        className="hidden"
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        size="sm"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={sending || (!newMessage.trim() && selectedImages.length === 0)}
                      size="sm"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sending ? 'Enviando...' : 'Enviar'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar de Ações */}
          <div className="space-y-6">
            {/* Ações */}
            {availableStatuses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Ações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alterar Status
                    </label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma ação" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            <div>
                              <p className="font-medium">{status.label}</p>
                              <p className="text-xs text-gray-500">{status.description}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Mensagem de conclusão */}
                  {newStatus === 'concluido' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Observações da Conclusão
                      </label>
                      <Textarea
                        value={conclusionMessage}
                        onChange={(e) => setConclusionMessage(e.target.value)}
                        placeholder="Descreva como o chamado foi resolvido..."
                        className="min-h-[80px]"
                      />
                      
                      {/* Upload de imagens da conclusão */}
                      <div className="mt-2">
                        <input
                          ref={conclusionFileInputRef}
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, true)}
                          className="hidden"
                        />
                        <Button
                          onClick={() => conclusionFileInputRef.current?.click()}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Anexar Imagens da Conclusão
                        </Button>
                      </div>

                      {/* Preview das imagens de conclusão */}
                      {conclusionImages.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {conclusionImages.map((image, index) => (
                            <div key={index} className="relative">
                              <img
                                src={URL.createObjectURL(image)}
                                alt={`Conclusão ${index + 1}`}
                                className="w-full h-20 object-cover rounded"
                              />
                              <button
                                onClick={() => removeImage(index, true)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={handleStatusUpdate}
                    disabled={!newStatus}
                    className="w-full"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar Ação
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Escalações */}
            <Card>
              <CardHeader>
                <CardTitle>Escalações</CardTitle>
                <p className="text-sm text-gray-600">Escalar chamado para outras áreas ou gerência</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Escalar para Área */}
                <div>
                  <h4 className="font-medium mb-2">Escalar para Área</h4>
                  <Select value={escalationArea} onValueChange={setEscalationArea}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma área" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((area) => (
                        <SelectItem key={area} value={area}>
                          {area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    placeholder="Motivo da escalação..."
                    className="mt-2"
                  />
                  <Button
                    onClick={handleEscalateToArea}
                    disabled={!escalationArea || !escalationReason.trim()}
                    className="w-full mt-2"
                    variant="outline"
                  >
                    Escalar para Área
                  </Button>
                </div>

                {/* Escalar para Gerência */}
                <div>
                  <h4 className="font-medium mb-2">Escalar para Gerência</h4>
                  <p className="text-sm text-gray-600 mb-2">Escale este chamado para qualquer gerência quando necessário</p>
                  <Select value={escalationManagement} onValueChange={setEscalationManagement}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a gerência que deve receber o chamado" />
                    </SelectTrigger>
                    <SelectContent>
                      {managements.map((management) => (
                        <SelectItem key={management} value={management}>
                          {management}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={escalationManagementReason}
                    onChange={(e) => setEscalationManagementReason(e.target.value)}
                    placeholder="Descreva o motivo pelo qual está escalando este chamado para a gerência..."
                    className="mt-2"
                  />
                  <Button
                    onClick={handleEscalateToManagement}
                    disabled={!escalationManagement || !escalationManagementReason.trim()}
                    className="w-full mt-2"
                    variant="outline"
                  >
                    Enviar para Gerência
                  </Button>
                  <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-sm text-purple-700">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    Atenção: Ao escalar para gerência, o chamado aguardará aprovação gerencial antes de retornar para execução.
                  </div>
                </div>

                {/* Escalar para Consultor */}
                {projects.length > 0 && projects[0].consultorNome && (
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">🤝</span>
                      <span className="font-medium">Escalar para Consultor</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Escale este chamado para o consultor do projeto para tratativa específica
                    </p>
                    <Textarea
                      value={escalationConsultorReason}
                      onChange={(e) => setEscalationConsultorReason(e.target.value)}
                      placeholder="Descreva o motivo pelo qual está escalando este chamado para o consultor do projeto..."
                      className="mb-3"
                    />
                    <Button
                      onClick={handleEscalateToConsultor}
                      disabled={!escalationConsultorReason.trim()}
                      className="w-full"
                      variant="outline"
                    >
                      <span className="mr-2">🤝</span>
                      Enviar para Consultor
                    </Button>
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      Fluxo: O chamado irá para o consultor do projeto. Após a ação do consultor, retornará automaticamente para sua área ({ticket.area}) para continuidade.
                    </div>
                  </div>
                )}

                {/* Transferir para Produtor */}
                {projects.length > 0 && projects[0].produtorNome && (
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">🏭</span>
                      <span className="font-medium">Transferir para Produtor</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Transfira este chamado para o produtor do projeto para continuidade e finalização
                    </p>
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm mb-3">
                      <p className="font-medium text-blue-800">Produtor do Projeto: {projects[0].produtorNome || 'Não identificado'}</p>
                      <p className="text-blue-600">O chamado será transferido para o produtor responsável por este projeto.</p>
                    </div>
                    <Button
                      onClick={handleTransferToProducer}
                      className="w-full"
                    >
                      <span className="mr-2">🏭</span>
                      Enviar para Produtor
                    </Button>
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                      <span className="font-medium">ℹ️ Informação:</span> O chamado será transferido para o produtor do projeto para dar continuidade e finalização.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vincular Chamado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Link className="h-5 w-5 mr-2" />
                  Vincular Chamado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Crie um novo chamado para outra área que ficará vinculado a este.
                </p>
                <Button
                  onClick={handleCreateLinkedTicket}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Chamado Vinculado
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal de Rejeição */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Rejeitar / Devolver Chamado</h3>
              <p className="text-sm text-gray-600 mb-4">
                Informe o motivo da rejeição ou devolução do chamado:
              </p>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Descreva o motivo da rejeição/devolução..."
                className="mb-4"
              />
              <div className="flex space-x-3">
                <Button
                  onClick={() => setShowRejectModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleRejectTicket}
                  disabled={!rejectReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Rejeitar / Devolver
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDetailPage;
