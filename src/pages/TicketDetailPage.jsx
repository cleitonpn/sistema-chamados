import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { ArrowLeft, Send, Paperclip, Clock, User, Users, AlertTriangle, CheckCircle, XCircle, MessageSquare, Building, UserCheck, Calendar, FileText, Flame } from 'lucide-react';
import { TICKET_CATEGORIES } from '../constants/ticketCategories';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Definir constantes de status localmente
const TICKET_STATUS = {
  OPEN: 'aberto',
  IN_TREATMENT: 'em_tratativa',
  EXECUTED_AWAITING_VALIDATION: 'executado_aguardando_validacao',
  COMPLETED: 'concluido',
  AWAITING_APPROVAL: 'aguardando_aprovacao',
  APPROVED: 'aprovado',
  REJECTED: 'reprovado',
  SENT_TO_AREA: 'enviado_para_area'
};

const TICKET_STATUS_LABELS = {
  'aberto': 'Aberto',
  'em_tratativa': 'Em Tratativa',
  'executado_aguardando_validacao': 'Executado',
  'concluido': 'Concluído',
  'aguardando_aprovacao': 'Aguardando Aprovação',
  'aprovado': 'Aprovado',
  'reprovado': 'Reprovado',
  'enviado_para_area': 'Enviado para Área'
};

const TICKET_STATUS_COLORS = {
  'aberto': 'bg-blue-100 text-blue-800',
  'em_tratativa': 'bg-yellow-100 text-yellow-800',
  'executado_aguardando_validacao': 'bg-purple-100 text-purple-800',
  'concluido': 'bg-green-100 text-green-800',
  'aguardando_aprovacao': 'bg-orange-100 text-orange-800',
  'aprovado': 'bg-green-100 text-green-800',
  'reprovado': 'bg-red-100 text-red-800',
  'enviado_para_area': 'bg-indigo-100 text-indigo-800'
};

const TicketDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [escalationType, setEscalationType] = useState('');
  const [statusHistory, setStatusHistory] = useState([]);
  const [error, setError] = useState(null);

  // Função para verificar se produtor pode concluir
  const canProducerComplete = (ticket, user, userProfile) => {
    if (!ticket || !user || !userProfile || userProfile?.funcao !== 'produtor') return false;
    
    // SITUAÇÃO 1: Chamado criado pelo próprio produtor (após áreas executarem)
    if (ticket.criadoPor === user.uid && ticket.status === 'executado_aguardando_validacao') {
      return true;
    }
    
    // SITUAÇÃO 2: Chamado criado por consultor (produtor pode concluir)
    if ((ticket.consultorId === user.uid || ticket.produtorId === user.uid) && 
        ['aberto', 'em_tratativa', 'executado_aguardando_validacao'].includes(ticket.status)) {
      return true;
    }
    
    // SITUAÇÃO 3: Produtor responsável pelo chamado
    if (ticket.produtorResponsavel === user.uid && 
        ['executado_aguardando_validacao', 'em_tratativa'].includes(ticket.status)) {
      return true;
    }
    
    return false;
  };

  // Função para verificar se operador pode concluir
  const canOperatorComplete = (ticket, user, userProfile) => {
    if (!ticket || !user || !userProfile || userProfile?.funcao !== 'operador') return false;
    
    // Operador que abriu o chamado pode concluir quando executado por outra área
    if (ticket.criadoPor === user.uid && ticket.status === 'executado_aguardando_validacao') {
      return true;
    }
    
    return false;
  };

  // Função para verificar se usuário pode acessar o chamado
  const canUserAccessTicket = (ticket, user, userProfile) => {
    if (!ticket || !user || !userProfile) return false;
    
    console.log('🔍 Verificando acesso:', {
      ticketId: ticket.id,
      userId: user.uid,
      userRole: userProfile.funcao,
      userArea: userProfile.area
    });

    // Administrador pode acessar tudo
    if (userProfile.funcao === 'administrador') {
      console.log('✅ Acesso permitido: Administrador');
      return true;
    }

    // Criador do chamado
    if (ticket.criadoPor === user.uid) {
      console.log('✅ Acesso permitido: Criador do chamado');
      return true;
    }

    // Consultor ou produtor responsável
    if (ticket.consultorId === user.uid || ticket.produtorId === user.uid) {
      console.log('✅ Acesso permitido: Consultor/Produtor responsável');
      return true;
    }

    // Operador da área do chamado
    if (userProfile.funcao === 'operador' && userProfile.area === ticket.area) {
      console.log('✅ Acesso permitido: Operador da área');
      return true;
    }

    // Gerente responsável
    if (userProfile.funcao === 'gerente' && 
        (ticket.gerenteResponsavelId === user.uid || userProfile.area === ticket.areaEscalada)) {
      console.log('✅ Acesso permitido: Gerente responsável');
      return true;
    }

    // Produtor da área
    if (userProfile.funcao === 'produtor') {
      console.log('✅ Acesso permitido: Produtor');
      return true;
    }

    console.log('❌ Acesso negado');
    return false;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🔍 Iniciando carregamento de dados...');
        console.log('👤 Usuário:', user?.email || 'Não autenticado');
        console.log('🎫 ID do chamado:', id);

        // Verificar se usuário está autenticado
        if (!user || !user.uid) {
          console.error('❌ Usuário não autenticado');
          setError('Usuário não autenticado. Faça login novamente.');
          setLoading(false);
          return;
        }

        // Verificar se ID do chamado foi fornecido
        if (!id) {
          console.error('❌ ID do chamado não fornecido');
          setError('ID do chamado não fornecido.');
          setLoading(false);
          return;
        }

        // Buscar perfil do usuário primeiro
        console.log('📋 Buscando perfil do usuário...');
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (!userDoc.exists()) {
          console.error('❌ Perfil do usuário não encontrado');
          setError('Perfil do usuário não encontrado.');
          setLoading(false);
          return;
        }

        const profile = userDoc.data();
        setUserProfile(profile);
        console.log('✅ Perfil carregado:', profile);

        // Buscar dados do chamado
        console.log('🎫 Buscando dados do chamado...');
        const ticketDoc = await getDoc(doc(db, 'chamados', id));
        if (!ticketDoc.exists()) {
          console.error('❌ Chamado não encontrado');
          setError('Chamado não encontrado.');
          setLoading(false);
          return;
        }

        const ticketData = { id: ticketDoc.id, ...ticketDoc.data() };
        console.log('✅ Chamado carregado:', ticketData);

        // Verificar se usuário pode acessar o chamado
        if (!canUserAccessTicket(ticketData, user, profile)) {
          console.error('❌ Usuário não tem permissão para acessar este chamado');
          setError('Você não tem permissão para visualizar este chamado.');
          setLoading(false);
          return;
        }

        setTicket(ticketData);

        // Buscar todos os usuários
        console.log('👥 Buscando usuários...');
        const usersSnapshot = await getDocs(collection(db, 'usuarios'));
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);
        
        const managersData = usersData.filter(user => user.funcao === 'gerente');
        setManagers(managersData);
        console.log('✅ Usuários carregados:', usersData.length);

        // Buscar mensagens - SEM usar where com valores undefined
        console.log('💬 Buscando mensagens...');
        try {
          const messagesSnapshot = await getDocs(collection(db, 'mensagens'));
          const allMessages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Filtrar mensagens manualmente para evitar erro de undefined
          const ticketMessages = allMessages.filter(msg => msg.chamadoId === id);
          // Ordenar manualmente
          ticketMessages.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0);
            const dateB = new Date(b.timestamp || 0);
            return dateA - dateB;
          });
          setMessages(ticketMessages);
          console.log('✅ Mensagens carregadas:', ticketMessages.length);
        } catch (msgError) {
          console.error('⚠️ Erro ao carregar mensagens:', msgError);
          setMessages([]); // Continuar sem mensagens
        }

        // Buscar histórico de status - SEM usar where com valores undefined
        console.log('📊 Buscando histórico...');
        try {
          const historySnapshot = await getDocs(collection(db, 'statusHistory'));
          const allHistory = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Filtrar histórico manualmente
          const ticketHistory = allHistory.filter(hist => hist.chamadoId === id);
          // Ordenar manualmente
          ticketHistory.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0);
            const dateB = new Date(b.timestamp || 0);
            return dateA - dateB;
          });
          setStatusHistory(ticketHistory);
          console.log('✅ Histórico carregado:', ticketHistory.length);
        } catch (histError) {
          console.error('⚠️ Erro ao carregar histórico:', histError);
          setStatusHistory([]); // Continuar sem histórico
        }

      } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        setError('Erro ao carregar dados do chamado. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, id]);

  // Função para obter pessoas envolvidas com histórico
  const getPeopleInvolved = () => {
    const people = [];
    
    // Sempre incluir quem criou
    if (ticket?.criadoPor) {
      const creator = users.find(u => u.id === ticket.criadoPor);
      if (creator) {
        people.push({
          id: creator.id,
          nome: creator.nome || 'Usuário desconhecido',
          funcao: creator.funcao || 'Não definido',
          area: creator.area || 'Não definido',
          tipo: 'Criador',
          timestamp: ticket.criadoEm
        });
      }
    }

    // Adicionar pessoas do histórico de status
    statusHistory.forEach(entry => {
      if (entry.userId && !people.find(p => p.id === entry.userId)) {
        const user = users.find(u => u.id === entry.userId);
        if (user) {
          people.push({
            id: user.id,
            nome: user.nome || 'Usuário desconhecido',
            funcao: user.funcao || 'Não definido',
            area: user.area || 'Não definido',
            tipo: 'Tratou o chamado',
            timestamp: entry.timestamp
          });
        }
      }
    });

    // Adicionar pessoas das mensagens
    messages.forEach(message => {
      if (message.userId && !people.find(p => p.id === message.userId)) {
        const user = users.find(u => u.id === message.userId);
        if (user) {
          people.push({
            id: user.id,
            nome: user.nome || 'Usuário desconhecido',
            funcao: user.funcao || 'Não definido',
            area: user.area || 'Não definido',
            tipo: 'Participou do chat',
            timestamp: message.timestamp
          });
        }
      }
    });

    return people.sort((a, b) => {
      if (a.tipo === 'Criador') return -1;
      if (b.tipo === 'Criador') return 1;
      return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
    });
  };

  // Função para obter status disponíveis
  const getAvailableStatuses = () => {
    if (!ticket || !userProfile) return [];

    const currentStatus = ticket.status;
    const userRole = userProfile.funcao;
    
    console.log('🔍 Verificando status disponíveis:', { currentStatus, userRole });

    // ADMINISTRADOR - Pode tudo
    if (userRole === 'administrador') {
      return Object.entries(TICKET_STATUS).map(([key, value]) => ({
        value,
        label: TICKET_STATUS_LABELS[value] || value,
        description: `Alterar para ${TICKET_STATUS_LABELS[value] || value}`
      }));
    }

    // PRODUTOR - Lógica corrigida com 3 opções quando consultor abre
    if (userRole === 'produtor') {
      const statuses = [];
      
      // Pode concluir se atende às regras de negócio
      if (canProducerComplete(ticket, user, userProfile)) {
        statuses.push({ 
          value: TICKET_STATUS.COMPLETED, 
          label: 'Concluir', 
          description: 'Finalizar chamado após validação' 
        });
      }
      
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

    // OPERADOR - Lógica corrigida (AJUSTE 4)
    if (userRole === 'operador') {
      const statuses = [];
      
      // Pode concluir se criou o chamado e foi executado por outra área
      if (canOperatorComplete(ticket, user, userProfile)) {
        statuses.push({ 
          value: TICKET_STATUS.COMPLETED, 
          label: 'Concluir', 
          description: 'Finalizar chamado após execução' 
        });
      }
      
      // Pode iniciar tratativa se for da área do chamado
      if ((currentStatus === TICKET_STATUS.OPEN || currentStatus === TICKET_STATUS.SENT_TO_AREA) &&
          userProfile.area === ticket.area) {
        statuses.push({ 
          value: TICKET_STATUS.IN_TREATMENT, 
          label: 'Tratativa', 
          description: 'Iniciar tratamento do chamado' 
        });
      }
      
      // Pode marcar como executado se estiver em tratativa
      if (currentStatus === TICKET_STATUS.IN_TREATMENT && userProfile.area === ticket.area) {
        statuses.push({ 
          value: TICKET_STATUS.EXECUTED_AWAITING_VALIDATION, 
          label: 'Executado', 
          description: 'Marcar como executado' 
        });
      }
      
      return statuses;
    }

    // CONSULTOR - Pode concluir chamados próprios
    if (userRole === 'consultor') {
      const statuses = [];
      
      if (ticket.criadoPor === user.uid && currentStatus === TICKET_STATUS.EXECUTED_AWAITING_VALIDATION) {
        statuses.push({ 
          value: TICKET_STATUS.COMPLETED, 
          label: 'Concluir', 
          description: 'Finalizar chamado' 
        });
      }
      
      return statuses;
    }

    // GERENTE - Pode aprovar/reprovar
    if (userRole === 'gerente') {
      const statuses = [];
      
      if (currentStatus === TICKET_STATUS.AWAITING_APPROVAL && 
          (ticket.gerenteResponsavelId === user.uid || 
           userProfile.area === ticket.areaEscalada)) {
        statuses.push(
          { value: TICKET_STATUS.APPROVED, label: 'Aprovar', description: 'Aprovar chamado' },
          { value: TICKET_STATUS.REJECTED, label: 'Reprovar', description: 'Reprovar chamado' }
        );
      }
      
      return statuses;
    }

    return [];
  };

  // Função para obter opções de escalação
  const getEscalationOptions = () => {
    const options = [];
    
    // Escalar para gerência
    options.push({
      value: 'gerencia',
      label: 'Escalar para Gerência',
      description: 'Enviar para aprovação gerencial'
    });
    
    // Escalar para outra área
    options.push({
      value: 'area',
      label: 'Escalar para Outra Área',
      description: 'Transferir para área específica'
    });
    
    // AJUSTE 6: Enviar para produtor (quando operador criou)
    if (userProfile?.funcao === 'operador' && ticket?.criadoPor === user.uid) {
      options.push({
        value: 'produtor',
        label: 'Enviar para Produtor',
        description: 'Transferir para produtor dar continuidade'
      });
    }
    
    return options;
  };

  // Função para alterar status
  const handleStatusChange = async () => {
    if (!selectedStatus) return;
    
    try {
      await updateDoc(doc(db, 'chamados', id), {
        status: selectedStatus,
        ultimaAtualizacao: new Date().toISOString()
      });
      
      // Adicionar ao histórico
      await addDoc(collection(db, 'statusHistory'), {
        chamadoId: id,
        userId: user.uid,
        oldStatus: ticket.status,
        newStatus: selectedStatus,
        timestamp: new Date().toISOString()
      });
      
      setTicket(prev => ({ ...prev, status: selectedStatus }));
      setShowStatusModal(false);
      setSelectedStatus('');
    } catch (error) {
      console.error('Erro ao alterar status:', error);
    }
  };

  // Função para escalar chamado
  const handleEscalation = async () => {
    if (!escalationType || !escalationReason.trim()) return;
    
    try {
      const updateData = {
        ultimaAtualizacao: new Date().toISOString()
      };
      
      if (escalationType === 'gerencia') {
        updateData.status = TICKET_STATUS.AWAITING_APPROVAL;
        updateData.gerenteResponsavelId = selectedManager;
      } else if (escalationType === 'area') {
        updateData.status = TICKET_STATUS.SENT_TO_AREA;
        updateData.areaAtual = selectedArea;
      } else if (escalationType === 'produtor') {
        // AJUSTE 6: Lógica para enviar para produtor
        updateData.status = TICKET_STATUS.OPEN;
        updateData.produtorResponsavel = users.find(u => u.funcao === 'produtor')?.id;
      }
      
      await updateDoc(doc(db, 'chamados', id), updateData);
      
      // Adicionar mensagem de escalação
      await addDoc(collection(db, 'mensagens'), {
        chamadoId: id,
        userId: user.uid,
        texto: `**Chamado escalado para ${escalationType === 'gerencia' ? 'Gerência' : escalationType === 'area' ? 'Área' : 'Produtor'}** **Motivo:** ${escalationReason}`,
        timestamp: new Date().toISOString(),
        isSystem: true
      });
      
      // Adicionar ao histórico
      await addDoc(collection(db, 'statusHistory'), {
        chamadoId: id,
        userId: user.uid,
        oldStatus: ticket.status,
        newStatus: updateData.status,
        motivo: escalationReason,
        escalationType,
        timestamp: new Date().toISOString()
      });
      
      setTicket(prev => ({ ...prev, ...updateData }));
      setShowEscalationModal(false);
      setEscalationType('');
      setEscalationReason('');
      setSelectedArea('');
      setSelectedManager('');
    } catch (error) {
      console.error('Erro ao escalar chamado:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando chamado...</p>
          <div className="mt-2 text-sm text-gray-500 space-y-1">
            <p>Usuário: {user?.email || 'Não logado'}</p>
            <p>Chamado: {id || 'ID não fornecido'}</p>
            <p>Perfil: {userProfile ? '✅ Carregado' : '⏳ Carregando...'}</p>
            <p>Dados: {ticket ? '✅ Carregado' : '⏳ Carregando...'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro de Acesso</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Voltar ao Dashboard
          </button>
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
          <p className="text-gray-600 mb-4">O chamado solicitado não existe ou você não tem permissão para visualizá-lo.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Voltar ao Dashboard
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Chamado #{ticket.id?.slice(-8) || 'N/A'}
              </h1>
              <p className="text-gray-600 mt-1">
                Criado em {ticket.criadoEm ? format(new Date(ticket.criadoEm), 'dd/MM/yyyy, HH:mm', { locale: ptBR }) : 'Data não disponível'} por {users.find(u => u.id === ticket.criadoPor)?.nome || 'cleiton'}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${TICKET_STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>
                {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detalhes do Chamado */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <FileText className="h-5 w-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Detalhes do Chamado</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Título</h3>
                  <p className="mt-1 text-gray-900">{ticket.titulo || 'Sem título'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Descrição</h3>
                  <p className="mt-1 text-gray-900 whitespace-pre-wrap">{ticket.descricao || 'Sem descrição'}</p>
                </div>

                {/* AJUSTE 1: FLAG DE ITEM EXTRA - RESTAURADA */}
                {ticket.isExtra && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <Flame className="h-5 w-5 text-orange-600 mr-2" />
                      <span className="font-medium text-orange-800">ITEM EXTRA</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-orange-700 mb-1">Motivo do Item Extra</h4>
                      <p className="text-orange-800">{ticket.motivoExtra || 'Não especificado'}</p>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Área</h3>
                    <p className="mt-1 text-gray-900">{ticket.area || 'Não definida'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Tipo</h3>
                    <p className="mt-1 text-gray-900">{ticket.tipo || 'Não definido'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Criado em</h3>
                    <p className="mt-1 text-gray-900">
                      {ticket.criadoEm ? format(new Date(ticket.criadoEm), 'dd/MM/yyyy, HH:mm', { locale: ptBR }) : 'Data não disponível'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Criado por</h3>
                    <p className="mt-1 text-gray-900">{users.find(u => u.id === ticket.criadoPor)?.nome || 'cleiton'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat de Mensagens */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center">
                  <MessageSquare className="h-5 w-5 text-gray-400 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Conversas ({messages.length})</h2>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nenhuma mensagem ainda</p>
                  ) : (
                    messages.map((message) => {
                      const messageUser = users.find(u => u.id === message.userId);
                      const isCurrentUser = message.userId === user.uid;
                      const isSystemMessage = message.isSystem;
                      
                      return (
                        <div key={message.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            isSystemMessage 
                              ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' 
                              : isCurrentUser 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-900'
                          }`}>
                            <div className="flex items-center mb-1">
                              <span className="text-xs font-medium">
                                {messageUser?.nome || 'Sistema'}
                              </span>
                              <span className={`text-xs ml-2 ${
                                isSystemMessage 
                                  ? 'text-yellow-600' 
                                  : isCurrentUser 
                                    ? 'text-blue-200' 
                                    : 'text-gray-500'
                              }`}>
                                {message.timestamp ? format(new Date(message.timestamp), 'dd/MM HH:mm', { locale: ptBR }) : ''}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{message.texto}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {/* Formulário de nova mensagem */}
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newMessage.trim()) return;
                  
                  try {
                    await addDoc(collection(db, 'mensagens'), {
                      chamadoId: id,
                      userId: user.uid,
                      texto: newMessage,
                      timestamp: new Date().toISOString()
                    });
                    setNewMessage('');
                    // Recarregar mensagens
                    const messagesSnapshot = await getDocs(collection(db, 'mensagens'));
                    const allMessages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const ticketMessages = allMessages.filter(msg => msg.chamadoId === id);
                    ticketMessages.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
                    setMessages(ticketMessages);
                  } catch (error) {
                    console.error('Erro ao enviar mensagem:', error);
                  }
                }} className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
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
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-800 text-sm font-medium">
                  ✅ Você pode concluir este chamado
                </p>
              </div>
            )}

            {/* AJUSTE 2: Pessoas Envolvidas - MELHORADO */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <Users className="h-5 w-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Pessoas Envolvidas</h2>
              </div>
              
              <div className="space-y-3">
                {getPeopleInvolved().map((person, index) => (
                  <div key={person.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">{person.nome}</p>
                        {person.tipo === 'Criador' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Criador
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{person.funcao} - {person.area}</p>
                      <p className="text-xs text-gray-400">{person.tipo}</p>
                      {person.timestamp && (
                        <p className="text-xs text-gray-400">
                          {format(new Date(person.timestamp), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AJUSTE 3: Histórico - MELHORADO COM DETALHES */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <Clock className="h-5 w-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Histórico</h2>
              </div>
              
              <div className="space-y-3">
                {/* Abertura do chamado */}
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">Chamado criado</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      por {users.find(u => u.id === ticket.criadoPor)?.nome || 'cleiton'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {ticket.criadoEm ? format(new Date(ticket.criadoEm), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Data não disponível'}
                    </p>
                  </div>
                </div>

                {/* Histórico de status */}
                {statusHistory.map((entry, index) => {
                  const entryUser = users.find(u => u.id === entry.userId);
                  return (
                    <div key={entry.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">
                            {TICKET_STATUS_LABELS[entry.newStatus] || entry.newStatus}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          por {entryUser?.nome || 'Usuário desconhecido'}
                        </p>
                        {entry.motivo && (
                          <p className="text-xs text-gray-600 mt-1">
                            Motivo: {entry.motivo}
                          </p>
                        )}
                        {entry.escalationType && (
                          <p className="text-xs text-gray-600">
                            Escalação: {entry.escalationType}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {entry.timestamp ? format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Data não disponível'}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {statusHistory.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Nenhuma movimentação registrada
                  </p>
                )}
              </div>
            </div>

            {/* Ações */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações</h2>
              
              <div className="space-y-3">
                {/* Alterar Status */}
                {getAvailableStatuses().length > 0 && (
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Alterar Status
                  </button>
                )}
                
                {/* Escalar */}
                {(userProfile?.funcao === 'operador' || userProfile?.funcao === 'produtor' || userProfile?.funcao === 'administrador') && (
                  <button
                    onClick={() => setShowEscalationModal(true)}
                    className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center justify-center"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Escalar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Alteração de Status */}
        {showStatusModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Alterar Status</h3>
              
              <div className="space-y-3">
                {getAvailableStatuses().map((status) => (
                  <label key={status.value} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value={status.value}
                      checked={selectedStatus === status.value}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="text-blue-600"
                    />
                    <div>
                      <p className="font-medium">{status.label}</p>
                      <p className="text-sm text-gray-500">{status.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleStatusChange}
                  disabled={!selectedStatus}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Escalação */}
        {showEscalationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Escalar Chamado</h3>
              
              <div className="space-y-4">
                {/* Tipo de Escalação */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Escalação
                  </label>
                  <div className="space-y-2">
                    {getEscalationOptions().map((option) => (
                      <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="escalationType"
                          value={option.value}
                          checked={escalationType === option.value}
                          onChange={(e) => setEscalationType(e.target.value)}
                          className="text-blue-600"
                        />
                        <div>
                          <p className="font-medium">{option.label}</p>
                          <p className="text-sm text-gray-500">{option.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Seleção de Área */}
                {escalationType === 'area' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selecionar Área
                    </label>
                    <select
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione uma área</option>
                      {Object.keys(TICKET_CATEGORIES).map((area) => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Seleção de Gerente */}
                {escalationType === 'gerencia' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selecionar Gerente
                    </label>
                    <select
                      value={selectedManager}
                      onChange={(e) => setSelectedManager(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione um gerente</option>
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.nome} - {manager.area}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Motivo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo da Escalação
                  </label>
                  <textarea
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    placeholder="Descreva o motivo da escalação..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowEscalationModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEscalation}
                  disabled={!escalationType || !escalationReason.trim() || 
                    (escalationType === 'area' && !selectedArea) ||
                    (escalationType === 'gerencia' && !selectedManager)}
                  className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  Escalar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDetailPage;

