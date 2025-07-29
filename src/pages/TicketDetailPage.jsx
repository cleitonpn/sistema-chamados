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
  Lock
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

  // ✅ AJUSTE 4: Função para verificar se operador pode concluir
  const canOperatorComplete = (ticket, user, userProfile) => {
    if (!ticket || !user || !userProfile || userProfile?.funcao !== 'operador') return false;
    
    try {
      // Operador que abriu chamado pode concluir quando executado por outra área
      if (ticket.criadoPor === user.uid && 
          (ticket.status === 'executado_aguardando_validacao' || 
           ticket.status === 'executado_aguardando_validacao_operador')) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao verificar permissões do operador:', error);
      return false;
    }
  };

  // ✅ AJUSTE 5: Função para verificar se produtor pode ter 3 opções
  const canProducerHaveThreeOptions = (ticket, user, userProfile) => {
    if (!ticket || !user || !userProfile || userProfile?.funcao !== 'produtor') return false;
    
    try {
      // Quando consultor abre chamado, produtor tem 3 opções
      if (ticket.status === 'aberto' && ticket.criadoPorFuncao === 'consultor') {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao verificar opções do produtor:', error);
      return false;
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

    // ADMINISTRADOR - Mantém lógica original
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

    // CONSULTOR - Mantém lógica original
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

    // PRODUTOR - Com ajustes
    if (userRole === 'produtor') {
      const isProjectProducer = project && (project.produtorId === user.uid || project.consultorId === user.uid);
      const isCurrentResponsible = ticket.responsavelAtual === 'produtor' ||
                                   ticket.responsavelAtual === 'consultor_produtor' ||
                                   ticket.responsavelId === user.uid;

      if (!isCurrentResponsible) {
        return [];
      }

      // ✅ AJUSTE 5: Quando consultor abre chamado, produtor tem 3 opções
      if (canProducerHaveThreeOptions(ticket, user, userProfile)) {
        return [
          { value: TICKET_STATUS.IN_TREATMENT, label: 'Dar Tratativa', description: 'Iniciar tratamento do chamado' },
          { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Finalizar chamado diretamente' },
          { value: TICKET_STATUS.SENT_TO_AREA, label: 'Enviar para Área', description: 'Escalar para área específica' }
        ];
      }

      // Mantém lógica original para outros casos
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

    // OPERADOR - Com ajustes
    if (userRole === 'operador') {
      // ✅ AJUSTE 4: Operador pode concluir chamado que criou quando executado por outra área
      if (canOperatorComplete(ticket, user, userProfile)) {
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
          const options = [
            { value: TICKET_STATUS.IN_TREATMENT, label: 'Tratativa', description: 'Dar andamento ao chamado' },
            { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado para validação' }
          ];

          // ✅ AJUSTE 6: Escalação "Enviar para Produtor"
          if (ticket.criadoPorFuncao === 'operador' && ticket.criadoPor === user.uid) {
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
      }

      return [];
    }

    // GERENTE - Mantém lógica original
    if (userRole === 'gerente') {
      if (currentStatus === TICKET_STATUS.AWAITING_APPROVAL) {
        const isResponsibleManager = ticket.gerenteResponsavelId === user.uid;
        const isAreaManager = userProfile.area === ticket.area;

        if (isResponsibleManager || isAreaManager) {
          return [
            { value: TICKET_STATUS.APPROVED, label: 'Aprovar', description: 'Aprovar e retornar para área' },
            { value: TICKET_STATUS.REJECTED, label: 'Reprovar', description: 'Reprovar e encerrar (motivo obrigatório)' }
          ];
        }
      }
      return [];
    }

    return [];
  };

  // Resto das funções mantém a lógica original...
  const handleStatusUpdate = async () => {
    if (!newStatus || updating) return;

    try {
      setUpdating(true);

      const updateData = {
        status: newStatus,
        atualizadoEm: new Date(),
        atualizadoPor: user.uid
      };

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

      // ✅ AJUSTE 6: Tratar escalação para produtor
      if (newStatus === 'enviar_para_produtor') {
        updateData.status = TICKET_STATUS.IN_TREATMENT;
        updateData.responsavelAtual = 'produtor';
        updateData.transferidoParaProdutor = true;
        updateData.motivoEscalacao = escalationReason;
      }

      await ticketService.updateTicket(ticketId, updateData);

      // Adicionar mensagem de sistema
      const systemMessage = {
        chamadoId: ticketId,
        remetenteId: user.uid,
        remetente: userProfile.nome || user.email,
        conteudo: `Status alterado para: ${getStatusLabel(newStatus)}`,
        tipo: 'sistema',
        criadoEm: new Date()
      };

      await messageService.addMessage(systemMessage);

      // Recarregar dados
      await loadTicketData();

      // Limpar campos
      setNewStatus('');
      setConclusionDescription('');
      setConclusionImages([]);
      setSelectedArea('');

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setError('Erro ao atualizar status do chamado');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      [TICKET_STATUS.OPEN]: 'Aberto',
      [TICKET_STATUS.IN_ANALYSIS]: 'Em Análise',
      [TICKET_STATUS.SENT_TO_AREA]: 'Enviado para Área',
      [TICKET_STATUS.IN_TREATMENT]: 'Em Tratativa',
      [TICKET_STATUS.IN_EXECUTION]: 'Em Execução',
      [TICKET_STATUS.EXECUTED_AWAITING_VALIDATION]: 'Executado - Aguardando Validação',
      [TICKET_STATUS.COMPLETED]: 'Concluído',
      [TICKET_STATUS.AWAITING_APPROVAL]: 'Aguardando Aprovação',
      [TICKET_STATUS.APPROVED]: 'Aprovado',
      [TICKET_STATUS.REJECTED]: 'Reprovado',
      'enviar_para_produtor': 'Enviado para Produtor'
    };
    return labels[status] || status;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sendingMessage) return;

    try {
      setSendingMessage(true);

      const mentions = extractMentions(newMessage);

      const messageData = {
        chamadoId: ticketId,
        remetenteId: user.uid,
        remetente: userProfile.nome || user.email,
        conteudo: newMessage,
        tipo: 'usuario',
        criadoEm: new Date(),
        imagens: chatImages,
        mencoes: mentions.map(user => user.id)
      };

      await messageService.addMessage(messageData);

      if (mentions.length > 0) {
        for (const mentionedUser of mentions) {
          try {
            await notificationService.notifyMention(ticketId, ticket, mentionedUser.id, user.uid, newMessage);
          } catch (error) {
            console.error('Erro ao enviar notificação de menção:', error);
          }
        }
      }

      setNewMessage('');
      setChatImages([]);
      await loadTicketData();

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setError('Erro ao enviar mensagem');
    } finally {
      setSendingMessage(false);
    }
  };

  // Resto do componente mantém a estrutura original...
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
                <Badge variant="outline">
                  {getStatusLabel(ticket.status)}
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
                <span className="ml-2 text-gray-900">
                  {ticket.criadoEm?.toDate?.()?.toLocaleDateString('pt-BR') || 'Data não disponível'}
                </span>
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
                        {ticket.criadoEm?.toDate?.()?.toLocaleString('pt-BR') || 'Data não disponível'}
                      </p>
                    </div>
                  </div>

                  {/* Mensagens de sistema (movimentações) */}
                  {messages
                    .filter(msg => msg.tipo === 'sistema')
                    .map((msg, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{msg.conteudo}</p>
                          <p className="text-sm text-gray-600">
                            por {msg.remetente}
                          </p>
                          <p className="text-xs text-gray-500">
                            {msg.criadoEm?.toDate?.()?.toLocaleString('pt-BR') || 'Data não disponível'}
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
                          Status: {getStatusLabel(ticket.status)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {ticket.atualizadoEm?.toDate?.()?.toLocaleString('pt-BR') || 'Data não disponível'}
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
                  Mensagens ({messages.filter(msg => msg.tipo === 'usuario').length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                  {messages.filter(msg => msg.tipo === 'usuario').map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.remetenteId === user.uid ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.remetenteId === user.uid
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <div
                          className="text-sm"
                          dangerouslySetInnerHTML={{
                            __html: processTextWithMentions(message.conteudo)
                          }}
                        />
                        {message.imagens && message.imagens.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {message.imagens.map((imagem, index) => (
                              <img
                                key={index}
                                src={imagem}
                                alt={`Anexo ${index + 1}`}
                                className="w-full h-20 object-cover rounded cursor-pointer"
                                onClick={() => window.open(imagem, '_blank')}
                              />
                            ))}
                          </div>
                        )}
                        <p className={`text-xs mt-1 ${
                          message.remetenteId === user.uid ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.remetente} • {message.criadoEm?.toDate?.()?.toLocaleString('pt-BR')}
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
                        onChange={(e) => {
                          setNewMessage(e.target.value);
                          setCursorPosition(e.target.selectionStart);
                          detectMentions(e.target.value, e.target.selectionStart);
                        }}
                        onKeyDown={(e) => {
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
            {/* Indicadores para usuários */}
            {userProfile?.funcao === 'operador' && canOperatorComplete(ticket, user, userProfile) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm font-medium">
                  ✅ Você pode concluir este chamado
                </p>
              </div>
            )}

            {userProfile?.funcao === 'produtor' && canProducerHaveThreeOptions(ticket, user, userProfile) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-800 text-sm font-medium">
                  ✅ Você tem 3 opções disponíveis para este chamado
                </p>
              </div>
            )}

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

                  {showAreaSelector && (
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

                  {newStatus === 'enviar_para_produtor' && (
                    <div>
                      <Label>Motivo da Escalação</Label>
                      <Textarea
                        placeholder="Descreva o motivo da escalação para o produtor..."
                        value={escalationReason}
                        onChange={(e) => setEscalationReason(e.target.value)}
                        rows={3}
                      />
                    </div>
                  )}

                  <Button 
                    onClick={handleStatusUpdate} 
                    disabled={!newStatus || updating || (showAreaSelector && !selectedArea)}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;

