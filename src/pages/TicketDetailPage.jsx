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
  const [projects, setProjects] = useState([]);
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

      // Lógica de carregamento de projetos (nova e antiga)
      if (ticketData.projetoIds && ticketData.projetoIds.length > 0) {
        const projectsData = await projectService.getProjectsByIds(ticketData.projetoIds);
        setProjects(projectsData);
      } else if (ticketData.projetoId) {
        const projectData = await projectService.getProjectById(ticketData.projetoId);
        if (projectData) {
          setProjects([projectData]);
        }
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
        'concluido': 'bg-green-100 text-green-800', 
        'cancelado': 'bg-red-100 text-red-800', 
        'devolvido': 'bg-pink-100 text-pink-800', 
        'arquivado': 'bg-gray-100 text-gray-700', 
        'enviado_para_area': 'bg-pink-100 text-pink-800',
        'aguardando_aprovacao': 'bg-orange-100 text-orange-800',
        'executado_aguardando_validacao': 'bg-indigo-100 text-indigo-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const statusTexts = { 
        'aberto': 'Aberto', 
        'em_tratativa': 'Em Tratativa',
        'concluido': 'Concluído',
        'cancelado': 'Cancelado',
        'devolvido': 'Devolvido',
        'arquivado': 'Arquivado',
        'enviado_para_area': 'Devolvido para Área',
        'aguardando_aprovacao': 'Aguardando Aprovação',
        'executado_aguardando_validacao': 'Aguardando Validação',
    };
    return statusTexts[status] || status;
  };

  const getAvailableStatuses = () => {
    if (!ticket || !userProfile || !user) return [];
    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;
    const isCreator = ticket.criadoPor === user.uid;

    if (isCreator && currentStatus === 'enviado_para_area') {
        return [ { value: 'cancelado', label: 'Cancelar Chamado' } ];
    }
    
    if (isCreator && currentStatus === 'executado_aguardando_validacao') {
        return [ { value: 'concluido', label: 'Validar e Concluir' }, { value: 'enviado_para_area', label: 'Rejeitar / Devolver' } ];
    }

    if (userRole === 'administrador') {
      if (['aberto', 'enviado_para_area'].includes(currentStatus)) return [ { value: 'em_tratativa', label: 'Iniciar Tratativa' } ];
      if (currentStatus === 'em_tratativa') return [ { value: 'executado_aguardando_validacao', label: 'Executado' } ];
      if (currentStatus === 'aguardando_aprovacao') return [ { value: 'aprovado', label: 'Aprovar' }, { value: 'rejeitado', label: 'Reprovar' } ];
    }
    
    if (userRole === 'operador' && (ticket.area === userProfile.area || ticket.atribuidoA === user.uid)) {
      if (['aberto', 'enviado_para_area'].includes(currentStatus)) {
          const actions = [ { value: 'em_tratativa', label: 'Iniciar Tratativa' } ];
          if (ticket.areaDeOrigem) {
              actions.push({ value: 'enviado_para_area', label: 'Rejeitar / Devolver' });
          }
          return actions;
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
        area: escalationArea,
        areaDeOrigem: ticket.area,
        motivoEscalonamento: escalationReason,
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
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
    const targetManager = users.find(u => u.funcao === 'gerente' && u.area === managementArea.replace('gerente_', ''));
    if (!targetManager) {
      alert(`Erro: Nenhum gerente encontrado para a área selecionada.`);
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
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `👨‍💼 **Chamado escalado para Gerência**\n\n**Motivo:** ${managementReason}\n\n**Gerente Responsável:** ${targetManager.nome}`,
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
      alert('Por favor, descreva o motivo da escalação para o consultor');
      return;
    }
    const mainProject = projects[0];
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
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `👨‍🎯 **Chamado escalado para CONSULTOR DO PROJETO**\n\n**Motivo:** ${consultorReason}`,
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
    const mainProject = projects[0];
    if (!mainProject?.produtorId) {
      alert('Erro: Produtor do projeto não encontrado');
      return;
    }
    setUpdating(true);
    try {
      const updateData = {
        status: 'transferido_para_produtor',
        produtorResponsavelId: mainProject.produtorId,
        transferidoPor: user.uid,
        transferidoEm: new Date(),
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      const transferMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `🏭 **Chamado transferido para PRODUTOR DO PROJETO**`,
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
      let updateData = { status: statusToUpdate, atualizadoPor: user.uid, updatedAt: new Date() };
      let systemMessageContent = '';

      if (statusToUpdate === 'concluido') {
        updateData.conclusaoDescricao = conclusionDescription;
        updateData.conclusaoImagens = conclusionImages;
        updateData.concluidoEm = new Date();
        updateData.concluidoPor = user.uid;
        systemMessageContent = `✅ **Chamado concluído**\n\n**Descrição:** ${conclusionDescription}`;
      } 
      else if (statusToUpdate === 'enviado_para_area') {
        updateData.motivoRejeicao = conclusionDescription;
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        updateData.area = ticket.areaDeOrigem || ticket.area;
        systemMessageContent = `🔄 **Chamado devolvido para:** ${updateData.area.replace(/_/g, ' ')}\n\n**Motivo:** ${conclusionDescription}`;
      }
      else if (statusToUpdate === 'cancelado') {
        updateData.canceladoEm = new Date();
        updateData.canceladoPor = user.uid;
        systemMessageContent = `🚫 **Chamado cancelado pelo criador.**`;
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
  const isLocked = ticket.status === 'arquivado' || ticket.status === 'cancelado';

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

        {isLocked && (
          <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800">
              {ticket.status === 'arquivado' ? <Archive className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertDescription>
                  Este chamado está **{ticket.status}** e é somente para consulta. Nenhuma nova ação pode ser realizada.
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
                          />
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
                      {isResubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
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
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2">
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
                            <span className="text-sm font-medium text-gray-900">{message.remetenteNome || 'Usuário'}</span>
                            <span className="text-xs text-gray-500">{formatDate(message.criadoEm)}</span>
                          </div>
                          {message.conteudo && (<p className="text-sm text-gray-700 mt-1">{message.conteudo}</p>)}
                          {message.imagens && message.imagens.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {message.imagens.map((imageUrl, imgIndex) => (<img key={imgIndex} src={imageUrl} alt={`Anexo ${imgIndex + 1}`} className="w-full h-20 object-cover rounded border" onClick={() => window.open(imageUrl, '_blank')} />))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {!isLocked && (
                  <div className="border-t pt-4">
                    <div className="space-y-3">
                      <div className="relative">
                        <Textarea ref={textareaRef} placeholder="Digite sua mensagem..." value={newMessage} onChange={handleTextareaChange} onKeyDown={handleTextareaKeyDown} rows={3} disabled={sendingMessage} />
                         {showMentionSuggestions && mentionSuggestions.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {mentionSuggestions.map((user, index) => (
                                    <button key={index} className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center space-x-2" onClick={() => insertMention(user)}>
                                        <AtSign className="h-4 w-4 text-gray-400" />
                                        <span className="font-medium">{user.nome}</span>
                                        <span className="text-sm text-gray-500">({user.email})</span>
                                    </button>
                                ))}
                            </div>
                         )}
                      </div>
                      <ImageUpload onImagesUploaded={setChatImages} existingImages={chatImages} maxImages={3} buttonText="Anexar ao Chat" className="border-t pt-3" />
                      <div className="flex items-center justify-end">
                        <Button onClick={handleSendMessage} disabled={sendingMessage || (!newMessage.trim() && chatImages.length === 0)}>
                          {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Enviar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center text-base sm:text-lg"><FolderOpen className="h-5 w-5 mr-2" />{projects.length > 1 ? `Projetos (${projects.length})` : 'Projeto'}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {projects.length > 0 ? (
                  projects.map((p, index) => (
                    <div key={p.id} className={index > 0 ? "pt-4 mt-4 border-t" : ""}>
                      <div className="space-y-2">
                        <div><Label className="text-xs font-medium text-gray-700">Nome do Projeto</Label><p className="text-gray-900 break-words font-medium">{p.nome}</p></div>
                        {p.cliente && (<div><Label className="text-xs font-medium text-gray-700">Cliente</Label><p className="text-gray-900 break-words">{p.cliente}</p></div>)}
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => navigate(`/projeto/${p.id}`)}><ExternalLink className="h-4 w-4 mr-2" />Acessar Projeto</Button>
                    </div>
                  ))
                ) : ( <p className="text-sm text-gray-500">Nenhum projeto associado.</p> )}
              </CardContent>
            </Card>

            {!isLocked && (
              <Card>
                <CardHeader><CardTitle className="flex items-center text-base sm:text-lg"><LinkIcon className="h-5 w-5 mr-2" />Vincular Chamado</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">Crie um novo chamado para outra área que ficará vinculado a este.</p>
                  <Button className="w-full" variant="outline" onClick={() => navigate('/novo-chamado', { state: { linkedTicketId: ticket.id } })}><PlusCircle className="h-4 w-4 mr-2" />Criar Chamado Vinculado</Button>
                </CardContent>
              </Card>
            )}

            {!isLocked && availableStatuses.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center text-base sm:text-lg"><Settings className="h-5 w-5 mr-2" />Ações</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Alterar Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger><SelectValue placeholder="Selecione uma ação" /></SelectTrigger>
                      <SelectContent>
                        {availableStatuses.map((status) => (<SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(newStatus === 'concluido' || newStatus === 'rejeitado' || newStatus === 'enviado_para_area') && (
                    <div className="space-y-3">
                      <div>
                        <Label>
                          {newStatus === 'concluido' ? 'Descrição da Conclusão' : 'Motivo da Rejeição/Devolução'}
                          {(newStatus === 'rejeitado' || newStatus === 'enviado_para_area') && ' *'}
                        </Label>
                        <Textarea value={conclusionDescription} onChange={(e) => setConclusionDescription(e.target.value)} className={(newStatus === 'rejeitado' || newStatus === 'enviado_para_area') ? "border-red-300 focus:border-red-500" : ""}/>
                         {(newStatus === 'rejeitado' || newStatus === 'enviado_para_area') && (<p className="text-xs text-red-600 mt-1">* Campo obrigatório</p>)}
                      </div>
                      {newStatus === 'concluido' && <ImageUpload onImagesUploaded={setConclusionImages} existingImages={conclusionImages} maxImages={5} buttonText="Anexar Evidências"/>}
                    </div>
                  )}
                  <Button 
                    onClick={handleStatusUpdate} 
                    disabled={!newStatus || updating} 
                    className={`w-full ${newStatus === 'rejeitado' || newStatus === 'enviado_para_area' || newStatus === 'cancelado' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                    variant={newStatus === 'cancelado' || newStatus === 'rejeitado' || newStatus === 'enviado_para_area' ? 'destructive' : 'default'}
                  >
                    {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Confirmar Ação
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {!isLocked && userProfile?.funcao === 'administrador' && ticket.status === 'concluido' && (
              <Card>
                <CardHeader><CardTitle className="flex items-center text-base sm:text-lg"><Archive className="h-5 w-5 mr-2" />Ações de Arquivo</CardTitle></CardHeader>
                <CardContent><Button onClick={handleArchiveTicket} disabled={updating} variant="outline" className="w-full"><Archive className="h-4 w-4 mr-2" />Arquivar Chamado</Button></CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader><CardTitle className="flex items-center"><Clock className="h-5 w-5 mr-2" />Histórico do Chamado</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {historyEvents.length > 0 ? (
                    historyEvents.map((event, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="flex flex-col items-center">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ${event.color}`}><event.Icon className="h-5 w-5" /></span>
                          {index < historyEvents.length - 1 && (<div className="h-6 w-px bg-gray-200" />)}
                        </div>
                        <div className="flex-1 pt-1.5">
                          <p className="text-sm text-gray-800">{event.description}{' '}<span className="font-semibold text-gray-900">{event.userName}</span></p>
                          <p className="text-xs text-gray-500 mt-0.5">{formatDate(event.date)}</p>
                        </div>
                      </div>
                    ))
                  ) : ( <p className="text-sm text-gray-500 text-center py-4">Nenhum evento de histórico registrado.</p> )}
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
