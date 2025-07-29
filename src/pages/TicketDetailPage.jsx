// TicketDetailPage com ID CORRIGIDO
// Correção: Verificação robusta do parâmetro ID da URL

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ArrowLeft, MessageCircle, Clock, User, Building, FileText, AlertCircle, Send, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

// Constantes de Status
const TICKET_STATUS = {
  OPEN: 'aberto',
  IN_TREATMENT: 'em_tratativa',
  EXECUTED_AWAITING_VALIDATION: 'executado_aguardando_validacao',
  COMPLETED: 'concluido',
  SENT_TO_AREA: 'escalado_area',
  SENT_TO_MANAGEMENT: 'escalado_gerencia',
  AWAITING_APPROVAL: 'aguardando_aprovacao',
  APPROVED: 'aprovado',
  REJECTED: 'reprovado'
};

const TICKET_STATUS_LABELS = {
  'aberto': 'Aberto',
  'em_tratativa': 'Em Tratativa',
  'executado_aguardando_validacao': 'Executado - Aguardando Validação',
  'concluido': 'Concluído',
  'escalado_area': 'Escalado para Área',
  'escalado_gerencia': 'Escalado para Gerência',
  'aguardando_aprovacao': 'Aguardando Aprovação',
  'aprovado': 'Aprovado',
  'reprovado': 'Reprovado'
};

const TicketDetailPage = () => {
  // ✅ CAPTURA ROBUSTA DO ID DA URL
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Debug do ID capturado
  const ticketId = params.id || params.ticketId || null;
  
  console.log('🔍 Debug ID da URL:', {
    params,
    ticketId,
    paramsId: params.id,
    paramsTicketId: params.ticketId,
    url: window.location.href,
    pathname: window.location.pathname
  });

  const [ticket, setTicket] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);

  // ✅ VERIFICAÇÃO INICIAL DO ID
  useEffect(() => {
    console.log('🔍 Verificação inicial do ID:', {
      ticketId,
      hasId: !!ticketId,
      idLength: ticketId?.length,
      user: user?.uid,
      userEmail: user?.email
    });

    if (!ticketId) {
      console.error('❌ ID do chamado não fornecido na URL');
      setError('ID do chamado não encontrado na URL');
      setLoading(false);
      return;
    }

    if (!user) {
      console.error('❌ Usuário não autenticado');
      setError('Usuário não autenticado');
      setLoading(false);
      return;
    }

    // Iniciar carregamento dos dados
    loadData();
  }, [ticketId, user]);

  // ✅ FUNÇÃO DE CARREGAMENTO SEQUENCIAL
  const loadData = async () => {
    try {
      console.log('🔄 Iniciando carregamento de dados...');
      setLoading(true);
      setError(null);

      // 1. Carregar perfil do usuário
      await fetchUserProfile();
      
      // 2. Carregar dados do chamado
      await fetchTicket();
      
      // 3. Carregar usuários e gerentes
      await fetchUsers();
      
      console.log('✅ Carregamento de dados concluído');
    } catch (error) {
      console.error('❌ Erro no carregamento de dados:', error);
      setError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FUNÇÃO CORRIGIDA - Buscar perfil do usuário
  const fetchUserProfile = async () => {
    if (!user?.uid) {
      throw new Error('Usuário não autenticado');
    }

    try {
      console.log('👤 Buscando perfil do usuário:', user.uid);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const profile = userDoc.data();
        setUserProfile(profile);
        console.log('✅ Perfil do usuário carregado:', profile);
        return profile;
      } else {
        throw new Error('Perfil do usuário não encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar perfil do usuário:', error);
      throw error;
    }
  };

  // ✅ FUNÇÃO CORRIGIDA - Buscar dados do chamado
  const fetchTicket = async () => {
    if (!ticketId) {
      throw new Error('ID do chamado não fornecido');
    }

    try {
      console.log('🎫 Buscando dados do chamado:', ticketId);
      const ticketDoc = await getDoc(doc(db, 'chamados', ticketId));
      
      if (ticketDoc.exists()) {
        const ticketData = { id: ticketDoc.id, ...ticketDoc.data() };
        setTicket(ticketData);
        console.log('✅ Dados do chamado carregados:', ticketData);
        
        // Carregar mensagens do chamado
        await fetchMessages();
        
        return ticketData;
      } else {
        throw new Error('Chamado não encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar dados do chamado:', error);
      throw error;
    }
  };

  // ✅ FUNÇÃO CORRIGIDA - Buscar mensagens
  const fetchMessages = async () => {
    if (!ticketId) {
      console.warn('⚠️ ID do chamado não fornecido para buscar mensagens');
      return;
    }

    try {
      console.log('💬 Buscando mensagens do chamado:', ticketId);
      
      // Buscar todas as mensagens e filtrar manualmente
      const messagesSnapshot = await getDocs(collection(db, 'messages'));
      const allMessages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filtrar mensagens do chamado específico
      const ticketMessages = allMessages
        .filter(msg => msg.chamadoId === ticketId)
        .sort((a, b) => {
          const dateA = a.criadoEm?.toDate?.() || new Date(a.criadoEm);
          const dateB = b.criadoEm?.toDate?.() || new Date(b.criadoEm);
          return dateA - dateB;
        });

      setMessages(ticketMessages);
      console.log('✅ Mensagens carregadas:', ticketMessages.length);
    } catch (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      // Não quebrar o fluxo se as mensagens falharem
    }
  };

  // ✅ FUNÇÃO CORRIGIDA - Buscar usuários
  const fetchUsers = async () => {
    try {
      console.log('👥 Buscando usuários...');
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const allUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setUsers(allUsers);
      
      // Filtrar gerentes
      const managersList = allUsers.filter(user => user.funcao === 'gerente');
      setManagers(managersList);
      
      console.log('✅ Usuários carregados:', allUsers.length);
      console.log('✅ Gerentes carregados:', managersList.length);
    } catch (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      // Não quebrar o fluxo se os usuários falharem
    }
  };

  // ✅ FUNÇÃO - Verifica se produtor pode concluir chamado
  const canProducerComplete = (ticket, user, userProfile) => {
    if (!ticket || !user || !userProfile || userProfile?.funcao !== 'produtor') return false;
    
    try {
      // SITUAÇÃO 1: Chamado criado pelo próprio produtor (após áreas executarem)
      if (ticket.criadoPor === user.uid) {
        return ticket.status === 'executado_aguardando_validacao';
      }
      
      // SITUAÇÃO 2: Chamado criado por consultor (produtor pode concluir)
      if (ticket.consultorId === user.uid || ticket.produtorId === user.uid) {
        return ['aberto', 'em_tratativa', 'executado_aguardando_validacao'].includes(ticket.status);
      }
      
      // SITUAÇÃO 3: Produtor responsável pelo chamado
      if (ticket.produtorResponsavel === user.uid) {
        return ['executado_aguardando_validacao', 'em_tratativa'].includes(ticket.status);
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao verificar permissões do produtor:', error);
      return false;
    }
  };

  // ✅ FUNÇÃO - Verifica se operador pode concluir
  const canOperatorComplete = (ticket, user, userProfile) => {
    if (!ticket || !user || !userProfile || userProfile?.funcao !== 'operador') return false;
    
    try {
      // AJUSTE 4: Operador que abriu chamado pode concluir quando executado por outra área
      if (ticket.criadoPor === user.uid && ticket.status === 'executado_aguardando_validacao') {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao verificar permissões do operador:', error);
      return false;
    }
  };

  // ✅ FUNÇÃO - Verifica acesso ao chamado
  const canUserAccessTicket = (ticket, user, userProfile) => {
    if (!ticket || !user || !userProfile) return false;
    
    try {
      // Administrador pode acessar tudo
      if (userProfile.funcao === 'administrador') return true;
      
      // Criador do chamado
      if (ticket.criadoPor === user.uid) return true;
      
      // Consultor/Produtor envolvido
      if (ticket.consultorId === user.uid || ticket.produtorId === user.uid) return true;
      
      // Operador da área do chamado
      if (userProfile.funcao === 'operador' && userProfile.area === ticket.area) return true;
      
      // Gerente responsável
      if (ticket.gerenteResponsavelId === user.uid) return true;
      
      // Gerente da área
      if (userProfile.funcao === 'gerente' && userProfile.area === ticket.area) return true;
      
      return false;
    } catch (error) {
      console.error('Erro ao verificar acesso ao chamado:', error);
      return false;
    }
  };

  // ✅ FUNÇÃO - Status disponíveis
  const getAvailableStatuses = () => {
    if (!ticket || !user || !userProfile) return [];

    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;
    
    console.log('🔍 Verificando status disponíveis:', {
      currentStatus,
      userRole,
      userId: user.uid,
      ticketCreator: ticket.criadoPor
    });

    // ADMINISTRADOR - Pode tudo
    if (userRole === 'administrador') {
      return [
        { value: TICKET_STATUS.IN_TREATMENT, label: 'Em Tratativa', description: 'Iniciar tratamento' },
        { value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, label: 'Executado', description: 'Marcar como executado' },
        { value: TICKET_STATUS.COMPLETED, label: 'Concluir', description: 'Finalizar chamado' },
        { value: TICKET_STATUS.SENT_TO_AREA, label: 'Enviar para Área', description: 'Escalar para área' },
        { value: TICKET_STATUS.SENT_TO_MANAGEMENT, label: 'Enviar para Gerência', description: 'Escalar para gerência' }
      ];
    }

    // PRODUTOR - Lógica corrigida
    if (userRole === 'produtor') {
      const statuses = [];
      
      // AJUSTE 5: Quando consultor abre chamado, produtor tem 3 opções
      if (currentStatus === TICKET_STATUS.OPEN && 
          (ticket.consultorId === user.uid || ticket.produtorId === user.uid)) {
        statuses.push(
          { 
            value: TICKET_STATUS.IN_TREATMENT, 
            label: 'Dar Tratativa', 
            description: 'Iniciar tratamento do chamado' 
          },
          { 
            value: TICKET_STATUS.COMPLETED, 
            label: 'Concluir', 
            description: 'Finalizar chamado diretamente' 
          },
          { 
            value: TICKET_STATUS.SENT_TO_AREA, 
            label: 'Enviar para Área', 
            description: 'Escalar para área específica' 
          }
        );
      }
      
      // Pode concluir se atende às regras de negócio
      if (canProducerComplete(ticket, user, userProfile)) {
        statuses.push({ 
          value: TICKET_STATUS.COMPLETED, 
          label: 'Concluir', 
          description: 'Finalizar chamado após validação' 
        });
      }
      
      // Pode devolver para área se necessário
      if (currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION && 
          (ticket.criadoPor === user.uid || ticket.consultorId === user.uid || ticket.produtorId === user.uid)) {
        statuses.push({ 
          value: TICKET_STATUS.SENT_TO_AREA, 
          label: 'Devolver', 
          description: 'Devolver para área com motivo' 
        });
      }
      
      return statuses;
    }

    // OPERADOR - Lógica corrigida
    if (userRole === 'operador') {
      const statuses = [];
      
      // Pode executar se da área responsável
      if (userProfile.area === ticket.area && 
          [TICKET_STATUS.OPEN, TICKET_STATUS.IN_TREATMENT, TICKET_STATUS.SENT_TO_AREA].includes(currentStatus)) {
        statuses.push({ 
          value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, 
          label: 'Executar', 
          description: 'Marcar como executado' 
        });
      }
      
      // AJUSTE 4: Pode concluir se criou o chamado e foi executado
      if (canOperatorComplete(ticket, user, userProfile)) {
        statuses.push({ 
          value: TICKET_STATUS.COMPLETED, 
          label: 'Concluir', 
          description: 'Finalizar chamado' 
        });
      }
      
      // AJUSTE 6: Pode enviar para produtor
      if (ticket.criadoPor === user.uid && 
          [TICKET_STATUS.OPEN, TICKET_STATUS.IN_TREATMENT].includes(currentStatus)) {
        statuses.push({ 
          value: 'enviar_para_produtor', 
          label: 'Enviar para Produtor', 
          description: 'Escalar para produtor' 
        });
      }
      
      return statuses;
    }

    // CONSULTOR
    if (userRole === 'consultor') {
      const statuses = [];
      
      // Pode concluir apenas chamados que criou
      if (ticket.criadoPor === user.uid && 
          [TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, TICKET_STATUS.IN_TREATMENT].includes(currentStatus)) {
        statuses.push({ 
          value: TICKET_STATUS.COMPLETED, 
          label: 'Concluir', 
          description: 'Finalizar chamado' 
        });
      }
      
      return statuses;
    }

    // GERENTE
    if (userRole === 'gerente') {
      const statuses = [];
      
      // Pode aprovar/reprovar se é o gerente responsável
      if (currentStatus === TICKET_STATUS.AWAITING_APPROVAL && 
          (ticket.gerenteResponsavelId === user.uid || userProfile.area === ticket.area)) {
        statuses.push(
          { value: TICKET_STATUS.APPROVED, label: 'Aprovar', description: 'Aprovar solicitação' },
          { value: TICKET_STATUS.REJECTED, label: 'Reprovar', description: 'Reprovar solicitação' }
        );
      }
      
      return statuses;
    }

    return [];
  };

  // ✅ FUNÇÃO - Atualizar status
  const handleStatusChange = async () => {
    if (!newStatus || !ticket) return;

    try {
      console.log('🔄 Atualizando status:', { from: ticket.status, to: newStatus });
      
      const updateData = {
        status: newStatus,
        atualizadoEm: new Date(),
        atualizadoPor: user.uid
      };

      // Adicionar campos específicos baseado no status
      if (newStatus === TICKET_STATUS.SENT_TO_AREA && selectedArea) {
        updateData.area = selectedArea;
        updateData.motivoEscalacao = escalationReason;
      }

      if (newStatus === TICKET_STATUS.SENT_TO_MANAGEMENT && selectedManager) {
        updateData.gerenteResponsavelId = selectedManager;
        updateData.motivoEscalacao = escalationReason;
        updateData.status = TICKET_STATUS.AWAITING_APPROVAL;
      }

      if (newStatus === 'enviar_para_produtor') {
        updateData.status = TICKET_STATUS.IN_TREATMENT;
        updateData.produtorResponsavel = ticket.produtorId || user.uid;
        updateData.motivoEscalacao = escalationReason;
      }

      await updateDoc(doc(db, 'chamados', ticketId), updateData);
      
      // Adicionar mensagem de sistema
      await addDoc(collection(db, 'messages'), {
        chamadoId: ticketId,
        remetenteId: user.uid,
        remetente: userProfile.nome || user.email,
        conteudo: `Status alterado para: ${TICKET_STATUS_LABELS[newStatus] || newStatus}${escalationReason ? ` - Motivo: ${escalationReason}` : ''}`,
        tipo: 'sistema',
        criadoEm: new Date()
      });

      toast.success('Status atualizado com sucesso!');
      
      // Recarregar dados
      await fetchTicket();
      
      // Limpar campos
      setNewStatus('');
      setEscalationReason('');
      setSelectedArea('');
      setSelectedManager('');
      
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  // ✅ FUNÇÃO - Enviar mensagem
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !ticket) return;

    try {
      await addDoc(collection(db, 'messages'), {
        chamadoId: ticketId,
        remetenteId: user.uid,
        remetente: userProfile.nome || user.email,
        conteudo: newMessage,
        tipo: 'usuario',
        criadoEm: new Date()
      });

      setNewMessage('');
      toast.success('Mensagem enviada!');
      
      // Recarregar mensagens
      await fetchMessages();
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    }
  };

  // ✅ VERIFICAÇÃO DE ACESSO
  if (!loading && ticket && userProfile && !canUserAccessTicket(ticket, user, userProfile)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Acesso Negado
              </h3>
              <p className="text-gray-600 mb-4">
                Você não tem permissão para acessar este chamado.
              </p>
              <Button onClick={() => navigate('/dashboard')} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ TELA DE LOADING COM DEBUG
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Carregando chamado...
              </h3>
              <div className="mt-2 text-sm text-gray-500 space-y-1">
                <p>ID do Chamado: {ticketId || 'Não fornecido'}</p>
                <p>Usuário: {user?.email || 'Não logado'}</p>
                <p>Perfil: {userProfile ? '✅ Carregado' : '⏳ Carregando...'}</p>
                <p>Dados: {ticket ? '✅ Carregado' : '⏳ Carregando...'}</p>
                <p>URL: {window.location.pathname}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ TELA DE ERRO
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Erro ao Carregar
              </h3>
              <p className="text-gray-600 mb-4">
                {error}
              </p>
              <div className="space-y-2">
                <Button onClick={loadData} className="w-full">
                  Tentar Novamente
                </Button>
                <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar ao Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ VERIFICAÇÃO FINAL
  if (!ticket) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Chamado Não Encontrado
              </h3>
              <p className="text-gray-600 mb-4">
                O chamado solicitado não foi encontrado ou foi removido.
              </p>
              <Button onClick={() => navigate('/dashboard')} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableStatuses = getAvailableStatuses();

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Chamado #{ticket.numero}
            </h1>
            <p className="text-gray-600">{ticket.titulo}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={ticket.prioridade === 'alta' ? 'destructive' : 
                         ticket.prioridade === 'media' ? 'default' : 'secondary'}>
            {ticket.prioridade?.toUpperCase()}
          </Badge>
          <Badge variant="outline">
            {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
          </Badge>
        </div>
      </div>

      {/* AJUSTE 1: Flag de Item Extra */}
      {ticket.itemExtra && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4">
            <div className="flex items-center space-x-2">
              <div className="text-orange-600">🔥</div>
              <div>
                <p className="font-semibold text-orange-800">ITEM EXTRA</p>
                <p className="text-sm text-orange-700">{ticket.motivoItemExtra}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Detalhes do Chamado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Detalhes do Chamado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Descrição</label>
                <p className="mt-1 text-gray-900">{ticket.descricao}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Área</label>
                  <p className="mt-1 text-gray-900">{ticket.area}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Projeto</label>
                  <p className="mt-1 text-gray-900">{ticket.projeto || 'Não especificado'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Data de Abertura</label>
                  <p className="mt-1 text-gray-900">
                    {ticket.criadoEm && format(ticket.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Última Atualização</label>
                  <p className="mt-1 text-gray-900">
                    {ticket.atualizadoEm && format(ticket.atualizadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AJUSTE 2: Pessoas Envolvidas */}
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

          {/* AJUSTE 3: Histórico Detalhado */}
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
                      {ticket.criadoEm && format(ticket.criadoEm.toDate(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
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
                          {msg.criadoEm && format(msg.criadoEm.toDate(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
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
                        Status: {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(ticket.atualizadoEm.toDate(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
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
                <MessageCircle className="mr-2 h-5 w-5" />
                Mensagens ({messages.filter(msg => msg.tipo === 'usuario').length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
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
                      <p className="text-sm">{message.conteudo}</p>
                      <p className={`text-xs mt-1 ${
                        message.remetenteId === user.uid ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {message.remetente} • {message.criadoEm && format(message.criadoEm.toDate(), 'dd/MM HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex space-x-2">
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                  rows={2}
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Lateral */}
        <div className="space-y-6">
          {/* Indicador para Produtores */}
          {userProfile?.funcao === 'produtor' && canProducerComplete(ticket, user, userProfile) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-800 text-sm font-medium">
                ✅ Você pode concluir este chamado
              </p>
            </div>
          )}

          {/* Indicador para Operadores */}
          {userProfile?.funcao === 'operador' && canOperatorComplete(ticket, user, userProfile) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-800 text-sm font-medium">
                ✅ Você pode concluir este chamado
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
                  <label className="text-sm font-medium text-gray-700">Novo Status</label>
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
                {(newStatus === TICKET_STATUS.SENT_TO_AREA || newStatus === 'enviar_para_produtor') && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Motivo da Escalação</label>
                    <Textarea
                      placeholder="Descreva o motivo da escalação..."
                      value={escalationReason}
                      onChange={(e) => setEscalationReason(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}

                {newStatus === TICKET_STATUS.SENT_TO_AREA && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Área de Destino</label>
                    <Select value={selectedArea} onValueChange={setSelectedArea}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma área" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="producao">Produção</SelectItem>
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="rh">Recursos Humanos</SelectItem>
                        <SelectItem value="ti">Tecnologia da Informação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newStatus === TICKET_STATUS.SENT_TO_MANAGEMENT && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Gerente Responsável</label>
                    <Select value={selectedManager} onValueChange={setSelectedManager}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um gerente" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.nome} - {manager.area}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button 
                  onClick={handleStatusChange} 
                  disabled={!newStatus || 
                    (newStatus === TICKET_STATUS.SENT_TO_AREA && !selectedArea) ||
                    (newStatus === TICKET_STATUS.SENT_TO_MANAGEMENT && !selectedManager)}
                  className="w-full"
                >
                  Atualizar Status
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;

