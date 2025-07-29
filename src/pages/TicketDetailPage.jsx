import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
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

// NOVO: Componente de Modal para substituir os alertas nativos do navegador.
// Isso oferece uma experiência de usuário muito melhor e mais integrada.
const AlertModal = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md transform transition-all duration-300 scale-95 hover:scale-100">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <X className="h-6 w-6" />
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>OK</Button>
        </div>
      </div>
    </div>
  );
};


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

  // NOVO: Estado para controlar o modal de alerta
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });

  // Estados do chat
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatImages, setChatImages] = useState([]);

  // Estados de atualização de status
  const [newStatus, setNewStatus] = useState('');
  const [conclusionImages, setConclusionImages] = useState([]);
  const [conclusionDescription, setConclusionDescription] = useState('');
  const [selectedArea, setSelectedArea] = useState('');

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

  // NOVO: Função para exibir o modal de alerta de forma centralizada
  const showAlert = (title, message) => {
    setAlertInfo({ isOpen: true, title, message });
  };

  // CORREÇÃO: Envolver a função de carregamento em useCallback para evitar
  // recriações desnecessárias em cada renderização, o que pode causar loops
  // de requisições e o erro "429 Too Many Requests".
  const loadTicketData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);

      const ticketData = await ticketService.getTicketById(ticketId);
      if (!ticketData) {
        throw new Error('Chamado não encontrado');
      }
      setTicket(ticketData);

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
  }, [ticketId]); // A dependência é ticketId, pois a função depende dele para buscar os dados.

  const markNotificationsAsRead = useCallback(async () => {
    if (!user?.uid || !ticketId) return;
    try {
      await notificationService.markTicketNotificationsAsRead(user.uid, ticketId);
      console.log('✅ Notificações marcadas como lidas para o chamado:', ticketId);
    } catch (error) {
      console.error('❌ Erro ao marcar notificações como lidas:', error);
    }
  }, [user, ticketId]); // Depende do usuário e do ticketId.

  useEffect(() => {
    if (ticketId && user) {
      loadTicketData();
      markNotificationsAsRead();
    }
    // CORREÇÃO: Adicionar as funções memoizadas (useCallback) ao array de dependências
    // para garantir que o useEffect só rode quando realmente necessário.
  }, [ticketId, user, loadTicketData, markNotificationsAsRead]);

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
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
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
    const isCreator = ticket.criadoPor === user.uid;

    // Lógica para Administrador (geralmente tem mais permissões)
    if (userRole === 'administrador') {
      // Pode fazer quase tudo, simplificando as opções para os status mais comuns
      if (currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
        return [
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir (Admin)', description: 'Finalizar o chamado como administrador' },
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Devolver para Área (Admin)', description: 'Devolver para a área de origem' }
        ];
      }
      // Adicione outras lógicas de admin se necessário
    }

    // Lógica para Produtor (Operador)
    if (userRole === 'operador') {
      const isFromUserArea = ticket.area === userProfile.area;
      const isAssignedToUser = ticket.atribuidoA === user.uid;
      const canManage = isFromUserArea || isAssignedToUser;

      if (canManage) {
        if ([TICKET_STATUS.OPEN, TICKET_STATUS.SENT_TO_AREA, 'devolvido'].includes(currentStatus)) {
          return [{ value: TICKET_STATUS.IN_TREATMENT, label: 'Iniciar Tratativa', description: 'Começar a trabalhar no chamado' }];
        }
        if (currentStatus === TICKET_STATUS.IN_TREATMENT) {
          return [{ value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executar', description: 'Marcar como executado para validação' }];
        }
      }

      // CORREÇÃO PRINCIPAL: Lógica para Produtor (Operador) validar um chamado executado.
      if (isCreator && currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
        return [
          { value: TICKET_STATUS.COMPLETED, label: 'Validar e Concluir', description: 'Validar a execução e finalizar o chamado' },
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Rejeitar Execução', description: 'Rejeitar e devolver para a última área' }
        ];
      }
    }

    // Lógica para Gerente
    if (userRole === 'gerente') {
      const isEscalatedToThisManager = currentStatus === 'aguardando_aprovacao' && ticket.gerenteResponsavelId === user.uid;
      if (isEscalatedToThisManager) {
        return [
          { value: TICKET_STATUS.APPROVED, label: 'Aprovar', description: 'Aprovar e retornar para área' },
          { value: TICKET_STATUS.REJECTED, label: 'Reprovar', description: 'Reprovar e encerrar chamado' }
        ];
      }
    }

    // Lógica para Consultor
    if (userRole === 'consultor' && isCreator) {
      // CORREÇÃO: Permitir que o consultor que abriu o chamado possa concluí-lo
      if (currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
        return [
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir e Finalizar', description: 'Validar a execução e finalizar o chamado' },
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Rejeitar Execução', description: 'Rejeitar a execução e devolver para a área de origem' }
        ];
      }
    }

    return [];
  };

  const handleEscalation = async () => {
    if (!escalationArea || !escalationReason.trim()) {
      showAlert('Atenção', 'Por favor, selecione uma área de destino e descreva o motivo da escalação.');
      return;
    }
    setIsEscalating(true);
    try {
      const updateData = {
        status: TICKET_STATUS.ESCALATED_TO_OTHER_AREA,
        area: escalationArea,
        areaDeOrigem: ticket.area,
        motivoEscalonamento: escalationReason,
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.escalateTicketToArea(ticketId, escalationArea, updateData);
      await messageService.sendMessage(ticketId, {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `🔄 **Chamado escalado para ${escalationArea.replace(/_/g, ' ').toUpperCase()}**\n\n**Motivo:** ${escalationReason}`,
        criadoEm: new Date(),
        type: 'escalation'
      });
      await loadTicketData();
      setEscalationArea('');
      setEscalationReason('');
      showAlert('Sucesso!', 'Chamado escalado com sucesso!');
    } catch (error) {
      console.error('Erro ao escalar chamado:', error);
      showAlert('Erro', 'Ocorreu um erro ao escalar o chamado: ' + error.message);
    } finally {
      setIsEscalating(false);
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
        await notificationService.notifyNewMessage(ticketId, ticket, messageData, user.uid);
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificação de nova mensagem:', notificationError);
      }

      setMessages(prev => [...prev, messageData]);
      setNewMessage('');
      setChatImages([]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      showAlert('Erro', 'Não foi possível enviar a mensagem: ' + error.message);
    } finally {
      setSendingMessage(false);
    }
  };
  
  const handleStatusUpdate = async () => {
    if (!newStatus) return;

    if ((newStatus === TICKET_STATUS.REJECTED || newStatus === TICKET_STATUS.SENT_TO_AREA) && !conclusionDescription.trim()) {
      showAlert('Campo Obrigatório', 'Por favor, forneça um motivo para a rejeição ou devolução.');
      return;
    }

    setUpdating(true);
    try {
      let updateData = {
        status: newStatus,
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      
      if (newStatus === TICKET_STATUS.COMPLETED) {
        updateData.conclusaoDescricao = conclusionDescription;
        updateData.conclusaoImagens = conclusionImages;
        updateData.concluidoEm = new Date();
        updateData.concluidoPor = user.uid;
      } else if (newStatus === TICKET_STATUS.SENT_TO_AREA) {
        updateData.status = 'devolvido';
        updateData.motivoRejeicao = conclusionDescription;
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        updateData.area = ticket.areaDeOrigem || ticket.area; 
      }
      
      await ticketService.updateTicket(ticketId, updateData);

      const statusMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `🔄 **Status atualizado para: ${getStatusText(newStatus)}**\n\n**Motivo/Descrição:** ${conclusionDescription || 'N/A'}`,
        criadoEm: new Date(),
        type: 'status_update'
      };
      await messageService.sendMessage(ticketId, statusMessage);

      try {
        await notificationService.notifyStatusChange(ticketId, ticket, newStatus, ticket.status, user.uid);
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificação de mudança de status:', notificationError);
      }

      await loadTicketData();
      setNewStatus('');
      setConclusionDescription('');
      setConclusionImages([]);
      showAlert('Sucesso!', 'Status do chamado atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showAlert('Erro', 'Ocorreu um erro ao atualizar o status: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleManagementEscalation = async () => {
    if (!managementArea || !managementReason.trim()) {
      showAlert('Atenção', 'Por favor, selecione uma gerência e descreva o motivo.');
      return;
    }
    
    const targetArea = managementArea.replace('gerente_', '');
    const targetManager = users.find(u => u.funcao === 'gerente' && u.area === targetArea);
    
    if (!targetManager) {
      showAlert('Erro', `Nenhum gerente encontrado para a área "${targetArea}".`);
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
      await ticketService.updateTicket(ticketId, updateData);
      // Mensagens e notificações...
      await loadTicketData();
      showAlert('Sucesso', 'Chamado escalado para gerência!');
    } catch (error) {
      showAlert('Erro', 'Falha ao escalar para gerência: ' + error.message);
    } finally {
      setIsEscalatingToManagement(false);
    }
  };

  const handleConsultorEscalation = async () => {
    if (!consultorReason.trim() || !project?.consultorId) {
      showAlert('Atenção', 'O motivo é obrigatório e o projeto deve ter um consultor definido.');
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
      // Mensagens e notificações...
      await loadTicketData();
      showAlert('Sucesso', 'Chamado escalado para o consultor!');
    } catch (error) {
      showAlert('Erro', 'Falha ao escalar para consultor: ' + error.message);
    } finally {
      setIsEscalatingToConsultor(false);
    }
  };

  const handleTransferToProducer = async () => {
    if (!project?.produtorId) {
      showAlert('Erro', 'Produtor do projeto não encontrado.');
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
      // Mensagens e notificações...
      await loadTicketData();
      showAlert('Sucesso', 'Chamado transferido para o produtor!');
    } catch (error) {
      showAlert('Erro', 'Falha ao transferir para produtor: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

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
    }
  };

  const insertMention = (user) => {
    const beforeCursor = newMessage.substring(0, cursorPosition);
    const afterCursor = newMessage.substring(cursorPosition);
    const beforeMention = beforeCursor.replace(/@\w*$/, '');
    const newText = `${beforeMention}@${user.nome} ${afterCursor}`;
    
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

  return (
    <div className="min-h-screen bg-gray-50">
      <AlertModal
        isOpen={alertInfo.isOpen}
        onClose={() => setAlertInfo({ isOpen: false, title: '', message: '' })}
        title={alertInfo.title}
        message={alertInfo.message}
      />

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
                        placeholder="Digite sua mensagem..."
                        value={newMessage}
                        onChange={handleTextareaChange}
                        onKeyDown={handleTextareaKeyDown}
                        rows={3}
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
                    <Button
                      onClick={handleEscalation}
                      disabled={!escalationArea || !escalationReason.trim() || isEscalating}
                      className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {isEscalating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Escalando...</> : <><span className="mr-2">🚀</span>Enviar Escalação</>}
                    </Button>
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
                  {(newStatus === TICKET_STATUS.COMPLETED || newStatus === TICKET_STATUS.REJECTED || newStatus === TICKET_STATUS.SENT_TO_AREA) && (
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
                          className={(newStatus === TICKET_STATUS.REJECTED || newStatus === TICKET_STATUS.SENT_TO_AREA) ? "border-red-300 focus:border-red-500" : ""}
                        />
                        {(newStatus === TICKET_STATUS.REJECTED || newStatus === TICKET_STATUS.SENT_TO_AREA) && (
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;
