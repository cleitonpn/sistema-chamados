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
  ClipboardEdit,
  Folder,
  FolderOpen
} from 'lucide-react';

const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  // Estados principais
  const [ticket, setTicket] = useState(null);
  const [project, setProject] = useState(null);
  const [projects, setProjects] = useState([]); // ✅ MUDANÇA: Array para múltiplos projetos
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
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isResubmitting, setIsResubmitting] = useState(false);

  const isArchived = ticket?.status === 'arquivado';

  useEffect(() => {
    if (ticketId) {
      loadTicketData();
      loadUsers();
    }
  }, [ticketId]);

  const loadTicketData = async () => {
    try {
      setLoading(true);
      const ticketData = await ticketService.getTicketById(ticketId);
      
      if (!ticketData) {
        setError('Chamado não encontrado');
        return;
      }

      // Verificar acesso
      if (!canUserAccessTicket(ticketData, user, userProfile)) {
        setAccessDenied(true);
        return;
      }

      setTicket(ticketData);

      // ✅ MUDANÇA: Carregar múltiplos projetos
      if (ticketData.projetos && ticketData.projetos.length > 0) {
        const projectsData = await Promise.all(
          ticketData.projetos.map(projectId => projectService.getProjectById(projectId))
        );
        setProjects(projectsData.filter(p => p !== null));
        
        // Manter compatibilidade com projeto principal
        if (ticketData.projetoId) {
          const mainProject = await projectService.getProjectById(ticketData.projetoId);
          setProject(mainProject);
        } else if (projectsData[0]) {
          setProject(projectsData[0]);
        }
      } else if (ticketData.projetoId) {
        // Compatibilidade com sistema antigo
        const projectData = await projectService.getProjectById(ticketData.projetoId);
        setProject(projectData);
        setProjects(projectData ? [projectData] : []);
      }

      const messagesData = await messageService.getMessagesByTicketId(ticketId);
      setMessages(messagesData);

      generateHistoryEvents(ticketData, messagesData);
    } catch (error) {
      console.error('Erro ao carregar dados do chamado:', error);
      setError('Erro ao carregar dados do chamado');
    } finally {
      setLoading(false);
    }
  };

  const canUserAccessTicket = (ticket, user, userProfile) => {
    if (!user || !userProfile) return false;
    
    // Administrador pode acessar tudo
    if (userProfile.funcao === 'administrador') return true;
    
    // Criador do chamado
    if (ticket.criadoPor === user.uid) return true;
    
    // Operador da área do chamado
    if (userProfile.funcao === 'operador' && userProfile.area === ticket.area) return true;
    
    // Chamado atribuído ao usuário
    if (ticket.atribuidoA === user.uid) return true;
    
    // Gerente responsável
    if (ticket.gerenteResponsavelId === user.uid) return true;
    
    // Consultor responsável
    if (ticket.consultorResponsavelId === user.uid) return true;
    
    // Produtor responsável
    if (ticket.produtorResponsavelId === user.uid) return true;
    
    // Chamados confidenciais só para envolvidos
    if (ticket.confidencial) {
      return false;
    }
    
    return true;
  };

  const loadUsers = async () => {
    try {
      const usersData = await userService.getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const generateHistoryEvents = (ticketData, messagesData) => {
    const events = [];
    
    // Evento de criação
    events.push({
      Icon: PlusCircle,
      description: 'Chamado criado por',
      userName: ticketData.criadoPorNome || 'Usuário',
      date: ticketData.criadoEm,
      color: 'text-green-600'
    });

    // Eventos das mensagens do sistema
    messagesData.forEach(message => {
      if (message.type === 'escalation') {
        events.push({
          Icon: ArrowLeft,
          description: 'Chamado escalado por',
          userName: message.remetenteNome || 'Usuário',
          date: message.criadoEm,
          color: 'text-blue-600'
        });
      } else if (message.type === 'status_change') {
        events.push({
          Icon: CheckCircle,
          description: 'Status alterado por',
          userName: message.remetenteNome || 'Usuário',
          date: message.criadoEm,
          color: 'text-purple-600'
        });
      }
    });

    // Ordenar por data
    events.sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return dateA - dateB;
    });

    setHistoryEvents(events);
  };

  // ✅ MUDANÇA: Função getAvailableStatuses sem filtro do produtor
  const getAvailableStatuses = () => {
    if (!ticket || !userProfile || !user) return [];
    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;
    const isCreator = ticket.criadoPor === user.uid;

    // ✅ MUDANÇA: Operador que criou pode concluir quando executado
    if (isCreator && (currentStatus === 'executado_aguardando_validacao' || currentStatus === 'executado_aguardando_validacao_operador')) {
        return [ 
          { value: 'concluido', label: 'Validar e Concluir' }, 
          { value: 'enviado_para_area', label: 'Rejeitar / Devolver' } 
        ];
    }

    if (userRole === 'administrador') {
      if (currentStatus === 'aberto' || currentStatus === 'escalado_para_outra_area' || currentStatus === 'enviado_para_area') {
        return [ { value: 'em_tratativa', label: 'Iniciar Tratativa' } ];
      }
      if (currentStatus === 'em_tratativa') {
        return [ { value: 'executado_aguardando_validacao', label: 'Executado' } ];
      }
      if (currentStatus === 'executado_aguardando_validacao' && !isCreator) {
        return [ { value: 'concluido', label: 'Forçar Conclusão (Admin)' } ];
      }
      if (currentStatus === 'aguardando_aprovacao') {
        return [ 
          { value: 'aprovado', label: 'Aprovar' }, 
          { value: 'rejeitado', label: 'Reprovar' } 
        ];
      }
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

    // ✅ MUDANÇA: Consultor pode executar diretamente sem filtro do produtor
    if (userRole === 'consultor') {
      if (ticket.status === 'escalado_para_consultor') {
        return [{ value: 'executado_pelo_consultor', label: 'Executar e Devolver para a Área' }];
      }
      
      // ✅ MUDANÇA: Consultor pode tratar chamados diretamente
      if (currentStatus === 'aberto' || currentStatus === 'escalado_para_outra_area' || currentStatus === 'enviado_para_area') {
        return [ { value: 'em_tratativa', label: 'Iniciar Tratativa' } ];
      }
      if (currentStatus === 'em_tratativa') {
        return [ { value: 'executado_aguardando_validacao', label: 'Executado' } ];
      }
    }

    // ✅ MUDANÇA: Produtor tem opções quando consultor abre chamado
    if (userRole === 'produtor' && ticket.criadoPorFuncao === 'consultor') {
      if (currentStatus === 'aberto' || currentStatus === 'escalado_para_outra_area' || currentStatus === 'enviado_para_area') {
        return [
          { value: 'em_tratativa', label: 'Dar Tratativa' },
          { value: 'concluido', label: 'Concluir Diretamente' },
          { value: 'enviado_para_area', label: 'Enviar para Área' }
        ];
      }
      if (currentStatus === 'em_tratativa') {
        return [ { value: 'executado_aguardando_validacao', label: 'Executado' } ];
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

      if (statusToUpdate === 'send_to_area') {
        const targetArea = ticket.areaDestinoOriginal;
        if (!targetArea) {
            alert('Erro Crítico: A área de destino original não foi encontrada neste chamado.');
            setUpdating(false);
            return;
        }
        updateData = {
          status: 'enviado_para_area',
          area: targetArea,
          areaDeOrigem: ticket.area,
          areaDestinoOriginal: targetArea,
          motivoRejeicao: conclusionDescription,
          rejeitadoPor: user.uid,
          rejeitadoEm: new Date(),
          atualizadoPor: user.uid,
          updatedAt: new Date()
        };
        systemMessageContent = `🔄 **Chamado devolvido para ${targetArea.replace('_', ' ').toUpperCase()}**\n\n**Motivo:** ${conclusionDescription}`;
      } else if (statusToUpdate === 'concluido') {
        updateData = {
          status: 'concluido',
          conclusao: conclusionDescription,
          concluidoPor: user.uid,
          concluidoEm: new Date(),
          atualizadoPor: user.uid,
          updatedAt: new Date()
        };
        systemMessageContent = `✅ **Chamado concluído**\n\n**Descrição:** ${conclusionDescription}`;
      } else if (statusToUpdate === 'executado_aguardando_validacao' || statusToUpdate === 'executado_aguardando_validacao_operador') {
        updateData = {
          status: statusToUpdate,
          executadoPor: user.uid,
          executadoEm: new Date(),
          descricaoExecucao: conclusionDescription,
          atualizadoPor: user.uid,
          updatedAt: new Date()
        };
        systemMessageContent = `⚡ **Chamado executado**\n\n**Descrição:** ${conclusionDescription}`;
      } else {
        updateData = {
          status: statusToUpdate,
          atualizadoPor: user.uid,
          updatedAt: new Date()
        };
        systemMessageContent = `🔄 **Status alterado para: ${statusToUpdate}**`;
      }

      await ticketService.updateTicket(ticketId, updateData);

      if (conclusionImages.length > 0) {
        const systemMessage = {
          userId: user.uid,
          remetenteNome: userProfile.nome || user.email,
          conteudo: systemMessageContent,
          imagens: conclusionImages.map(img => img.url),
          criadoEm: new Date(),
          type: 'status_change'
        };
        await messageService.sendMessage(ticketId, systemMessage);
      } else {
        const systemMessage = {
          userId: user.uid,
          remetenteNome: userProfile.nome || user.email,
          conteudo: systemMessageContent,
          criadoEm: new Date(),
          type: 'status_change'
        };
        await messageService.sendMessage(ticketId, systemMessage);
      }

      try {
        await notificationService.notifyStatusChange(ticketId, ticket, statusToUpdate, user.uid);
      } catch (notificationError) {
        console.error('Falha não-crítica ao enviar notificação:', notificationError);
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
        imagens: chatImages.map(img => img.url),
        criadoEm: new Date()
      };

      await messageService.sendMessage(ticketId, messageData);
      
      try {
        await notificationService.notifyNewMessage(ticketId, ticket, messageData, user.uid);
      } catch (notificationError) {
        console.error('Falha não-crítica ao enviar notificação:', notificationError);
      }

      setNewMessage('');
      setChatImages([]);
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleTextareaChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setNewMessage(value);
    setCursorPosition(cursorPos);

    // Detectar menções
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionQuery(query);
      
      const filteredUsers = users.filter(user => 
        user.nome.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query)
      ).slice(0, 5);
      
      setMentionSuggestions(filteredUsers);
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowMentionSuggestions(false);
    }
  };

  const insertMention = (user) => {
    const textBeforeCursor = newMessage.substring(0, cursorPosition);
    const textAfterCursor = newMessage.substring(cursorPosition);
    
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const beforeMention = textBeforeCursor.substring(0, mentionMatch.index);
      const newText = `${beforeMention}@${user.nome} ${textAfterCursor}`;
      setNewMessage(newText);
    }
    
    setShowMentionSuggestions(false);
    textareaRef.current?.focus();
  };

  const formatDate = (date) => {
    if (!date) return 'Data não disponível';
    
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'aberto': { color: 'bg-blue-100 text-blue-800', label: 'Aberto' },
      'em_tratativa': { color: 'bg-yellow-100 text-yellow-800', label: 'Em Tratativa' },
      'executado_aguardando_validacao': { color: 'bg-purple-100 text-purple-800', label: 'Aguardando Validação' },
      'executado_aguardando_validacao_operador': { color: 'bg-purple-100 text-purple-800', label: 'Aguardando Validação' },
      'concluido': { color: 'bg-green-100 text-green-800', label: 'Concluído' },
      'rejeitado': { color: 'bg-red-100 text-red-800', label: 'Rejeitado' },
      'escalado_para_outra_area': { color: 'bg-orange-100 text-orange-800', label: 'Escalado' },
      'arquivado': { color: 'bg-gray-100 text-gray-800', label: 'Arquivado' }
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      'baixa': { color: 'bg-gray-100 text-gray-800', label: 'Baixa' },
      'media': { color: 'bg-yellow-100 text-yellow-800', label: 'Média' },
      'alta': { color: 'bg-orange-100 text-orange-800', label: 'Alta' },
      'urgente': { color: 'bg-red-100 text-red-800', label: 'Urgente' }
    };

    const config = priorityConfig[priority] || { color: 'bg-gray-100 text-gray-800', label: priority };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto pt-8 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto pt-8 px-4">
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Você não tem permissão para acessar este chamado.
            </AlertDescription>
          </Alert>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto pt-8 px-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Chamado não encontrado.</AlertDescription>
          </Alert>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
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
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {ticket.titulo}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Chamado #{ticketId} • Criado em {formatDate(ticket.criadoEm)}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusBadge(ticket.status)}
              {getPriorityBadge(ticket.prioridade)}
              {ticket.itemExtra && (
                <Badge className="bg-orange-100 text-orange-800">
                  🔥 Item Extra
                </Badge>
              )}
              {ticket.confidencial && (
                <Badge className="bg-red-100 text-red-800">
                  <Lock className="h-3 w-3 mr-1" />
                  Confidencial
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Detalhes do Chamado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ClipboardEdit className="h-5 w-5 mr-2" />
                  Detalhes do Chamado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Descrição</Label>
                    <p className="mt-1 text-sm text-gray-900">{ticket.descricao}</p>
                  </div>
                  
                  {ticket.itemExtra && ticket.motivoItemExtra && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="text-orange-600 text-lg">🔥</div>
                        <div>
                          <p className="font-semibold text-orange-800">ITEM EXTRA</p>
                          <p className="text-sm text-orange-700">{ticket.motivoItemExtra}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Área</Label>
                      <p className="mt-1 text-sm text-gray-900 capitalize">
                        {ticket.area?.replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Tipo</Label>
                      <p className="mt-1 text-sm text-gray-900 capitalize">
                        {ticket.tipo?.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-500">Criado por</Label>
                    <p className="mt-1 text-sm text-gray-900">
                      {ticket.criadoPorNome} ({ticket.criadoPorFuncao})
                    </p>
                  </div>

                  {ticket.observacoes && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Observações</Label>
                      <p className="mt-1 text-sm text-gray-900">{ticket.observacoes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ✅ MUDANÇA: Seção de múltiplos projetos */}
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
                      <div key={proj.id} className={`${index > 0 ? 'border-t pt-4' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{proj.nome}</h4>
                          <Badge variant="secondary">{proj.feira}</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <Label className="text-xs font-medium text-gray-500">Local</Label>
                            <p className="text-gray-900">{proj.local}</p>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-gray-500">Metragem</Label>
                            <p className="text-gray-900">{proj.metragem}</p>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-gray-500">Período</Label>
                            <p className="text-gray-900">
                              {proj.dataInicio && formatDate(proj.dataInicio)} - {proj.dataFim && formatDate(proj.dataFim)}
                            </p>
                          </div>
                        </div>
                        {proj.produtorNome && (
                          <div className="mt-2 text-sm">
                            <Label className="text-xs font-medium text-gray-500">Produtor:</Label>
                            <span className="ml-1 text-gray-900">{proj.produtorNome}</span>
                          </div>
                        )}
                        {proj.consultorNome && (
                          <div className="mt-1 text-sm">
                            <Label className="text-xs font-medium text-gray-500">Consultor:</Label>
                            <span className="ml-1 text-gray-900">{proj.consultorNome}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chat de Mensagens */}
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
                            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{message.conteudo}</p>
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
                
                {!isArchived && (
                  <div className="border-t pt-4">
                    <div className="space-y-3">
                      <div className="relative">
                        <Textarea
                          ref={textareaRef}
                          placeholder="Digite sua mensagem... (use @ para mencionar usuários)"
                          value={newMessage}
                          onChange={handleTextareaChange}
                          onKeyDown={handleTextareaKeyDown}
                          rows={3}
                          disabled={sendingMessage}
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
                )}
              </CardContent>
            </Card>

            {/* Histórico do Chamado */}
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

          {/* Sidebar com Ações */}
          <div className="space-y-6">
            {/* Ações Disponíveis */}
            {!isArchived && availableStatuses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Ações Disponíveis
                  </CardTitle>
                  <CardDescription>
                    Alterar status do chamado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="status">Novo Status</Label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger>
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
                    
                    {newStatus && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="conclusion">
                            {newStatus === 'concluido' ? 'Descrição da Conclusão' : 
                             newStatus === 'executado_aguardando_validacao' || newStatus === 'executado_aguardando_validacao_operador' ? 'Descrição da Execução' :
                             'Motivo/Observações'}
                            {(newStatus === 'rejeitado' || newStatus === 'enviado_para_area') && ' *'}
                          </Label>
                          <Textarea
                            id="conclusion"
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
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Escalações */}
            {!isArchived && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">🔄</span>Escalar Chamado
                  </CardTitle>
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
                          <SelectItem value="enviar_para_produtor">🏭 Enviar para Produtor</SelectItem>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;

