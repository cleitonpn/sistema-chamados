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

  // Estados para anexar links
  const [attachedLinks, setAttachedLinks] = useState([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkDescription, setNewLinkDescription] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [savingLink, setSavingLink] = useState(false);

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
  const [showManagementModal, setShowManagementModal] = useState(false);

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

  // Função para adicionar link
  const handleAddLink = async () => {
    if (!newLinkUrl.trim()) {
      alert('Por favor, insira uma URL válida');
      return;
    }

    try {
      setSavingLink(true);
      
      const linkData = {
        url: newLinkUrl.trim(),
        description: newLinkDescription.trim() || 'Link anexado',
        addedBy: user.uid,
        addedByName: userProfile?.nome || user.email,
        addedAt: new Date()
      };

      // Atualizar o array de links anexados
      const updatedLinks = [...(ticket.attachedLinks || []), linkData];
      
      // Salvar no banco de dados
      await ticketService.updateTicket(ticketId, {
        attachedLinks: updatedLinks,
        updatedAt: new Date()
      });

      // Atualizar estado local
      setAttachedLinks(updatedLinks);
      setTicket(prev => ({ ...prev, attachedLinks: updatedLinks }));
      
      // Limpar formulário
      setNewLinkUrl('');
      setNewLinkDescription('');
      setShowLinkForm(false);
      
      // Adicionar mensagem no chat informando sobre o link
      const messageData = {
        userId: user.uid,
        remetenteNome: userProfile?.nome || user.email,
        conteudo: `📎 Link anexado: ${linkData.description}\n🔗 ${linkData.url}`,
        criadoEm: new Date(),
        type: 'link_attachment'
      };
      await messageService.sendMessage(ticketId, messageData);
      
      // Recarregar mensagens
      const messagesData = await messageService.getMessagesByTicket(ticketId);
      setMessages(messagesData || []);
      
    } catch (error) {
      console.error('Erro ao anexar link:', error);
      alert('Erro ao anexar link. Tente novamente.');
    } finally {
      setSavingLink(false);
    }
  };

  // Função para remover link
  const handleRemoveLink = async (linkIndex) => {
    if (!confirm('Tem certeza que deseja remover este link?')) return;
    
    try {
      const updatedLinks = attachedLinks.filter((_, index) => index !== linkIndex);
      
      await ticketService.updateTicket(ticketId, {
        attachedLinks: updatedLinks,
        updatedAt: new Date()
      });
      
      setAttachedLinks(updatedLinks);
      setTicket(prev => ({ ...prev, attachedLinks: updatedLinks }));
      
    } catch (error) {
      console.error('Erro ao remover link:', error);
      alert('Erro ao remover link. Tente novamente.');
    }
  };

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

  // useEffect para carregar links anexados
  useEffect(() => {
    if (ticket && ticket.attachedLinks) {
      setAttachedLinks(ticket.attachedLinks);
    }
  }, [ticket]);

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
        'escalado_para_consultor': 'bg-indigo-100 text-indigo-800', 
        'aguardando_aprovacao': 'bg-orange-100 text-orange-800', 
        'aprovado': 'bg-green-100 text-green-800', 
        'reprovado': 'bg-red-100 text-red-800', 
        'devolvido': 'bg-red-100 text-red-800', 
        'transferido_para_produtor': 'bg-cyan-100 text-cyan-800', 
        'executado_aguardando_validacao': 'bg-lime-100 text-lime-800', 
        'validado': 'bg-emerald-100 text-emerald-800', 
        'concluido': 'bg-green-100 text-green-800', 
        'cancelado': 'bg-gray-100 text-gray-800', 
        'arquivado': 'bg-gray-100 text-gray-800' 
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = { 
        'aberto': 'Aberto', 
        'em_tratativa': 'Em Tratativa', 
        'em_execucao': 'Em Execução', 
        'enviado_para_area': 'Enviado para Área', 
        'escalado_para_area': 'Escalado para Área', 
        'escalado_para_outra_area': 'Escalado para Outra Área', 
        'escalado_para_consultor': 'Escalado para Consultor', 
        'aguardando_aprovacao': 'Aguardando Aprovação', 
        'aprovado': 'Aprovado', 
        'reprovado': 'Reprovado', 
        'devolvido': 'Devolvido', 
        'transferido_para_produtor': 'Transferido para Produtor', 
        'executado_aguardando_validacao': 'Executado - Aguardando Validação', 
        'validado': 'Validado', 
        'concluido': 'Concluído', 
        'cancelado': 'Cancelado', 
        'arquivado': 'Arquivado' 
    };
    return labels[status] || status;
  };

  const getAvailableStatuses = () => {
    if (!ticket || !userProfile) return [];
    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;

    // Gerente pode aprovar/reprovar chamados escalados para gerência
    if (userRole === 'gerente' && currentStatus === 'aguardando_aprovacao' && ticket.responsavelAtual === user.uid) {
      return [ { value: 'aprovado', label: 'Aprovar' }, { value: 'reprovado', label: 'Reprovar' } ];
    }

    // Produtor pode executar chamados transferidos para ele
    if (userRole === 'produtor' && currentStatus === 'transferido_para_produtor' && ticket.produtorResponsavelId === user.uid) {
      return [{ value: 'executado_aguardando_validacao', label: 'Executar' }];
    }

    if (userRole === 'administrador') {
      if (currentStatus === 'aberto') return [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }, { value: 'concluido', label: 'Concluir' }];
      if (currentStatus === 'em_tratativa') return [{ value: 'em_execucao', label: 'Executar' }, { value: 'concluido', label: 'Concluir' }];
      if (currentStatus === 'em_execucao') return [{ value: 'concluido', label: 'Concluir' }];
      if (currentStatus === 'executado_aguardando_validacao') return [{ value: 'validado', label: 'Validar' }, { value: 'devolvido', label: 'Devolver' }];
      if (currentStatus === 'validado') return [{ value: 'concluido', label: 'Concluir' }];
      if (currentStatus === 'aprovado') return [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }];
      if (currentStatus === 'reprovado' || currentStatus === 'devolvido') return [{ value: 'em_tratativa', label: 'Reiniciar Tratativa' }];
    }

    if (userRole === 'operador') {
      const userArea = userProfile.area;
      const ticketArea = ticket.area;
      const isResponsible = ticketArea === userArea || ticket.atribuidoA === user.uid;
      if (!isResponsible) return [];
      if (currentStatus === 'aberto') return [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }];
      if (currentStatus === 'em_tratativa') return [{ value: 'em_execucao', label: 'Executar' }];
      if (currentStatus === 'em_execucao') return [{ value: 'concluido', label: 'Concluir' }];
      if (currentStatus === 'executado_aguardando_validacao') return [{ value: 'validado', label: 'Validar' }, { value: 'devolvido', label: 'Devolver' }];
      if (currentStatus === 'validado') return [{ value: 'concluido', label: 'Concluir' }];
      if (currentStatus === 'aprovado') return [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }];
      if (currentStatus === 'reprovado' || currentStatus === 'devolvido') return [{ value: 'em_tratativa', label: 'Reiniciar Tratativa' }];
    }

    if (userRole === 'consultor') {
      if (currentStatus === 'escalado_para_consultor') return [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }];
    }

    return [];
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    setUpdating(true);
    try {
      const updateData = { status: newStatus, dataUltimaAtualizacao: new Date() };
      if (newStatus === 'concluido') {
        updateData.concluidoEm = new Date();
        updateData.concluidoPor = user.uid;
        updateData.descricaoConclusao = conclusionDescription;
        updateData.imagensConclusao = conclusionImages;
      }
      if (newStatus === 'validado') {
        updateData.validadoEm = new Date();
        updateData.validadoPor = user.uid;
      }
      if (newStatus === 'aprovado') {
        updateData.aprovadoEm = new Date();
        updateData.aprovadoPor = user.uid;
        updateData.status = 'em_tratativa';
        updateData.responsavelAtual = null;
      }
      if (newStatus === 'reprovado') {
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        updateData.status = 'devolvido';
        updateData.responsavelAtual = ticket.escaladoPor;
      }
      if (newStatus === 'devolvido') {
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        updateData.responsavelAtual = ticket.criadoPor;
      }
      await ticketService.updateTicket(ticketId, updateData);
      setNewStatus('');
      setConclusionDescription('');
      setConclusionImages([]);
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do chamado');
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
        remetenteNome: userProfile?.nome || user.email,
        conteudo: newMessage.trim(),
        criadoEm: new Date(),
        imagens: chatImages
      };
      await messageService.sendMessage(ticketId, messageData);
      setNewMessage('');
      setChatImages([]);
      const messagesData = await messageService.getMessagesByTicket(ticketId);
      setMessages(messagesData || []);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleEscalateToArea = async () => {
    if (!escalationArea || !escalationReason) {
      alert('Por favor, selecione a área e forneça um motivo.');
      return;
    }
    setIsEscalating(true);
    try {
      const updateData = {
        status: 'escalado_para_outra_area',
        areaEscalada: escalationArea,
        escaladoEm: new Date(),
        escaladoPor: user.uid,
        motivoEscalonamento: escalationReason,
        dataUltimaAtualizacao: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      setEscalationArea('');
      setEscalationReason('');
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao escalar para área:', error);
      alert('Erro ao escalar chamado');
    } finally {
      setIsEscalating(false);
    }
  };

  const handleManagementEscalation = async () => {
    if (!managementArea || !managementReason) {
      alert('Por favor, selecione a gerência e forneça um motivo.');
      return;
    }

    setIsEscalatingToManagement(true);
    try {
      // Encontra o gerente correspondente na lista de todos os usuários
      const targetManager = users.find(user => user.area === managementArea.replace('gerente_', '') && user.funcao === 'gerente');

      if (!targetManager) {
        alert(`Erro: Nenhum gerente encontrado para a área "${managementArea}". Verifique o cadastro de usuários.`);
        console.error('Nenhum gerente encontrado para a área:', managementArea);
        setIsEscalatingToManagement(false);
        return;
      }

      const managerUid = targetManager.id; // O ID do documento do usuário é o UID

      const updateData = {
        status: 'aguardando_aprovacao',
        gerenciaDestino: managementArea,
        escaladoEm: new Date(),
        escaladoPor: user.uid,
        motivoEscalonamentoGerencial: managementReason,
        responsavelAtual: managerUid, // <-- CORREÇÃO PRINCIPAL AQUI
        dataUltimaAtualizacao: new Date()
      };

      await ticketService.updateTicket(ticketId, updateData);

      // Mensagem para o chat
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `👨‍💼 **Chamado escalado para ${managementArea.replace('gerente_', '').replace('_', ' ').toUpperCase()}**\n\n**Motivo:** ${managementReason}\n\n**Gerente Responsável:** ${targetManager.nome}`,
        criadoEm: new Date(),
        type: 'management_escalation'
      };
      await messageService.sendMessage(ticketId, escalationMessage);

      // Notificação para o gerente
      await notificationService.notifyManagementEscalation(
        ticketId,
        ticket,
        managerUid, // Usando o UID do gerente encontrado
        user.uid,
        managementReason
      );
      console.log('✅ Notificação de escalação gerencial enviada');
      
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
    if (!consultorReason) {
      alert('Por favor, forneça um motivo para a escalação.');
      return;
    }
    setIsEscalatingToConsultor(true);
    try {
      const updateData = {
        status: 'escalado_para_consultor',
        escaladoEm: new Date(),
        escaladoPor: user.uid,
        motivoEscalonamentoConsultor: consultorReason,
        dataUltimaAtualizacao: new Date()
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

  const showEscalationToAreaCard = () => {
    if (!userProfile) return false;
    const userRole = userProfile.funcao;
    const currentStatus = ticket?.status;
    
    // Produtores podem escalar quando o chamado está transferido para eles
    if (userRole === 'produtor' && currentStatus === 'transferido_para_produtor') {
      return true;
    }
    
    if (userRole === 'operador' && ['em_tratativa', 'em_execucao'].includes(currentStatus)) {
      return true;
    }
    if (userRole === 'administrador') return true;
    return false;
  };

  const showEscalationToManagementCard = () => {
    if (!userProfile) return false;
    const userRole = userProfile.funcao;
    const currentStatus = ticket?.status;
    
    // Produtores podem escalar quando o chamado está transferido para eles
    if (userRole === 'produtor' && currentStatus === 'transferido_para_produtor') {
      return true;
    }
    
    if (userRole === 'operador' && ['em_tratativa', 'em_execucao'].includes(currentStatus)) {
      return true;
    }
    if (userRole === 'administrador') return true;
    return false;
  };

  const showEscalationToConsultorCard = () => {
    if (!userProfile) return false;
    const userRole = userProfile.funcao;
    const currentStatus = ticket?.status;
    
    // Produtores podem escalar quando o chamado está transferido para eles
    if (userRole === 'produtor' && currentStatus === 'transferido_para_produtor') {
      return true;
    }
    
    if (userRole === 'operador' && ['em_tratativa', 'em_execucao'].includes(currentStatus)) {
      return true;
    }
    if (userRole === 'administrador') return true;
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto p-6">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Você não tem permissão para visualizar este chamado confidencial.
            </AlertDescription>
          </Alert>
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
            <AlertDescription>Chamado não encontrado</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const isArchived = ticket.status === 'arquivado';
  const availableStatuses = getAvailableStatuses();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-6xl mx-auto p-6">
        {/* Header com botão voltar */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Detalhes do Chamado</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações do chamado */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {ticket.titulo}
                      {(ticket.confidencial || ticket.isConfidential) && (
                        <Lock className="h-4 w-4 text-red-500" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      Criado em {formatDate(ticket.criadoEm)} por {ticket.criadoPorNome}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(ticket.status)}>
                    {getStatusLabel(ticket.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Descrição</Label>
                  <p className="mt-1 text-gray-900">{ticket.descricao}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Área</Label>
                    <p className="mt-1 text-gray-900">{ticket.area}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Tipo</Label>
                    <p className="mt-1 text-gray-900">{ticket.tipo}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Prioridade</Label>
                    <p className="mt-1 text-gray-900">{ticket.prioridade}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Evento</Label>
                    <p className="mt-1 text-gray-900">{ticket.evento}</p>
                  </div>
                </div>

                {ticket.observacoes && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Observações</Label>
                    <p className="mt-1 text-gray-900">{ticket.observacoes}</p>
                  </div>
                )}

                {parentTicketForLink && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Chamado Pai</Label>
                    <Link 
                      to={`/ticket/${parentTicketForLink.id}`}
                      className="mt-1 text-blue-600 hover:text-blue-800 underline block"
                    >
                      {parentTicketForLink.titulo}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card para Anexar Links */}
            {!isArchived && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador' || userProfile.funcao === 'produtor') && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    Links Anexados
                  </CardTitle>
                  <CardDescription>
                    Anexe links de documentos (Google Drive, OneDrive, etc.) relacionados a este chamado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Exibir links existentes */}
                  {(ticket.attachedLinks || []).length > 0 && (
                    <div className="space-y-3 mb-4">
                      <Label className="text-sm font-medium">Links Anexados:</Label>
                      {(ticket.attachedLinks || []).map((link, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <ExternalLink className="h-4 w-4 text-blue-600" />
                              <a 
                                href={link.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 font-medium truncate"
                              >
                                {link.description}
                              </a>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Anexado por {link.addedByName} em {formatDate(link.addedAt)}
                            </p>
                          </div>
                          {(userProfile.funcao === 'administrador' || link.addedBy === user.uid) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveLink(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulário para adicionar novo link */}
                  {!showLinkForm ? (
                    <Button 
                      onClick={() => setShowLinkForm(true)}
                      variant="outline"
                      className="w-full border-dashed border-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Anexar Novo Link
                    </Button>
                  ) : (
                    <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div>
                        <Label htmlFor="link-url" className="text-sm font-medium">
                          URL do Link *
                        </Label>
                        <Input
                          id="link-url"
                          type="url"
                          placeholder="https://drive.google.com/..."
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          className="mt-1"
                          disabled={savingLink}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="link-description" className="text-sm font-medium">
                          Descrição do Link
                        </Label>
                        <Input
                          id="link-description"
                          placeholder="Ex: Documentação do projeto, Orçamento aprovado..."
                          value={newLinkDescription}
                          onChange={(e) => setNewLinkDescription(e.target.value)}
                          className="mt-1"
                          disabled={savingLink}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleAddLink}
                          disabled={!newLinkUrl.trim() || savingLink}
                          className="flex-1"
                        >
                          {savingLink ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <LinkIcon className="h-4 w-4 mr-2" />
                          )}
                          Anexar Link
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setShowLinkForm(false);
                            setNewLinkUrl('');
                            setNewLinkDescription('');
                          }}
                          disabled={savingLink}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Ações disponíveis */}
            {!isArchived && availableStatuses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Ações</CardTitle>
                  <CardDescription>
                    Atualize o status do chamado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="status">Novo Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um status" />
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

                  {newStatus === 'concluido' && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="conclusion-description">Descrição da Conclusão</Label>
                        <Textarea
                          id="conclusion-description"
                          placeholder="Descreva como o chamado foi resolvido..."
                          value={conclusionDescription}
                          onChange={(e) => setConclusionDescription(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Imagens da Conclusão</Label>
                        <ImageUpload
                          images={conclusionImages}
                          onImagesChange={setConclusionImages}
                          maxImages={5}
                        />
                      </div>
                    </div>
                  )}

                  <Button 
                    onClick={handleStatusUpdate} 
                    disabled={!newStatus || updating}
                    className="w-full"
                  >
                    {updating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Atualizar Status
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Escalar para Área */}
            {!isArchived && showEscalationToAreaCard() && (
              <Card>
                <CardHeader>
                  <CardTitle>Escalar para Área</CardTitle>
                  <CardDescription>
                    Transfira o chamado para outra área
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="escalation-area">Área de Destino</Label>
                    <Select value={escalationArea} onValueChange={setEscalationArea}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma área" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operacional">Operacional</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="producao">Produção</SelectItem>
                        <SelectItem value="locacao">Locação</SelectItem>
                        <SelectItem value="compras">Compras</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="escalation-reason">Motivo da Escalação</Label>
                    <Textarea
                      id="escalation-reason"
                      placeholder="Explique o motivo da escalação..."
                      value={escalationReason}
                      onChange={(e) => setEscalationReason(e.target.value)}
                    />
                  </div>

                  <Button 
                    onClick={handleEscalateToArea} 
                    disabled={!escalationArea || !escalationReason || isEscalating}
                    className="w-full"
                  >
                    {isEscalating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowLeft className="h-4 w-4 mr-2" />
                    )}
                    Escalar para Área
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Escalar para Gerência */}
            {!isArchived && showEscalationToManagementCard() && (
              <Card>
                <CardHeader>
                  <CardTitle>Escalar para Gerência</CardTitle>
                  <CardDescription>
                    Solicite aprovação da gerência
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="management-area">Gerência</Label>
                    <Select value={managementArea} onValueChange={setManagementArea}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma gerência" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gerente_operacional">Gerência Operacional</SelectItem>
                        <SelectItem value="gerente_financeiro">Gerência Financeira</SelectItem>
                        <SelectItem value="gerente_comercial">Gerência Comercial</SelectItem>
                        <SelectItem value="gerente_producao">Gerência de Produção</SelectItem>
                        <SelectItem value="gerente_locacao">Gerência de Locação</SelectItem>
                        <SelectItem value="gerente_compras">Gerência de Compras</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="management-reason">Motivo da Escalação</Label>
                    <Textarea
                      id="management-reason"
                      placeholder="Explique o motivo da escalação para gerência..."
                      value={managementReason}
                      onChange={(e) => setManagementReason(e.target.value)}
                    />
                  </div>

                  <Button 
                    onClick={handleManagementEscalation} 
                    disabled={!managementArea || !managementReason || isEscalatingToManagement}
                    className="w-full"
                  >
                    {isEscalatingToManagement ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    Escalar para Gerência
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Escalar para Consultor */}
            {!isArchived && showEscalationToConsultorCard() && (
              <Card>
                <CardHeader>
                  <CardTitle>Escalar para Consultor</CardTitle>
                  <CardDescription>
                    Solicite análise de um consultor
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="consultor-reason">Motivo da Escalação</Label>
                    <Textarea
                      id="consultor-reason"
                      placeholder="Explique o motivo da escalação para consultor..."
                      value={consultorReason}
                      onChange={(e) => setConsultorReason(e.target.value)}
                    />
                  </div>

                  <Button 
                    onClick={handleEscalateToConsultor} 
                    disabled={!consultorReason || isEscalatingToConsultor}
                    className="w-full"
                  >
                    {isEscalatingToConsultor ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserCheck className="h-4 w-4 mr-2" />
                    )}
                    Escalar para Consultor
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Chat */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nenhuma mensagem ainda</p>
                  ) : (
                    messages.map((message, index) => (
                      <div key={index} className="flex gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{message.remetenteNome}</span>
                            <span className="text-xs text-gray-500">
                              {formatDate(message.criadoEm)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                            {message.conteudo}
                          </div>
                          {message.imagens && message.imagens.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {message.imagens.map((img, imgIndex) => (
                                <img
                                  key={imgIndex}
                                  src={img}
                                  alt={`Imagem ${imgIndex + 1}`}
                                  className="rounded-lg max-w-full h-auto cursor-pointer"
                                  onClick={() => window.open(img, '_blank')}
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
                  <div className="space-y-4">
                    <div className="relative">
                      <Textarea
                        ref={textareaRef}
                        placeholder="Digite sua mensagem... (use @ para mencionar usuários)"
                        value={newMessage}
                        onChange={handleTextareaChange}
                        onKeyDown={handleTextareaKeyDown}
                        className="min-h-[80px]"
                      />
                      
                      {showMentionSuggestions && (
                        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1">
                          {mentionSuggestions.map((user, index) => (
                            <button
                              key={index}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                              onClick={() => insertMention(user)}
                            >
                              <AtSign className="h-4 w-4 text-gray-400" />
                              <span>{user.nome}</span>
                              <span className="text-sm text-gray-500">({user.email})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>Anexar Imagens</Label>
                      <ImageUpload
                        images={chatImages}
                        onImagesChange={setChatImages}
                        maxImages={3}
                      />
                    </div>

                    <Button 
                      onClick={handleSendMessage} 
                      disabled={(!newMessage.trim() && chatImages.length === 0) || sendingMessage}
                      className="w-full"
                    >
                      {sendingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Enviar Mensagem
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Informações do projeto */}
            {linkedProjectIds.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Projetos Vinculados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {linkedProjectIds.length > 1 && (
                    <div className="mb-4">
                      <Label>Selecionar Projeto</Label>
                      <Select value={activeProjectId} onValueChange={handleSelectProject}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {linkedProjectIds.map((pid) => {
                            const proj = projectsMap[pid];
                            return (
                              <SelectItem key={pid} value={pid}>
                                {proj?.nome || `Projeto ${pid}`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {project && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Nome</Label>
                        <p className="text-sm text-gray-900">{project.nome}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Cliente</Label>
                        <p className="text-sm text-gray-900">{project.cliente}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Evento</Label>
                        <p className="text-sm text-gray-900">{project.evento}</p>
                      </div>
                      {project.dataInicio && (
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Data de Início</Label>
                          <p className="text-sm text-gray-900">{formatDate(project.dataInicio)}</p>
                        </div>
                      )}
                      {project.dataFim && (
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Data de Fim</Label>
                          <p className="text-sm text-gray-900">{formatDate(project.dataFim)}</p>
                        </div>
                      )}

                      {/* Responsáveis do projeto */}
                      <Separator />
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Responsáveis</Label>
                        <div className="mt-2 space-y-2">
                          {resolveUserNameByProjectField(project, 'consultor') && (
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-blue-500" />
                              <span className="text-sm">Consultor: {resolveUserNameByProjectField(project, 'consultor')}</span>
                            </div>
                          )}
                          {resolveUserNameByProjectField(project, 'produtor') && (
                            <div className="flex items-center gap-2">
                              <Settings className="h-4 w-4 text-green-500" />
                              <span className="text-sm">Produtor: {resolveUserNameByProjectField(project, 'produtor')}</span>
                            </div>
                          )}
                          {resolveUserNameByProjectField(project, 'operador') && (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-purple-500" />
                              <span className="text-sm">Operador: {resolveUserNameByProjectField(project, 'operador')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Histórico */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Histórico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {historyEvents.map((event, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <event.Icon className={`h-4 w-4 ${event.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          {event.description} <span className="font-medium">{event.userName}</span>
                        </p>
                        <p className="text-xs text-gray-500">{formatDate(event.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Ações administrativas */}
            {userProfile?.funcao === 'administrador' && (
              <Card>
                <CardHeader>
                  <CardTitle>Ações Administrativas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isArchived ? (
                    <Button 
                      onClick={handleUnarchiveTicket} 
                      disabled={updating}
                      variant="outline"
                      className="w-full"
                    >
                      {updating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                      )}
                      Desarquivar
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleArchiveTicket} 
                      disabled={updating}
                      variant="outline"
                      className="w-full"
                    >
                      {updating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Archive className="h-4 w-4 mr-2" />
                      )}
                      Arquivar
                    </Button>
                  )}
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

