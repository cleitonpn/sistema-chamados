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
  UserCheck
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

  // Estados para menções de usuários
  const [users, setUsers] = useState([]);
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
      'reprovado': 'bg-red-100 text-red-800'
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
      'reprovado': 'Reprovado'
    };
    return statusTexts[status] || status;
  };

  // ✅ FUNÇÃO CORRIGIDA - Verifica se produtor pode concluir chamado
  const canProducerComplete = (ticket, user, userProfile) => {
    if (!ticket || !user || !userProfile || userProfile?.funcao !== 'produtor') return false;
    
    // SITUAÇÃO 1: Chamado criado pelo próprio produtor (após áreas executarem)
    if (ticket.criadoPor === user.uid && ticket.status === 'executado_aguardando_validacao') {
      return true;
    }
    
    // SITUAÇÃO 2: Chamado criado por consultor (produtor pode concluir)
    if ((ticket.consultorId === user.uid || ticket.produtorId === user.uid) && 
        ['aberto', 'em_tratativa', 'executado_aguardando_validacao'].includes(ticket.status)) {
      return true;
    }
    
    // SITUAÇÃO 3: Produtor responsável pelo chamado
    if (ticket.produtorResponsavel === user.uid && 
        ['executado_aguardando_validacao', 'em_tratativa'].includes(ticket.status)) {
      return true;
    }
    
    return false;
  };

  // ✅ FUNÇÃO CORRIGIDA - Status disponíveis incluindo permissões de produtor
  const getAvailableStatuses = () => {
    if (!ticket || !userProfile || !user) {
      return [];
    }

    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;

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
      if (currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
        return [
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Devolver', description: 'Devolver para área com motivo' },
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Finalizar chamado' }
        ];
      }
      if (currentStatus === 'aguardando_aprovacao') {
        return [
          { value: TICKET_STATUS.APPROVED, label: 'Aprovar', description: 'Aprovar e retornar para área' },
          { value: TICKET_STATUS.REJECTED, label: 'Reprovar', description: 'Reprovar e encerrar chamado' }
        ];
      }
    }

    // ✅ PRODUTOR - Lógica corrigida
    if (userRole === 'produtor') {
      const statuses = [];
      
      // Pode concluir se atende às regras de negócio
      if (canProducerComplete(ticket, user, userProfile)) {
        statuses.push({ 
          value: TICKET_STATUS.COMPLETED, 
          label: 'Concluir', 
          description: 'Finalizar chamado após validação' 
        });
      }
      
      // Pode iniciar tratativa se aberto
      if (currentStatus === TICKET_STATUS.OPEN && 
          (ticket.criadoPor === user.uid || ticket.consultorId === user.uid || ticket.produtorId === user.uid)) {
        statuses.push({ 
          value: TICKET_STATUS.IN_TREATMENT, 
          label: 'Iniciar Tratativa', 
          description: 'Começar a trabalhar no chamado' 
        });
      }
      
      // Pode devolver para área se necessário
      if (currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION && 
          (ticket.criadoPor === user.uid || ticket.consultorId === user.uid || ticket.produtorId === user.uid)) {
        statuses.push({ 
          value: TICKET_STATUS.SENT_TO_AREA, 
          label: 'Devolver', 
          description: 'Devolver para área com motivo' 
        });
      }
      
      return statuses;
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
        updatedAt: new Date()
      };

      await ticketService.updateTicket(ticketId, updateData);

      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `🔺 **Chamado escalado para GERÊNCIA DE ${targetArea.toUpperCase()}**\n\n**Gerente:** ${targetManager.nome}\n**Motivo:** ${managementReason}`,
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

    setIsEscalatingToConsultor(true);
    try {
      const updateData = {
        status: 'escalado_para_consultor',
        motivoEscalonamentoConsultor: consultorReason,
        escaladoPor: user.uid,
        escaladoEm: new Date(),
        updatedAt: new Date()
      };

      await ticketService.updateTicket(ticketId, updateData);

      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `📋 **Chamado escalado para CONSULTOR**\n\n**Motivo:** ${consultorReason}`,
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

  const handleStatusUpdate = async () => {
    if (!newStatus) {
      alert('Por favor, selecione um status');
      return;
    }

    setUpdating(true);
    try {
      const updateData = {
        status: newStatus,
        updatedAt: new Date(),
        atualizadoPor: user.uid
      };

      if (newStatus === TICKET_STATUS.COMPLETED) {
        updateData.conclusionDescription = conclusionDescription;
        updateData.conclusionImages = conclusionImages;
        updateData.concluidoEm = new Date();
        updateData.concluidoPor = user.uid;
      }

      if (newStatus === TICKET_STATUS.SENT_TO_AREA && selectedArea) {
        updateData.area = selectedArea;
        updateData.devolvido = true;
        updateData.devolvidoEm = new Date();
        updateData.devolvidoPor = user.uid;
      }

      await ticketService.updateTicket(ticketId, updateData);

      let messageContent = `📊 **Status alterado para: ${getStatusText(newStatus)}**`;
      
      if (conclusionDescription) {
        messageContent += `\n\n**Descrição:** ${conclusionDescription}`;
      }

      const statusMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: messageContent,
        criadoEm: new Date(),
        type: 'status_update',
        images: conclusionImages
      };

      await messageService.sendMessage(ticketId, statusMessage);
      await loadTicketData();
      
      setNewStatus('');
      setConclusionDescription('');
      setConclusionImages([]);
      setSelectedArea('');
      setShowAreaSelector(false);
      
      alert('Status atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && chatImages.length === 0) {
      return;
    }

    setSendingMessage(true);
    try {
      const messageData = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: newMessage,
        criadoEm: new Date(),
        type: 'message',
        images: chatImages
      };

      await messageService.sendMessage(ticketId, messageData);
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

  const handleImageUpload = (images, type = 'chat') => {
    if (type === 'chat') {
      setChatImages(prev => [...prev, ...images]);
    } else if (type === 'conclusion') {
      setConclusionImages(prev => [...prev, ...images]);
    }
  };

  const removeImage = (index, type = 'chat') => {
    if (type === 'chat') {
      setChatImages(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'conclusion') {
      setConclusionImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Carregando chamado...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Alert className="max-w-md mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="text-center mt-4">
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
        <div className="container mx-auto px-4 py-8">
          <Alert className="max-w-md mx-auto border-red-200 bg-red-50">
            <Lock className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Acesso negado. Este chamado é confidencial e você não tem permissão para visualizá-lo.
            </AlertDescription>
          </Alert>
          <div className="text-center mt-4">
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
        <div className="container mx-auto px-4 py-8">
          <Alert className="max-w-md mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Chamado não encontrado</AlertDescription>
          </Alert>
          <div className="text-center mt-4">
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const availableStatuses = getAvailableStatuses();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header do Chamado */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  Chamado #{ticket.id?.slice(-6) || 'N/A'}
                </h1>
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
              
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Criado em {formatDate(ticket.criadoEm)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>por {ticket.criadoPorNome || 'Usuário desconhecido'}</span>
                </div>
                {project && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{project.nome}</span>
                  </div>
                )}
              </div>
            </div>
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
                  <h3 className="font-semibold text-lg mb-2">{ticket.titulo}</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{ticket.descricao}</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Área</Label>
                    <p className="font-medium">{ticket.area?.replace('_', ' ').toUpperCase() || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Tipo</Label>
                    <p className="font-medium">{ticket.tipo || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Prioridade</Label>
                    <p className="font-medium">{ticket.prioridade || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Categoria</Label>
                    <p className="font-medium">{ticket.categoria || 'N/A'}</p>
                  </div>
                </div>

                {ticket.imagensIniciais && ticket.imagensIniciais.length > 0 && (
                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium text-gray-500 mb-2 block">Imagens Iniciais</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {ticket.imagensIniciais.map((image, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={image}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-75 transition-opacity"
                            onClick={() => window.open(image, '_blank')}
                          />
                          <ExternalLink className="absolute top-2 right-2 h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ações do Chamado */}
            {availableStatuses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Ações do Chamado</CardTitle>
                  <CardDescription>
                    {userProfile?.funcao === 'produtor' && canProducerComplete(ticket, user, userProfile) && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                        <p className="text-green-800 text-sm font-medium">
                          ✅ Você pode concluir este chamado
                        </p>
                      </div>
                    )}
                    Selecione uma ação para atualizar o status do chamado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="status-select">Novo Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o novo status" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            <div>
                              <div className="font-medium">{status.label}</div>
                              {status.description && (
                                <div className="text-sm text-gray-500">{status.description}</div>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {newStatus === TICKET_STATUS.COMPLETED && (
                    <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div>
                        <Label htmlFor="conclusion-description">Descrição da Conclusão</Label>
                        <Textarea
                          id="conclusion-description"
                          placeholder="Descreva como o chamado foi resolvido..."
                          value={conclusionDescription}
                          onChange={(e) => setConclusionDescription(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label>Imagens da Conclusão (opcional)</Label>
                        <ImageUpload
                          onImagesUploaded={(images) => handleImageUpload(images, 'conclusion')}
                          maxImages={5}
                          className="mt-1"
                        />
                        {conclusionImages.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {conclusionImages.map((image, index) => (
                              <div key={index} className="relative">
                                <img
                                  src={image}
                                  alt={`Conclusão ${index + 1}`}
                                  className="w-full h-20 object-cover rounded border"
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                                  onClick={() => removeImage(index, 'conclusion')}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {newStatus === TICKET_STATUS.SENT_TO_AREA && (
                    <div className="space-y-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div>
                        <Label htmlFor="area-select">Selecionar Área</Label>
                        <Select value={selectedArea} onValueChange={setSelectedArea}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a área de destino" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(AREAS).map(([key, value]) => (
                              <SelectItem key={key} value={key}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleStatusUpdate}
                    disabled={updating || !newStatus || (newStatus === TICKET_STATUS.SENT_TO_AREA && !selectedArea)}
                    className="w-full"
                  >
                    {updating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Atualizar Status
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Escalações */}
            {(userProfile?.funcao === 'operador' || userProfile?.funcao === 'administrador') && (
              <Card>
                <CardHeader>
                  <CardTitle>Escalações</CardTitle>
                  <CardDescription>
                    Escale o chamado para outras áreas ou gerência quando necessário
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Escalação para Área */}
                  <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900">Escalar para Outra Área</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="escalation-area">Área de Destino</Label>
                        <Select value={escalationArea} onValueChange={setEscalationArea}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a área" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(AREAS)
                              .filter(([key]) => key !== ticket.area)
                              .map(([key, value]) => (
                                <SelectItem key={key} value={key}>
                                  {value}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="escalation-reason">Motivo da Escalação</Label>
                        <Textarea
                          id="escalation-reason"
                          placeholder="Descreva o motivo da escalação..."
                          value={escalationReason}
                          onChange={(e) => setEscalationReason(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleEscalation}
                      disabled={isEscalating || !escalationArea || !escalationReason.trim()}
                      className="w-full"
                    >
                      {isEscalating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Escalando...
                        </>
                      ) : (
                        'Escalar para Área'
                      )}
                    </Button>
                  </div>

                  {/* Escalação para Gerência */}
                  <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h4 className="font-medium text-purple-900">Escalar para Gerência</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="management-area">Gerência</Label>
                        <Select value={managementArea} onValueChange={setManagementArea}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a gerência" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gerente_producao">Gerência de Produção</SelectItem>
                            <SelectItem value="gerente_operacional">Gerência Operacional</SelectItem>
                            <SelectItem value="gerente_logistica">Gerência de Logística</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="management-reason">Motivo da Escalação</Label>
                        <Textarea
                          id="management-reason"
                          placeholder="Descreva o motivo da escalação para gerência..."
                          value={managementReason}
                          onChange={(e) => setManagementReason(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleManagementEscalation}
                      disabled={isEscalatingToManagement || !managementArea || !managementReason.trim()}
                      className="w-full"
                    >
                      {isEscalatingToManagement ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Escalando...
                        </>
                      ) : (
                        'Escalar para Gerência'
                      )}
                    </Button>
                  </div>

                  {/* Escalação para Consultor */}
                  <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-900">Escalar para Consultor</h4>
                    <div>
                      <Label htmlFor="consultor-reason">Motivo da Escalação</Label>
                      <Textarea
                        id="consultor-reason"
                        placeholder="Descreva o motivo da escalação para consultor..."
                        value={consultorReason}
                        onChange={(e) => setConsultorReason(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleConsultorEscalation}
                      disabled={isEscalatingToConsultor || !consultorReason.trim()}
                      className="w-full"
                    >
                      {isEscalatingToConsultor ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Escalando...
                        </>
                      ) : (
                        'Escalar para Consultor'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chat de Mensagens */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversas ({messages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto mb-4 p-4 bg-gray-50 rounded-lg">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Nenhuma mensagem ainda</p>
                  ) : (
                    messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.userId === user.uid ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.userId === user.uid
                              ? 'bg-blue-500 text-white'
                              : message.type === 'system' || message.type === 'escalation' || message.type === 'status_update'
                              ? 'bg-gray-200 text-gray-800 border'
                              : 'bg-white text-gray-800 border'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">
                              {message.remetenteNome || 'Sistema'}
                            </span>
                            <span className="text-xs opacity-75">
                              {formatDate(message.criadoEm)}
                            </span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap">{message.conteudo}</div>
                          {message.images && message.images.length > 0 && (
                            <div className="grid grid-cols-2 gap-1 mt-2">
                              {message.images.map((image, imgIndex) => (
                                <img
                                  key={imgIndex}
                                  src={image}
                                  alt={`Anexo ${imgIndex + 1}`}
                                  className="w-full h-16 object-cover rounded cursor-pointer hover:opacity-75 transition-opacity"
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

                {/* Input de nova mensagem */}
                <div className="space-y-4">
                  <div className="relative">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Digite sua mensagem... (use @ para mencionar usuários)"
                      value={newMessage}
                      onChange={handleTextareaChange}
                      onKeyDown={handleTextareaKeyDown}
                      className="min-h-[80px] pr-12"
                    />
                    
                    {/* Sugestões de menção */}
                    {showMentionSuggestions && mentionSuggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                        {mentionSuggestions.map((user, index) => (
                          <button
                            key={user.uid}
                            className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                            onClick={() => insertMention(user)}
                          >
                            <AtSign className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{user.nome}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Upload de imagens para chat */}
                  <div>
                    <ImageUpload
                      onImagesUploaded={(images) => handleImageUpload(images, 'chat')}
                      maxImages={3}
                      className="mb-2"
                    />
                    {chatImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {chatImages.map((image, index) => (
                          <div key={index} className="relative">
                            <img
                              src={image}
                              alt={`Anexo ${index + 1}`}
                              className="w-full h-16 object-cover rounded border"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                              onClick={() => removeImage(index, 'chat')}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || (!newMessage.trim() && chatImages.length === 0)}
                    className="w-full"
                  >
                    {sendingMessage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar Mensagem
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Informações do Projeto */}
            {project && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Projeto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Nome</Label>
                    <p className="font-medium">{project.nome}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Local</Label>
                    <p className="font-medium">{project.local}</p>
                  </div>
                  {project.dataInicio && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Data de Início</Label>
                      <p className="font-medium">{formatDate(project.dataInicio)}</p>
                    </div>
                  )}
                  {project.dataFim && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Data de Fim</Label>
                      <p className="font-medium">{formatDate(project.dataFim)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pessoas Envolvidas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Pessoas Envolvidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Criado por</Label>
                  <p className="font-medium">{ticket.criadoPorNome || 'Usuário desconhecido'}</p>
                </div>
                {ticket.atribuidoA && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Atribuído a</Label>
                    <p className="font-medium">{ticket.atribuidoANome || 'Usuário desconhecido'}</p>
                  </div>
                )}
                {ticket.gerenteResponsavelId && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Gerente Responsável</Label>
                    <p className="font-medium">{ticket.gerenteResponsavelNome || 'Gerente'}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico de Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Histórico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {messages
                    .filter(msg => msg.type === 'status_update' || msg.type === 'escalation' || msg.type === 'system')
                    .slice(-5)
                    .map((message, index) => (
                      <div key={index} className="text-sm">
                        <p className="font-medium text-gray-900">{message.conteudo}</p>
                        <p className="text-gray-500 text-xs">
                          {formatDate(message.criadoEm)} - {message.remetenteNome}
                        </p>
                      </div>
                    ))}
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

