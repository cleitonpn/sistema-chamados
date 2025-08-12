import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService } from '@/services/ticketService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { messageService } from '@/services/messageService';
import notificationService from '@/services/notificationService';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  User,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
  PlusCircle,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Archive,
  ArchiveRestore,
  Link as LinkIcon,
  Users,
  History,
  FolderOpen,
  Folder,
  AlertTriangle,
  ExternalLink,
  Loader2,
  UserCheck
} from 'lucide-react';

// Componente principal da página de detalhes do chamado
const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  // --- ESTADOS UNIFICADOS ---
  const [ticket, setTicket] = useState(null);
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [parentTicketForLink, setParentTicketForLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [conclusionDescription, setConclusionDescription] = useState('');
  const [escalationArea, setEscalationArea] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);
  const [managementArea, setManagementArea] = useState('');
  const [managementReason, setManagementReason] = useState('');
  const [isEscalatingToManagement, setIsEscalatingToManagement] = useState(false);
  const [consultorReason, setConsultorReason] = useState('');
  const [isEscalatingToConsultor, setIsEscalatingToConsultor] = useState(false);
  
  // --- FUNÇÕES DE CARREGAMENTO DE DADOS ---

  /**
   * Recarrega os dados do chamado e das mensagens após uma ação.
   * É uma versão mais leve do que a carga inicial completa.
   */
  const refreshTicketData = async () => {
    try {
      const [ticketData, messagesData] = await Promise.all([
        ticketService.getTicketById(ticketId),
        messageService.getMessagesByTicket(ticketId),
      ]);
      setTicket(ticketData);
      setMessages(messagesData || []);
    } catch (err) {
      setError('Falha ao atualizar os dados do chamado.');
      console.error("Refresh error:", err);
    }
  };

  // --- HOOKS DE EFEITO (useEffect) ---

  /**
   * EFEITO PRINCIPAL DE CARREGAMENTO.
   * Este hook é o coração da correção. Ele roda apenas quando o `ticketId` ou `user` mudam.
   * Ele busca todos os dados iniciais de forma controlada para evitar loops.
   */
  useEffect(() => {
    if (!ticketId || !user) {
      setLoading(false);
      return;
    }

    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        setAccessDenied(false);

        // 1. Busca os dados primários (chamado e todos os usuários) em paralelo.
        const [ticketData, allUsers] = await Promise.all([
          ticketService.getTicketById(ticketId),
          userService.getAllUsers()
        ]);

        if (!ticketData) {
          throw new Error('Chamado não encontrado');
        }
        
        // Atualiza os estados primários
        setTicket(ticketData);
        setUsers(allUsers || []);

        // 2. Com os dados do chamado em mãos, busca os dados secundários (projetos, mensagens, etc.)
        const projectsToLoad = [];
        if (ticketData.projetoId) {
          try {
            const projectData = await projectService.getProjectById(ticketData.projetoId);
            if (projectData) projectsToLoad.push(projectData);
          } catch (err) { console.warn("Erro ao carregar projeto único:", err); }
        } else if (ticketData.projetos?.length > 0) {
          const results = await Promise.allSettled(
            ticketData.projetos.map(id => projectService.getProjectById(id))
          );
          results.forEach(res => {
            if (res.status === 'fulfilled' && res.value) projectsToLoad.push(res.value);
          });
        }
        
        const [messagesData, parentData] = await Promise.all([
            messageService.getMessagesByTicket(ticketId),
            ticketData.chamadoPaiId ? ticketService.getTicketById(ticketData.chamadoPaiId) : Promise.resolve(null)
        ]);
        
        // Atualiza os estados secundários
        setProjects(projectsToLoad);
        setMessages(messagesData || []);
        setParentTicketForLink(parentData);

        // 3. Marca as notificações como lidas
        await notificationService.markTicketNotificationsAsRead(user.uid, ticketId);

      } catch (err) {
        console.error('Erro fatal ao carregar dados do chamado:', err);
        setError(err.message || 'Ocorreu um erro desconhecido ao carregar o chamado.');
      } finally {
        // 4. Garante que o loading seja desativado, mesmo se ocorrer um erro.
        setLoading(false);
      }
    };

    loadInitialData();
  }, [ticketId, user]); // Dependências seguras que não causam loop.

  // Efeito para verificar permissão de acesso (roda após o carregamento inicial)
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
  }, [ticket, userProfile, user]); // Dependências seguras.

  // Efeito para construir o histórico de eventos (roda após o carregamento inicial)
  useEffect(() => {
    if (ticket && users.length > 0) {
      const events = [];
      if (ticket.criadoEm) events.push({ date: ticket.criadoEm, description: 'Chamado criado por', userName: ticket.criadoPorNome || getUserNameById(ticket.criadoPor), Icon: PlusCircle, color: 'text-blue-500' });
      if (ticket.escaladoEm && ticket.motivoEscalonamentoGerencial) events.push({ date: ticket.escaladoEm, description: 'Escalado para gerência por', userName: getUserNameById(ticket.escaladoPor), Icon: Shield, color: 'text-purple-500' });
      if (ticket.aprovadoEm) events.push({ date: ticket.aprovadoEm, description: 'Aprovado por', userName: getUserNameById(ticket.aprovadoPor), Icon: ThumbsUp, color: 'text-green-500' });
      if (ticket.rejeitadoEm) events.push({ date: ticket.rejeitadoEm, description: 'Rejeitado / Devolvido por', userName: getUserNameById(ticket.rejeitadoPor), Icon: ThumbsDown, color: 'text-red-500' });
      if (ticket.concluidoEm) events.push({ date: ticket.concluidoEm, description: 'Concluído por', userName: getUserNameById(ticket.concluidoPor), Icon: CheckCircle, color: 'text-green-600' });

      const sortedEvents = events.sort((a, b) =>
        (a.date?.toDate ? a.date.toDate() : new Date(a.date)) -
        (b.date?.toDate ? b.date.toDate() : new Date(b.date))
      );
      setHistoryEvents(sortedEvents);
    }
  }, [ticket, users]); // Dependências seguras.


  // --- FUNÇÕES AUXILIARES E DE UTILIDADE ---

  const getUserNameById = (userId) => {
    if (!users || !userId) return 'Sistema';
    const userFound = users.find(u => u.uid === userId || u.id === userId);
    return userFound?.nome || 'Usuário Desconhecido';
  };

  const formatDate = (date) => {
    if (!date) return 'Data não disponível';
    try {
      const dateObj = (date.toDate && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
      if (isNaN(dateObj.getTime())) return 'Data inválida';
      return dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Erro na data';
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'aberto': { text: 'Aberto', color: 'bg-blue-100 text-blue-800' },
      'em_tratativa': { text: 'Em Tratativa', color: 'bg-yellow-100 text-yellow-800' },
      'enviado_para_area': { text: 'Devolvido', color: 'bg-pink-100 text-pink-800' },
      'escalado_para_outra_area': { text: 'Escalado', color: 'bg-purple-100 text-purple-800' },
      'aguardando_aprovacao': { text: 'Aguardando Aprovação', color: 'bg-orange-100 text-orange-800' },
      'executado_aguardando_validacao': { text: 'Aguardando Validação', color: 'bg-indigo-100 text-indigo-800' },
      'concluido': { text: 'Concluído', color: 'bg-green-100 text-green-800' },
      'cancelado': { text: 'Cancelado', color: 'bg-red-100 text-red-800' },
      'arquivado': { text: 'Arquivado', color: 'bg-gray-100 text-gray-700' },
      'escalado_para_consultor': { text: 'Escalado p/ Consultor', color: 'bg-cyan-100 text-cyan-800' },
      'executado_pelo_consultor': { text: 'Executado p/ Consultor', color: 'bg-yellow-100 text-yellow-800' },
      'executado_aguardando_validacao_operador': { text: 'Aguardando Validação', color: 'bg-indigo-100 text-indigo-800' }
    };
    return statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
  };

  const renderMentions = (content) => {
    if (!content) return '';
    return content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, (match, name) => 
        `<span class="bg-blue-100 text-blue-800 font-semibold px-1 rounded">@${name}</span>`);
  };

  // --- LÓGICA DE AÇÕES DO USUÁRIO ---

  const getAvailableStatuses = () => {
    if (!ticket || !userProfile || !user) return [];
    const { status: currentStatus, criadoPor, area: ticketArea } = ticket;
    const { funcao: userRole, area: userArea } = userProfile;
    const isCreator = criadoPor === user.uid;

    if (isCreator && ['executado_aguardando_validacao', 'executado_aguardando_validacao_operador'].includes(currentStatus)) {
      return [{ value: 'concluido', label: 'Validar e Concluir' }, { value: 'enviado_para_area', label: 'Rejeitar / Devolver' }];
    }
    if (isCreator && currentStatus === 'enviado_para_area' && ticket.rejeitadoEm) {
      return [{ value: 'cancelado', label: 'Cancelar Chamado' }];
    }
    if (userRole === 'administrador') {
      if (['aberto', 'escalado_para_outra_area', 'enviado_para_area'].includes(currentStatus)) return [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }];
      if (currentStatus === 'em_tratativa') return [{ value: 'executado_aguardando_validacao', label: 'Executado' }];
      if (currentStatus === 'executado_aguardando_validacao' && !isCreator) return [{ value: 'concluido', label: 'Forçar Conclusão (Admin)' }];
      if (currentStatus === 'aguardando_aprovacao') return [{ value: 'aprovado', label: 'Aprovar' }, { value: 'rejeitado', label: 'Reprovar' }];
    }
    if (userRole === 'operador' && (ticketArea === userArea || ticket.atribuidoA === user.uid)) {
      if (['aberto', 'escalado_para_outra_area', 'enviado_para_area'].includes(currentStatus)) {
        const actions = [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }];
        if (ticket.areaDeOrigem) actions.push({ value: 'enviado_para_area', label: 'Rejeitar / Devolver' });
        return actions;
      }
      if (currentStatus === 'em_tratativa') return [{ value: 'executado_aguardando_validacao_operador', label: 'Executado' }];
      if (currentStatus === 'executado_pelo_consultor') return [{ value: 'em_tratativa', label: 'Continuar Tratativa' }, { value: 'executado_aguardando_validacao', label: 'Finalizar Execução' }];
    }
    if (userRole === 'consultor' && ticket.consultorResponsavelId === user.uid && currentStatus === 'escalado_para_consultor') {
      return [{ value: 'executado_pelo_consultor', label: 'Executar e Devolver para a Área' }];
    }
    return [];
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const messageData = { userId: user.uid, remetenteNome: userProfile?.nome || user.email, conteudo: newMessage.trim(), criadoEm: new Date(), type: 'user_message' };
      await messageService.sendMessage(ticketId, messageData);
      await notificationService.notifyNewMessage(ticketId, ticket, messageData, user.uid);
      setNewMessage('');
      await refreshTicketData();
    } catch (error) {
      setError('Erro ao enviar mensagem: ' + error.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    if (['rejeitado', 'enviado_para_area'].includes(newStatus) && !conclusionDescription.trim()) {
      setError('Por favor, forneça um motivo para a rejeição/devolução.');
      return;
    }
    setUpdating(true);
    setError(null);
    try {
      let updateData = { status: newStatus, atualizadoPor: user.uid, updatedAt: new Date() };
      let systemMessageContent = `🔄 Status atualizado para: ${getStatusInfo(newStatus).text}`;

      switch (newStatus) {
        case 'concluido':
          updateData = { ...updateData, conclusaoDescricao: conclusionDescription, concluidoEm: new Date(), concluidoPor: user.uid };
          systemMessageContent = `✅ Chamado concluído: ${conclusionDescription || 'Sem observações.'}`;
          break;
        case 'rejeitado':
          updateData = { ...updateData, motivoRejeicao: conclusionDescription, rejeitadoEm: new Date(), rejeitadoPor: user.uid };
          systemMessageContent = `❌ Chamado reprovado: ${conclusionDescription}`;
          break;
        case 'enviado_para_area':
          if (!ticket.areaDeOrigem) throw new Error('A área de origem para devolução não foi encontrada.');
          updateData = { ...updateData, motivoRejeicao: conclusionDescription, rejeitadoEm: new Date(), rejeitadoPor: user.uid, areaQueRejeitou: ticket.area, area: ticket.areaDeOrigem };
          systemMessageContent = `🔄 Chamado devolvido para ${updateData.area}: ${conclusionDescription}`;
          break;
        case 'aprovado':
          if (userProfile.funcao === 'gerente') {
            updateData = { ...updateData, status: 'em_tratativa', area: ticket.areaDeOrigem || ticket.area, aprovadoEm: new Date(), aprovadoPor: user.uid };
            systemMessageContent = `✅ Chamado aprovado pelo gerente.`;
          }
          break;
        case 'executado_pelo_consultor':
          updateData = { ...updateData, area: ticket.areaDeOrigem, consultorResponsavelId: null };
          systemMessageContent = `👨‍🎯 Chamado executado pelo consultor e devolvido para a área de origem.`;
          break;
      }

      await ticketService.updateTicket(ticketId, updateData);
      await messageService.sendSystemMessage(ticketId, user.uid, systemMessageContent);
      await notificationService.notifyStatusChange(ticketId, ticket, newStatus, ticket.status, user.uid);
      
      setNewStatus('');
      setConclusionDescription('');
      await refreshTicketData();
    } catch (error) {
      setError('Erro ao atualizar status: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleEscalation = async () => {
    if (!escalationArea || !escalationReason.trim()) {
      setError("Selecione uma área e forneça um motivo.");
      return;
    }
    setIsEscalating(true);
    setError(null);
    try {
      const updateData = { status: 'escalado_para_outra_area', area: escalationArea, areaDeOrigem: ticket.area, motivoEscalonamento: escalationReason, escaladoPor: user.uid, escaladoEm: new Date() };
      await ticketService.updateTicket(ticketId, updateData);
      await messageService.sendSystemMessage(ticketId, user.uid, `Chamado escalado para a área ${escalationArea}. Motivo: ${escalationReason}`);
      setEscalationArea('');
      setEscalationReason('');
      await refreshTicketData();
    } catch (error) {
      setError('Erro ao escalar o chamado: ' + error.message);
    } finally {
      setIsEscalating(false);
    }
  };
  
  const handleEscalationToManagement = async () => {
    if (!managementArea || !managementReason.trim()) {
      setError("Selecione uma gerência e forneça um motivo.");
      return;
    }
    setIsEscalatingToManagement(true);
    setError(null);
    try {
      const targetManager = users.find(u => u.funcao === 'gerente' && u.area === managementArea);
      if (!targetManager) throw new Error(`Gerente para a área ${managementArea} não encontrado.`);
      const updateData = { status: 'aguardando_aprovacao', areaDeOrigem: ticket.area, gerenteResponsavelId: targetManager.uid, motivoEscalonamentoGerencial: managementReason, escaladoPor: user.uid, escaladoEm: new Date() };
      await ticketService.updateTicket(ticketId, updateData);
      await messageService.sendSystemMessage(ticketId, user.uid, `Chamado escalado para a gerência ${managementArea}. Motivo: ${managementReason}`);
      setManagementArea('');
      setManagementReason('');
      await refreshTicketData();
    } catch (error) {
      setError('Erro ao escalar para gerência: ' + error.message);
    } finally {
      setIsEscalatingToManagement(false);
    }
  };

  const handleConsultorEscalation = async () => {
    const mainProject = projects.length > 0 ? projects[0] : null;
    if (!consultorReason.trim() || !mainProject?.consultorId) {
      setError('Motivo ou consultor do projeto não encontrado para escalação.');
      return;
    }
    setIsEscalatingToConsultor(true);
    setError(null);
    try {
      const updateData = { status: 'escalado_para_consultor', areaDeOrigem: ticket.area, consultorResponsavelId: mainProject.consultorId, motivoEscalonamentoConsultor: consultorReason, escaladoPor: user.uid, escaladoEm: new Date() };
      await ticketService.updateTicket(ticketId, updateData);
      await messageService.sendSystemMessage(ticketId, user.uid, `Chamado escalado para o consultor do projeto. Motivo: ${consultorReason}`);
      setConsultorReason('');
      await refreshTicketData();
    } catch (error) {
      setError('Erro ao escalar para consultor: ' + error.message);
    } finally {
      setIsEscalatingToConsultor(false);
    }
  };
  
  const handleArchiveTicket = async (archive = true) => {
    setUpdating(true);
    try {
      await ticketService.updateTicket(ticketId, { status: archive ? 'arquivado' : 'concluido' });
      await refreshTicketData();
    } catch (error) {
      setError('Erro ao ' + (archive ? 'arquivar' : 'desarquivar') + ' o chamado.');
    } finally {
      setUpdating(false);
    }
  };

  // --- RENDERIZAÇÃO DO COMPONENTE ---

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-lg text-gray-700">Carregando dados do chamado...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Header />
        <Alert variant="destructive" className="max-w-4xl mx-auto"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
        <div className="text-center mt-4"><Button onClick={() => navigate('/dashboard')} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button></div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Header />
        <Alert variant="destructive" className="max-w-4xl mx-auto"><Lock className="h-4 w-4" /><AlertDescription>Acesso Negado. Este chamado é confidencial.</AlertDescription></Alert>
        <div className="text-center mt-4"><Button onClick={() => navigate('/dashboard')} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 p-6"><Header /><Alert className="max-w-4xl mx-auto"><AlertCircle className="h-4 w-4" /><AlertDescription>Chamado não encontrado.</AlertDescription></Alert></div>
    );
  }

  const isArchived = ticket.status === 'arquivado';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Chamado #{ticket.numero}</h1>
              <p className="text-sm text-gray-600">{ticket.titulo}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge className={getStatusInfo(ticket.status).color}>{getStatusInfo(ticket.status).text}</Badge>
            {ticket.isConfidential && <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" />Confidencial</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Detalhes do Chamado</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Descrição</Label><p className="text-gray-700 mt-1 whitespace-pre-wrap">{ticket.descricao}</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label>Área</Label><p>{ticket.area}</p></div>
                  <div><Label>Categoria</Label><p>{ticket.categoria}</p></div>
                  <div><Label>Criado por</Label><p>{ticket.criadoPorNome}</p></div>
                  <div><Label>Data de criação</Label><p>{formatDate(ticket.criadoEm)}</p></div>
                </div>
                {ticket.itemExtra && <Alert className="bg-orange-50 border-orange-200"><AlertTriangle className="h-4 w-4 text-orange-500" /><AlertDescription className="text-orange-800"><strong>ITEM EXTRA:</strong> {ticket.motivoItemExtra}</AlertDescription></Alert>}
                {parentTicketForLink && <Alert className="bg-blue-50 border-blue-200"><LinkIcon className="h-4 w-4 text-blue-500" /><AlertDescription>Vinculado a: <Link to={`/chamado/${parentTicketForLink.id}`} className="font-semibold text-blue-600 hover:underline">#{parentTicketForLink.numero}</Link></AlertDescription></Alert>}
              </CardContent>
            </Card>

            {projects.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center">{projects.length > 1 ? <FolderOpen className="mr-2 h-5 w-5" /> : <Folder className="mr-2 h-5 w-5" />}{projects.length > 1 ? `Projetos (${projects.length})` : 'Projeto'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {projects.map((proj, index) => (
                    <div key={index} className="p-3 border rounded-lg flex justify-between items-center">
                      <div><h3 className="font-semibold">{proj.nome}</h3><p className="text-sm text-gray-600">{proj.evento}</p></div>
                      <Button asChild variant="outline" size="sm"><a href={`/projeto/${proj.id}`} target="_blank" rel="noopener noreferrer">Ver <ExternalLink className="ml-2 h-3 w-3" /></a></Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="flex items-center"><MessageSquare className="mr-2 h-5 w-5" />Conversas</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto p-2 mb-4">
                  {messages.length > 0 ? messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.type === 'system' ? 'justify-center' : ''}`}>
                      {msg.type !== 'system' && <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0"><User className="h-4 w-4" /></div>}
                      <div className={`p-3 rounded-lg max-w-lg ${msg.type === 'system' ? 'bg-yellow-100 text-yellow-800 text-sm italic w-full text-center' : 'bg-gray-100'}`}>
                        {msg.type !== 'system' && <p className="font-semibold text-sm">{msg.remetenteNome}</p>}
                        <div className="text-sm" dangerouslySetInnerHTML={{ __html: renderMentions(msg.conteudo) }} />
                        <p className="text-xs text-gray-500 mt-1 text-right">{formatDate(msg.criadoEm)}</p>
                      </div>
                    </div>
                  )) : <p className="text-center text-gray-500">Nenhuma mensagem ainda.</p>}
                </div>
                {!isArchived && (
                  <div className="border-t pt-4">
                    <Textarea placeholder="Digite sua mensagem..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={sendingMessage} />
                    <div className="flex justify-end mt-2"><Button onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim()}>{sendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Enviar</Button></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Ações</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {getAvailableStatuses().length > 0 && !isArchived && (
                  <div className="space-y-2">
                    <Label>Atualizar Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}><SelectTrigger><SelectValue placeholder="Selecione uma ação" /></SelectTrigger><SelectContent>{getAvailableStatuses().map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
                    {['concluido', 'rejeitado', 'enviado_para_area'].includes(newStatus) && <Textarea placeholder="Adicione observações ou motivo..." value={conclusionDescription} onChange={(e) => setConclusionDescription(e.target.value)} />}
                    {newStatus && <Button onClick={handleStatusUpdate} disabled={updating} className="w-full">{updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}Confirmar</Button>}
                  </div>
                )}
                {userProfile?.funcao === 'administrador' && (ticket.status === 'arquivado' ? <Button onClick={() => handleArchiveTicket(false)} variant="outline" className="w-full"><ArchiveRestore className="mr-2 h-4 w-4" /> Desarquivar</Button> : ticket.status === 'concluido' && <Button onClick={() => handleArchiveTicket(true)} variant="outline" className="w-full"><Archive className="mr-2 h-4 w-4" /> Arquivar</Button>)}
              </CardContent>
            </Card>

            {!isArchived && (
              <Card>
                <CardHeader><CardTitle>Escalonamentos</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Escalar para outra Área</Label>
                    <Select value={escalationArea} onValueChange={setEscalationArea}><SelectTrigger><SelectValue placeholder="Selecione a área" /></SelectTrigger><SelectContent><SelectItem value="comercial">Comercial</SelectItem><SelectItem value="operacao">Operação</SelectItem><SelectItem value="logistica">Logística</SelectItem><SelectItem value="financeiro">Financeiro</SelectItem></SelectContent></Select>
                    <Textarea placeholder="Motivo..." value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} />
                    <Button onClick={handleEscalation} disabled={isEscalating || !escalationArea || !escalationReason} className="w-full" variant="outline">{isEscalating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Escalar</Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Escalar para Gerência</Label>
                    <Select value={managementArea} onValueChange={setManagementArea}><SelectTrigger><SelectValue placeholder="Selecione a gerência" /></SelectTrigger><SelectContent><SelectItem value="operacional">Gerência Operacional</SelectItem><SelectItem value="comercial">Gerência Comercial</SelectItem></SelectContent></Select>
                    <Textarea placeholder="Motivo..." value={managementReason} onChange={(e) => setManagementReason(e.target.value)} />
                    <Button onClick={handleEscalationToManagement} disabled={isEscalatingToManagement || !managementArea || !managementReason} className="w-full" variant="outline">{isEscalatingToManagement ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />} Escalar</Button>
                  </div>
                  {projects.length > 0 && projects[0]?.consultorId && (
                    <div className="space-y-2">
                      <Label>Escalar para Consultor</Label>
                      <Textarea placeholder="Motivo..." value={consultorReason} onChange={(e) => setConsultorReason(e.target.value)} />
                      <Button onClick={handleConsultorEscalation} disabled={isEscalatingToConsultor || !consultorReason} className="w-full" variant="outline">{isEscalatingToConsultor ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />} Escalar</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="flex items-center"><History className="mr-2 h-5 w-5" />Histórico</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {historyEvents.map((event, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <div className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full ${event.color.replace('text-', 'bg-').replace('-500', '-100')}`}><event.Icon className={`h-4 w-4 ${event.color}`} /></div>
                      <div><p className="text-sm text-gray-600">{event.description} <span className="font-semibold text-gray-800">{event.userName}</span></p><p className="text-xs text-gray-500">{formatDate(event.date)}</p></div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TicketDetailPage;
