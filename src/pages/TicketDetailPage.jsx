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
import {
  ArrowLeft, Clock, User, MessageSquare, Send, CheckCircle, XCircle, AlertCircle,
  Lock, PlusCircle, Shield, ThumbsUp, ThumbsDown, Archive, ArchiveRestore,
  Link as LinkIcon, ClipboardEdit, MapPin, ExternalLink, Settings, AtSign, Loader2,
  Paperclip, Image as ImageIcon, FolderOpen, Folder, Users, History
} from 'lucide-react';

const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  // ESTADOS UNIFICADOS E COMPLETOS
  const [ticket, setTicket] = useState(null);
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatImages, setChatImages] = useState([]);
  const [newStatus, setNewStatus] = useState('');
  const [conclusionImages, setConclusionImages] = useState([]);
  const [conclusionDescription, setConclusionDescription] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [showAreaSelector, setShowAreaSelector] = useState(false);
  const [escalationArea, setEscalationArea] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);
  const [managementArea, setManagementArea] = useState('');
  const [managementReason, setManagementReason] = useState('');
  const [isEscalatingToManagement, setIsEscalatingToManagement] = useState(false);
  const [consultorReason, setConsultorReason] = useState('');
  const [isEscalatingToConsultor, setIsEscalatingToConsultor] = useState(false);
  const [users, setUsers] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');
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

      const projectsToLoad = [];
      if (ticketData.projetos && Array.isArray(ticketData.projetos) && ticketData.projetos.length > 0) {
        const results = await Promise.allSettled(ticketData.projetos.map(id => projectService.getProjectById(id)));
        results.forEach(res => {
          if (res.status === 'fulfilled' && res.value) projectsToLoad.push(res.value);
        });
      } else if (ticketData.projetoId) {
        const projectData = await projectService.getProjectById(ticketData.projetoId);
        if (projectData) projectsToLoad.push(projectData);
      }
      setProjects(projectsToLoad);

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
      notificationService.markTicketNotificationsAsRead(user.uid, ticketId);
      userService.getAllUsers().then(setUsers).catch(err => console.error("Erro ao carregar usuários:", err));
    }
  }, [ticketId, user]);

  useEffect(() => {
    if (ticket && userProfile && user) {
      if (ticket.isConfidential) {
        const isCreator = ticket.criadoPor === user.uid;
        const isAdmin = userProfile.funcao === 'administrador';
        const isInvolvedOperator = userProfile.funcao === 'operador' && (userProfile.area === ticket.area || userProfile.area === ticket.areaDeOrigem);
        if (!isCreator && !isAdmin && !isInvolvedOperator) {
          setAccessDenied(true);
        }
      }
    }
  }, [ticket, userProfile, user]);

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
      const sortedEvents = events.sort((a, b) => (a.date?.toDate ? a.date.toDate() : new Date(a.date)) - (b.date?.toDate ? b.date.toDate() : new Date(b.date)));
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

  const insertMention = (userToMention) => {
    const beforeCursor = newMessage.substring(0, cursorPosition);
    const afterCursor = newMessage.substring(cursorPosition);
    const beforeMention = beforeCursor.replace(/@\w*$/, '');
    const newText = beforeMention + `@${userToMention.nome} ` + afterCursor;
    setNewMessage(newText);
    setShowMentionSuggestions(false);
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = beforeMention.length + userToMention.nome.length + 2;
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
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status) => {
    const colors = { 
        'aberto': 'bg-blue-100 text-blue-800', 'em_tratativa': 'bg-yellow-100 text-yellow-800', 'em_execucao': 'bg-blue-100 text-blue-800', 
        'enviado_para_area': 'bg-purple-100 text-purple-800', 'escalado_para_outra_area': 'bg-purple-100 text-purple-800', 
        'aguardando_aprovacao': 'bg-orange-100 text-orange-800', 'executado_aguardando_validacao': 'bg-indigo-100 text-indigo-800', 
        'concluido': 'bg-green-100 text-green-800', 'cancelado': 'bg-red-100 text-red-800', 'devolvido': 'bg-pink-100 text-pink-800', 
        'aprovado': 'bg-green-100 text-green-800', 'reprovado': 'bg-red-100 text-red-800', 'arquivado': 'bg-gray-100 text-gray-700', 
        'executado_pelo_consultor': 'bg-yellow-100 text-yellow-800', 'escalado_para_consultor': 'bg-cyan-100 text-cyan-800',
        'executado_aguardando_validacao_operador': 'bg-indigo-100 text-indigo-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const statusTexts = { 
        'aberto': 'Aberto', 'em_tratativa': 'Em Tratativa', 'em_execucao': 'Em Execução', 
        'enviado_para_area': 'Enviado para Área', 'escalado_para_outra_area': 'Escalado para Outra Área', 
        'aguardando_aprovacao': 'Aguardando Aprovação', 'executado_aguardando_validacao': 'Aguardando Validação', 
        'concluido': 'Concluído', 'cancelado': 'Cancelado', 'devolvido': 'Devolvido', 
        'aprovado': 'Aprovado', 'reprovado': 'Reprovado', 'arquivado': 'Arquivado', 
        'executado_pelo_consultor': 'Executado pelo Consultor', 'escalado_para_consultor': 'Escalado para Consultor',
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
    if (userRole === 'administrador') {
      if (['aberto', 'escalado_para_outra_area', 'enviado_para_area'].includes(currentStatus)) return [ { value: 'em_tratativa', label: 'Iniciar Tratativa' } ];
      if (currentStatus === 'em_tratativa') return [ { value: 'executado_aguardando_validacao', label: 'Executado' } ];
      if (currentStatus === 'aguardando_aprovacao') return [ { value: 'aprovado', label: 'Aprovar' }, { value: 'rejeitado', label: 'Reprovar' } ];
    }
    if (userRole === 'operador' && (ticket.area === userProfile.area || ticket.atribuidoA === user.uid)) {
        if (['aberto', 'escalado_para_outra_area', 'enviado_para_area'].includes(currentStatus)) {
            const actions = [ { value: 'em_tratativa', label: 'Iniciar Tratativa' } ];
            if (ticket.areaDeOrigem) { actions.push({ value: 'enviado_para_area', label: 'Rejeitar / Devolver' }); }
            return actions;
        }
        if (currentStatus === 'em_tratativa') { return [ { value: 'executado_aguardando_validacao_operador', label: 'Executado' } ]; }
        if (currentStatus === 'executado_pelo_consultor') { return [ { value: 'em_tratativa', label: 'Continuar Tratativa' }, { value: 'executado_aguardando_validacao', label: 'Finalizar Execução' } ]; }
    }
    if (userRole === 'consultor' && ticket.consultorResponsavelId === user.uid && ticket.status === 'escalado_para_consultor') {
        return [{ value: 'executado_pelo_consultor', label: 'Executar e Devolver para a Área' }];
    }
    return [];
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && chatImages.length === 0) return;
    setSendingMessage(true);
    try {
      const messageData = { userId: user.uid, remetenteNome: userProfile.nome || user.email, conteudo: newMessage.trim(), imagens: chatImages, criadoEm: new Date(), type: 'user_message' };
      await messageService.sendMessage(ticketId, messageData);
      await notificationService.notifyNewMessage(ticketId, ticket, messageData, user.uid);
      setNewMessage('');
      setChatImages([]);
      await loadTicketData();
    } catch (error) {
      alert('Erro ao enviar mensagem: ' + error.message);
    } finally {
      setSendingMessage(false);
    }
  };
  
  const proceedWithStatusUpdate = async (statusToUpdate) => {
    if ((statusToUpdate === 'rejeitado' || statusToUpdate === 'enviado_para_area') && !conclusionDescription.trim()) {
      alert('Por favor, forneça um motivo para a rejeição/devolução');
      return;
    }
    setUpdating(true);
    try {
      let updateData = { status: statusToUpdate, atualizadoPor: user.uid, updatedAt: new Date() };
      let systemMessageContent = `🔄 Status atualizado para: ${getStatusText(statusToUpdate)}`;

      if (statusToUpdate === 'concluido') {
        updateData.conclusaoDescricao = conclusionDescription;
        updateData.conclusaoImagens = conclusionImages;
        updateData.concluidoEm = new Date();
        updateData.concluidoPor = user.uid;
        systemMessageContent = `✅ Chamado concluído: ${conclusionDescription}`;
      } else if (statusToUpdate === 'rejeitado') {
        updateData.motivoRejeicao = conclusionDescription;
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        systemMessageContent = `❌ Chamado reprovado: ${conclusionDescription}`;
      } else if (statusToUpdate === 'enviado_para_area') {
        if (!ticket.areaDeOrigem) { throw new Error('A área de origem para devolução não foi encontrada.'); }
        updateData.motivoRejeicao = conclusionDescription;
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        updateData.areaQueRejeitou = ticket.area;
        updateData.area = ticket.areaDeOrigem;
        systemMessageContent = `🔄 Chamado devolvido para ${updateData.area}: ${conclusionDescription}`;
      } else if (statusToUpdate === 'aprovado' && userProfile.funcao === 'gerente') {
        updateData.status = 'em_tratativa';
        updateData.area = ticket.areaDeOrigem || ticket.area;
        updateData.aprovadoEm = new Date();
        updateData.aprovadoPor = user.uid;
        systemMessageContent = `✅ Chamado aprovado pelo gerente.`;
      } else if (statusToUpdate === 'executado_pelo_consultor') {
        updateData.area = ticket.areaDeOrigem;
        updateData.consultorResponsavelId = null; 
        systemMessageContent = `👨‍🎯 Chamado executado pelo consultor e devolvido para a área de origem.`;
      }

      await ticketService.updateTicket(ticketId, updateData);
      await messageService.sendMessage(ticketId, { userId: user.uid, remetenteNome: 'Sistema', conteudo: systemMessageContent, criadoEm: new Date(), type: 'status_update' });
      await notificationService.notifyStatusChange(ticketId, ticket, updateData.status, ticket.status, user.uid);
      setNewStatus('');
      setConclusionDescription('');
      setConclusionImages([]);
      await loadTicketData();
    } catch (error) {
      alert('Erro ao atualizar status: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    await proceedWithStatusUpdate(newStatus);
  };
  
  const handleConsultorEscalation = async () => {
    const mainProject = projects.length > 0 ? projects[0] : null;
    if (!consultorReason.trim()) {
      alert('Por favor, descreva o motivo da escalação para o consultor');
      return;
    }
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
      setConsultorReason('');
      await loadTicketData();
    } catch (error) {
      alert('Erro ao escalar para consultor: ' + error.message);
    } finally {
      setIsEscalatingToConsultor(false);
    }
  };

  const handleResubmitTicket = async () => {
    if (!additionalInfo.trim() || !ticket.areaQueRejeitou) {
      alert('Informações insuficientes para o reenvio.');
      return;
    }
    setIsResubmitting(true);
    try {
      const updateData = {
        status: 'aberto', 
        area: ticket.areaQueRejeitou,
        areaDeOrigem: ticket.area,
        areaQueRejeitou: null,
        descricao: `${ticket.descricao}\n\n--- INFORMAÇÕES ADICIONAIS ---\n${additionalInfo}`,
        atualizadoPor: user.uid,
        updatedAt: new Date()
      };
      await ticketService.updateTicket(ticketId, updateData);
      await messageService.sendMessage(ticketId, { userId: user.uid, remetenteNome: 'Sistema', conteudo: `📬 Chamado reenviado com informações adicionais.`, criadoEm: new Date(), type: 'status_update' });
      setAdditionalInfo('');
      await loadTicketData();
    } catch (error) {
      alert('Ocorreu um erro ao reenviar o chamado: ' + error.message);
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleArchiveTicket = async () => {
    if (!window.confirm('Tem certeza que deseja arquivar este chamado?')) return;
    setUpdating(true);
    try {
        await ticketService.updateTicket(ticketId, { status: 'arquivado', arquivadoEm: new Date(), arquivadoPor: user.uid });
        navigate('/dashboard');
    } catch (error) {
        alert('Ocorreu um erro ao arquivar o chamado.');
    } finally {
        setUpdating(false);
    }
  };

  const handleUnarchiveTicket = async () => {
      if (!window.confirm('Deseja desarquivar este chamado?')) return;
      setUpdating(true);
      try {
          await ticketService.updateTicket(ticketId, { status: 'concluido', arquivadoEm: null, arquivadoPor: null });
          await loadTicketData();
      } catch (error) {
          alert('Ocorreu um erro ao desarquivar o chamado.');
      } finally {
          setUpdating(false);
      }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Carregando chamado...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Erro ao Carregar</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <Button onClick={() => navigate('/dashboard')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Dashboard
        </Button>
      </div>
    );
  }
  
  if (accessDenied || !ticket) {
     return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
            <Lock className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado ou Chamado Inexistente</h2>
            <Button onClick={() => navigate('/dashboard')} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Dashboard
            </Button>
        </div>
    );
  }
  
  const isArchived = ticket.status === 'arquivado';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={`Chamado #${ticket.numero || ticketId.slice(-8)}`} />
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="mb-3">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Dashboard
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 break-words">{ticket.titulo}</h2>
              <p className="text-gray-600 mt-1">Criado em {formatDate(ticket.criadoEm)} por {ticket.criadoPorNome}</p>
            </div>
            <div className="flex items-center space-x-2">
              {ticket.isConfidential && <Badge variant="outline" className="border-orange-400 text-orange-700"><Lock className="h-3 w-3 mr-1.5" />Confidencial</Badge>}
              <Badge className={getStatusColor(ticket.status)}>{getStatusText(ticket.status)}</Badge>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Detalhes do Chamado</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{ticket.descricao}</p>
              </CardContent>
            </Card>

            {projects.length > 0 && (
              <Card>
                <CardHeader><CardTitle>{projects.length > 1 ? 'Projetos Associados' : 'Projeto Associado'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {projects.map(p => (
                    <div key={p.id} className="p-3 border rounded-md">
                      <p className="font-semibold">{p.nome}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader><CardTitle>Conversas</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                    {messages.map((message, index) => (
                      <div key={index} className="flex space-x-3">
                          <div className="flex-shrink-0"><div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center"><User className="h-4 w-4 text-white" /></div></div>
                          <div>
                              <p className="font-semibold text-sm">{message.remetenteNome}</p>
                              <p className="text-gray-700 whitespace-pre-wrap">{message.conteudo}</p>
                          </div>
                      </div>
                    ))}
                </div>
                <div className="border-t pt-4">
                  <Textarea placeholder="Digite sua mensagem..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={sendingMessage || isArchived} />
                  <div className="mt-2 flex justify-end">
                      <Button onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim() || isArchived}>
                          {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Send className="h-4 w-4 mr-2" />}
                          Enviar
                      </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader><CardTitle>Ações</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <Select value={newStatus} onValueChange={setNewStatus} disabled={isArchived}>
                      <SelectTrigger><SelectValue placeholder="Mudar status..." /></SelectTrigger>
                      <SelectContent>
                          {getAvailableStatuses().map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {(newStatus === 'concluido' || newStatus === 'enviado_para_area' || newStatus === 'rejeitado') && (
                      <Textarea value={conclusionDescription} onChange={(e) => setConclusionDescription(e.target.value)} placeholder="Motivo/Descrição..."/>
                    )}
                    <Button onClick={handleStatusUpdate} disabled={!newStatus || updating || isArchived} className="w-full">
                        {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
                    </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
                <CardContent>
                    {historyEvents.map((event, index) => (
                      <div key={index} className="flex items-start space-x-3 mb-4">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-opacity-20 ${event.color}`}><event.Icon className="h-5 w-5" /></div>
                          <div>
                              <p className="text-sm">{event.description} <span className="font-semibold">{event.userName}</span></p>
                              <p className="text-xs text-gray-500">{formatDate(event.date)}</p>
                          </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;
