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

    // ✅ AJUSTE 5: Produtor tem 3 opções quando consultor abre chamado
    if (userRole === 'produtor') {
      // Quando consultor abre chamado, produtor tem 3 opções
      if (currentStatus === TICKET_STATUS.OPEN && ticket.criadoPorFuncao === 'consultor') {
        return [
          { value: TICKET_STATUS.IN_TREATMENT, label: 'Dar Tratativa', description: 'Iniciar tratamento do chamado' },
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Finalizar chamado diretamente' },
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Enviar para Área', description: 'Escalar para área responsável' }
        ];
      }
      
      // Mantém lógica original para outros casos
      if (currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
        return [
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Devolver', description: 'Devolver para área com motivo' },
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Finalizar chamado' }
        ];
      }
    }

    if (userRole === 'operador') {
      const isFromUserArea = ticket.area === userProfile.area;
      const isAssignedToUser = ticket.atribuidoA === user.uid;
      const canManage = isFromUserArea || isAssignedToUser;

      if (canManage) {
        if (currentStatus === TICKET_STATUS.OPEN) {
          const options = [
            { value: TICKET_STATUS.IN_TREATMENT, label: 'Iniciar Tratativa', description: 'Começar a trabalhar no chamado' }
          ];
          
          // ✅ AJUSTE 6: Escalação "Enviar para Produtor"
          if (ticket.criadoPor === user.uid) {
            options.push({ 
              value: 'enviar_para_produtor', 
              label: 'Enviar para Produtor', 
              description: 'Escalar para produtor dar continuidade' 
            });
          }
          
          return options;
        }
        
        if (currentStatus === TICKET_STATUS.IN_TREATMENT) {
          return [
            { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado para validação' }
          ];
        }
        
        // ✅ AJUSTE 4: Operador pode concluir chamado que criou quando executado por outra área
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
      alert('Gerente não encontrado para a área selecionada');
      return;
    }

    setIsEscalatingToManagement(true);
    try {
      const updateData = {
        status: 'aguardando_aprovacao',
        gerenteResponsavelId: targetManager.id,
        motivoEscalonamento: managementReason,
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      
      await ticketService.updateTicket(ticketId, updateData);
      
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `🔼 **Chamado escalado para GERÊNCIA (${targetArea.toUpperCase()})**\n\n**Gerente:** ${targetManager.nome}\n**Motivo:** ${managementReason}`,
        criadoEm: new Date(),
        type: 'escalation'
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
        motivoEscalonamento: consultorReason,
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      
      await ticketService.updateTicket(ticketId, updateData);
      
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `📋 **Chamado escalado para CONSULTOR**\n\n**Motivo:** ${consultorReason}`,
        criadoEm: new Date(),
        type: 'escalation'
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
    if (!newStatus) return;

    setUpdating(true);
    try {
      let updateData = {
        status: newStatus,
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };

      // ✅ AJUSTE 6: Tratar escalação para produtor
      if (newStatus === 'enviar_para_produtor') {
        updateData.status = TICKET_STATUS.IN_TREATMENT;
        updateData.responsavelAtual = 'produtor';
        updateData.transferidoParaProdutor = true;
      }

      if (newStatus === TICKET_STATUS.COMPLETED) {
        updateData.conclusaoDescricao = conclusionDescription;
        updateData.conclusaoImagens = conclusionImages;
        updateData.concluidoEm = new Date();
        updateData.concluidoPor = user.uid;
      }

      if (newStatus === TICKET_STATUS.ESCALATED_TO_OTHER_AREA && selectedArea) {
        updateData.area = selectedArea;
        updateData.areaAnterior = ticket.area;
      }

      await ticketService.updateTicket(ticketId, updateData);

      const statusMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `📊 **Status alterado para: ${getStatusText(newStatus)}**`,
        criadoEm: new Date(),
        type: 'status_change'
      };

      await messageService.sendMessage(ticketId, statusMessage);
      await loadTicketData();

      setNewStatus('');
      setConclusionDescription('');
      setConclusionImages([]);
      setSelectedArea('');

      alert('Status atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sendingMessage) return;

    setSendingMessage(true);
    try {
      const messageData = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: newMessage,
        imagens: chatImages,
        criadoEm: new Date(),
        type: 'user_message'
      };

      await messageService.sendMessage(ticketId, messageData);
      setNewMessage('');
      setChatImages([]);
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem: ' + error.message);
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Carregando chamado...</p>
            </div>
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
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <div className="text-center mt-4">
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
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
              <ArrowLeft className="mr-2 h-4 w-4" />
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
            <AlertDescription>
              Chamado não encontrado.
            </AlertDescription>
          </Alert>
          <div className="text-center mt-4">
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
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
      
      <div className="container mx-auto px-4 py-8">
        {/* Header do Chamado */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="flex items-center"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Chamado #{ticket.numero}
                </h1>
                <p className="text-gray-600 mb-4">{ticket.titulo}</p>
                
                {/* ✅ AJUSTE 1: Flag de Item Extra */}
                {ticket.itemExtra && (
                  <div className="flex items-center space-x-2 mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-orange-600 text-lg">🔥</div>
                    <div>
                      <p className="font-semibold text-orange-800">ITEM EXTRA</p>
                      <p className="text-sm text-orange-700">{ticket.motivoItemExtra}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end space-y-2">
                <Badge variant={
                  ticket.prioridade === 'alta' ? 'destructive' :
                  ticket.prioridade === 'media' ? 'default' : 'secondary'
                }>
                  {ticket.prioridade?.toUpperCase()}
                </Badge>
                <Badge className={getStatusColor(ticket.status)}>
                  {getStatusText(ticket.status)}
                </Badge>
                {ticket.isConfidential && (
                  <Badge variant="destructive">
                    <Lock className="mr-1 h-3 w-3" />
                    CONFIDENCIAL
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Área:</span>
                <span className="ml-2 text-gray-900">{ticket.area}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Projeto:</span>
                <span className="ml-2 text-gray-900">{project?.nome || 'Não especificado'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Criado em:</span>
                <span className="ml-2 text-gray-900">{formatDate(ticket.criadoEm)}</span>
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
                  <Label className="text-sm font-medium text-gray-700">Descrição</Label>
                  <p className="mt-1 text-gray-900 whitespace-pre-wrap">{ticket.descricao}</p>
                </div>

                {ticket.imagens && ticket.imagens.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Imagens</Label>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                      {ticket.imagens.map((imagem, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imagem}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-75 transition-opacity"
                            onClick={() => window.open(imagem, '_blank')}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-6 w-6 text-white drop-shadow-lg" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ✅ AJUSTE 2: Pessoas Envolvidas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Pessoas Envolvidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Sempre mostrar quem criou */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-blue-900">
                        {users.find(u => u.id === ticket.criadoPor)?.nome || 'Usuário não encontrado'}
                      </p>
                      <p className="text-sm text-blue-700">
                        {users.find(u => u.id === ticket.criadoPor)?.funcao} - {users.find(u => u.id === ticket.criadoPor)?.area}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">
                      Criador
                    </Badge>
                  </div>

                  {/* Histórico de pessoas que trataram */}
                  {ticket.consultorId && ticket.consultorId !== ticket.criadoPor && (
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium text-green-900">
                          {users.find(u => u.id === ticket.consultorId)?.nome || 'Consultor não encontrado'}
                        </p>
                        <p className="text-sm text-green-700">
                          {users.find(u => u.id === ticket.consultorId)?.funcao} - {users.find(u => u.id === ticket.consultorId)?.area}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        Consultor
                      </Badge>
                    </div>
                  )}

                  {ticket.produtorId && ticket.produtorId !== ticket.criadoPor && (
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <p className="font-medium text-purple-900">
                          {users.find(u => u.id === ticket.produtorId)?.nome || 'Produtor não encontrado'}
                        </p>
                        <p className="text-sm text-purple-700">
                          {users.find(u => u.id === ticket.produtorId)?.funcao} - {users.find(u => u.id === ticket.produtorId)?.area}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">
                        Produtor
                      </Badge>
                    </div>
                  )}

                  {ticket.gerenteResponsavelId && (
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div>
                        <p className="font-medium text-orange-900">
                          {users.find(u => u.id === ticket.gerenteResponsavelId)?.nome || 'Gerente não encontrado'}
                        </p>
                        <p className="text-sm text-orange-700">
                          {users.find(u => u.id === ticket.gerenteResponsavelId)?.funcao} - {users.find(u => u.id === ticket.gerenteResponsavelId)?.area}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">
                        Gerente Responsável
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ✅ AJUSTE 3: Histórico Detalhado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Histórico Detalhado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Abertura do chamado */}
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Chamado Aberto</p>
                      <p className="text-sm text-gray-600">
                        por {users.find(u => u.id === ticket.criadoPor)?.nome || 'Usuário não encontrado'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(ticket.criadoEm)}
                      </p>
                    </div>
                  </div>

                  {/* Mensagens de sistema (movimentações) */}
                  {messages
                    .filter(msg => msg.type === 'escalation' || msg.type === 'status_change')
                    .map((msg, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div 
                            className="font-medium text-gray-900"
                            dangerouslySetInnerHTML={{ __html: msg.conteudo.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                          />
                          <p className="text-sm text-gray-600">
                            por {msg.remetenteNome}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(msg.criadoEm)}
                          </p>
                        </div>
                      </div>
                    ))}

                  {/* Última atualização */}
                  {ticket.atualizadoEm && (
                    <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Última Atualização</p>
                        <p className="text-sm text-gray-600">
                          Status: {getStatusText(ticket.status)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(ticket.atualizadoEm)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chat de Mensagens */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Mensagens ({messages.filter(msg => msg.type === 'user_message').length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                  {messages.filter(msg => msg.type === 'user_message').map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.userId === user.uid ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.userId === user.uid
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.conteudo}</p>
                        {message.imagens && message.imagens.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {message.imagens.map((imagem, imgIndex) => (
                              <img
                                key={imgIndex}
                                src={imagem}
                                alt={`Anexo ${imgIndex + 1}`}
                                className="w-full h-20 object-cover rounded cursor-pointer"
                                onClick={() => window.open(imagem, '_blank')}
                              />
                            ))}
                          </div>
                        )}
                        <p className={`text-xs mt-1 ${
                          message.userId === user.uid ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.remetenteNome} • {formatDate(message.criadoEm)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Campo de nova mensagem */}
                <div className="relative">
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <Textarea
                        ref={textareaRef}
                        placeholder="Digite sua mensagem... (use @ para mencionar usuários)"
                        value={newMessage}
                        onChange={handleTextareaChange}
                        onKeyDown={(e) => {
                          handleTextareaKeyDown(e);
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        className="resize-none"
                        rows={3}
                      />

                      {/* Sugestões de menção */}
                      {showMentionSuggestions && mentionSuggestions.length > 0 && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                          {mentionSuggestions.map((user) => (
                            <div
                              key={user.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center space-x-2"
                              onClick={() => insertMention(user)}
                            >
                              <AtSign className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium">{user.nome}</p>
                                <p className="text-xs text-gray-500">{user.funcao} - {user.area}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2">
                      <ImageUpload
                        onImagesChange={setChatImages}
                        maxImages={3}
                        className="w-10 h-10"
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sendingMessage}
                        size="sm"
                      >
                        {sendingMessage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Preview das imagens do chat */}
                  {chatImages.length > 0 && (
                    <div className="mt-2 flex space-x-2">
                      {chatImages.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image}
                            alt={`Preview ${index + 1}`}
                            className="w-16 h-16 object-cover rounded border"
                          />
                          <button
                            onClick={() => setChatImages(prev => prev.filter((_, i) => i !== index))}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna Lateral */}
          <div className="space-y-6">
            {/* Ações de Status */}
            {availableStatuses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Ações Disponíveis</CardTitle>
                  <CardDescription>
                    Alterar status do chamado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Novo Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um status" />
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

                  {/* Campos condicionais */}
                  {newStatus === TICKET_STATUS.COMPLETED && (
                    <div className="space-y-4">
                      <div>
                        <Label>Descrição da Conclusão</Label>
                        <Textarea
                          placeholder="Descreva como o chamado foi resolvido..."
                          value={conclusionDescription}
                          onChange={(e) => setConclusionDescription(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label>Imagens da Conclusão</Label>
                        <ImageUpload
                          onImagesChange={setConclusionImages}
                          maxImages={5}
                        />
                      </div>
                    </div>
                  )}

                  {newStatus === TICKET_STATUS.ESCALATED_TO_OTHER_AREA && (
                    <div>
                      <Label>Área de Destino</Label>
                      <Select value={selectedArea} onValueChange={setSelectedArea}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma área" />
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
                  )}

                  <Button 
                    onClick={handleStatusUpdate} 
                    disabled={!newStatus || updating}
                    className="w-full"
                  >
                    {updating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      'Atualizar Status'
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Escalações */}
            <Card>
              <CardHeader>
                <CardTitle>Escalações</CardTitle>
                <CardDescription>
                  Escalar chamado para outras áreas ou gerência
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Escalação para Área */}
                <div className="space-y-2">
                  <Label>Escalar para Área</Label>
                  <Select value={escalationArea} onValueChange={setEscalationArea}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma área" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AREAS).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="Motivo da escalação..."
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    rows={2}
                  />
                  <Button 
                    onClick={handleEscalation}
                    disabled={!escalationArea || !escalationReason.trim() || isEscalating}
                    size="sm"
                    className="w-full"
                  >
                    {isEscalating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Escalando...
                      </>
                    ) : (
                      'Escalar para Área'
                    )}
                  </Button>
                </div>

                <Separator />

                {/* Escalação para Gerência */}
                <div className="space-y-2">
                  <Label>Escalar para Gerência</Label>
                  <Select value={managementArea} onValueChange={setManagementArea}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma gerência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gerente_producao">Gerência de Produção</SelectItem>
                      <SelectItem value="gerente_comercial">Gerência Comercial</SelectItem>
                      <SelectItem value="gerente_financeiro">Gerência Financeira</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="Motivo da escalação para gerência..."
                    value={managementReason}
                    onChange={(e) => setManagementReason(e.target.value)}
                    rows={2}
                  />
                  <Button 
                    onClick={handleManagementEscalation}
                    disabled={!managementArea || !managementReason.trim() || isEscalatingToManagement}
                    size="sm"
                    className="w-full"
                  >
                    {isEscalatingToManagement ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Escalando...
                      </>
                    ) : (
                      'Escalar para Gerência'
                    )}
                  </Button>
                </div>

                <Separator />

                {/* Escalação para Consultor */}
                <div className="space-y-2">
                  <Label>Escalar para Consultor</Label>
                  <Textarea
                    placeholder="Motivo da escalação para consultor..."
                    value={consultorReason}
                    onChange={(e) => setConsultorReason(e.target.value)}
                    rows={2}
                  />
                  <Button 
                    onClick={handleConsultorEscalation}
                    disabled={!consultorReason.trim() || isEscalatingToConsultor}
                    size="sm"
                    className="w-full"
                  >
                    {isEscalatingToConsultor ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Escalando...
                      </>
                    ) : (
                      'Escalar para Consultor'
                    )}
                  </Button>
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

