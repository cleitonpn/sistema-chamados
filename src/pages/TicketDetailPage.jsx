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
  const [projects, setProjects] = useState([]); // Array para múltiplos projetos
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

  // Função loadTicketData com suporte a múltiplos projetos e correções do Firestore
  const loadTicketData = async () => {
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);

      console.log('🔍 Carregando dados do chamado:', ticketId);

      // Verificar se ticketId existe
      if (!ticketId || typeof ticketId !== 'string') {
        setError('ID do chamado inválido');
        return;
      }

      const ticketData = await ticketService.getTicketById(ticketId);
      if (!ticketData) {
        throw new Error('Chamado não encontrado');
      }

      console.log('📋 Dados do chamado carregados:', ticketData);
      setTicket(ticketData);

      if (ticketData.chamadoPaiId) {
          const parentTicketData = await ticketService.getTicketById(ticketData.chamadoPaiId);
          setParentTicketForLink(parentTicketData);
      }

      // Carregar múltiplos projetos com tratamento de erro
      try {
        if (ticketData.projetos && Array.isArray(ticketData.projetos) && ticketData.projetos.length > 0) {
          console.log('📁 Carregando múltiplos projetos:', ticketData.projetos);
          
          const projectsData = await Promise.allSettled(
            ticketData.projetos.map(async (projectId) => {
              if (!projectId || typeof projectId !== 'string') {
                console.warn('⚠️ ID de projeto inválido:', projectId);
                return null;
              }
              return await projectService.getProjectById(projectId);
            })
          );
          
          const validProjects = projectsData
            .filter(result => result.status === 'fulfilled' && result.value !== null)
            .map(result => result.value);
          
          console.log('✅ Projetos carregados:', validProjects);
          setProjects(validProjects);
          
          // Manter compatibilidade com projeto principal
          if (ticketData.projetoId) {
            try {
              const mainProject = await projectService.getProjectById(ticketData.projetoId);
              setProject(mainProject);
            } catch (projectError) {
              console.warn('⚠️ Erro ao carregar projeto principal:', projectError);
              if (validProjects[0]) {
                setProject(validProjects[0]);
              }
            }
          } else if (validProjects[0]) {
            setProject(validProjects[0]);
          }
        } else if (ticketData.projetoId) {
          // Compatibilidade com sistema antigo
          console.log('📁 Carregando projeto único:', ticketData.projetoId);
          try {
            const projectData = await projectService.getProjectById(ticketData.projetoId);
            if (projectData) {
              setProject(projectData);
              setProjects([projectData]);
            }
          } catch (projectError) {
            console.warn('⚠️ Erro ao carregar projeto único:', projectError);
            setProjects([]);
          }
        } else {
          console.log('📁 Nenhum projeto vinculado ao chamado');
          setProjects([]);
        }
      } catch (projectsError) {
        console.error('❌ Erro ao carregar projetos:', projectsError);
        setProjects([]);
      }

      // Carregar mensagens com nome correto da função
      try {
        console.log('💬 Carregando mensagens do chamado');
        const messagesData = await messageService.getMessagesByTicket(ticketId);
        console.log('✅ Mensagens carregadas:', messagesData?.length || 0);
        setMessages(messagesData || []);
      } catch (messagesError) {
        console.error('❌ Erro ao carregar mensagens:', messagesError);
        setMessages([]);
      }

    } catch (err) {
      console.error('❌ Erro ao carregar dados do chamado:', err);
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

  // Nova função para cancelar chamado
  const handleCancelTicket = async () => {
    if (!window.confirm('Tem certeza que deseja cancelar este chamado? Esta ação não pode ser desfeita.')) return;
    setUpdating(true);
    try {
        await ticketService.updateTicket(ticketId, {
            status: 'cancelado',
            canceladoEm: new Date(),
            canceladoPor: user.uid,
            motivoCancelamento: 'Cancelado pelo criador após rejeição/devolução',
            dataUltimaAtualizacao: new Date()
        });

        // Enviar mensagem de sistema
        const systemMessage = {
          userId: user.uid,
          remetenteNome: userProfile.nome || user.email,
          conteudo: `❌ **Chamado cancelado pelo criador**\n\nO chamado foi cancelado e não pode mais ser movimentado.`,
          criadoEm: new Date(),
          type: 'cancellation'
        };
        await messageService.sendMessage(ticketId, systemMessage);

        alert('Chamado cancelado com sucesso!');
        loadTicketData();
    } catch (error) {
        alert('Ocorreu um erro ao cancelar o chamado.');
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
        if (ticket.canceladoEm) { events.push({ date: ticket.canceladoEm, description: 'Cancelado por', userName: getUserNameById(ticket.canceladoPor), Icon: XCircle, color: 'text-red-600' }); }
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

    // Chamados cancelados não podem ser movimentados
    if (currentStatus === 'cancelado') return [];

    // Criador pode cancelar chamado quando rejeitado/devolvido
    if (isCreator && currentStatus === 'enviado_para_area') {
        return [ 
          { value: 'concluido', label: 'Validar e Concluir' }, 
          { value: 'enviado_para_area', label: 'Rejeitar / Devolver' },
          { value: 'cancelado', label: 'Cancelar Chamado' }
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

  const handleEscalateToManagement = async () => {
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
      const updateData = {
        status: 'aguardando_aprovacao',
        gerenciaDestino: managementArea,
        motivoEscalonamentoGerencial: managementReason,
        escaladoPor: user.uid,
        escaladoEm: new Date(),
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `🏢 **Chamado escalado para ${managementArea.replace('_', ' ').toUpperCase()}**\n\n**Motivo:** ${managementReason}`,
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

  const handleEscalateToConsultor = async () => {
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
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `🤝 **Chamado escalado para CONSULTOR**\n\n**Motivo:** ${consultorReason}`,
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
    await proceedWithStatusUpdate(newStatus);
  };
    
  const proceedWithStatusUpdate = async (statusToUpdate) => {
    if ((statusToUpdate === 'rejeitado' || statusToUpdate === 'enviado_para_area') && !conclusionDescription.trim()) {
      alert('Por favor, forneça um motivo para a rejeição/devolução');
      return;
    }

    if (statusToUpdate === 'cancelado') {
      await handleCancelTicket();
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
      } else if (statusToUpdate === 'enviado_para_area') {
        updateData = {
          status: 'enviado_para_area',
          motivoRejeicao: conclusionDescription,
          rejeitadoPor: user.uid,
          rejeitadoEm: new Date(),
          atualizadoPor: user.uid,
          updatedAt: new Date()
        };
        systemMessageContent = `🔄 **Chamado rejeitado/devolvido**\n\n**Motivo:** ${conclusionDescription}`;
      } else {
        updateData = {
          status: statusToUpdate,
          atualizadoPor: user.uid,
          updatedAt: new Date()
        };
        systemMessageContent = `🔄 **Status alterado para: ${getStatusText(statusToUpdate)}**`;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600">Carregando dados do chamado...</p>
          </div>
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
              Você não tem permissão para acessar este chamado confidencial.
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

  const isArchived = ticket.status === 'arquivado';
  const isCanceled = ticket.status === 'cancelado';
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
                Criado em {formatDate(ticket.criadoEm)} por {ticket.criadoPorNome}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getStatusColor(ticket.status)}>
                {getStatusText(ticket.status)}
              </Badge>
              {ticket.prioridade && (
                <Badge variant="outline" className="capitalize">
                  {ticket.prioridade}
                </Badge>
              )}
              {ticket.confidencial && (
                <Badge variant="destructive">
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
                    <Label className="text-sm font-medium text-gray-500">Título</Label>
                    <p className="mt-1 text-sm text-gray-900">{ticket.titulo}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Descrição</Label>
                    <p className="mt-1 text-sm text-gray-900">{ticket.descricao}</p>
                  </div>

                  {/* Flag de Item Extra */}
                  {ticket.itemExtra && (
                    <div className="flex items-center space-x-2 mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="text-orange-600 text-lg">🔥</div>
                      <div>
                        <p className="font-semibold text-orange-800">ITEM EXTRA</p>
                        <p className="text-sm text-orange-700">{ticket.motivoItemExtra}</p>
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

            {/* Seção de múltiplos projetos */}
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
                          <h4 className="font-medium text-gray-900">
                            <Link 
                              to={`/project/${proj.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                            >
                              {proj.nome}
                              <ExternalLink className="h-4 w-4 ml-1" />
                            </Link>
                          </h4>
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

            {/* Compatibilidade com projeto único */}
            {project && projects.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Folder className="h-5 w-5 mr-2" />
                    Projeto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">
                        <Link 
                          to={`/project/${project.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                        >
                          {project.nome}
                          <ExternalLink className="h-4 w-4 ml-1" />
                        </Link>
                      </h3>
                      <Badge variant="secondary">{project.feira}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Local</Label>
                        <p className="text-gray-900">{project.local}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Metragem</Label>
                        <p className="text-gray-900">{project.metragem}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Período</Label>
                        <p className="text-gray-900">
                          {project.dataInicio && formatDate(project.dataInicio)} - {project.dataFim && formatDate(project.dataFim)}
                        </p>
                      </div>
                    </div>
                    {project.produtorNome && (
                      <div className="text-sm">
                        <Label className="text-xs font-medium text-gray-500">Produtor:</Label>
                        <span className="ml-1 text-gray-900">{project.produtorNome}</span>
                      </div>
                    )}
                    {project.consultorNome && (
                      <div className="text-sm">
                        <Label className="text-xs font-medium text-gray-500">Consultor:</Label>
                        <span className="ml-1 text-gray-900">{project.consultorNome}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Link para chamado pai */}
            {parentTicketForLink && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <LinkIcon className="h-5 w-5 mr-2" />
                    Chamado Vinculado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 mb-2">
                      Este chamado está vinculado ao chamado:
                    </p>
                    <Link 
                      to={`/ticket/${parentTicketForLink.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      {parentTicketForLink.titulo}
                    </Link>
                    <p className="text-xs text-blue-600 mt-1">
                      Criado por {parentTicketForLink.criadoPorNome} • {formatDate(parentTicketForLink.criadoEm)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pessoas Envolvidas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Pessoas Envolvidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Criador do chamado */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-blue-900">{ticket.criadoPorNome}</p>
                        <p className="text-sm text-blue-700">{ticket.criadoPorFuncao} - {ticket.criadoPorArea}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">Criador</Badge>
                  </div>

                  {/* Consultor responsável */}
                  {ticket.consultorResponsavelNome && (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-green-900">{ticket.consultorResponsavelNome}</p>
                          <p className="text-sm text-green-700">Consultor - {ticket.consultorResponsavelArea}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Consultor</Badge>
                    </div>
                  )}

                  {/* Produtor responsável */}
                  {project?.produtorNome && (
                    <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center">
                          <Settings className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-purple-900">{project.produtorNome}</p>
                          <p className="text-sm text-purple-700">Produtor - Produção</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">Produtor</Badge>
                    </div>
                  )}

                  {/* Gerente responsável */}
                  {ticket.gerenciaDestino && (
                    <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-orange-500 rounded-full flex items-center justify-center">
                          <Shield className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-orange-900">Gerência {ticket.gerenciaDestino.replace('_', ' ')}</p>
                          <p className="text-sm text-orange-700">Escalado para aprovação</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800">Gerente</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

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
                              {formatDate(message.criadoEm || message.createdAt)}
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
                
                {!isArchived && !isCanceled && (
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
                  Histórico Detalhado
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
            {/* Card de Vincular Chamado */}
            {!isArchived && !isCanceled && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <LinkIcon className="h-5 w-5 mr-2" />
                    Vincular Chamado
                  </CardTitle>
                  <CardDescription>
                    Crie um novo chamado para outra área que ficará vinculado a este.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => navigate(`/new-ticket?linkedTicket=${ticketId}`)}
                    className="w-full"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Criar Chamado Vinculado
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Ações Disponíveis */}
            {!isArchived && !isCanceled && availableStatuses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Ações
                  </CardTitle>
                  <CardDescription>
                    Alterar status do chamado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="status">Alterar Status</Label>
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
                             newStatus === 'cancelado' ? 'Motivo do Cancelamento' :
                             'Motivo/Observações'}
                            {(newStatus === 'rejeitado' || newStatus === 'enviado_para_area' || newStatus === 'cancelado') && ' *'}
                          </Label>
                          <Textarea
                            id="conclusion"
                            placeholder={
                              newStatus === 'concluido' ? "Descreva como o problema foi resolvido..." : 
                              newStatus === 'cancelado' ? "Explique o motivo do cancelamento..." :
                              "Explique o motivo..."
                            }
                            value={conclusionDescription}
                            onChange={(e) => setConclusionDescription(e.target.value)}
                            rows={3}
                            className={(newStatus === 'rejeitado' || newStatus === 'enviado_para_area' || newStatus === 'cancelado') ? "border-red-300 focus:border-red-500" : ""}
                          />
                          {(newStatus === 'rejeitado' || newStatus === 'enviado_para_area' || newStatus === 'cancelado') && (
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
                      className={`w-full ${newStatus === 'rejeitado' || newStatus === 'enviado_para_area' || newStatus === 'cancelado' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                      variant={newStatus === 'rejeitado' || newStatus === 'enviado_para_area' || newStatus === 'cancelado' ? 'destructive' : 'default'}
                    >
                      {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      {updating ? 'Atualizando...' : 'Confirmar Ação'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Escalações */}
            {!isArchived && !isCanceled && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">🔄</span>Escalações
                  </CardTitle>
                  <CardDescription>Escalar chamado para outras áreas ou gerência</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="escalation-area" className="text-base font-semibold">🎯 Escalar para Área</Label>
                      <Select value={escalationArea} onValueChange={setEscalationArea}>
                        <SelectTrigger className="mt-2 h-12 border-2 border-blue-300 focus:border-blue-500">
                          <SelectValue placeholder="👆 Selecione uma área" />
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
                      <Label htmlFor="escalation-reason" className="text-base font-semibold">📝 Motivo da Escalação</Label>
                      <Textarea
                        id="escalation-reason"
                        value={escalationReason}
                        onChange={(e) => setEscalationReason(e.target.value)}
                        placeholder="Descreva o motivo da escalação..."
                        className="mt-2 min-h-[100px] border-2 border-blue-300 focus:border-blue-500"
                      />
                    </div>
                    <Button
                      onClick={handleEscalation}
                      disabled={!escalationArea || !escalationReason.trim() || isEscalating}
                      className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {isEscalating ? <><span className="animate-spin mr-2">⏳</span>Enviando...</> : <><span className="mr-2">🚀</span>Escalar para Área</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Escalar para Consultor */}
            {!isArchived && !isCanceled && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span className="text-2xl mr-2">🤝</span>
                    <span className="text-2xl mr-2">🎯</span>
                    Escalar para Consultor
                  </CardTitle>
                  <CardDescription>
                    Escale este chamado para o consultor do projeto para tratativa específica
                  </CardDescription>
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
                    <Button
                      onClick={handleEscalateToConsultor}
                      disabled={!consultorReason.trim() || isEscalatingToConsultor}
                      className="w-full h-12 text-lg font-semibold bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                    >
                      {isEscalatingToConsultor ? <><span className="animate-spin mr-2">⏳</span>Enviando...</> : <><span className="mr-2">🤝</span><span className="mr-2">🎯</span>Enviar para Consultor</>}
                    </Button>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">⚠️ <strong>Fluxo:</strong> O chamado irá para o consultor do projeto. Após a ação do consultor, retornará automaticamente para sua área para continuidade.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Escalar para Gerência */}
            {!isArchived && !isCanceled && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span className="text-2xl mr-2">👔</span>
                    Escalar para Gerência
                  </CardTitle>
                  <CardDescription>
                    Escale este chamado para qualquer gerência quando necessário
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="management-area" className="text-base font-semibold">📋 Gerência de Destino *</Label>
                      <Select value={managementArea} onValueChange={setManagementArea}>
                        <SelectTrigger className="mt-2 h-12 border-2 border-purple-300 focus:border-purple-500">
                          <SelectValue placeholder="👆 Selecione a gerência que deve receber o chamado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gerencia_comercial">👔 Gerência Comercial</SelectItem>
                          <SelectItem value="gerencia_operacional">⚙️ Gerência Operacional</SelectItem>
                          <SelectItem value="gerencia_financeira">💰 Gerência Financeira</SelectItem>
                          <SelectItem value="gerencia_projetos">📊 Gerência de Projetos</SelectItem>
                          <SelectItem value="diretoria">🏢 Diretoria</SelectItem>
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
                    <Button
                      onClick={handleEscalateToManagement}
                      disabled={!managementArea || !managementReason.trim() || isEscalatingToManagement}
                      className="w-full h-12 text-lg font-semibold bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400"
                    >
                      {isEscalatingToManagement ? <><span className="animate-spin mr-2">⏳</span>Enviando...</> : <><span className="mr-2">👔</span>Enviar para Gerência</>}
                    </Button>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm text-purple-800">⚠️ <strong>Atenção:</strong> Ao escalar para gerência, o chamado aguardará aprovação gerencial antes de retornar para execução.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transferir para Produtor */}
            {!isArchived && !isCanceled && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador') && project && project.produtorId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span className="text-2xl mr-2">🏭</span>
                    Transferir para Produtor
                  </CardTitle>
                  <CardDescription>
                    Transfira este chamado para o produtor do projeto para continuidade e finalização
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 font-semibold">
                        Produtor do Projeto: {project.produtorNome || 'Não identificado'}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        O chamado será transferido para o produtor responsável por este projeto.
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        if (window.confirm(`Confirma a transferência deste chamado para o produtor ${project.produtorNome}?`)) {
                          // Implementar lógica de transferência
                        }
                      }}
                      className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
                    >
                      <span className="mr-2">🏭</span>Enviar para Produtor
                    </Button>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">ℹ️ <strong>Informação:</strong> O chamado será transferido para o produtor do projeto para dar continuidade e finalização.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Arquivar/Desarquivar */}
            {userProfile?.funcao === 'administrador' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    {isArchived ? (
                      <ArchiveRestore className="h-5 w-5 mr-2" />
                    ) : (
                      <Archive className="h-5 w-5 mr-2" />
                    )}
                    {isArchived ? 'Desarquivar' : 'Arquivar'} Chamado
                  </CardTitle>
                  <CardDescription>
                    {isArchived 
                      ? 'Retornar chamado para a lista de concluídos'
                      : 'Remover chamado da visualização principal'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={isArchived ? handleUnarchiveTicket : handleArchiveTicket}
                    disabled={updating}
                    variant={isArchived ? 'default' : 'destructive'}
                    className="w-full"
                  >
                    {updating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : isArchived ? (
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                    ) : (
                      <Archive className="h-4 w-4 mr-2" />
                    )}
                    {updating ? 'Processando...' : (isArchived ? 'Desarquivar' : 'Arquivar')}
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

