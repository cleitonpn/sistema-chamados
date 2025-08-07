import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ticketService from '../services/ticketService';
import messageService from '../services/messageService';
import projectService from '../services/projectService';
import userService from '../services/userService';
import notificationService from '../services/notificationService';
import { TICKET_STATUS } from '../constants/ticketStatus';
import { TICKET_CATEGORIES } from '../constants/ticketCategories';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Textarea } from '../components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  Building, 
  Tag, 
  Calendar,
  MessageSquare,
  Send,
  Paperclip,
  Image as ImageIcon,
  Download,
  Archive,
  ArchiveRestore,
  Link,
  Users,
  History,
  FolderOpen,
  Folder,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus
} from 'lucide-react';

const TicketDetailPage = () => {
  const { id: ticketId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth(); // ✅ CORRIGIDO: usar apenas useAuth
  const [ticket, setTicket] = useState(null);
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [conclusionImages, setConclusionImages] = useState([]);
  const [conclusionMessage, setConclusionMessage] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [escalationArea, setEscalationArea] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [escalationManagement, setEscalationManagement] = useState('');
  const [escalationManagementReason, setEscalationManagementReason] = useState('');
  const [escalationConsultorReason, setEscalationConsultorReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [managements, setManagements] = useState([]);
  const [areas, setAreas] = useState([]);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const conclusionFileInputRef = useRef(null);

  useEffect(() => {
    if (ticketId && user) {
      loadTicketData();
      loadUsers();
      loadManagements();
      loadAreas();
    }
  }, [ticketId, user]);

  const loadTicketData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Carregando dados do chamado:', ticketId);
      
      // Carregar dados do chamado
      const ticketData = await ticketService.getTicketById(ticketId);
      if (!ticketData) {
        setError('Chamado não encontrado');
        setLoading(false);
        return;
      }
      
      console.log('📋 Dados do chamado carregados:', ticketData);
      setTicket(ticketData);

      // Carregar projetos (múltiplos ou único)
      if (ticketData.projetos && Array.isArray(ticketData.projetos) && ticketData.projetos.length > 0) {
        console.log('📁 Carregando múltiplos projetos:', ticketData.projetos);
        
        const projectsData = await Promise.allSettled(
          ticketData.projetos.map(async (projectId) => {
            if (!projectId || typeof projectId !== 'string') {
              console.warn('⚠️ ID de projeto inválido:', projectId);
              return null;
            }
            try {
              return await projectService.getProjectById(projectId);
            } catch (error) {
              console.error('❌ Erro ao carregar projeto:', projectId, error);
              return null;
            }
          })
        );
        
        const validProjects = projectsData
          .filter(result => result.status === 'fulfilled' && result.value !== null)
          .map(result => result.value);
        
        console.log('✅ Projetos carregados:', validProjects);
        setProjects(validProjects);
      } else if (ticketData.projeto) {
        // Compatibilidade com sistema antigo (projeto único)
        console.log('📁 Carregando projeto único:', ticketData.projeto);
        try {
          const projectData = await projectService.getProjectById(ticketData.projeto);
          if (projectData) {
            setProjects([projectData]);
          }
        } catch (error) {
          console.error('❌ Erro ao carregar projeto único:', error);
        }
      }

      // Carregar mensagens
      console.log('💬 Carregando mensagens do chamado');
      const messagesData = await messageService.getMessagesByTicket(ticketId); // ✅ CORRIGIDO: nome correto da função
      console.log('✅ Mensagens carregadas:', messagesData?.length || 0);
      setMessages(messagesData || []);

    } catch (error) {
      console.error('❌ Erro ao carregar dados do chamado:', error);
      setError('Erro ao carregar dados do chamado');
    } finally {
      setLoading(false);
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

  const loadManagements = async () => {
    try {
      const managementsData = await userService.getManagements();
      setManagements(managementsData || []);
    } catch (error) {
      console.error('Erro ao carregar gerências:', error);
    }
  };

  const loadAreas = async () => {
    try {
      const areasData = await userService.getAreas();
      setAreas(areasData || []);
    } catch (error) {
      console.error('Erro ao carregar áreas:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && selectedImages.length === 0) return;

    try {
      setSending(true);
      await messageService.sendMessage(ticketId, {
        content: newMessage,
        images: selectedImages,
        senderId: user.uid,
        senderName: userProfile?.nome || user.displayName || 'Usuário',
        timestamp: new Date()
      });

      // Enviar notificação
      await notificationService.sendTicketNotification(
        ticket,
        'nova_mensagem',
        `Nova mensagem de ${userProfile?.nome || user.displayName}`,
        user.uid
      );

      setNewMessage('');
      setSelectedImages([]);
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = (event, isConclusionImage = false) => {
    const files = Array.from(event.target.files);
    if (isConclusionImage) {
      setConclusionImages(prev => [...prev, ...files]);
    } else {
      setSelectedImages(prev => [...prev, ...files]);
    }
  };

  const removeImage = (index, isConclusionImage = false) => {
    if (isConclusionImage) {
      setConclusionImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setSelectedImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;

    try {
      // Verificar se é rejeição/devolução
      if (newStatus === 'enviado_para_area' && ticket.status !== 'aberto') {
        setShowRejectModal(true);
        return;
      }

      const updateData = {
        status: newStatus,
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      // Adicionar dados específicos baseado no status
      if (newStatus === TICKET_STATUS.COMPLETED && conclusionMessage) {
        updateData.conclusionMessage = conclusionMessage;
        updateData.conclusionImages = conclusionImages;
        updateData.completedAt = new Date();
        updateData.completedBy = user.uid;
      }

      await ticketService.updateTicket(ticketId, updateData);

      // Enviar notificação
      await notificationService.sendTicketNotification(
        ticket,
        'mudanca_status',
        `Status alterado para: ${getStatusLabel(newStatus)}`,
        user.uid
      );

      setNewStatus('');
      setConclusionMessage('');
      setConclusionImages([]);
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
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

      // Enviar notificação para o criador
      await notificationService.sendTicketNotification(
        ticket,
        'chamado_rejeitado',
        `Chamado rejeitado/devolvido: ${rejectReason}`,
        user.uid
      );

      setShowRejectModal(false);
      setRejectReason('');
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao rejeitar chamado:', error);
    }
  };

  const handleEscalateToArea = async () => {
    if (!escalationArea || !escalationReason.trim()) {
      alert('Por favor, selecione uma área e informe o motivo da escalação.');
      return;
    }

    try {
      const updateData = {
        area: escalationArea,
        escalationReason: escalationReason,
        escalatedAt: new Date(),
        escalatedBy: user.uid,
        status: 'aberto',
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      await ticketService.updateTicket(ticketId, updateData);

      // Enviar notificação
      await notificationService.sendTicketNotification(
        ticket,
        'escalacao_area',
        `Chamado escalado para área: ${escalationArea}`,
        user.uid
      );

      setEscalationArea('');
      setEscalationReason('');
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao escalar para área:', error);
    }
  };

  const handleEscalateToManagement = async () => {
    if (!escalationManagement || !escalationManagementReason.trim()) {
      alert('Por favor, selecione uma gerência e informe o motivo da escalação.');
      return;
    }

    try {
      const updateData = {
        escalatedToManagement: escalationManagement,
        escalationManagementReason: escalationManagementReason,
        escalatedToManagementAt: new Date(),
        escalatedToManagementBy: user.uid,
        status: 'aguardando_aprovacao_gerencial',
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      await ticketService.updateTicket(ticketId, updateData);

      // Enviar notificação
      await notificationService.sendTicketNotification(
        ticket,
        'escalacao_gerencia',
        `Chamado escalado para gerência: ${escalationManagement}`,
        user.uid
      );

      setEscalationManagement('');
      setEscalationManagementReason('');
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao escalar para gerência:', error);
    }
  };

  const handleEscalateToConsultor = async () => {
    if (!escalationConsultorReason.trim()) {
      alert('Por favor, informe o motivo da escalação para o consultor.');
      return;
    }

    try {
      const updateData = {
        escalationConsultorReason: escalationConsultorReason,
        escalatedToConsultorAt: new Date(),
        escalatedToConsultorBy: user.uid,
        status: 'aguardando_consultor',
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      await ticketService.updateTicket(ticketId, updateData);

      // Enviar notificação
      await notificationService.sendTicketNotification(
        ticket,
        'escalacao_consultor',
        `Chamado escalado para consultor do projeto`,
        user.uid
      );

      setEscalationConsultorReason('');
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao escalar para consultor:', error);
    }
  };

  const handleTransferToProducer = async () => {
    try {
      const updateData = {
        status: 'em_tratativa',
        responsavelAtual: 'produtor',
        transferredToProducerAt: new Date(),
        transferredToProducerBy: user.uid,
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      await ticketService.updateTicket(ticketId, updateData);

      // Enviar notificação
      await notificationService.sendTicketNotification(
        ticket,
        'transferencia_produtor',
        'Chamado transferido para produtor',
        user.uid
      );

      await loadTicketData();
    } catch (error) {
      console.error('Erro ao transferir para produtor:', error);
    }
  };

  const handleArchiveTicket = async () => {
    try {
      const updateData = {
        archived: !ticket.archived,
        archivedAt: !ticket.archived ? new Date() : null,
        archivedBy: !ticket.archived ? user.uid : null,
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      await ticketService.updateTicket(ticketId, updateData);
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao arquivar/desarquivar chamado:', error);
    }
  };

  const handleCreateLinkedTicket = () => {
    // ✅ CORRIGIDO: Navegar para NewTicketForm com dados do chamado atual via location.state
    navigate('/novo-chamado', {
      state: {
        linkedTicketId: ticketId,
        linkedTicketData: {
          titulo: ticket.titulo,
          descricao: ticket.descricao,
          criadoPorNome: ticket.criadoPorNome,
          area: ticket.area,
          projectName: projects.length > 0 ? projects[0].nome : '',
          eventName: projects.length > 0 ? projects[0].evento : ''
        }
      }
    });
  };

  const handleMentionInput = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setNewMessage(value);
    setCursorPosition(cursorPos);

    // Detectar menções (@)
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionQuery(query);
      
      const filteredUsers = users.filter(user => 
        user.nome?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
      ).slice(0, 5);
      
      setMentionSuggestions(filteredUsers);
      setShowMentions(true);
    } else {
      setShowMentions(false);
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
    
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const getAvailableStatuses = () => {
    if (!ticket || !userProfile) return [];

    const currentStatus = ticket.status;
    const isCreator = ticket.criadoPor === user.uid;
    const isAdmin = userProfile.funcao === 'administrador';
    const userArea = userProfile.area;
    const ticketArea = ticket.area;

    // Administrador pode fazer qualquer ação
    if (isAdmin) {
      return [
        { value: TICKET_STATUS.OPEN, label: 'Reabrir', description: 'Reabrir chamado' },
        { value: TICKET_STATUS.IN_TREATMENT, label: 'Em Tratativa', description: 'Iniciar tratamento' },
        { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado' },
        { value: TICKET_STATUS.COMPLETED, label: 'Concluído', description: 'Finalizar chamado' },
        { value: 'enviado_para_area', label: 'Rejeitar / Devolver', description: 'Devolver para área anterior' },
        { value: 'cancelado', label: 'Cancelar', description: 'Cancelar chamado' }
      ];
    }

    // Criador do chamado
    if (isCreator) {
      if (currentStatus === 'executado_aguardando_validacao' || 
          currentStatus === 'executado_aguardando_validacao_operador') {
        return [
          { value: TICKET_STATUS.COMPLETED, label: 'Validar e Concluir', description: 'Validar execução e finalizar' },
          { value: 'enviado_para_area', label: 'Rejeitar / Devolver', description: 'Devolver para área responsável' }
        ];
      }
      
      if (currentStatus === 'enviado_para_area' && ticket.rejectedAt) {
        return [
          { value: 'cancelado', label: 'Cancelar Chamado', description: 'Cancelar este chamado' }
        ];
      }
    }

    // Operador da área responsável
    if (userProfile.funcao?.startsWith('operador_') && userArea === ticketArea) {
      if (currentStatus === TICKET_STATUS.OPEN) {
        return [
          { value: TICKET_STATUS.IN_TREATMENT, label: 'Iniciar Tratativa', description: 'Assumir responsabilidade' }
        ];
      }
      
      if (currentStatus === TICKET_STATUS.IN_TREATMENT) {
        return [
          { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado' },
          { value: 'enviado_para_area', label: 'Rejeitar / Devolver', description: 'Devolver para área anterior' }
        ];
      }
    }

    // Consultor
    if (userProfile.funcao === 'consultor') {
      if (currentStatus === 'aguardando_consultor') {
        return [
          { value: TICKET_STATUS.IN_TREATMENT, label: 'Dar Tratativa', description: 'Assumir tratamento' },
          { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Concluir', description: 'Finalizar diretamente' },
          { value: 'enviado_para_area', label: 'Enviar para Área', description: 'Escalar para área responsável' }
        ];
      }
    }

    // Produtor
    if (userProfile.funcao === 'produtor') {
      if (currentStatus === TICKET_STATUS.IN_TREATMENT && ticket.responsavelAtual === 'produtor') {
        return [
          { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado' },
          { value: 'enviado_para_area', label: 'Rejeitar / Devolver', description: 'Devolver para área anterior' }
        ];
      }
    }

    // Gerência
    if (userProfile.funcao === 'gerencia') {
      if (currentStatus === 'aguardando_aprovacao_gerencial') {
        return [
          { value: TICKET_STATUS.IN_TREATMENT, label: 'Aprovar', description: 'Aprovar e retornar para execução' },
          { value: 'enviado_para_area', label: 'Rejeitar', description: 'Rejeitar solicitação' }
        ];
      }
    }

    return [];
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      [TICKET_STATUS.OPEN]: 'Aberto',
      [TICKET_STATUS.IN_TREATMENT]: 'Em Tratativa',
      [TICKET_STATUS.EXECUTED_AWAITING_VALIDATION]: 'Executado - Aguardando Validação',
      [TICKET_STATUS.COMPLETED]: 'Concluído',
      'enviado_para_area': 'Enviado para Área',
      'aguardando_consultor': 'Aguardando Consultor',
      'aguardando_aprovacao_gerencial': 'Agua