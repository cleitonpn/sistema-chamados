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
  Lock,
  UserCheck,
  Link // ✅ NOVO: Ícone para vinculação
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

  // ✅ NOVO: Estados para popup de vinculação
  const [showLinkTicketModal, setShowLinkTicketModal] = useState(false);
  const [isLinkingTicket, setIsLinkingTicket] = useState(false);

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

  // ✅ NOVO: Função para lidar com vinculação de chamados
  const handleLinkTicketConfirm = async (shouldLink) => {
    setShowLinkTicketModal(false);
    
    if (shouldLink) {
      setIsLinkingTicket(true);
      try {
        // 1. Executar o chamado atual
        await executeCurrentTicket();
        
        // 2. Redirecionar para NewTicketForm com dados do chamado vinculado
        const linkedTicketData = {
          id: ticketId,
          numero: ticket.numero || ticketId.substring(0, 8),
          titulo: ticket.titulo,
          criadorNome: ticket.criadoPorNome || 'Usuário',
          area: ticket.area,
          projetoNome: project?.nome || 'Projeto não identificado',
          projetoId: ticket.projetoId,
          descricao: ticket.descricao
        };
        
        // Navegar para NewTicketForm com parâmetros
        navigate(`/novo-chamado?linked=${encodeURIComponent(JSON.stringify(linkedTicketData))}`);
        
      } catch (error) {
        console.error('Erro ao vincular chamado:', error);
        alert('Erro ao vincular chamado: ' + error.message);
      } finally {
        setIsLinkingTicket(false);
      }
    } else {
      // Apenas executar o chamado normalmente
      await executeCurrentTicket();
    }
  };

  // ✅ NOVO: Função para executar o chamado atual
  const executeCurrentTicket = async () => {
    setUpdating(true);
    try {
      const updateData = {
        status: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION,
        atualizadoPor: user.uid,
        updatedAt: new Date(),
        executadoEm: new Date(),
        executadoPor: user.uid
      };

      await ticketService.updateTicket(ticketId, updateData);

      const statusMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `✅ **Chamado executado**\n\nO chamado foi marcado como executado e está aguardando validação do criador.`,
        criadoEm: new Date(),
        type: 'status_update'
      };
      await messageService.sendMessage(ticketId, statusMessage);

      // Notificação
      try {
        await notificationService.notifyStatusChange(
          ticketId,
          ticket,
          TICKET_STATUS.EXECUTED_AWAITING_VALIDATION,
          ticket.status,
          user.uid
        );
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificação:', notificationError);
      }

      await loadTicketData();
      alert('Chamado executado com sucesso!');
    } catch (error) {
      console.error('Erro ao executar chamado:', error);
      alert('Erro ao executar chamado: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  // Função modificada para interceptar execução da logística
  const handleStatusUpdate = async () => {
    if (!newStatus) return;

    // ✅ NOVO: Interceptar execução da logística para mostrar popup
    if (userProfile.area === 'logistica' && 
        newStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
      setShowLinkTicketModal(true);
      return; // Não executar ainda, aguardar resposta do popup
    }

    if ((newStatus === TICKET_STATUS.REJECTED || (newStatus === TICKET_STATUS.SENT_TO_AREA && ticket.status === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION)) && !conclusionDescription.trim()) {
      alert('Por favor, forneça um motivo para a rejeição');
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
      } else if (newStatus === TICKET_STATUS.REJECTED) {
        updateData.motivoRejeicao = conclusionDescription;
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
      } else if (newStatus === TICKET_STATUS.SENT_TO_AREA && ticket.status === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
        updateData.motivoRejeicao = conclusionDescription;
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        updateData.area = ticket.areaDeOrigem || ticket.area;
      }

      if (newStatus === TICKET_STATUS.APPROVED || newStatus === TICKET_STATUS.REJECTED) {
        if (ticket.status === 'aguardando_aprovacao' && userProfile.funcao === 'gerente') {
          const targetArea = ticket.areaDeOrigem || ticket.area;

          if (newStatus === TICKET_STATUS.APPROVED) {
            updateData.status = 'em_tratativa';
            updateData.area = targetArea;
            updateData.aprovadoEm = new Date();
            updateData.aprovadoPor = user.uid;
          } else {
            updateData.rejeitadoEm = new Date();
            updateData.rejeitadoPor = user.uid;
            updateData.motivoRejeicao = conclusionDescription;
          }
        }
      }

      await ticketService.updateTicket(ticketId, updateData);

      const managerName = userProfile?.nome || user?.email || 'Gerente';
      const statusMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: newStatus === TICKET_STATUS.APPROVED
          ? `✅ **Chamado aprovado pelo gerente ${managerName}**\n\nO chamado foi aprovado e retornará para a área responsável para execução.`
          : newStatus === TICKET_STATUS.REJECTED
            ? `❌ **Chamado reprovado pelo gerente ${managerName}**\n\n**Motivo:** ${conclusionDescription}\n\nO chamado foi encerrado devido à reprovação gerencial.`
            : newStatus === TICKET_STATUS.COMPLETED
              ? `✅ **Chamado concluído**\n\n**Descrição:** ${conclusionDescription}`
              : `🔄 **Status atualizado para:** ${getStatusText(newStatus)}`,
        criadoEm: new Date(),
        type: 'status_update'
      };
      await messageService.sendMessage(ticketId, statusMessage);

      try {
        await notificationService.notifyStatusChange(
          ticketId,
          ticket,
          newStatus,
          ticket.status,
          user.uid
        );
        console.log('✅ Notificação de mudança de status enviada');
      } catch (notificationError) {
        console.error('❌ Erro ao enviar notificação de mudança de status:', notificationError);
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

  // [RESTO DO CÓDIGO PERMANECE IGUAL - incluindo todas as outras funções]
  
  const loadTicketData = async () => {
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);

      console.log('Carregando dados do chamado:', ticketId);

      const ticketData = await ticketService.getTicketById(ticketId);
      if (!ticketData) {
        setError('Chamado não encontrado');
        return;
      }

      console.log('Dados do chamado carregados:', ticketData);
      setTicket(ticketData);

      if (ticketData.projetoId) {
        const projectData = await projectService.getProjectById(ticketData.projetoId);
        console.log('Dados do projeto carregados:', projectData);
        setProject(projectData);
      }

      const messagesData = await messageService.getMessagesByTicket(ticketId);
      console.log('Mensagens carregadas:', messagesData);
      setMessages(messagesData);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      if (error.message.includes('Permission denied') || error.message.includes('Acesso negado')) {
        setAccessDenied(true);
      } else {
        setError('Erro ao carregar dados: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId && user && userProfile) {
      loadTicketData();
    }
  }, [ticketId, user, userProfile]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await userService.getAllUsers();
        setUsers(usersData);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };
    loadUsers();
  }, []);

  // [TODAS AS OUTRAS FUNÇÕES PERMANECEM IGUAIS]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Carregando chamado...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {accessDenied ? 'Acesso Negado' : 'Erro ao Carregar'}
            </h2>
            <p className="text-gray-600 mb-4">
              {accessDenied 
                ? 'Você não tem permissão para acessar este chamado.' 
                : error
              }
            </p>
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
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
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Chamado não encontrado</h2>
            <p className="text-gray-600 mb-4">O chamado solicitado não existe ou foi removido.</p>
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* ✅ NOVO: Modal de Vinculação de Chamados */}
      {showLinkTicketModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <Link className="h-6 w-6 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold">Vincular Chamado</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Deseja vincular este chamado a um novo chamado de <strong>Pagamento de Frete</strong> para o financeiro?
            </p>
            
            <div className="flex space-x-3">
              <Button
                onClick={() => handleLinkTicketConfirm(true)}
                disabled={isLinkingTicket}
                className="flex-1"
              >
                {isLinkingTicket ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Vinculando...
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-2" />
                    Sim, Vincular
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => handleLinkTicketConfirm(false)}
                variant="outline"
                disabled={isLinkingTicket}
                className="flex-1"
              >
                Não, Apenas Executar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RESTO DO COMPONENTE PERMANECE IGUAL */}
      <main className="px-4 py-6 md:px-6 lg:px-8">
        {/* Conteúdo da página permanece igual */}
      </main>
    </div>
  );
};

export default TicketDetailPage;

