// TicketDetailPage com ERRO FIRESTORE CORRIGIDO
// Correção: Tratamento de campos undefined nas consultas

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

const TicketDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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

  // ✅ FUNÇÃO CORRIGIDA - Verifica se produtor pode concluir chamado
  const canProducerComplete = (ticket, user, userProfile) => {
    if (!ticket || !user || !userProfile || userProfile?.funcao !== 'produtor') return false;
    
    try {
      // SITUAÇÃO 1: Chamado criado pelo próprio produtor (após áreas executarem)
      if (ticket.criadoPor === user.uid) {
        return ticket.status === 'executado';
      }
      
      // SITUAÇÃO 2: Chamado criado por consultor (produtor pode concluir)
      if (ticket.consultorId === user.uid || ticket.produtorId === user.uid) {
        return ['aberto', 'em_tratativa', 'executado'].includes(ticket.status);
      }
      
      // SITUAÇÃO 3: Produtor responsável pelo chamado
      if (ticket.produtorResponsavel === user.uid) {
        return ['executado', 'em_tratativa'].includes(ticket.status);
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao verificar permissões do produtor:', error);
      return false;
    }
  };

  // ✅ FUNÇÃO CORRIGIDA - Verifica se usuário pode alterar status
  const canUserChangeStatus = (ticket, user, userProfile, newStatus) => {
    if (!ticket || !user || !userProfile || !newStatus) return false;
    
    try {
      // Administrador pode tudo
      if (userProfile.funcao === 'administrador') return true;
      
      // PRODUTOR - Lógica específica corrigida
      if (userProfile.funcao === 'produtor') {
        // Pode concluir chamados conforme regras de negócio
        if (newStatus === 'concluido') {
          return canProducerComplete(ticket, user, userProfile);
        }
        
        // Pode escalar sempre (se for responsável pelo chamado)
        if (['escalado_area', 'escalado_gerencia'].includes(newStatus)) {
          return ticket.criadoPor === user.uid || 
                 ticket.consultorId === user.uid || 
                 ticket.produtorId === user.uid ||
                 ticket.produtorResponsavel === user.uid;
        }
        
        // Pode colocar em tratativa
        if (newStatus === 'em_tratativa') {
          return ticket.status === 'aberto' && 
                 (ticket.criadoPor === user.uid || 
                  ticket.consultorId === user.uid || 
                  ticket.produtorId === user.uid ||
                  ticket.produtorResponsavel === user.uid);
        }
        
        return false;
      }
      
      // CONSULTOR - Pode concluir apenas chamados que criou
      if (userProfile.funcao === 'consultor') {
        if (newStatus === 'concluido') {
          return ticket.criadoPor === user.uid && ticket.status === 'executado';
        }
        
        if (['escalado_area', 'escalado_gerencia'].includes(newStatus)) {
          return ticket.criadoPor === user.uid;
        }
        
        return false;
      }
      
      // OPERADOR - Pode executar e escalar
      if (userProfile.funcao === 'operador') {
        if (newStatus === 'executado') {
          return ticket.area === userProfile.area && 
                 ['aberto', 'em_tratativa'].includes(ticket.status);
        }
        
        if (['escalado_area', 'escalado_gerencia'].includes(newStatus)) {
          return ticket.area === userProfile.area;
        }
        
        if (newStatus === 'em_tratativa') {
          return ticket.area === userProfile.area && ticket.status === 'aberto';
        }
        
        return false;
      }
      
      // GERENTE - Pode aprovar/reprovar quando escalado para ele
      if (userProfile.funcao === 'gerente') {
        if (['aprovado', 'reprovado'].includes(newStatus)) {
          return ticket.status === 'aguardando_aprovacao' && 
                 ticket.gerenteResponsavelId === user.uid;
        }
        
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      return false;
    }
  };

  // ✅ FUNÇÃO CORRIGIDA - Retorna status disponíveis para o usuário
  const getAvailableStatuses = (ticket, userProfile) => {
    if (!ticket || !userProfile) return [];
    
    try {
      const statuses = [];
      
      // PRODUTOR - Status disponíveis corrigidos
      if (userProfile.funcao === 'produtor') {
        // Pode concluir se atende às regras
        if (canProducerComplete(ticket, user, userProfile)) {
          statuses.push({ value: 'concluido', label: 'Concluído' });
        }
        
        // Pode escalar sempre
        if (canUserChangeStatus(ticket, user, userProfile, 'escalado_area')) {
          statuses.push({ value: 'escalado_area', label: 'Escalar para Área' });
        }
        
        if (canUserChangeStatus(ticket, user, userProfile, 'escalado_gerencia')) {
          statuses.push({ value: 'escalado_gerencia', label: 'Escalar para Gerência' });
        }
        
        // Pode colocar em tratativa
        if (canUserChangeStatus(ticket, user, userProfile, 'em_tratativa')) {
          statuses.push({ value: 'em_tratativa', label: 'Em Tratativa' });
        }
      }
      
      // CONSULTOR - Status disponíveis
      else if (userProfile.funcao === 'consultor') {
        if (canUserChangeStatus(ticket, user, userProfile, 'concluido')) {
          statuses.push({ value: 'concluido', label: 'Concluído' });
        }
        
        if (canUserChangeStatus(ticket, user, userProfile, 'escalado_area')) {
          statuses.push({ value: 'escalado_area', label: 'Escalar para Área' });
        }
        
        if (canUserChangeStatus(ticket, user, userProfile, 'escalado_gerencia')) {
          statuses.push({ value: 'escalado_gerencia', label: 'Escalar para Gerência' });
        }
      }
      
      // OPERADOR - Status disponíveis
      else if (userProfile.funcao === 'operador') {
        if (canUserChangeStatus(ticket, user, userProfile, 'executado')) {
          statuses.push({ value: 'executado', label: 'Executado' });
        }
        
        if (canUserChangeStatus(ticket, user, userProfile, 'em_tratativa')) {
          statuses.push({ value: 'em_tratativa', label: 'Em Tratativa' });
        }
        
        if (canUserChangeStatus(ticket, user, userProfile, 'escalado_area')) {
          statuses.push({ value: 'escalado_area', label: 'Escalar para Área' });
        }
        
        if (canUserChangeStatus(ticket, user, userProfile, 'escalado_gerencia')) {
          statuses.push({ value: 'escalado_gerencia', label: 'Escalar para Gerência' });
        }
      }
      
      // GERENTE - Status disponíveis
      else if (userProfile.funcao === 'gerente') {
        if (canUserChangeStatus(ticket, user, userProfile, 'aprovado')) {
          statuses.push({ value: 'aprovado', label: 'Aprovado' });
        }
        
        if (canUserChangeStatus(ticket, user, userProfile, 'reprovado')) {
          statuses.push({ value: 'reprovado', label: 'Reprovado' });
        }
      }
      
      // ADMINISTRADOR - Todos os status
      else if (userProfile.funcao === 'administrador') {
        statuses.push(
          { value: 'aberto', label: 'Aberto' },
          { value: 'em_tratativa', label: 'Em Tratativa' },
          { value: 'executado', label: 'Executado' },
          { value: 'concluido', label: 'Concluído' },
          { value: 'escalado_area', label: 'Escalar para Área' },
          { value: 'escalado_gerencia', label: 'Escalar para Gerência' },
          { value: 'aguardando_aprovacao', label: 'Aguardando Aprovação' },
          { value: 'aprovado', label: 'Aprovado' },
          { value: 'reprovado', label: 'Reprovado' }
        );
      }
      
      return statuses;
    } catch (error) {
      console.error('Erro ao obter status disponíveis:', error);
      return [];
    }
  };

  // ✅ FUNÇÃO CORRIGIDA - Buscar dados do usuário com tratamento de erro
  const fetchUserProfile = async () => {
    if (!user?.uid) {
      setError('Usuário não autenticado');
      return;
    }
    
    try {
      console.log('🔍 Buscando perfil do usuário:', user.uid);
      const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('✅ Perfil do usuário carregado:', userData);
        setUserProfile(userData);
      } else {
        console.error('❌ Perfil do usuário não encontrado');
        setError('Perfil do usuário não encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar perfil do usuário:', error);
      setError('Erro ao carregar perfil do usuário');
    }
  };

  // ✅ FUNÇÃO CORRIGIDA - Buscar dados do chamado com tratamento de erro
  const fetchTicket = async () => {
    if (!id) {
      setError('ID do chamado não fornecido');
      return;
    }
    
    try {
      console.log('🔍 Buscando chamado:', id);
      const ticketDoc = await getDoc(doc(db, 'chamados', id));
      if (ticketDoc.exists()) {
        const ticketData = { id: ticketDoc.id, ...ticketDoc.data() };
        console.log('✅ Chamado carregado:', ticketData);
        setTicket(ticketData);
      } else {
        console.error('❌ Chamado não encontrado');
        setError('Chamado não encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar chamado:', error);
      setError('Erro ao carregar chamado');
    }
  };

  // ✅ FUNÇÃO CORRIGIDA - Buscar mensagens com tratamento de erro
  const fetchMessages = () => {
    if (!id) {
      console.error('❌ ID do chamado não fornecido para buscar mensagens');
      return;
    }
    
    try {
      console.log('🔍 Configurando listener de mensagens para chamado:', id);
      
      const messagesQuery = query(
        collection(db, 'mensagens'),
        where('chamadoId', '==', id),
        orderBy('criadoEm', 'asc')
      );
      
      const unsubscribe = onSnapshot(
        messagesQuery, 
        (snapshot) => {
          try {
            const messagesData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            console.log('✅ Mensagens carregadas:', messagesData.length);
            setMessages(messagesData);
          } catch (error) {
            console.error('❌ Erro ao processar mensagens:', error);
          }
        },
        (error) => {
          console.error('❌ Erro no listener de mensagens:', error);
          // Não definir como erro crítico, apenas log
        }
      );
      
      return unsubscribe;
    } catch (error) {
      console.error('❌ Erro ao configurar listener de mensagens:', error);
      return null;
    }
  };

  // ✅ FUNÇÃO CORRIGIDA - Buscar usuários com tratamento de erro
  const fetchUsers = async () => {
    try {
      console.log('🔍 Buscando usuários...');
      const usersSnapshot = await getDocs(collection(db, 'usuarios'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('✅ Usuários carregados:', usersData.length);
      setUsers(usersData);
      
      // Filtrar gerentes
      const managersData = usersData.filter(user => user.funcao === 'gerente');
      console.log('✅ Gerentes encontrados:', managersData.length);
      setManagers(managersData);
    } catch (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      // Não definir como erro crítico
    }
  };

  // Função para enviar mensagem
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      await addDoc(collection(db, 'mensagens'), {
        chamadoId: id,
        autorId: user.uid,
        autorNome: userProfile?.nome || user.email,
        conteudo: newMessage,
        criadoEm: new Date(),
        tipo: 'mensagem'
      });
      
      setNewMessage('');
      toast.success('Mensagem enviada');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    }
  };

  // Função para atualizar status do chamado
  const handleStatusChange = async () => {
    if (!newStatus) return;
    
    // Verificar permissão antes de alterar
    if (!canUserChangeStatus(ticket, user, userProfile, newStatus)) {
      toast.error('Você não tem permissão para alterar para este status');
      return;
    }
    
    try {
      const updateData = {
        status: newStatus,
        atualizadoEm: new Date(),
        atualizadoPor: user.uid
      };
      
      // Lógica específica para escalações
      if (newStatus === 'escalado_area' && selectedArea) {
        updateData.area = selectedArea;
        updateData.motivoEscalacao = escalationReason;
      }
      
      if (newStatus === 'escalado_gerencia' && selectedManager) {
        updateData.gerenteResponsavelId = selectedManager;
        updateData.motivoEscalacao = escalationReason;
        updateData.status = 'aguardando_aprovacao';
      }
      
      if (newStatus === 'reprovado' && escalationReason) {
        updateData.motivoReprovacao = escalationReason;
        updateData.status = 'encerrado';
      }
      
      await updateDoc(doc(db, 'chamados', id), updateData);
      
      // Adicionar mensagem de sistema
      await addDoc(collection(db, 'mensagens'), {
        chamadoId: id,
        autorId: user.uid,
        autorNome: userProfile?.nome || user.email,
        conteudo: `Status alterado para: ${getStatusLabel(newStatus)}${escalationReason ? ` - Motivo: ${escalationReason}` : ''}`,
        criadoEm: new Date(),
        tipo: 'sistema'
      });
      
      setNewStatus('');
      setEscalationReason('');
      setSelectedArea('');
      setSelectedManager('');
      
      toast.success('Status atualizado com sucesso');
      
      // Recarregar dados
      fetchTicket();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  // Função auxiliar para obter label do status
  const getStatusLabel = (status) => {
    const statusMap = {
      'aberto': 'Aberto',
      'em_tratativa': 'Em Tratativa',
      'executado': 'Executado',
      'concluido': 'Concluído',
      'escalado_area': 'Escalado para Área',
      'escalado_gerencia': 'Escalado para Gerência',
      'aguardando_aprovacao': 'Aguardando Aprovação',
      'aprovado': 'Aprovado',
      'reprovado': 'Reprovado',
      'encerrado': 'Encerrado'
    };
    return statusMap[status] || status;
  };

  // Função para obter cor do status
  const getStatusColor = (status) => {
    const colorMap = {
      'aberto': 'bg-blue-100 text-blue-800',
      'em_tratativa': 'bg-yellow-100 text-yellow-800',
      'executado': 'bg-green-100 text-green-800',
      'concluido': 'bg-green-100 text-green-800',
      'escalado_area': 'bg-orange-100 text-orange-800',
      'escalado_gerencia': 'bg-purple-100 text-purple-800',
      'aguardando_aprovacao': 'bg-purple-100 text-purple-800',
      'aprovado': 'bg-green-100 text-green-800',
      'reprovado': 'bg-red-100 text-red-800',
      'encerrado': 'bg-gray-100 text-gray-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  // ✅ useEffect CORRIGIDO - Carregamento sequencial com tratamento de erro
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!user?.uid) {
          console.log('⏳ Aguardando autenticação...');
          return;
        }
        
        console.log('🚀 Iniciando carregamento de dados...');
        
        // Carregar dados sequencialmente
        await fetchUserProfile();
        await fetchTicket();
        await fetchUsers();
        
        console.log('✅ Dados básicos carregados');
      } catch (error) {
        console.error('❌ Erro no carregamento inicial:', error);
        setError('Erro ao carregar dados');
      }
    };
    
    loadData();
  }, [user, id]);

  // ✅ useEffect CORRIGIDO - Configurar listener de mensagens após dados carregados
  useEffect(() => {
    if (id && ticket && userProfile) {
      console.log('🔄 Configurando listener de mensagens...');
      const unsubscribe = fetchMessages();
      
      // Definir loading como false após tudo carregado
      setLoading(false);
      
      return () => {
        if (unsubscribe) {
          console.log('🧹 Limpando listener de mensagens');
          unsubscribe();
        }
      };
    }
  }, [id, ticket, userProfile]);

  // Renderização de loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando chamado...</p>
          {user && <p className="text-sm text-gray-500">Usuário: {user.email}</p>}
          {id && <p className="text-sm text-gray-500">Chamado: {id}</p>}
        </div>
      </div>
    );
  }

  // Renderização de erro
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <Button onClick={() => window.location.reload()} variant="outline">
              Tentar Novamente
            </Button>
            <Button onClick={() => navigate('/dashboard')}>
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Chamado não encontrado</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const availableStatuses = getAvailableStatuses(ticket, userProfile);
  const areas = ['producao', 'logistica', 'operacional', 'locacao', 'comunicacao_visual', 'almoxarifado', 'compras', 'financeiro'];

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Chamado #{ticket.id?.slice(-6)}</h1>
          <p className="text-gray-600">
            Criado em {ticket.criadoEm?.toDate ? format(ticket.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Data não disponível'} por {ticket.criadoPorNome || 'Usuário desconhecido'}
          </p>
        </div>
        <div className="ml-auto">
          <Badge className={getStatusColor(ticket.status)}>
            {getStatusLabel(ticket.status)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detalhes do Chamado */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalhes do Chamado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{ticket.titulo || 'Título não disponível'}</h3>
                <p className="text-gray-600 mt-2">{ticket.descricao || 'Descrição não disponível'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Área</label>
                  <p className="font-medium">{ticket.area || 'Não definida'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Tipo</label>
                  <p className="font-medium">{ticket.tipo || 'Não definido'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Prioridade</label>
                  <p className="font-medium">{ticket.prioridade || 'Não definida'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Projeto</label>
                  <p className="font-medium">{ticket.projetoNome || 'Não definido'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seção de Ações */}
          {availableStatuses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ações do Chamado</CardTitle>
                <CardDescription>
                  {userProfile?.funcao === 'produtor' && canProducerComplete(ticket, user, userProfile) && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                      <p className="text-green-800 text-sm font-medium">
                        ✅ Você pode concluir este chamado
                      </p>
                    </div>
                  )}
                  Selecione uma ação para alterar o status do chamado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o novo status" />
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

                {/* Campos condicionais para escalação */}
                {newStatus === 'escalado_area' && (
                  <div>
                    <Select value={selectedArea} onValueChange={setSelectedArea}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a área" />
                      </SelectTrigger>
                      <SelectContent>
                        {areas.map((area) => (
                          <SelectItem key={area} value={area}>
                            {area.charAt(0).toUpperCase() + area.slice(1).replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newStatus === 'escalado_gerencia' && (
                  <div>
                    <Select value={selectedManager} onValueChange={setSelectedManager}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o gerente" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(['escalado_area', 'escalado_gerencia', 'reprovado'].includes(newStatus)) && (
                  <div>
                    <Textarea
                      placeholder={newStatus === 'reprovado' ? 'Motivo da reprovação (obrigatório)' : 'Motivo da escalação (opcional)'}
                      value={escalationReason}
                      onChange={(e) => setEscalationReason(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                )}

                <Button 
                  onClick={handleStatusChange} 
                  disabled={!newStatus || (newStatus === 'escalado_area' && !selectedArea) || (newStatus === 'escalado_gerencia' && !selectedManager) || (newStatus === 'reprovado' && !escalationReason)}
                  className="w-full"
                >
                  Atualizar Status
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Chat de Mensagens */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Conversas ({messages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.autorId === user.uid ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.autorId === user.uid
                          ? 'bg-blue-500 text-white'
                          : message.tipo === 'sistema'
                          ? 'bg-gray-100 text-gray-800 border'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">
                          {message.autorNome}
                        </span>
                        <span className="text-xs opacity-75">
                          {message.criadoEm?.toDate ? format(message.criadoEm.toDate(), 'HH:mm', { locale: ptBR }) : 'Agora'}
                        </span>
                      </div>
                      <p className="text-sm">{message.conteudo}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input de nova mensagem */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 min-h-[60px]"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar com informações adicionais */}
        <div className="space-y-6">
          {/* Informações do Projeto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Projeto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-gray-500">Nome</label>
                  <p className="font-medium">{ticket.projetoNome || 'Não definido'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Local</label>
                  <p className="font-medium">{ticket.projetoLocal || 'Não definido'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Histórico de Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {messages
                  .filter(msg => msg.tipo === 'sistema')
                  .slice(-5)
                  .map((message) => (
                    <div key={message.id} className="text-sm">
                      <p className="font-medium text-gray-900">{message.conteudo}</p>
                      <p className="text-gray-500 text-xs">
                        {message.criadoEm?.toDate ? format(message.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Data não disponível'}
                      </p>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Pessoas Envolvidas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Pessoas Envolvidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Criado por</label>
                  <p className="font-medium">{ticket.criadoPorNome || 'Usuário desconhecido'}</p>
                </div>
                {ticket.consultorNome && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Consultor</label>
                    <p className="font-medium">{ticket.consultorNome}</p>
                  </div>
                )}
                {ticket.produtorNome && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Produtor</label>
                    <p className="font-medium">{ticket.produtorNome}</p>
                  </div>
                )}
                {ticket.gerenteResponsavelNome && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Gerente Responsável</label>
                    <p className="font-medium">{ticket.gerenteResponsavelNome}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;

