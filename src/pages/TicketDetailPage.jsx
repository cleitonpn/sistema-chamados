import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService } from '@/services/ticketService';
import { messageService } from '@/services/messageService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import notificationService from '@/services/notificationService';
import { TICKET_CATEGORIES } from '@/constants/ticketCategories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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
  Plus,
  Loader2
} from 'lucide-react';

const TicketDetailPage = () => {
  const { id: ticketId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
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
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const conclusionFileInputRef = useRef(null);

  useEffect(() => {
    if (ticketId && user) {
      loadInitialData();
    }
  }, [ticketId, user]);
  
  const loadInitialData = async () => {
      console.log("PASSO 1: Iniciando o carregamento de dados do chamado...");
      setLoading(true);
      try {
        // Carregamentos que não dependem do chamado
        const usersPromise = userService.getAllUsers().then(data => setUsers(data || []));
        const managementsPromise = userService.getManagements().then(data => setManagements(data || []));
        const areasPromise = userService.getAreas().then(data => setAreas(data || []));
        
        await Promise.all([usersPromise, managementsPromise, areasPromise]);

        // Agora carrega os dados do chamado
        await loadTicketData();
  
      } catch (error) {
        console.error('❌ OCORREU UM ERRO GERAL NO CARREGAMENTO INICIAL:', error);
        setError('Erro ao carregar dados essenciais da página');
      } finally {
        console.log("PASSO FINAL: Fim do processo. Definindo loading como false.");
        setLoading(false);
      }
    };

  const loadTicketData = async () => {
    console.log("PASSO 2: Buscando dados principais do chamado com ID:", ticketId);
    try {
      const ticketData = await ticketService.getTicketById(ticketId);
      console.log("PASSO 3: Dados principais do chamado RECEBIDOS.", ticketData);

      if (!ticketData) {
        setError('Chamado não encontrado');
        console.log("FIM: Chamado não encontrado.");
        return;
      }
      setTicket(ticketData);

      const projectsToLoad = [];
      if (ticketData.projetoId) {
        console.log("PASSO 4a: Chamado antigo - buscando projeto único por projetoId");
        const projectData = await projectService.getProjectById(ticketData.projetoId);
        if (projectData) projectsToLoad.push(projectData);
      } else if (ticketData.projetos?.length > 0) {
        console.log("PASSO 4b: Chamado novo - buscando múltiplos projetos");
        const projectsData = await Promise.allSettled(
          ticketData.projetos.map(projectId => projectService.getProjectById(projectId))
        );
        projectsData.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            projectsToLoad.push(result.value);
          }
        });
      }
      setProjects(projectsToLoad);
      console.log("PASSO 5: Projetos CARREGADOS.", projectsToLoad);

      console.log("PASSO 6: Buscando mensagens do chamado...");
      const messagesData = await messageService.getMessagesByTicket(ticketId);
      console.log("PASSO 7: Mensagens RECEBIDAS.", messagesData);
      setMessages(messagesData || []);

    } catch (error) {
      console.error('❌ OCORREU UM ERRO DENTRO DO loadTicketData:', error);
      setError('Erro ao carregar os detalhes do chamado');
      // Não definimos loading como false aqui para que o finally principal cuide disso.
    }
  };

  const reloadTicketAndMessages = async () => {
      try {
          // Apenas recarrega os dados do chamado e mensagens, não os dados estáticos.
          await loadTicketData();
      } catch (error) {
          console.error("Erro ao recarregar dados do chamado:", error);
          setError("Não foi possível atualizar os dados do chamado.");
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
        senderName: user.displayName || userProfile?.nome || 'Usuário',
        timestamp: new Date()
      });

      if (ticket) {
          await notificationService.sendTicketNotification(
            ticket,
            'nova_mensagem',
            `Nova mensagem de ${user.displayName || userProfile?.nome || 'Usuário'}`,
            user.uid
          );
      }

      setNewMessage('');
      setSelectedImages([]);
      fileInputRef.current.value = ""; // Limpa o input de arquivo
      await reloadTicketAndMessages();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setError('Falha ao enviar a mensagem.');
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
    if (!newStatus || !ticket) return;

    // Lógica para o modal de rejeição
    if (newStatus === 'enviado_para_area' && ticket.status !== 'aberto') {
      setShowRejectModal(true);
      return;
    }

    try {
      const updateData = {
        status: newStatus,
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      if (newStatus === 'concluido') {
        updateData.conclusionMessage = conclusionMessage;
        updateData.conclusionImages = conclusionImages;
        updateData.completedAt = new Date();
        updateData.completedBy = user.uid;
      }

      await ticketService.updateTicket(ticketId, updateData);

      await notificationService.sendTicketNotification(
        ticket,
        'mudanca_status',
        `Status alterado para: ${getStatusLabel(newStatus)}`,
        user.uid
      );

      setNewStatus('');
      setConclusionMessage('');
      setConclusionImages([]);
      conclusionFileInputRef.current.value = "";
      await reloadTicketAndMessages();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setError('Falha ao atualizar o status do chamado.');
    }
  };

  const handleRejectTicket = async () => {
    if (!rejectReason.trim() || !ticket) {
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

      await notificationService.sendTicketNotification(
        ticket,
        'chamado_rejeitado',
        `Chamado rejeitado/devolvido: ${rejectReason}`,
        user.uid
      );

      setShowRejectModal(false);
      setRejectReason('');
      setNewStatus(''); // Reseta o select de ações
      await reloadTicketAndMessages();
    } catch (error) {
      console.error('Erro ao rejeitar chamado:', error);
      setError('Falha ao rejeitar o chamado.');
    }
  };

  const handleEscalateToArea = async () => {
    if (!escalationArea || !escalationReason.trim() || !ticket) {
      alert('Por favor, selecione uma área e informe o motivo da escalação.');
      return;
    }

    try {
      const updateData = {
        area: escalationArea,
        escalationReason: escalationReason,
        escalatedAt: new Date(),
        escalatedBy: user.uid,
        status: 'aberto', // Status é reaberto para a nova área
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      await ticketService.updateTicket(ticketId, updateData);

      await notificationService.sendTicketNotification(
        ticket,
        'escalacao_area',
        `Chamado escalado para área: ${escalationArea}`,
        user.uid
      );

      setEscalationArea('');
      setEscalationReason('');
      await reloadTicketAndMessages();
    } catch (error) {
      console.error('Erro ao escalar para área:', error);
      setError('Falha ao escalar o chamado para a área.');
    }
  };

  const handleEscalateToManagement = async () => {
    if (!escalationManagement || !escalationManagementReason.trim() || !ticket) {
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

      await notificationService.sendTicketNotification(
        ticket,
        'escalacao_gerencia',
        `Chamado escalado para gerência: ${escalationManagement}`,
        user.uid
      );

      setEscalationManagement('');
      setEscalationManagementReason('');
      await reloadTicketAndMessages();
    } catch (error) {
      console.error('Erro ao escalar para gerência:', error);
      setError('Falha ao escalar o chamado para a gerência.');
    }
  };

  const handleEscalateToConsultor = async () => {
    if (!escalationConsultorReason.trim() || !ticket) {
      alert('Por favor, informe o motivo da escalação para o consultor.');
      return;
    }

    if (projects.length === 0 || !projects[0]?.consultorId) {
      alert('Erro: Consultor do projeto não encontrado');
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

      await notificationService.sendTicketNotification(
        ticket,
        'escalacao_consultor',
        `Chamado escalado para consultor do projeto`,
        user.uid
      );

      setEscalationConsultorReason('');
      await reloadTicketAndMessages();
    } catch (error) {
      console.error('Erro ao escalar para consultor:', error);
      setError('Falha ao escalar o chamado para o consultor.');
    }
  };
  
  const handleTransferToProducer = async () => {
    if (projects.length === 0 || !projects[0]?.produtorId) {
      alert('Erro: Produtor do projeto não encontrado');
      return;
    }
  
    try {
      const updateData = {
        status: 'em_tratativa', // Muda o status para em tratativa
        responsavelAtual: 'produtor',
        transferredToProducerAt: new Date(),
        transferredToProducerBy: user.uid,
        updatedAt: new Date(),
        updatedBy: user.uid
      };
  
      await ticketService.updateTicket(ticketId, updateData);
  
      await notificationService.sendTicketNotification(
        ticket,
        'transferencia_produtor',
        'Chamado transferido para produtor',
        user.uid
      );
  
      await reloadTicketAndMessages();
    } catch (error) {
      console.error('Erro ao transferir para produtor:', error);
      setError('Falha ao transferir o chamado para o produtor.');
    }
  };

  const handleArchiveTicket = async () => {
    if(!ticket) return;
    try {
      const updateData = {
        archived: !ticket.archived,
        archivedAt: !ticket.archived ? new Date() : null,
        archivedBy: !ticket.archived ? user.uid : null,
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      await ticketService.updateTicket(ticketId, updateData);
      await reloadTicketAndMessages();
    } catch (error) {
      console.error('Erro ao arquivar/desarquivar chamado:', error);
      setError('Falha ao arquivar/desarquivar o chamado.');
    }
  };

  const handleCreateLinkedTicket = () => {
    if(!ticket) return;
    const ticketData = {
      linkedTicketId: ticketId,
      linkedTicketTitle: ticket.titulo,
      linkedTicketDescription: ticket.descricao,
      linkedTicketCreator: ticket.criadoPorNome,
      linkedTicketArea: ticket.area,
      linkedTicketProject: projects.length > 0 ? projects[0].nome : '',
      linkedTicketEvent: projects.length > 0 ? projects[0].evento : ''
    };

    const queryParams = new URLSearchParams(ticketData).toString();
    navigate(`/novo-chamado?${queryParams}`);
  };

  const handleMentionInput = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setNewMessage(value);

    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionQuery(query);
      
      const filteredUsers = users.filter(u => 
        u.displayName?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query)
      ).slice(0, 5);
      
      setMentionSuggestions(filteredUsers);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (selectedUser) => {
    if (!textareaRef.current) return;
    
    const message = newMessage;
    const startPos = textareaRef.current.selectionStart;
    const beforeCursor = message.substring(0, startPos - mentionQuery.length - 1);
    const afterCursor = message.substring(startPos);
    
    const newText = `${beforeCursor}@${selectedUser.displayName} ${afterCursor}`;
    setNewMessage(newText);
    setShowMentions(false);
    setMentionQuery('');
    
    setTimeout(() => {
      textareaRef.current.focus();
      const newCursorPos = beforeCursor.length + selectedUser.displayName.length + 2;
      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const getAvailableStatuses = () => {
    if (!ticket || !user || !userProfile) return [];

    const currentStatus = ticket.status;
    const isCreator = ticket.criadoPor === user.uid;
    const isAdmin = userProfile.funcao === 'administrador';
    const userArea = userProfile.area || '';
    const ticketArea = ticket.area;

    let statuses = [];

    // Regras do Administrador (tem acesso a quase tudo)
    if (isAdmin) {
        statuses.push({ value: 'aberto', label: 'Reabrir', description: 'Reabrir chamado para a área original' });
        statuses.push({ value: 'em_tratativa', label: 'Em Tratativa', description: 'Iniciar ou continuar o tratamento' });
        statuses.push({ value: 'executado_aguardando_validacao', label: 'Executado', description: 'Marcar como executado (p/ validação)' });
        statuses.push({ value: 'concluido', label: 'Concluir (Admin)', description: 'Forçar a finalização do chamado' });
        statuses.push({ value: 'enviado_para_area', label: 'Rejeitar / Devolver', description: 'Devolver para a área anterior/criador' });
        statuses.push({ value: 'cancelado', label: 'Cancelar', description: 'Cancelar chamado permanentemente' });
        return statuses;
    }

    // Regras do Criador do Chamado
    if (isCreator) {
        if (['executado_aguardando_validacao', 'executado_aguardando_validacao_operador'].includes(currentStatus)) {
            statuses.push({ value: 'concluido', label: 'Validar e Concluir', description: 'Confirmar a execução e finalizar o chamado.' });
            statuses.push({ value: 'enviado_para_area', label: 'Rejeitar / Devolver', description: 'Devolver para a área responsável corrigir.' });
        }
        if (currentStatus === 'enviado_para_area' && ticket.rejectedAt) {
            statuses.push({ value: 'cancelado', label: 'Cancelar Chamado', description: 'Cancelar este chamado permanentemente.' });
        }
    }

    // Regras do Operador da Área
    if (userProfile.funcao?.startsWith('operador_') && userArea === ticketArea) {
        if (currentStatus === 'aberto') {
            statuses.push({ value: 'em_tratativa', label: 'Iniciar Tratativa', description: 'Assumir a responsabilidade e iniciar o trabalho.' });
        }
        if (currentStatus === 'em_tratativa') {
            statuses.push({ value: 'executado_aguardando_validacao', label: 'Executado', description: 'Marcar como executado e enviar para validação.' });
            statuses.push({ value: 'enviado_para_area', label: 'Rejeitar / Devolver', description: 'Devolver para a área anterior ou criador.' });
        }
    }

    // Regras do Consultor
    if (userProfile.funcao === 'consultor' && currentStatus === 'aguardando_consultor') {
        statuses.push({ value: 'em_tratativa', label: 'Dar Tratativa', description: 'Assumir e devolver para a área de origem' });
        statuses.push({ value: 'executado_aguardando_validacao', label: 'Concluir Direto', description: 'Finalizar o chamado diretamente' });
        statuses.push({ value: 'enviado_para_area', label: 'Enviar para Área', description: 'Escalar para outra área responsável' });
    }

    // Regras do Produtor
    if (userProfile.funcao === 'produtor' && currentStatus === 'em_tratativa' && ticket.responsavelAtual === 'produtor') {
        statuses.push({ value: 'executado_aguardando_validacao', label: 'Executado', description: 'Marcar como executado e enviar para validação.' });
        statuses.push({ value: 'enviado_para_area', label: 'Rejeitar / Devolver', description: 'Devolver para a área anterior' });
    }

    // Regras da Gerência
    if (userProfile.funcao === 'gerencia' && currentStatus === 'aguardando_aprovacao_gerencial') {
        statuses.push({ value: 'em_tratativa', label: 'Aprovar', description: 'Aprovar e retornar o chamado para execução.' });
        statuses.push({ value: 'enviado_para_area', label: 'Rejeitar', description: 'Rejeitar a solicitação e devolver.' });
    }

    // Remove duplicados e retorna
    const uniqueStatuses = Array.from(new Set(statuses.map(s => s.value))).map(value => {
        return statuses.find(s => s.value === value);
    });

    return uniqueStatuses;
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'aberto': 'Aberto',
      'em_tratativa': 'Em Tratativa',
      'executado_aguardando_validacao': 'Executado - Aguardando Validação',
      'concluido': 'Concluído',
      'enviado_para_area': 'Devolvido / Rejeitado',
      'aguardando_consultor': 'Aguardando Consultor',
      'aguardando_aprovacao_gerencial': 'Aguardando Aprovação Gerencial',
      'cancelado': 'Cancelado'
    };
    return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'aberto': 'bg-blue-100 text-blue-800',
      'em_tratativa': 'bg-yellow-100 text-yellow-800',
      'executado_aguardando_validacao': 'bg-purple-100 text-purple-800',
      'concluido': 'bg-green-100 text-green-800',
      'enviado_para_area': 'bg-orange-100 text-orange-800',
      'aguardando_consultor': 'bg-cyan-100 text-cyan-800',
      'aguardando_aprovacao_gerencial': 'bg-indigo-100 text-indigo-800',
      'cancelado': 'bg-red-100 text-red-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const canUserAccessTicket = () => {
    if (!ticket || !user || !userProfile) return false;
    
    if (userProfile.funcao === 'administrador') return true;
    if (ticket.criadoPor === user.uid) return true;
    if (userProfile.funcao?.startsWith('operador_') && userProfile.area === ticket.area) return true;
    if (userProfile.funcao === 'consultor' && projects.some(p => p.consultorId === user.uid)) return true;
    if (userProfile.funcao === 'produtor' && projects.some(p => p.produtorId === user.uid)) return true;
    if (userProfile.funcao === 'gerencia' && ticket.status === 'aguardando_aprovacao_gerencial') return true;
    // Uma gerência genérica pode ver todos os chamados para ter visibilidade
    if (userProfile.funcao === 'gerencia') return true;
  
    return false;
  };

  const formatDate = (date) => {
    if (!date) return 'Data não disponível';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    if(isNaN(dateObj)) return 'Data inválida';
    return dateObj.toLocaleString('pt-BR');
  };

  const renderMentions = (text) => {
    if (!text) return text;
    
    return text.split(/(@[\w\s-]+)/g).map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.substring(1).trim();
        const mentionedUser = users.find(u => u.displayName === username);
        return (
          <span key={index} className="bg-blue-100 text-blue-800 px-1 rounded font-semibold">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin rounded-full h-12 w-12 text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Carregando dados do chamado...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar dados do chamado</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/dashboard')} className="bg-gray-600 hover:bg-gray-700">
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
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Chamado não encontrado</h2>
          <p className="text-gray-600 mb-4">O chamado solicitado não existe ou foi removido.</p>
          <Button onClick={() => navigate('/dashboard')} className="bg-gray-600 hover:bg-gray-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!canUserAccessTicket()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso negado</h2>
          <p className="text-gray-600 mb-4">Você não tem permissão para acessar este chamado.</p>
          <Button onClick={() => navigate('/dashboard')} className="bg-gray-600 hover:bg-gray-700">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            onClick={() => navigate('/dashboard')} 
            variant="outline" 
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Chamado #{ticket.id?.substring(0, 8) || 'N/A'}
              </h1>
              <p className="text-gray-600 mt-1">
                Criado em {formatDate(ticket.criadoEm)} por {ticket.criadoPorNome}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge className={getStatusColor(ticket.status)}>
                {getStatusLabel(ticket.status)}
              </Badge>
              {userProfile.funcao === 'administrador' && (
                <Button
                  onClick={handleArchiveTicket}
                  variant="outline"
                  size="sm"
                >
                  {ticket.archived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      Desarquivar
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      Arquivar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detalhes do Chamado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Tag className="h-5 w-5 mr-2" />
                  Detalhes do Chamado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{ticket.titulo}</h3>
                  <p className="text-gray-600 mt-2 whitespace-pre-wrap">{ticket.descricao}</p>
                </div>

                {ticket.itemExtra && (
                  <div className="flex items-center space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-orange-600 text-lg">🔥</div>
                    <div>
                      <p className="font-semibold text-orange-800">ITEM EXTRA</p>
                      <p className="text-sm text-orange-700">{ticket.motivoItemExtra}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Área</p>
                    <p className="text-gray-900">{ticket.area}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tipo</p>
                    <p className="text-gray-900">{ticket.tipo}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Criado em</p>
                    <p className="text-gray-900">{formatDate(ticket.criadoEm)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Criado por</p>
                    <p className="text-gray-900">{ticket.criadoPorNome}</p>
                  </div>
                </div>

                {ticket.linkedTicketId && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Link className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Chamado Vinculado</span>
                    </div>
                    <p className="text-sm text-blue-700 mt-1">
                      Este chamado está vinculado ao chamado #{ticket.linkedTicketId?.substring(0, 8)}
                    </p>
                    <Button
                      onClick={() => navigate(`/chamado/${ticket.linkedTicketId}`)}
                      variant="outline"
                      size="sm"
                      className="mt-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Ver Chamado Original
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Projetos */}
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
                    {projects.map((project, index) => (
                      <div key={project.id || index} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-lg">{project.nome}</h4>
                          <Button
                            onClick={() => navigate(`/projeto/${project.id}`)}
                            variant="outline"
                            size="sm"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Ver Projeto
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium text-gray-500">Evento</p>
                            <p className="text-gray-900">{project.evento}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-500">Local</p>
                            <p className="text-gray-900">{project.local}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-500">Consultor</p>
                            <p className="text-gray-900">{project.consultorNome}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-500">Produtor</p>
                            <p className="text-gray-900">{project.produtorNome}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pessoas Envolvidas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Pessoas Envolvidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Criador */}
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <User className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-blue-800">{ticket.criadoPorNome}</p>
                      <p className="text-sm text-blue-600">Criador - {ticket.criadoPorFuncao}</p>
                    </div>
                    <Badge className="ml-auto bg-blue-100 text-blue-800">Criador</Badge>
                  </div>

                  {/* Consultor responsável */}
                  {projects.length > 0 && projects[0].consultorNome && (
                    <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <User className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-800">{projects[0].consultorNome}</p>
                        <p className="text-sm text-green-600">Consultor - {projects[0].consultorArea}</p>
                      </div>
                      <Badge className="ml-auto bg-green-100 text-green-800">Consultor</Badge>
                    </div>
                  )}

                  {/* Produtor responsável */}
                  {projects.length > 0 && projects[0].produtorNome && (
                    <div className="flex items-center space-x-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <User className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="font-semibold text-purple-800">{projects[0].produtorNome}</p>
                        <p className="text-sm text-purple-600">Produtor - {projects[0].produtorArea}</p>
                      </div>
                      <Badge className="ml-auto bg-purple-100 text-purple-800">Produtor</Badge>
                    </div>
                  )}

                  {/* Gerente responsável */}
                  {ticket.escalatedToManagement && (
                    <div className="flex items-center space-x-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <User className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="font-semibold text-orange-800">{ticket.escalatedToManagement}</p>
                        <p className="text-sm text-orange-600">Gerente Responsável</p>
                      </div>
                      <Badge className="ml-auto bg-orange-100 text-orange-800">Gerente</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Histórico Detalhado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="h-5 w-5 mr-2" />
                  Histórico Detalhado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Abertura do chamado */}
                  <div className="flex items-start space-x-3">
                    <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mt-1.5"></div>
                        <div className="w-px h-full bg-gray-300"></div>
                    </div>
                    <div>
                      <p className="font-semibold text-blue-800">Chamado Aberto</p>
                      <p className="text-sm text-gray-600">por {ticket.criadoPorNome}</p>
                      <p className="text-xs text-gray-500">{formatDate(ticket.criadoEm)}</p>
                    </div>
                  </div>

                  {/* Escalações e movimentações */}
                  {ticket.escalatedAt && (
                    <div className="flex items-start space-x-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mt-1.5"></div>
                        <div className="w-px h-full bg-gray-300"></div>
                      </div>
                      <div>
                        <p className="font-semibold text-yellow-800">Escalado para Área</p>
                        <p className="text-sm text-gray-600">para {ticket.area}</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.escalatedAt)}</p>
                        {ticket.escalationReason && (
                          <p className="text-sm text-gray-700 mt-1 p-2 bg-gray-50 rounded">Motivo: {ticket.escalationReason}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {ticket.escalatedToConsultorAt && (
                    <div className="flex items-start space-x-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5"></div>
                        <div className="w-px h-full bg-gray-300"></div>
                      </div>
                      <div>
                        <p className="font-semibold text-green-800">Escalado para Consultor</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.escalatedToConsultorAt)}</p>
                        {ticket.escalationConsultorReason && (
                           <p className="text-sm text-gray-700 mt-1 p-2 bg-gray-50 rounded">Motivo: {ticket.escalationConsultorReason}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {ticket.escalatedToManagementAt && (
                    <div className="flex items-start space-x-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-orange-500 rounded-full mt-1.5"></div>
                        <div className="w-px h-full bg-gray-300"></div>
                      </div>
                      <div>
                        <p className="font-semibold text-orange-800">Escalado para Gerência</p>
                        <p className="text-sm text-gray-600">para {ticket.escalatedToManagement}</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.escalatedToManagementAt)}</p>
                        {ticket.escalationManagementReason && (
                          <p className="text-sm text-gray-700 mt-1 p-2 bg-gray-50 rounded">Motivo: {ticket.escalationManagementReason}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {ticket.transferredToProducerAt && (
                    <div className="flex items-start space-x-3">
                       <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-purple-500 rounded-full mt-1.5"></div>
                        <div className="w-px h-full bg-gray-300"></div>
                      </div>
                      <div>
                        <p className="font-semibold text-purple-800">Transferido para Produtor</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.transferredToProducerAt)}</p>
                      </div>
                    </div>
                  )}

                  {ticket.rejectedAt && (
                    <div className="flex items-start space-x-3">
                       <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full mt-1.5"></div>
                        <div className="w-px h-full bg-gray-300"></div>
                      </div>
                      <div>
                        <p className="font-semibold text-red-800">Chamado Rejeitado/Devolvido</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.rejectedAt)}</p>
                        {ticket.rejectReason && (
                          <p className="text-sm text-gray-700 mt-1 p-2 bg-gray-50 rounded">Motivo: {ticket.rejectReason}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {ticket.completedAt && (
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-green-600 rounded-full mt-1.5"></div>
                      <div>
                        <p className="font-semibold text-green-800">Chamado Concluído</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.completedAt)}</p>
                        {ticket.conclusionMessage && (
                          <p className="text-sm text-gray-700 mt-1 p-2 bg-gray-50 rounded">Observações: {ticket.conclusionMessage}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Conversas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Conversas ({messages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nenhuma mensagem ainda</p>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} className="flex space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold text-sm">{message.senderName}</p>
                            <p className="text-xs text-gray-500">{formatDate(message.timestamp)}</p>
                          </div>
                          <div className="mt-1 text-gray-800">
                            {renderMentions(message.content)}
                          </div>
                          {message.images && message.images.length > 0 && (
                            <div className="mt-2 flex space-x-2 flex-wrap">
                              {message.images.map((image, imgIndex) => (
                                <a key={imgIndex} href={image} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={image}
                                  alt={`Anexo ${imgIndex + 1}`}
                                  className="w-20 h-20 object-cover rounded cursor-pointer border hover:opacity-80"
                                />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Nova mensagem */}
                <div className="mt-4 border-t pt-4">
                  <div className="relative">
                    <Textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={handleMentionInput}
                      placeholder="Digite sua mensagem... (use @ para mencionar usuários)"
                      className="min-h-[80px] pr-20"
                      disabled={sending}
                    />
                    
                    {showMentions && mentionSuggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 w-full bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                        {mentionSuggestions.map((user, index) => (
                          <div
                            key={index}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => insertMention(user)}
                          >
                            <p className="font-medium">{user.displayName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedImages.length > 0 && (
                    <div className="mt-2 flex space-x-2 flex-wrap gap-2">
                      {selectedImages.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Preview ${index + 1}`}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex space-x-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e)}
                        className="hidden"
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        size="sm"
                        disabled={sending}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={sending || (!newMessage.trim() && selectedImages.length === 0)}
                      size="sm"
                    >
                      {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      {sending ? 'Enviando...' : 'Enviar'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar de Ações */}
          <div className="space-y-6">
            {availableStatuses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Ações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alterar Status
                    </label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma ação" />
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

                  {newStatus === 'concluido' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Observações da Conclusão
                      </label>
                      <Textarea
                        value={conclusionMessage}
                        onChange={(e) => setConclusionMessage(e.target.value)}
                        placeholder="Descreva como o chamado foi resolvido..."
                        className="min-h-[80px]"
                      />
                      
                      <div className="mt-2">
                        <input
                          ref={conclusionFileInputRef}
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, true)}
                          className="hidden"
                        />
                        <Button
                          onClick={() => conclusionFileInputRef.current?.click()}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Anexar Imagens da Conclusão
                        </Button>
                      </div>

                      {conclusionImages.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {conclusionImages.map((image, index) => (
                            <div key={index} className="relative">
                              <img
                                src={URL.createObjectURL(image)}
                                alt={`Conclusão ${index + 1}`}
                                className="w-full h-20 object-cover rounded"
                              />
                              <button
                                onClick={() => removeImage(index, true)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={handleStatusUpdate}
                    disabled={!newStatus}
                    className="w-full"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar Ação
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Escalações</CardTitle>
                <p className="text-sm text-gray-600">Mova o chamado para outras áreas ou gerências.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Escalar para Outra Área</h4>
                  <Select value={escalationArea} onValueChange={setEscalationArea}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma área" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((area) => (
                        <SelectItem key={area.id} value={area.nome}>
                          {area.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    placeholder="Motivo da escalação..."
                    className="mt-2"
                  />
                  <Button
                    onClick={handleEscalateToArea}
                    disabled={!escalationArea || !escalationReason.trim()}
                    className="w-full mt-2"
                    variant="outline"
                  >
                    Escalar para Área
                  </Button>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Escalar para Gerência</h4>
                  <Select value={escalationManagement} onValueChange={setEscalationManagement}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a gerência" />
                    </SelectTrigger>
                    <SelectContent>
                      {managements.map((management) => (
                        <SelectItem key={management.id} value={management.nome}>
                          {management.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={escalationManagementReason}
                    onChange={(e) => setEscalationManagementReason(e.target.value)}
                    placeholder="Motivo da escalação para a gerência..."
                    className="mt-2"
                  />
                  <Button
                    onClick={handleEscalateToManagement}
                    disabled={!escalationManagement || !escalationManagementReason.trim()}
                    className="w-full mt-2"
                    variant="outline"
                  >
                    Enviar para Gerência
                  </Button>
                </div>
                
                 {projects.length > 0 && projects[0].consultorNome && (
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-medium mb-2">Escalar para Consultor</h4>
                     <p className="text-sm text-gray-600 mb-3">
                      Escale para o consultor: <strong>{projects[0].consultorNome}</strong>
                    </p>
                    <Textarea
                      value={escalationConsultorReason}
                      onChange={(e) => setEscalationConsultorReason(e.target.value)}
                      placeholder="Motivo da escalação para o consultor..."
                      className="mb-3"
                    />
                    <Button
                      onClick={handleEscalateToConsultor}
                      disabled={!escalationConsultorReason.trim()}
                      className="w-full"
                      variant="outline"
                    >
                      Enviar para Consultor
                    </Button>
                  </div>
                )}

                {projects.length > 0 && projects[0].produtorNome && (
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-medium mb-2">Transferir para Produtor</h4>
                    <p className="text-sm text-gray-600 mb-3">
                       Transfira a responsabilidade para o produtor: <strong>{projects[0].produtorNome}</strong>
                    </p>
                    <Button
                      onClick={handleTransferToProducer}
                      className="w-full"
                    >
                      Enviar para Produtor
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Link className="h-5 w-5 mr-2" />
                  Vincular Chamado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Crie um novo chamado para outra área que ficará vinculado a este.
                </p>
                <Button
                  onClick={handleCreateLinkedTicket}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Chamado Vinculado
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Rejeitar / Devolver Chamado</h3>
              <p className="text-sm text-gray-600 mb-4">
                Informe o motivo da rejeição ou devolução do chamado. Ele será enviado de volta para a área ou pessoa que o enviou para você.
              </p>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Descreva o motivo da rejeição/devolução..."
                className="mb-4"
              />
              <div className="flex space-x-3">
                <Button
                  onClick={() => {
                    setShowRejectModal(false);
                    setNewStatus(''); // Reseta o select de ações
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleRejectTicket}
                  disabled={!rejectReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Confirmar Rejeição
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDetailPage;
