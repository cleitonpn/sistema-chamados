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
  Calendar,
  Loader2,
  ExternalLink,
  Lock,
  UserCheck,
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
  Paperclip
} from 'lucide-react';

const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  // Estados principais
  const [ticket, setTicket] = useState(null);
  const [project, setProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Estados do chat
  const [newMessage, setNewMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [sending, setSending] = useState(false);

  // Estados de atualização de status
  const [newStatus, setNewStatus] = useState('');
  const [conclusionDescription, setConclusionDescription] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [showAreaSelector, setShowAreaSelector] = useState(false);

  // Estados para escalação
  const [escalationArea, setEscalationArea] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);
  const [managementArea, setManagementArea] = useState('');
  const [managementReason, setManagementReason] = useState('');
  const [isEscalatingToManagement, setIsEscalatingToManagement] = useState(false);
  const [consultorReason, setConsultorReason] = useState('');
  const [isEscalatingToConsultor, setIsEscalatingToConsultor] = useState(false);

  // Estados para menções e histórico
  const [users, setUsers] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const textareaRef = useRef(null);
  
  // Estados para rejeição e reenvio
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [parentTicketForLink, setParentTicketForLink] = useState(null);
  
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

      if (ticketData.chamadoPaiId) {
        const parentTicketData = await ticketService.getTicketById(ticketData.chamadoPaiId);
        setParentTicketForLink(parentTicketData);
      }

      // Carregar projetos (suporte a múltiplos projetos)
      const projectsToLoad = [];
      
      if (ticketData.projetoId) {
        try {
          const projectData = await projectService.getProjectById(ticketData.projetoId);
          if (projectData) {
            setProject(projectData);
            projectsToLoad.push(projectData);
          }
        } catch (err) {
          console.warn("Erro ao carregar projeto único:", err);
        }
      }
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
          
          if (projectsToLoad.length > 0) {
            setProject(projectsToLoad[0]);
          }
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

  const handleCreateLinkedTicket = () => {
    if (!ticket) return;
    
    const linkedTicketData = {
      linkedTicketId: ticketId,
      linkedTicketTitle: ticket.titulo,
      linkedTicketDescription: ticket.descricao,
      linkedTicketCreator: ticket.criadoPorNome,
      linkedTicketArea: ticket.area,
      linkedTicketProject: projects.length > 0 ? projects[0]?.nome : (project?.nome || ''),
      linkedTicketEvent: projects.length > 0 ? projects[0]?.evento : (project?.evento || '')
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

  const handleMentionInput = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    // Detectar @ para mostrar sugestões
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const query = value.substring(lastAtIndex + 1);
      if (query.length >= 0) {
        const filtered = users.filter(user => 
          user.nome?.toLowerCase().includes(query.toLowerCase()) ||
          user.email?.toLowerCase().includes(query.toLowerCase())
        );
        setMentionSuggestions(filtered.slice(0, 5));
        setShowMentions(true);
        setMentionQuery(query);
      }
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (user) => {
    const lastAtIndex = newMessage.lastIndexOf('@');
    const beforeMention = newMessage.substring(0, lastAtIndex);
    const afterMention = newMessage.substring(lastAtIndex + mentionQuery.length + 1);
    setNewMessage(`${beforeMention}@${user.nome} ${afterMention}`);
    setShowMentions(false);
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
        areaDestino: escalationArea || null,
        motivoEscalonamento: escalationReason || '',
        atualizadoPor: user?.uid || null,
        updatedAt: new Date()
      };
      await ticketService.escalateTicketToArea(ticketId, escalationArea, updateData);
      setEscalationArea('');
      setEscalationReason('');
      await loadTicketData();
    } catch (error) {
      console.error('Erro na escalação:', error);
      alert('Erro ao escalar chamado');
    } finally {
      setIsEscalating(false);
    }
  };

  const handleEscalationToManagement = async () => {
    if (!managementArea) {
      alert('Por favor, selecione uma gerência');
      return;
    }
    if (!managementReason.trim()) {
      alert('Por favor, descreva o motivo da escalação');
      return;
    }
    setIsEscalatingToManagement(true);
    try {
      const updateData = {
        status: 'aguardando_aprovacao',
        gerenciaDestino: managementArea,
        motivoEscalonamentoGerencial: managementReason,
        escaladoEm: new Date(),
        escaladoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      setManagementArea('');
      setManagementReason('');
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao escalar para gerência:', error);
      alert('Erro ao escalar para gerência');
    } finally {
      setIsEscalatingToManagement(false);
    }
  };

  const handleEscalationToConsultor = async () => {
    if (!consultorReason.trim()) {
      alert('Por favor, descreva o motivo da escalação');
      return;
    }
    setIsEscalatingToConsultor(true);
    try {
      const updateData = {
        status: 'escalado_para_consultor',
        motivoEscalonamentoConsultor: consultorReason,
        escaladoParaConsultorEm: new Date(),
        escaladoParaConsultorPor: user.uid,
        consultorResponsavelId: project?.consultorId || null,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      setConsultorReason('');
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao escalar para consultor:', error);
      alert('Erro ao escalar para consultor');
    } finally {
      setIsEscalatingToConsultor(false);
    }
  };

  const handleStatusUpdate = async (status) => {
    if (status === 'enviado_para_area' && !showAreaSelector) {
      setShowAreaSelector(true);
      return;
    }
    if (status === 'enviado_para_area' && !selectedArea) {
      alert('Por favor, selecione uma área de destino');
      return;
    }
    setUpdating(true);
    try {
      const updateData = {
        status: status,
        updatedAt: new Date(),
        updatedBy: user.uid
      };
      if (status === 'concluido') {
        updateData.concluidoEm = new Date();
        updateData.concluidoPor = user.uid;
        if (conclusionDescription) {
          updateData.observacoesConclusao = conclusionDescription;
        }
      }
      if (status === 'enviado_para_area' && selectedArea) {
        updateData.area = selectedArea;
        updateData.areaDeOrigem = ticket.area;
      }
      await ticketService.updateTicket(ticketId, updateData);
      setConclusionDescription('');
      setSelectedArea('');
      setShowAreaSelector(false);
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do chamado');
    } finally {
      setUpdating(false);
    }
  };

  const handleSendMessageNew = async () => {
    if (!newMessage.trim() && selectedImages.length === 0) return;

    try {
      setSending(true);
      await messageService.sendMessage(ticketId, {
        content: newMessage,
        images: selectedImages,
        senderId: user.uid,
        senderName: userProfile?.nome || user.email
      });

      setNewMessage('');
      setSelectedImages([]);
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleResubmit = async () => {
    if (!additionalInfo.trim()) {
      alert('Por favor, forneça informações adicionais para o reenvio');
      return;
    }
    setIsResubmitting(true);
    try {
      const updateData = {
        status: 'aberto',
        informacoesAdicionais: additionalInfo,
        reenviado: true,
        reenviadoEm: new Date(),
        reenviadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      await messageService.sendMessage(ticketId, {
        content: `Chamado reenviado com informações adicionais: ${additionalInfo}`,
        senderId: user.uid,
        senderName: userProfile?.nome || user.email,
        isSystemMessage: true
      });
      setAdditionalInfo('');
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao reenviar chamado:', error);
      alert('Erro ao reenviar chamado');
    } finally {
      setIsResubmitting(false);
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
                  <p className="text-gray-700 mt-1">{ticket.descricao}</p>
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

            {/* Projeto Único (compatibilidade) */}
            {project && projects.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    Projeto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{project.nome}</h3>
                      <p className="text-sm text-gray-600">{project.evento}</p>
                      <p className="text-sm text-gray-500">
                        {project.cidade} - {formatDate(project.dataInicio)} a {formatDate(project.dataFim)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/projeto/${project.id}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
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
                            <p className="font-semibold text-sm">{message.senderName}</p>
                            <p className="text-xs text-gray-500">{formatDate(message.timestamp)}</p>
                          </div>
                          <div 
                            className="mt-1"
                            dangerouslySetInnerHTML={{ __html: renderMentions(message.content) }}
                          />
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
                            className="p-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => selectMention(user)}
                          >
                            <p className="font-medium">{user.nome}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="absolute bottom-2 right-2 flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSendMessageNew}
                        disabled={sending || (!newMessage.trim() && selectedImages.length === 0)}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Imagens selecionadas */}
                  {selectedImages.length > 0 && (
                    <div className="mt-2 flex space-x-2">
                      {selectedImages.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image}
                            alt={`Selecionada ${index + 1}`}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <button
                            onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      files.forEach(file => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          setSelectedImages(prev => [...prev, e.target.result]);
                        };
                        reader.readAsDataURL(file);
                      });
                    }}
                  />
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
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar / Devolver
                </Button>

                {/* Atualizar Status */}
                {getAvailableStatuses().length > 0 && (
                  <div className="space-y-2">
                    <Label>Atualizar Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
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
                        onClick={() => handleStatusUpdate(newStatus)}
                        disabled={updating}
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
                {newStatus === 'concluido' && (
                  <div className="space-y-2">
                    <Label>Observações da Conclusão</Label>
                    <Textarea
                      value={conclusionDescription}
                      onChange={(e) => setConclusionDescription(e.target.value)}
                      placeholder="Descreva como o chamado foi resolvido..."
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
                  <Select value={escalationArea} onValueChange={setEscalationArea}>
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
                  />
                  <Button
                    onClick={handleEscalation}
                    disabled={isEscalating || !escalationArea || !escalationReason.trim()}
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
                  <Select value={managementArea} onValueChange={setManagementArea}>
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
                  />
                  <Button
                    onClick={handleEscalationToManagement}
                    disabled={isEscalatingToManagement || !managementArea || !managementReason.trim()}
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
                {project?.consultorId && (
                  <div className="space-y-2">
                    <Label>Escalar para Consultor</Label>
                    <Textarea
                      value={consultorReason}
                      onChange={(e) => setConsultorReason(e.target.value)}
                      placeholder="Motivo da escalação..."
                    />
                    <Button
                      onClick={handleEscalationToConsultor}
                      disabled={isEscalatingToConsultor || !consultorReason.trim()}
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
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-semibold text-blue-900">Criador</p>
                        <p className="text-sm text-blue-700">{ticket.criadoPorNome}</p>
                        <p className="text-xs text-blue-600">{ticket.area}</p>
                      </div>
                    </div>
                  </div>

                  {/* Responsável atual */}
                  {ticket.responsavelAtual && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-900">Responsável Atual</p>
                          <p className="text-sm text-green-700">{ticket.responsavelAtual}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Consultor responsável */}
                  {ticket.consultorResponsavelId && (
                    <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <UserCheck className="h-4 w-4 text-cyan-600" />
                        <div>
                          <p className="font-semibold text-cyan-900">Consultor</p>
                          <p className="text-sm text-cyan-700">{getUserNameById(ticket.consultorResponsavelId)}</p>
                        </div>
                      </div>
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
                  Histórico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Abertura */}
                  <div className="flex items-start space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="font-semibold text-blue-800">Chamado Aberto</p>
                      <p className="text-xs text-gray-500">{formatDate(ticket.criadoEm)}</p>
                      <p className="text-sm text-gray-700">Por: {ticket.criadoPorNome}</p>
                    </div>
                  </div>

                  {/* Eventos do histórico */}
                  {historyEvents.map((event, index) => {
                    return (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-3 h-3 bg-gray-400 rounded-full mt-2"></div>
                        <div>
                          <p className={`font-semibold ${event.color}`}>
                            {event.description} {event.userName}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(event.date)}</p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Outras movimentações */}
                  {ticket.updatedAt && (
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-semibold text-yellow-800">Última Atualização</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.updatedAt)}</p>
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

            {/* Reenvio para correção */}
            {ticket.status === 'devolvido' && ticket.criadoPor === user.uid && (
              <Card>
                <CardHeader>
                  <CardTitle>Reenviar com Correções</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    placeholder="Forneça informações adicionais ou correções..."
                  />
                  <Button
                    onClick={handleResubmit}
                    disabled={isResubmitting || !additionalInfo.trim()}
                    className="w-full"
                  >
                    {isResubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ClipboardEdit className="h-4 w-4 mr-2" />
                    )}
                    Reenviar Chamado
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Rejeição */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Rejeitar / Devolver Chamado</h3>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Informe o motivo da rejeição/devolução..."
              className="mb-4"
            />
            <div className="flex space-x-3">
              <Button
                onClick={handleRejectTicket}
                variant="destructive"
                disabled={!rejectReason.trim()}
              >
                Confirmar
              </Button>
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetailPage;
