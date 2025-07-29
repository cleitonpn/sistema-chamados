import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { ticketService } from '../services/ticketService';
import { userService } from '../services/userService';
import notificationService from '../services/notificationService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import NotificationCenter from '../components/NotificationCenter';
import {
  LogOut, Plus, AlertCircle, Clock, CheckCircle, Users, FolderOpen, BarChart3,
  Menu, X, ExternalLink, MapPin, User, FileText, Calendar, ChevronDown,
  ChevronRight, Eye, Filter, ArrowUp, Hourglass, UserCheck, Play, BellRing, Lock
} from 'lucide-react';

const DashboardPage = () => {
  const { user, userProfile, logout, authInitialized } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectNames, setProjectNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [ticketNotifications, setTicketNotifications] = useState({});
  const [activeFilter, setActiveFilter] = useState('todos');

  // EFEITO PARA DADOS ESTÁTICOS (CARREGA UMA VEZ)
  useEffect(() => {
    const loadStaticData = async () => {
      try {
        const allProjects = await projectService.getAllProjects();
        setProjects(allProjects);
        const projectNamesMap = {};
        allProjects.forEach(project => {
          projectNamesMap[project.id] = project.nome;
        });
        setProjectNames(projectNamesMap);
      } catch (error) {
        console.error("Erro ao carregar dados estáticos:", error);
      }
    };
    if (user) {
      loadStaticData();
    }
  }, [user]);

  // ✅ EFEITO PARA CHAMADOS EM TEMPO REAL COM CORREÇÃO PARA O ERRO
  useEffect(() => {
    if (!user?.uid || !userProfile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let ticketsQuery;
    const ticketsRef = collection(db, 'tickets');

    // Lógica para construir a query de acordo com a função do usuário
    switch (userProfile.funcao) {
      case 'administrador':
      case 'gerente':
        ticketsQuery = query(ticketsRef);
        break;
      
      case 'produtor': {
        const projectIds = projects.filter(p => p.produtorId === user.uid).map(p => p.id);
        // CORREÇÃO: Só executa a query se a lista de IDs de projeto não estiver vazia.
        if (projectIds.length === 0) {
          setTickets([]);
          setLoading(false);
          return; // Sai do efeito para evitar o erro.
        }
        ticketsQuery = query(ticketsRef, where('projetoId', 'in', projectIds));
        break;
      }
      
      case 'consultor': {
        const projectIds = projects.filter(p => p.consultorId === user.uid).map(p => p.id);
        // CORREÇÃO: Só executa a query se a lista de IDs de projeto não estiver vazia.
        if (projectIds.length === 0) {
          setTickets([]);
          setLoading(false);
          return; // Sai do efeito para evitar o erro.
        }
        ticketsQuery = query(ticketsRef, where('projetoId', 'in', projectIds));
        break;
      }

      case 'operador':
        ticketsQuery = query(ticketsRef, where('areasEnvolvidas', 'array-contains', userProfile.area));
        break;
      
      default:
        ticketsQuery = query(ticketsRef, where('criadoPor', '==', user.uid));
        break;
    }
    
    const unsubscribe = onSnapshot(ticketsQuery, (querySnapshot) => {
      const ticketsData = [];
      querySnapshot.forEach((doc) => {
        ticketsData.push({ id: doc.id, ...doc.data() });
      });

      const filterConfidential = (ticket) => {
          if (!ticket.isConfidential) return true;
          const isCreator = ticket.criadoPor === user.uid;
          const isAdmin = userProfile.funcao === 'administrador';
          return isCreator || isAdmin;
      };
      
      setTickets(ticketsData.filter(filterConfidential));
      setLoading(false);
    }, (error) => {
      console.error("Erro ao escutar chamados em tempo real:", error);
      setLoading(false);
    });

    return () => unsubscribe();

  }, [user, userProfile, projects]);


  // EFEITO PARA NOTIFICAÇÕES (SINCRONIZADO COM OS CHAMADOS)
  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = notificationService.subscribeToNotifications(user.uid, (allNotifications) => {
        const counts = {};
        allNotifications.forEach(notification => {
          if (notification.ticketId && !notification.lida) {
            counts[notification.ticketId] = (counts[notification.ticketId] || 0) + 1;
          }
        });
        setTicketNotifications(counts);
      });
      return () => unsubscribe();
    }
  }, [user?.uid]);
  
  // O resto do componente (funções de filtragem, renderização, etc.) permanece o mesmo.
  const getTicketCounts = () => {
    const existingTicketIds = new Set(tickets.map(t => t.id));
    let ticketsWithNotifications = 0;

    Object.keys(ticketNotifications).forEach(ticketId => {
      if (existingTicketIds.has(ticketId)) {
        ticketsWithNotifications++;
      }
    });

    const counts = {
      todos: tickets.length,
      com_notificacao: ticketsWithNotifications,
      sem_tratativa: tickets.filter(t => t.status === 'aberto').length,
      em_tratativa: tickets.filter(t => t.status === 'em_tratativa').length,
      em_execucao: tickets.filter(t => t.status === 'em_execucao').length,
      escalado: tickets.filter(t => t.status === 'enviado_para_area' || t.status === 'escalado_para_area').length,
      escalado_para_mim: tickets.filter(t => (t.status === 'escalado_para_outra_area' && (t.areaEscalada === userProfile?.area || t.usuarioEscalado === user?.uid || (t.areasEnvolvidas && t.areasEnvolvidas.includes(userProfile?.area))))).length,
      aguardando_validacao: tickets.filter(t => t.status === 'executado_aguardando_validacao').length,
      concluidos: tickets.filter(t => t.status === 'concluido').length,
      aguardando_aprovacao: tickets.filter(t => t.status === 'aguardando_aprovacao').length
    };
    return counts;
  };
    
  const getFilteredTickets = () => {
    let filteredTickets = [...tickets];

    switch (activeFilter) {
      case 'todos':
        break;
      case 'com_notificacao':
        filteredTickets = filteredTickets.filter(ticket => ticketNotifications[ticket.id]);
        break;
      case 'sem_tratativa':
        filteredTickets = filteredTickets.filter(ticket => ticket.status === 'aberto');
        break;
      case 'em_tratativa':
        filteredTickets = filteredTickets.filter(ticket => ticket.status === 'em_tratativa');
        break;
      case 'em_execucao':
        filteredTickets = filteredTickets.filter(ticket => ticket.status === 'em_execucao');
        break;
      case 'escalado':
        filteredTickets = filteredTickets.filter(ticket =>
          ticket.status === 'enviado_para_area' || ticket.status === 'escalado_para_area'
        );
        break;
      case 'escalado_para_mim':
        filteredTickets = filteredTickets.filter(ticket => {
          if (ticket.status === 'escalado_para_outra_area') {
            if (ticket.areaEscalada === userProfile?.area) return true;
            if (ticket.usuarioEscalado === user?.uid ||
                ticket.usuarioEscalado === userProfile?.email ||
                ticket.usuarioEscalado === userProfile?.nome) return true;
            if (ticket.areasEnvolvidas && ticket.areasEnvolvidas.includes(userProfile?.area)) return true;
          }
          return false;
        });
        break;
      case 'aguardando_validacao':
        filteredTickets = filteredTickets.filter(ticket =>
          ticket.status === 'executado_aguardando_validacao'
        );
        break;
      case 'concluidos':
        filteredTickets = filteredTickets.filter(ticket => ticket.status === 'concluido');
        break;
      case 'aguardando_aprovacao':
        filteredTickets = filteredTickets.filter(ticket => ticket.status === 'aguardando_aprovacao');
        break;
      default:
        break;
    }

    return filteredTickets.sort((a, b) => {
      const dateA = a.dataUltimaAtualizacao?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.dataUltimaAtualizacao?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });
  };

  const getProjectName = (projetoId) => projectNames[projetoId] || 'Projeto não encontrado';
  const toggleProjectExpansion = (projectName) => setExpandedProjects(prev => ({ ...prev, [projectName]: !prev[projectName] }));
  const handleTicketClick = (ticketId) => navigate(`/chamado/${ticketId}`);
  
  if (!authInitialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const counts = getTicketCounts();
  const filterCards = [
    { id: 'todos', title: 'Todos', icon: FileText, color: 'bg-blue-50 border-blue-200 hover:bg-blue-100', iconColor: 'text-blue-600', activeColor: 'bg-blue-500 text-white border-blue-500' },
    ...(userProfile?.funcao === 'gerente' ? [{
      id: 'aguardando_aprovacao',
      title: 'Aguardando Aprovação',
      icon: UserCheck,
      color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
      iconColor: 'text-orange-600',
      activeColor: 'bg-orange-500 text-white border-orange-500'
    }] : []),
    { id: 'com_notificacao', title: 'Notificações', icon: BellRing, color: 'bg-red-50 border-red-200 hover:bg-red-100', iconColor: 'text-red-600', activeColor: 'bg-red-500 text-white border-red-500' },
    { id: 'sem_tratativa', title: 'Sem Tratativa', icon: AlertCircle, color: 'bg-orange-50 border-orange-200 hover:bg-orange-100', iconColor: 'text-orange-600', activeColor: 'bg-orange-500 text-white border-orange-500' },
    { id: 'em_tratativa', title: 'Em Tratativa', icon: Clock, color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100', iconColor: 'text-yellow-600', activeColor: 'bg-yellow-500 text-white border-yellow-500' },
    { id: 'em_execucao', title: 'Em Execução', icon: Play, color: 'bg-blue-50 border-blue-200 hover:bg-blue-100', iconColor: 'text-blue-600', activeColor: 'bg-blue-500 text-white border-blue-500' },
    { id: 'escalado', title: 'Escalado', icon: ArrowUp, color: 'bg-purple-50 border-purple-200 hover:bg-purple-100', iconColor: 'text-purple-600', activeColor: 'bg-purple-500 text-white border-purple-500' },
    { id: 'escalado_para_mim', title: 'Escalados para Mim', icon: ChevronDown, color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100', iconColor: 'text-indigo-600', activeColor: 'bg-indigo-500 text-white border-indigo-500' },
    { id: 'aguardando_validacao', title: 'Aguardando Validação', icon: Hourglass, color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100', iconColor: 'text-indigo-600', activeColor: 'bg-indigo-500 text-white border-indigo-500' },
    { id: 'concluidos', title: 'Concluídos', icon: CheckCircle, color: 'bg-green-50 border-green-200 hover:bg-green-100', iconColor: 'text-green-600', activeColor: 'bg-green-500 text-white border-green-500' }
  ];
  const getTicketsByProject = () => {
    const grouped = {};
    const displayedTickets = getFilteredTickets();
    displayedTickets.forEach(ticket => {
        const project = projects.find(p => p.id === ticket.projetoId);
        const projectName = project ? project.nome : 'Sem Projeto';
        if (!grouped[projectName]) grouped[projectName] = [];
        grouped[projectName].push(ticket);
    });
    return grouped;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
        <div className={`${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
            {/* O conteúdo da sua Sidebar (barra lateral) vai aqui */}
            <div className="flex items-center justify-between h-16 px-6 border-b">
                <h1 className="text-xl font-semibold text-gray-900">Gestão de Chamados</h1>
                <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden"><X className="h-6 w-6" /></button>
            </div>
            <nav className="mt-6 px-3">
              {/* Seus itens de navegação (botões, etc) */}
            </nav>
            <div className="absolute bottom-0 w-full p-4 border-t">
              {/* O menu do usuário no final da sidebar */}
            </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white shadow-sm border-b">
                <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center space-x-4">
                        <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden"><Menu className="h-6 w-6" /></button>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
                            <p className="text-sm text-gray-500">Bem-vindo, {userProfile?.nome || user?.email} ({userProfile?.funcao})</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <NotificationCenter />
                    </div>
                </div>
            </header>
            <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <Tabs defaultValue="chamados" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="chamados">Chamados</TabsTrigger>
                        <TabsTrigger value="projetos">Projetos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="chamados" className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-3 mb-6">
                            {filterCards.map((card) => {
                              const IconComponent = card.icon;
                              const isActive = activeFilter === card.id;
                              const count = counts[card.id];
                              if (!count && card.id === 'aguardando_aprovacao') return null;
                              return (
                                <Card key={card.id} className={`cursor-pointer transition-all duration-200 ${isActive ? card.activeColor : card.color} hover:shadow-md`} onClick={() => setActiveFilter(card.id)}>
                                  <CardContent className="p-3 sm:p-4">
                                    <div className="flex flex-col items-center text-center space-y-2">
                                      <IconComponent className={`h-5 w-5 sm:h-6 sm:w-6 ${isActive ? 'text-white' : card.iconColor}`} />
                                      <div>
                                        <p className={`text-xs sm:text-sm font-medium ${isActive ? 'text-white' : 'text-gray-900'}`}>{card.title}</p>
                                        <p className={`text-lg sm:text-xl font-bold ${isActive ? 'text-white' : card.iconColor}`}>{count}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                        </div>
                        {activeFilter !== 'todos' && (
                          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                            {/* Banner de filtro ativo */}
                          </div>
                        )}
                        <div className="space-y-4">
                            {Object.entries(getTicketsByProject()).map(([projectName, projectTickets]) => (
                                <div key={projectName} className="border rounded-lg">
                                    <button onClick={() => toggleProjectExpansion(projectName)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center space-x-3">
                                            {expandedProjects[projectName] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <div>
                                                <h3 className="font-medium">{projectName}</h3>
                                                <p className="text-xs text-gray-500">{projectTickets.length} chamado(s)</p>
                                            </div>
                                        </div>
                                    </button>
                                    {expandedProjects[projectName] && (
                                        <div className="border-t bg-gray-50/50 p-4 space-y-3">
                                            {projectTickets.map((ticket) => (
                                                <Card key={ticket.id} className="cursor-pointer hover:shadow-md" onClick={() => handleTicketClick(ticket.id)}>
                                                    <CardContent className="p-3 md:p-4">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    {ticket.isConfidential && <Lock className="h-4 w-4 text-orange-500" />}
                                                                    <h3 className="font-medium text-sm md:text-base truncate">{ticket.titulo}</h3>
                                                                    {ticketNotifications[ticket.id] && (
                                                                        <Badge className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                                                                            {ticketNotifications[ticket.id]}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs md:text-sm text-gray-600 mt-1 line-clamp-2">{ticket.descricao}</p>
                                                            </div>
                                                            <div className="text-right text-xs">
                                                                {/* Data e ícone */}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                                            {/* Badges de status e prioridade */}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                    <TabsContent value="projetos">
                        {/* Conteúdo da aba Projetos */}
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    </div>
  );
};

export default DashboardPage;
