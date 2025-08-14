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
  ClipboardEdit, // Ícone adicionado
} from 'lucide-react';

const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  // Estados principais
  const [ticket, setTicket] = useState(null);
  const [project, setProject] = useState(null);
const [projectsMap, setProjectsMap] = useState({});
const [linkedProjectIds, setLinkedProjectIds] = useState([]);
const [activeProjectId, setActiveProjectId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  // Resolve nome do responsável do projeto a partir de possíveis formatos (Id/Uid/Nome/Email/responsaveis{})
  const resolveUserNameByProjectField = (proj, base) => {
    if (!proj) return null;
    const id = proj?.[base + 'Id'] || proj?.[base + 'Uid'] || proj?.responsaveis?.[base]?.id;
    if (id && Array.isArray(users)) {
      const u = users.find(u => u.uid === id || u.id === id);
      if (u?.nome) return u.nome;
    }
    const nome = proj?.[base + 'Nome'] || proj?.responsaveis?.[base]?.nome;
    if (nome) return nome;
    const email = proj?.[base + 'Email'] || proj?.responsaveis?.[base]?.email;
    if (email && Array.isArray(users)) {
      const u = users.find(u => u.email === email);
      if (u?.nome) return u.nome;
      return email;
    }
    return null;
  };


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

      const _linkedIds = Array.isArray(ticketData.projetos) && ticketData.projetos.length > 0
        ? ticketData.projetos
        : (ticketData.projetoId ? [ticketData.projetoId] : []);
      setLinkedProjectIds(_linkedIds);
      if (_linkedIds.length > 0) {
        const entries = await Promise.all(
          _linkedIds.map(async (pid) => {
            try { const pdata = await projectService.getProjectById(pid); return [pid, pdata]; }
            catch(e) { console.error('Erro ao carregar projeto', pid, e); return [pid, null]; }
          })
        );
        const map = Object.fromEntries(entries);
        setProjectsMap(map);
        setActiveProjectId(_linkedIds[0]);
        setProject(map[_linkedIds[0]] || null);
      } else {
        setProjectsMap({});
        setActiveProjectId(null);
        setProject(null);
      }
const messagesData = await messageService.getMessagesByTicket(ticketId);
      setMessages(messagesData || []);

    } catch (err) {
      setError(err.message || 'Erro ao carregar chamado');
    } finally {
      setLoading(false);
    }
  };

  // Selecionar um projeto vinculado
  const handleSelectProject = (pid) => {
    setActiveProjectId(pid);
    const p = projectsMap[pid] || null;
    setProject(p);
  };

  useEffect(() => {
    if (ticketId && user) {
      loadTicketData();
      markNotificationsAsRead();
    }
  }, [ticketId, user]);

  useEffect(() => {
    if (ticket && userProfile && user) {
      if (ticket.confidencial || ticket.isConfidential) {
        const isCreator   = ticket.criadoPor === user.uid;
        const isAdmin     = userProfile.funcao === 'administrador';
        const isGerente   = userProfile.funcao === 'gerente';
        const isOperator  = userProfile.funcao === 'operador';
        const areaOp      = userProfile.area;
        const operatorInvolved = isOperator && (
          [ticket.area, ticket.areaDeOrigem, ticket.areaDestino, ticket.areaQueRejeitou].includes(areaOp) ||
          (Array.isArray(ticket.areasEnvolvidas) && ticket.areasEnvolvidas.includes(areaOp))
        );
        if (!isCreator && !isAdmin && !isGerente && !operatorInvolved) {
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

    if (isCreator && (currentStatus === 'executado_aguardando_validacao' || currentStatus === 'executado_aguardando_validacao_operador')) {
        return [ { value: 'concluido', label: 'Validar e Concluir' }, { value: 'enviado_para_area', label: 'Rejeitar / Devolver' } ];
    }

    if (isCreator && currentStatus === 'enviado_para_area') {
        return [{ value: 'cancelado', label: 'Cancelar Chamado' }];
    }


    if (userRole === 'gerente' && currentStatus === 'aguardando_aprovacao' && ticket.gerenciaDestino === userProfile.area) {
      return [ { value: 'aprovado', label: 'Aprovar' }, { value: 'reprovado', label: 'Reprovar' } ];
    }

    if (userRole === 'administrador') {
      if (currentStatus === 'aberto' || currentStatus === 'escalado_para_outra_area' || currentStatus === 'enviado_para_area') return [ { value: 'em_tratativa', label: 'Iniciar Tratativa' } ];
      if (currentStatus === 'em_tratativa') return [ { value: 'executado_aguardando_validacao', label: 'Executado' } ];
      if (currentStatus === 'executado_aguardando_validacao' && !isCreator) return [ { value: 'concluido', label: 'Validar e Concluir' }, { value: 'enviado_para_area', label: 'Rejeitar / Devolver' } ];
      if (currentStatus === 'concluido' && ticket.arquivadoEm) return [ { value: 'desarquivar', label: 'Desarquivar' } ];
      if (currentStatus === 'concluido' && !ticket.arquivadoEm) return [ { value: 'arquivar', label: 'Arquivar' } ];
      if (currentStatus === 'cancelado' || currentStatus === 'reprovado' || currentStatus === 'devolvido') return [ { value: 'reabrir', label: 'Reabrir Chamado' } ];
    }

    if (userRole === 'operador' && ticket.area === userProfile.area) {
      if (currentStatus === 'aberto' || currentStatus === 'escalado_para_outra_area') return [ { value: 'em_tratativa', label: 'Iniciar Tratativa' } ];
      if (currentStatus === 'em_tratativa') return [ { value: 'executado_aguardando_validacao', label: 'Executado' } ];
    }

    if (userRole === 'consultor' && ticket.consultorResponsavelId === user.uid) {
      if (currentStatus === 'escalado_para_consultor') return [ { value: 'executado_pelo_consultor', label: 'Executar' } ];
    }

    return [];
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;

    setUpdating(true);
    try {
      let updateData = {
        status: newStatus,
        dataUltimaAtualizacao: new Date(),
      };
      let systemMessage = '';

      if (newStatus === 'concluido') {
        updateData.concluidoEm = new Date();
        updateData.concluidoPor = user.uid;
        systemMessage = `Chamado ${ticket.titulo} (${ticketId}) foi concluído por ${userProfile.nome}.`;
      } else if (newStatus === 'enviado_para_area') {
        // Rejeitar / Devolver
        if (!conclusionDescription) {
          alert('Por favor, insira o motivo da rejeição/devolução.');
          setUpdating(false);
          return;
        }
        updateData.status = 'devolvido'; // Altera o status para 'devolvido'
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        updateData.areaQueRejeitou = userProfile.area;
        systemMessage = `Chamado ${ticket.titulo} (${ticketId}) foi rejeitado/devolvido por ${userProfile.nome}. Motivo: ${conclusionDescription}`; 
      } else if (newStatus === 'cancelado') {
        updateData.canceladoEm = new Date();
        updateData.canceladoPor = user.uid;
        systemMessage = `Chamado ${ticket.titulo} (${ticketId}) foi cancelado por ${userProfile.nome}.`;
      } else if (newStatus === 'reabrir') {
        updateData.status = 'aberto';
        updateData.reabertoEm = new Date();
        updateData.reabertoPor = user.uid;
        systemMessage = `Chamado ${ticket.titulo} (${ticketId}) foi reaberto por ${userProfile.nome}.`;
      } else if (newStatus === 'arquivar') {
        await handleArchiveTicket();
        return;
      } else if (newStatus === 'desarquivar') {
        await handleUnarchiveTicket();
        return;
      } else if (newStatus === 'executado_pelo_consultor') {
        updateData.executadoPeloConsultorEm = new Date();
        updateData.executadoPeloConsultorPor = user.uid;
        systemMessage = `Chamado ${ticket.titulo} (${ticketId}) foi executado pelo consultor ${userProfile.nome}.`;
      }

      await ticketService.updateTicket(ticketId, updateData);
      if (systemMessage) {
        await messageService.addMessage(ticketId, user.uid, systemMessage, 'system');
      }
      loadTicketData();
      setNewStatus('');
      setConclusionDescription('');
      setConclusionImages([]);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Ocorreu um erro ao atualizar o status do chamado.');
    } finally {
      setUpdating(false);
    }
  };

  const handleEscalateToArea = async () => {
    if (!escalationArea || !escalationReason) {
      alert('Por favor, selecione a área e insira o motivo da escalação.');
      return;
    }
    setIsEscalating(true);
    try {
      await ticketService.updateTicket(ticketId, {
        status: 'escalado_para_outra_area',
        areaDestino: escalationArea,
        escaladoEm: new Date(),
        escaladoPor: user.uid,
        motivoEscalonamento: escalationReason,
        dataUltimaAtualizacao: new Date()
      });
      await messageService.addMessage(ticketId, user.uid, `Chamado ${ticket.titulo} (${ticketId}) foi escalado para a área ${escalationArea} por ${userProfile.nome}. Motivo: ${escalationReason}`, 'system');
      loadTicketData();
      setEscalationArea('');
      setEscalationReason('');
      alert('Chamado escalado com sucesso!');
    } catch (error) {
      console.error('Erro ao escalar chamado:', error);
      alert('Ocorreu um erro ao escalar o chamado.');
    } finally {
      setIsEscalating(false);
    }
  };

  const handleEscalateToManagement = async () => {
    if (!managementArea || !managementReason) {
      alert('Por favor, selecione a gerência e insira o motivo da escalação.');
      return;
    }
    setIsEscalatingToManagement(true);
    try {
      await ticketService.updateTicket(ticketId, {
        status: 'aguardando_aprovacao',
        gerenciaDestino: managementArea,
        escaladoEm: new Date(),
        escaladoPor: user.uid,
        motivoEscalonamentoGerencial: managementReason,
        responsavelAtual: user.uid, // Adicionado: Atualiza o responsável atual para o gerente
        dataUltimaAtualizacao: new Date()
      });
      await messageService.addMessage(ticketId, user.uid, `Chamado ${ticket.titulo} (${ticketId}) foi escalado para a Gerência ${managementArea} por ${userProfile.nome}. Motivo: ${managementReason}`, 'system');
      loadTicketData();
      setManagementArea('');
      setManagementReason('');
      alert('Chamado escalado para gerência com sucesso!');
    } catch (error) {
      console.error('Erro ao escalar para gerência:', error);
      alert('Ocorreu um erro ao escalar para gerência.');
    } finally {
      setIsEscalatingToManagement(false);
    }
  };

  const handleEscalateToConsultor = async () => {
    if (!consultorReason) {
      alert('Por favor, insira o motivo da escalação para o consultor.');
      return;
    }
    setIsEscalatingToConsultor(true);
    try {
      await ticketService.updateTicket(ticketId, {
        status: 'escalado_para_consultor',
        consultorResponsavelId: user.uid, // O consultor que escalou é o responsável
        escaladoEm: new Date(),
        escaladoPor: user.uid,
        motivoEscalonamentoConsultor: consultorReason,
        dataUltimaAtualizacao: new Date()
      });
      await messageService.addMessage(ticketId, user.uid, `Chamado ${ticket.titulo} (${ticketId}) foi escalado para o Consultor ${userProfile.nome}. Motivo: ${consultorReason}`, 'system');
      loadTicketData();
      setConsultorReason('');
      alert('Chamado escalado para consultor com sucesso!');
    } catch (error) {
      console.error('Erro ao escalar para consultor:', error);
      alert('Ocorreu um erro ao escalar para consultor.');
    } finally {
      setIsEscalatingToConsultor(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && chatImages.length === 0) return;
    setSendingMessage(true);
    try {
      await messageService.addMessage(ticketId, user.uid, newMessage, 'user', chatImages);
      setNewMessage('');
      setChatImages([]);
      loadTicketData(); // Recarrega os dados para atualizar o chat
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Ocorreu um erro ao enviar a mensagem.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleImageUpload = (newImages) => {
    setChatImages(prevImages => [...prevImages, ...newImages]);
  };

  const handleRemoveImage = (indexToRemove) => {
    setChatImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
  };

  const handleConclusionImageUpload = (newImages) => {
    setConclusionImages(prevImages => [...prevImages, ...newImages]);
  };

  const handleConclusionRemoveImage = (indexToRemove) => {
    setConclusionImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
  };

  const showStatusUpdateSection = () => {
    if (!ticket || !userProfile || !user) return false;
    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;
    const isCreator = ticket.criadoPor === user.uid;

    // Regras para mostrar a seção de atualização de status
    if (userRole === 'administrador') return true;
    if (userRole === 'operador' && ticket.area === userProfile.area) return true;
    if (userRole === 'consultor' && ticket.consultorResponsavelId === user.uid) return true;
    if (isCreator && (currentStatus === 'executado_aguardando_validacao' || currentStatus === 'executado_aguardando_validacao_operador')) return true;
    if (isCreator && currentStatus === 'enviado_para_area' && ticket.rejeitadoEm) return true; // Para o criador cancelar o chamado rejeitado

    return false;
  };

  const showEscalationToAreaCard = () => {
    if (!ticket || !userProfile || !user) return false;
    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;
    const isCreator = ticket.criadoPor === user.uid;

    if (userRole === 'administrador') return true;
    if (userRole === 'operador' && ticket.area === userProfile.area && (currentStatus === 'aberto' || currentStatus === 'em_tratativa' || currentStatus === 'executado_aguardando_validacao')) return true;
    if (userRole === 'consultor' && ticket.consultorResponsavelId === user.uid && currentStatus === 'escalado_para_consultor') return true;

    return false;
  };

  const showEscalationToManagementCard = () => {
    if (!ticket || !userProfile || !user) return false;
    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;
    const isCreator = ticket.criadoPor === user.uid;

    if (userRole === 'administrador') return true;
    if (userRole === 'operador' && ticket.area === userProfile.area && (currentStatus === 'aberto' || currentStatus === 'em_tratativa' || currentStatus === 'executado_aguardando_validacao')) return true;
    if (userRole === 'consultor' && ticket.consultorResponsavelId === user.uid && currentStatus === 'escalado_para_consultor') return true;

    return false;
  };

  const showEscalationToConsultorCard = () => {
    if (!ticket || !userProfile || !user) return false;
    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;
    const isCreator = ticket.criadoPor === user.uid;

    if (userRole === 'administrador') return true;
    if (userRole === 'operador' && ticket.area === userProfile.area && (currentStatus === 'aberto' || currentStatus === 'em_tratativa' || currentStatus === 'executado_aguardando_validacao')) return true;

    return false;
  };

  const showLinkedTicketCard = () => {
    if (!ticket || !userProfile || !user) return false;
    const userRole = userProfile.funcao;
    return userRole === 'operador' || userRole === 'administrador';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <span className="ml-3 text-lg text-gray-700">Carregando dados do chamado...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-red-600">
        <AlertCircle className="h-12 w-12 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Erro ao carregar chamado</h2>
        <p className="text-lg mb-4">{error}</p>
        <Button onClick={() => navigate('/dashboard')}>Voltar para o Dashboard</Button>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-red-600">
        <Lock className="h-12 w-12 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Acesso Negado</h2>
        <p className="text-lg mb-4">Você não tem permissão para visualizar este chamado confidencial.</p>
        <Button onClick={() => navigate('/dashboard')}>Voltar para o Dashboard</Button>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-gray-600">
        <AlertCircle className="h-12 w-12 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Chamado não encontrado</h2>
        <p className="text-lg mb-4">O ID do chamado na URL não corresponde a nenhum chamado existente.</p>
        <Button onClick={() => navigate('/dashboard')}>Voltar para o Dashboard</Button>
      </div>
    );
  }

  const isExtraItem = ticket.itemExtra;

  const handleCreateLinkedTicket = () => {
    if (!ticket) return;
    
    const linkedTicketData = {
      linkedTicketId: ticketId,
      linkedTicketTitle: ticket.titulo,
      linkedTicketDescription: ticket.descricao,
      linkedTicketCreator: ticket.criadoPorNome,
      linkedTicketArea: ticket.area,
      linkedTicketProject: projectsMap[activeProjectId]?.nome || project?.nome || '',
      linkedTicketEvent: projectsMap[activeProjectId]?.evento || project?.evento || ''
    };

    navigate('/novo-chamado', { state: linkedTicketData });
  };

  const currentStatusText = getStatusText(ticket.status);
  const currentStatusColor = getStatusColor(ticket.status);

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Header />
      <main className="flex-1 p-6 md:p-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Botão Voltar */}
            <Button onClick={() => navigate('/dashboard')} variant="outline" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Dashboard
            </Button>

            {/* Detalhes do Chamado */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold">{ticket.titulo}</CardTitle>
                  <Badge className={`${currentStatusColor} text-white px-3 py-1 rounded-full`}>
                    {currentStatusText}
                  </Badge>
                </div>
                <CardDescription className="text-sm text-gray-500">
                  Criado em {formatDate(ticket.criadoEm)} por {ticket.criadoPorNome || 'Usuário Desconhecido'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isExtraItem && (
                  <Alert className="bg-orange-100 border-orange-400 text-orange-800">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <span className="font-bold">ITEM EXTRA:</span> Este chamado possui um item extra.
                    </AlertDescription>
                  </Alert>
                )}
                <div>
                  <h3 className="font-semibold text-gray-700">Descrição:</h3>
                  <p className="text-gray-600">{ticket.descricao}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-700">Área:</h3>
                    <p className="text-gray-600">{ticket.area}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700">Tipo:</h3>
                    <p className="text-gray-600">{ticket.tipo}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Projetos Vinculados */}
            {linkedProjectIds.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Projetos ({linkedProjectIds.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select onValueChange={handleSelectProject} value={activeProjectId || ''}>
                    <SelectTrigger className="w-full mb-4">
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {linkedProjectIds.map(pid => {
                        const p = projectsMap[pid];
                        return p ? (
                          <SelectItem key={pid} value={pid}>
                            {p.nome} - {p.evento} ({p.local})
                          </SelectItem>
                        ) : null;
                      })}
                    </SelectContent>
                  </Select>
                  {project && (
                    <div className="space-y-3">
                      <div className="flex items-center text-gray-600">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span>Local: {project.local}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>Período: {formatDate(project.dataInicio)} - {formatDate(project.dataFim)}</span>
                      </div>
                      <div className="text-gray-600">
                        <h4 className="font-semibold">Produtor:</h4>
                        <p>{resolveUserNameByProjectField(project, 'produtor') || 'Não informado'}</p>
                      </div>
                      <div className="text-gray-600">
                        <h4 className="font-semibold">Consultor:</h4>
                        <p>{resolveUserNameByProjectField(project, 'consultor') || 'Não informado'}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pessoas Envolvidas */}
            <Card>
              <CardHeader>
                <CardTitle>Pessoas Envolvidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2 text-blue-500" />
                  <span className="font-semibold">Criador:</span>
                  <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800">
                    {ticket.criadoPorNome || 'Usuário Desconhecido'}
                  </Badge>
                  <Badge variant="outline" className="ml-2">
                    {getUserNameById(ticket.criadoPor) === ticket.criadoPorNome ? userProfile.funcao : 'Criador'}
                  </Badge>
                </div>
                {ticket.areaResponsavel && (
                  <div className="flex items-center">
                    <UserCheck className="h-4 w-4 mr-2 text-green-500" />
                    <span className="font-semibold">Área Responsável:</span>
                    <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">
                      {ticket.areaResponsavel}
                    </Badge>
                  </div>
                )}
                {ticket.consultorResponsavelId && (
                  <div className="flex items-center">
                    <UserCheck className="h-4 w-4 mr-2 text-purple-500" />
                    <span className="font-semibold">Consultor Responsável:</span>
                    <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-800">
                      {getUserNameById(ticket.consultorResponsavelId)}
                    </Badge>
                  </div>
                )}
                {ticket.produtorResponsavelId && (
                  <div className="flex items-center">
                    <UserCheck className="h-4 w-4 mr-2 text-orange-500" />
                    <span className="font-semibold">Produtor Responsável:</span>
                    <Badge variant="outline" className="ml-2 bg-orange-100 text-orange-800">
                      {getUserNameById(ticket.produtorResponsavelId)}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico do Chamado */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico do Chamado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative pl-8">
                  {historyEvents.map((event, index) => (
                    <div key={index} className="mb-4 last:mb-0 flex items-start">
                      <div className="absolute left-0 flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                        <event.Icon className={`h-5 w-5 ${event.color}`} />
                      </div>
                      <div className="ml-4 flex-1">
                        <p className="text-sm text-gray-500">{formatDate(event.date)}</p>
                        <p className="font-medium text-gray-800">
                          {event.description} <span className="font-bold">{event.userName}</span>.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chat de Mensagens */}
            <Card>
              <CardHeader>
                <CardTitle>Conversas ({messages.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-96 overflow-y-auto pr-4">
                  {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start mb-4 ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex flex-col ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center mb-1">
                          <span className="text-xs font-semibold text-gray-700 mr-2">
                            {msg.senderId === user.uid ? 'Você' : getUserNameById(msg.senderId)}
                          </span>
                          <span className="text-xs text-gray-500">{formatDate(msg.timestamp)}</span>
                        </div>
                        <div className={`p-3 rounded-lg max-w-xs ${msg.senderId === user.uid ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                          {msg.type === 'system' ? (
                            <p className="italic text-sm">{msg.text}</p>
                          ) : (
                            <p className="text-sm">{msg.text}</p>
                          )}
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex flex-wrap mt-2">
                              {msg.images.map((img, imgIndex) => (
                                <img key={imgIndex} src={img} alt="Anexo" className="w-24 h-24 object-cover rounded-md mr-2 mb-2" />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-center space-x-2">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Digite sua mensagem... (use @ para mencionar usuários)"
                    value={newMessage}
                    onChange={handleTextareaChange}
                    onKeyDown={handleTextareaKeyDown}
                    rows={1}
                    className="flex-1 resize-none"
                  />
                  <Button onClick={handleSendMessage} disabled={sendingMessage || (!newMessage.trim() && chatImages.length === 0)}>
                    {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                {showMentionSuggestions && mentionSuggestions.length > 0 && (
                  <div className="absolute z-10 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {mentionSuggestions.map(user => (
                      <div
                        key={user.uid}
                        className="px-4 py-2 cursor-pointer hover:bg-gray-100"
                        onClick={() => insertMention(user)}
                      >
                        {user.nome} ({user.email})
                      </div>
                    ))}
                  </div>
                )}
                <ImageUpload onImageUpload={handleImageUpload} onRemoveImage={handleRemoveImage} existingImages={chatImages} />
              </CardContent>
            </Card>
          </div>

          {/* Coluna Lateral */}
          <div className="lg:col-span-1 space-y-6">
            {/* Card de Vincular Chamado */}
            {showLinkedTicketCard() && (
              <Card>
                <CardHeader>
                  <CardTitle>Vincular Chamado</CardTitle>
                  <CardDescription>Crie um novo chamado para outra área que ficará vinculado a este.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleCreateLinkedTicket} className="w-full" variant="outline">
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Criar Chamado Vinculado
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Card de Ações do Chamado */}
            {showStatusUpdateSection() && (
              <Card>
                <CardHeader>
                  <CardTitle>Ações do Chamado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select onValueChange={setNewStatus} value={newStatus}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Atualizar Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableStatuses().map(statusOption => (
                        <SelectItem key={statusOption.value} value={statusOption.value}>
                          {statusOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(newStatus === 'enviado_para_area' || newStatus === 'reprovado') && (
                    <Textarea
                      placeholder="Motivo da rejeição/devolução (obrigatório)"
                      value={conclusionDescription}
                      onChange={(e) => setConclusionDescription(e.target.value)}
                      rows={3}
                    />
                  )}
                  {newStatus === 'reabrir' && (
                    <Textarea
                      placeholder="Informações adicionais para reabertura (opcional)"
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                      rows={3}
                    />
                  )}
                  <Button onClick={handleStatusUpdate} className="w-full" disabled={updating}>
                    {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Ação'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Card de Escalar para Área */}
            {showEscalationToAreaCard() && (
              <Card>
                <CardHeader>
                  <CardTitle>Escalar para Área</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select onValueChange={setEscalationArea} value={escalationArea}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a Área" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Substituir por áreas dinâmicas do seu sistema */}
                      <SelectItem value="Comercial">Comercial</SelectItem>
                      <SelectItem value="Produção">Produção</SelectItem>
                      <SelectItem value="Logística">Logística</SelectItem>
                      <SelectItem value="Financeiro">Financeiro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="Motivo da escalação (obrigatório)"
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={handleEscalateToArea} className="w-full" disabled={isEscalating}>
                    {isEscalating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Escalar para Área'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Card de Escalar para Gerência */}
            {showEscalationToManagementCard() && (
              <Card>
                <CardHeader>
                  <CardTitle>Escalar para Gerência</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select onValueChange={setManagementArea} value={managementArea}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a Gerência" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Substituir por gerências dinâmicas do seu sistema */}
                      <SelectItem value="Gerência de Produção">Gerência de Produção</SelectItem>
                      <SelectItem value="Gerência Comercial">Gerência Comercial</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="Motivo da escalação para gerência (obrigatório)"
                    value={managementReason}
                    onChange={(e) => setManagementReason(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={handleEscalateToManagement} className="w-full" disabled={isEscalatingToManagement}>
                    {isEscalatingToManagement ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Escalar para Gerência'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Card de Escalar para Consultor */}
            {showEscalationToConsultorCard() && (
              <Card>
                <CardHeader>
                  <CardTitle>Escalar para Consultor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Motivo da escalação para consultor (obrigatório)"
                    value={consultorReason}
                    onChange={(e) => setConsultorReason(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={handleEscalateToConsultor} className="w-full" disabled={isEscalatingToConsultor}>
                    {isEscalatingToConsultor ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Escalar para Consultor'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TicketDetailPage;


