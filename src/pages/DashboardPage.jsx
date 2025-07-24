import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { ticketService } from '../services/ticketService';
import { userService } from '../services/userService';
// ✅ 1. ALTERAÇÃO: Usando o serviço de notificação unificado e correto.
import notificationService from '../services/notificationService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import NotificationCenter from '../components/NotificationCenter';
import { 
  LogOut, 
  Plus, 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  Users,
  FolderOpen,
  BarChart3,
  Menu,
  X,
  ExternalLink,
  MapPin,
  User,
  FileText,
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  MoreVertical,
  Archive,
  Trash2,
  Edit,
  Eye,
  Filter,
  RotateCcw,
  ArrowUp,
  Hourglass,
  UserCheck,
  Play,
  Bell // 🔔 NOVO: Ícone para notificações
} from 'lucide-react';

const DashboardPage = () => {
  const { user, userProfile, logout, authInitialized } = useAuth();
  const navigate = useNavigate();
  
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [projectNames, setProjectNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});
  const [ticketNotifications, setTicketNotifications] = useState({});
  
  // Estados para ações em lote
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // NOVO: Estado para filtro ativo
  const [activeFilter, setActiveFilter] = useState('todos');

  // Função para buscar nome do projeto
  const getProjectName = (projetoId) => {
    return projectNames[projetoId] || 'Projeto não encontrado';
  };

  // NOVO: Função para filtrar chamados baseado no filtro ativo
  const getFilteredTickets = () => {
    let filteredTickets = [...tickets];

    switch (activeFilter) {
      case 'todos':
        // Sem filtro, todos os chamados
        break;
      
      case 'sem_tratativa':
        // Chamados com status 'aberto'
        filteredTickets = filteredTickets.filter(ticket => ticket.status === 'aberto');
        break;
      
      case 'em_tratativa':
        // Chamados com status 'em_tratativa'
        filteredTickets = filteredTickets.filter(ticket => ticket.status === 'em_tratativa');
        break;
      
      case 'em_execucao':
        // Chamados com status 'em_execucao'
        filteredTickets = filteredTickets.filter(ticket => ticket.status === 'em_execucao');
        break;
      
      case 'escalado':
        // Chamados com status 'enviado_para_area' ou 'escalado_para_area'
        filteredTickets = filteredTickets.filter(ticket => 
          ticket.status === 'enviado_para_area' || ticket.status === 'escalado_para_area'
        );
        break;
      
      case 'escalado_para_mim':
        // Chamados escalados para a área ou usuário atual
        filteredTickets = filteredTickets.filter(ticket => {
          if (ticket.status === 'escalado_para_outra_area') {
            // Verifica se foi escalado para a área do usuário
            if (ticket.areaEscalada === userProfile?.area) {
              return true;
            }
            // Verifica se foi escalado especificamente para o usuário
            if (ticket.usuarioEscalado === user?.uid || 
                ticket.usuarioEscalado === userProfile?.email ||
                ticket.usuarioEscalado === userProfile?.nome) {
              return true;
            }
            // Verifica se está nas áreas envolvidas
            if (ticket.areasEnvolvidas && ticket.areasEnvolvidas.includes(userProfile?.area)) {
              return true;
            }
          }
          return false;
        });
        break;
      
      case 'devolvido':
        // Chamados que retornaram para o usuário (lógica pode variar conforme regras de negócio)
        // Por enquanto, usando chamados que foram escalados e voltaram
        filteredTickets = filteredTickets.filter(ticket => 
          ticket.status === 'devolvido' || 
          (ticket.historico && ticket.historico.some(h => h.acao === 'devolvido'))
        );
        break;
      
      case 'aguardando_validacao':
        // Chamados com status 'executado_aguardando_validacao'
        filteredTickets = filteredTickets.filter(ticket => 
          ticket.status === 'executado_aguardando_validacao'
        );
        break;
      
      case 'concluidos':
        // Chamados com status 'concluido'
        filteredTickets = filteredTickets.filter(ticket => ticket.status === 'concluido');
        break;
      
      // 🔔 NOVO: Filtro para chamados com notificações não lidas
      case 'com_notificacoes_nao_lidas':
        // Filtrar apenas chamados que têm notificações não lidas
        filteredTickets = filteredTickets.filter(ticket => 
          ticketNotifications[ticket.id] && ticketNotifications[ticket.id] > 0
        );
        break;
      
      default:
        break;
    }

    // Ordenar por dataUltimaAtualizacao (mais recente primeiro)
    return filteredTickets.sort((a, b) => {
      const dateA = a.dataUltimaAtualizacao?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.dataUltimaAtualizacao?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });
  };

  // NOVO: Função para contar chamados por categoria
  const getTicketCounts = () => {
    // 🔔 NOVO: Contar chamados com notificações não lidas
    const ticketsWithUnreadNotifications = tickets.filter(ticket => 
      ticketNotifications[ticket.id] && ticketNotifications[ticket.id] > 0
    ).length;

    const counts = {
      todos: tickets.length,
      sem_tratativa: tickets.filter(t => t.status === 'aberto').length,
      em_tratativa: tickets.filter(t => t.status === 'em_tratativa').length,
      em_execucao: tickets.filter(t => t.status === 'em_execucao').length,
      escalado: tickets.filter(t => 
        t.status === 'enviado_para_area' || t.status === 'escalado_para_area'
      ).length,
      escalado_para_mim: tickets.filter(t => {
        if (t.status === 'escalado_para_outra_area') {
          if (t.areaEscalada === userProfile?.area) return true;
          if (t.usuarioEscalado === user?.uid || t.usuarioEscalado === userProfile?.email || t.usuarioEscalado === userProfile?.nome) return true;
          if (t.areasEnvolvidas && t.areasEnvolvidas.includes(userProfile?.area)) return true;
        }
        return false;
      }).length,
      devolvido: tickets.filter(t => t.status === 'devolvido' || (t.historico && t.historico.some(h => h.acao === 'devolvido'))).length,
      aguardando_validacao: tickets.filter(t => t.status === 'executado_aguardando_validacao').length,
      concluidos: tickets.filter(t => t.status === 'concluido').length,
      // 🔔 NOVO: Adicionar contagem de notificações não lidas
      com_notificacoes_nao_lidas: ticketsWithUnreadNotifications
    };
    return counts;
  };

  // NOVO: Configuração dos cards de filtro
  const filterCards = [
    { id: 'todos', title: 'Todos', icon: FileText, color: 'bg-blue-50 border-blue-200 hover:bg-blue-100', iconColor: 'text-blue-600', activeColor: 'bg-blue-500 text-white border-blue-500' },
    // 🔔 NOVO: Card de notificações não lidas - posicionado no início para destaque
    { id: 'com_notificacoes_nao_lidas', title: 'Com Notificações', icon: Bell, color: 'bg-red-50 border-red-200 hover:bg-red-100', iconColor: 'text-red-600', activeColor: 'bg-red-500 text-white border-red-500' },
    { id: 'sem_tratativa', title: 'Sem Tratativa', icon: AlertCircle, color: 'bg-orange-50 border-orange-200 hover:bg-orange-100', iconColor: 'text-orange-600', activeColor: 'bg-orange-500 text-white border-orange-500' },
    { id: 'em_tratativa', title: 'Em Tratativa', icon: Clock, color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100', iconColor: 'text-yellow-600', activeColor: 'bg-yellow-500 text-white border-yellow-500' },
    { id: 'em_execucao', title: 'Em Execução', icon: Play, color: 'bg-blue-50 border-blue-200 hover:bg-blue-100', iconColor: 'text-blue-600', activeColor: 'bg-blue-500 text-white border-blue-500' },
    { id: 'escalado', title: 'Escalado', icon: ArrowUp, color: 'bg-purple-50 border-purple-200 hover:bg-purple-100', iconColor: 'text-purple-600', activeColor: 'bg-purple-500 text-white border-purple-500' },
    { id: 'escalado_para_mim', title: 'Escalados para Mim', icon: ChevronDown, color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100', iconColor: 'text-indigo-600', activeColor: 'bg-indigo-500 text-white border-indigo-500' },
    { id: 'devolvido', title: 'Devolvido', icon: RotateCcw, color: 'bg-pink-50 border-pink-200 hover:bg-pink-100', iconColor: 'text-pink-600', activeColor: 'bg-pink-500 text-white border-pink-500' },
    { id: 'aguardando_validacao', title: 'Aguardando Validação', icon: Hourglass, color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100', iconColor: 'text-indigo-600', activeColor: 'bg-indigo-500 text-white border-indigo-500' },
    { id: 'concluidos', title: 'Concluídos', icon: CheckCircle, color: 'bg-green-50 border-green-200 hover:bg-green-100', iconColor: 'text-green-600', activeColor: 'bg-green-500 text-white border-green-500' }
  ];

  const getDisplayedTickets = () => getFilteredTickets();
  const getProjectsByEvent = () => {
    const grouped = {};
    projects.forEach(project => {
      const eventName = project.feira || 'Sem Evento';
      if (!grouped[eventName]) grouped[eventName] = [];
      grouped[eventName].push(project);
    });
    return grouped;
  };
  const getTicketsByProject = () => {
    const grouped = {};
    const displayedTickets = getDisplayedTickets();
    displayedTickets.forEach(ticket => {
      const projectName = ticket.projetoId ? getProjectName(ticket.projetoId) : 'Sem Projeto';
      if (!grouped[projectName]) grouped[projectName] = [];
      grouped[projectName].push(ticket);
    });
    return grouped;
  };

  const toggleEventExpansion = (eventName) => setExpandedEvents(prev => ({ ...prev, [eventName]: !prev[eventName] }));
  const toggleProjectExpansion = (projectName) => setExpandedProjects(prev => ({ ...prev, [projectName]: !prev[projectName] }));
  const handleProjectClick = (project) => navigate(`/projeto/${project.id}`);
  const handleTicketClick = (ticketId) => navigate(`/chamado/${ticketId}`);

  const getStatusColor = (status) => {
    const colors = { 'aberto': 'bg-blue-100 text-blue-800', 'em_tratativa': 'bg-yellow-100 text-yellow-800', 'em_execucao': 'bg-blue-100 text-blue-800', 'enviado_para_area': 'bg-purple-100 text-purple-800', 'escalado_para_area': 'bg-purple-100 text-purple-800', 'aguardando_aprovacao': 'bg-orange-100 text-orange-800', 'executado_aguardando_validacao': 'bg-indigo-100 text-indigo-800', 'concluido': 'bg-green-100 text-green-800', 'cancelado': 'bg-red-100 text-red-800', 'devolvido': 'bg-pink-100 text-pink-800' };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };
  const getPriorityColor = (priority) => {
    const colors = { 'baixa': 'bg-green-100 text-green-800', 'media': 'bg-yellow-100 text-yellow-800', 'alta': 'bg-red-100 text-red-800' };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const handleTicketSelect = (ticketId, checked) => {
    const newSelected = new Set(selectedTickets);
    if (checked) newSelected.add(ticketId);
    else newSelected.delete(ticketId);
    setSelectedTickets(newSelected);
  };

  // ✅ 2. ALTERAÇÃO: Função agora usa o serviço correto.
  const loadTicketNotifications = async () => {
    if (!user?.uid || !tickets.length) return;
    
    try {
      const notificationCounts = {};
      
      for (const ticket of tickets) {
        try {
          const count = await notificationService.getUnreadNotificationsByTicket(
            user.uid, 
            ticket.id
          );
          if (count > 0) {
            notificationCounts[ticket.id] = count;
          }
        } catch (ticketError) {
          console.warn(`⚠️ Erro ao carregar notificações do chamado ${ticket.id}:`, ticketError);
        }
      }
      
      setTicketNotifications(notificationCounts);
      console.log('📱 Notificações carregadas:', notificationCounts);
    } catch (error) {
      console.error('❌ Erro ao carregar notificações dos chamados:', error);
      setTicketNotifications({});
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Carregando dados para:', userProfile?.funcao);
      
      if (userProfile?.funcao === 'administrador') {
        console.log('👑 Administrador: carregando TODOS os dados');
        const [allProjects, allTickets, allUsers] = await Promise.all([
          projectService.getAllProjects(),
          ticketService.getAllTickets(),
          userService.getAllUsers()
        ]);
        setProjects(allProjects);
        setTickets(allTickets);
        setUsers(allUsers);
        
        const projectNamesMap = {};
        allProjects.forEach(project => {
          projectNamesMap[project.id] = project.nome;
        });
        setProjectNames(projectNamesMap);
        
      } else if (userProfile?.funcao === 'produtor') {
        console.log('🏭 Produtor: carregando projetos próprios e chamados relacionados');
        const [allProjects, allTickets, allUsers] = await Promise.all([
          projectService.getAllProjects(),
          ticketService.getAllTickets(),
          userService.getAllUsers()
        ]);
        
        const produtorProjects = allProjects.filter(project => 
          project.produtorId === user.uid
        );
        
        const produtorProjectIds = produtorProjects.map(p => p.id);
        const produtorTickets = allTickets.filter(ticket => 
          produtorProjectIds.includes(ticket.projetoId)
        );
        
        console.log('🔍 DEBUG Produtor (REGRAS ORIGINAIS):', {
          userId: user.uid,
          userProfile: userProfile.nome,
          totalProjects: allProjects.length,
          produtorProjects: produtorProjects.length,
          produtorProjectIds,
          totalTickets: allTickets.length,
          produtorTickets: produtorTickets.length
        });
        
        setProjects(produtorProjects);
        setTickets(produtorTickets);
        setUsers(allUsers);
        
        const projectNamesMap = {};
        produtorProjects.forEach(project => {
          projectNamesMap[project.id] = project.nome;
        });
        setProjectNames(projectNamesMap);
        
      } else if (userProfile?.funcao === 'consultor') {
        console.log('👨‍💼 Consultor: carregando projetos próprios e chamados específicos');
        const [allProjects, allTickets, allUsers] = await Promise.all([
          projectService.getAllProjects(),
          ticketService.getAllTickets(),
          userService.getAllUsers()
        ]);
        
        const consultorProjects = allProjects.filter(project => 
          project.consultorId === user.uid
        );
        
        const consultorProjectIds = consultorProjects.map(p => p.id);
        const consultorTickets = allTickets.filter(ticket => {
          const isFromConsultorProject = consultorProjectIds.includes(ticket.projetoId);
          const isOpenedByConsultor = ticket.autorId === user.uid;
          const isEscalatedToConsultor = ticket.escalonamentos?.some(esc => 
            esc.consultorId === user.uid || esc.responsavelId === user.uid
          );
          
          return isFromConsultorProject || isOpenedByConsultor || isEscalatedToConsultor;
        });
        
        setProjects(consultorProjects);
        setTickets(consultorTickets);
        setUsers(allUsers);
        
        const projectNamesMap = {};
        allProjects.forEach(project => {
          projectNamesMap[project.id] = project.nome;
        });
        setProjectNames(projectNamesMap);
        
      } else if (userProfile?.funcao === 'operador') {
        console.log('👷 Operador: carregando chamados da área específica');
        const [allProjects, allTickets, allUsers] = await Promise.all([
          projectService.getAllProjects(),
          ticketService.getAllTickets(),
          userService.getAllUsers()
        ]);
        
        const operatorTickets = allTickets.filter(ticket => {
          const isFromOperatorArea = ticket.area === userProfile.area;
          const isAssignedToOperator = ticket.atribuidoA === user.uid;
          const isInvolvedArea = ticket.areasEnvolvidas && ticket.areasEnvolvidas.includes(userProfile.area);
          
          return isFromOperatorArea || isAssignedToOperator || isInvolvedArea;
        });
        
        setProjects(allProjects);
        setTickets(operatorTickets);
        setUsers(allUsers);
        
        const projectNamesMap = {};
        allProjects.forEach(project => {
          projectNamesMap[project.id] = project.nome;
        });
        setProjectNames(projectNamesMap);
        
      } else if (userProfile?.funcao === 'gerente') {
        console.log('👔 Gerente: carregando todos os dados');
        const [allProjects, allTickets, allUsers] = await Promise.all([
          projectService.getAllProjects(),
          ticketService.getAllTickets(),
          userService.getAllUsers()
        ]);
        setProjects(allProjects);
        setTickets(allTickets);
        setUsers(allUsers);
        
        const projectNamesMap = {};
        allProjects.forEach(project => {
          projectNamesMap[project.id] = project.nome;
        });
        setProjectNames(projectNamesMap);
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authInitialized && user && userProfile && user.uid) {
      loadDashboardData();
    } else if (authInitialized && !user) {
      navigate('/login');
    } else if (authInitialized && user && !userProfile) {
      console.warn('DashboardPage: usuário logado mas perfil não carregado ainda');
      setLoading(false);
    }
  }, [user, userProfile, authInitialized, navigate]);

  useEffect(() => {
    if (tickets.length > 0 && user?.uid) {
      // ✅ 3. ALTERAÇÃO: Listener agora usa o serviço unificado.
      const unsubscribe = notificationService.subscribeToNotifications(user.uid, (allNotifications) => {
        console.log('📱 Listener de notificações do Dashboard ativado, documentos:', allNotifications.length);
        const counts = {};
        allNotifications.forEach(notification => {
          // Conta apenas as notificações não lidas que pertencem a um chamado
          if (notification.ticketId && !notification.lida) {
            counts[notification.ticketId] = (counts[notification.ticketId] || 0) + 1;
          }
        });
        console.log('📱 Contagens de notificação do Dashboard atualizadas:', counts);
        setTicketNotifications(counts);
      });
      
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }
  }, [tickets, user?.uid]);

  if (!authInitialized || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600 mb-4">Você precisa estar logado para acessar esta página.</p>
          <Button onClick={() => navigate('/login')}>
            Fazer Login
          </Button>
        </div>
      </div>
    );
  }

  const counts = getTicketCounts();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationCenter />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{userProfile?.nome}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/perfil')}>
                    <User className="h-4 w-4 mr-2" />
                    Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Olá, {userProfile?.nome}! 👋
                </h2>
                <p className="mt-1 text-gray-600">
                  Bem-vindo ao seu dashboard. Aqui você pode gerenciar seus chamados e projetos.
                </p>
              </div>
              <div className="mt-4 sm:mt-0">
                <Button onClick={() => navigate('/novo-chamado')} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Chamado
                </Button>
              </div>
            </div>
          </div>

          {/* Filter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {filterCards.map((card) => {
              const IconComponent = card.icon;
              const count = counts[card.id] || 0;
              const isActive = activeFilter === card.id;
              
              return (
                <Card 
                  key={card.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    isActive ? card.activeColor : card.color
                  } ${
                    // 🔔 NOVO: Destaque especial para o card de notificações quando há notificações
                    card.id === 'com_notificacoes_nao_lidas' && count > 0 && !isActive
                      ? 'ring-2 ring-red-400 shadow-lg animate-pulse'
                      : ''
                  }`}
                  onClick={() => setActiveFilter(card.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        isActive ? 'bg-white bg-opacity-20' : 'bg-white'
                      }`}>
                        <IconComponent className={`h-5 w-5 ${
                          isActive ? 'text-white' : card.iconColor
                        }`} />
                      </div>
                      <div>
                        <p className={`text-xs sm:text-sm font-medium ${
                          isActive ? 'text-white' : 'text-gray-900'
                        }`}>
                          {card.title}
                        </p>
                        <p className={`text-lg sm:text-xl font-bold ${
                          isActive ? 'text-white' : card.iconColor
                        }`}>
                          {count}
                          {/* 🔔 NOVO: Indicador visual extra para notificações */}
                          {card.id === 'com_notificacoes_nao_lidas' && count > 0 && (
                            <span className="ml-1 text-xs">🔔</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Active Filter Indicator */}
          {activeFilter !== 'todos' && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  Filtro ativo: {filterCards.find(c => c.id === activeFilter)?.title}
                </span>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {counts[activeFilter]} chamado{counts[activeFilter] !== 1 ? 's' : ''}
                </Badge>
                {/* 🔔 NOVO: Indicador especial para filtro de notificações */}
                {activeFilter === 'com_notificacoes_nao_lidas' && (
                  <Badge className="bg-red-500 text-white">
                    <Bell className="h-3 w-3 mr-1" />
                    Requer atenção
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveFilter('todos')}
                className="text-blue-600 hover:text-blue-800"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar filtro
              </Button>
            </div>
          )}
          
          {/* Tickets List */}
          <div className="space-y-4">
            {Object.entries(getTicketsByProject()).map(([projectName, projectTickets]) => (
              <div key={projectName} className="border rounded-lg">
                <button
                  onClick={() => toggleProjectExpansion(projectName)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    {expandedProjects[projectName] ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <div>
                      <h3 className="font-medium text-sm md:text-base">{projectName}</h3>
                      <p className="text-xs text-gray-500">
                        {projectTickets.length} chamado{projectTickets.length !== 1 ? 's' : ''}
                        {/* 🔔 NOVO: Mostrar quantas notificações não lidas há no projeto */}
                        {(() => {
                          const projectNotificationCount = projectTickets.reduce((total, ticket) => {
                            return total + (ticketNotifications[ticket.id] || 0);
                          }, 0);
                          return projectNotificationCount > 0 ? (
                            <span className="ml-2 text-red-600 font-medium">
                              • {projectNotificationCount} notificação{projectNotificationCount !== 1 ? 'ões' : ''} não lida{projectNotificationCount !== 1 ? 's' : ''}
                            </span>
                          ) : null;
                        })()}
                      </p>
                    </div>
                  </div>
                </button>
                
                {expandedProjects[projectName] && (
                  <div className="border-t bg-gray-50/50 p-4 space-y-3">
                    {projectTickets.map((ticket) => {
                      const isAwaitingApproval = ticket.status === 'aguardando_aprovacao' && 
                                               userProfile?.funcao === 'gerente' && 
                                               ticket.gerenteResponsavelId === user.uid;
                      
                      // 🔔 NOVO: Destacar chamados com notificações não lidas
                      const hasUnreadNotifications = ticketNotifications[ticket.id] && ticketNotifications[ticket.id] > 0;
                      
                      const cardClassName = `${bulkActionMode ? 'cursor-default' : 'cursor-pointer hover:shadow-md'} transition-shadow ${
                        isAwaitingApproval 
                          ? 'bg-orange-50 border-2 border-orange-400 shadow-lg ring-2 ring-orange-200' 
                          : hasUnreadNotifications && activeFilter === 'com_notificacoes_nao_lidas'
                            ? 'bg-red-50 border-2 border-red-300 shadow-lg'
                            : 'bg-white'
                      } ${selectedTickets.has(ticket.id) ? 'ring-2 ring-blue-500' : ''}`;
                      
                      return (
                      <Card 
                        key={ticket.id} 
                        className={cardClassName}
                        onClick={bulkActionMode ? undefined : () => handleTicketClick(ticket.id)}
                      >
                        <CardContent className="p-3 md:p-4">
                          <div className="flex flex-col space-y-3">
                            <div className="flex items-start justify-between">
                              {bulkActionMode && (
                                <div className="flex items-center mr-3">
                                  <Checkbox
                                    checked={selectedTickets.has(ticket.id)}
                                    onCheckedChange={(checked) => handleTicketSelect(ticket.id, checked)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-sm md:text-base truncate">{ticket.titulo}</h3>
                                  {ticketNotifications[ticket.id] && (
                                    <Badge className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                      {ticketNotifications[ticket.id]}
                                    </Badge>
                                  )}
                                  {isAwaitingApproval && (
                                    <Badge className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                                      APROVAÇÃO
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ticket.descricao}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <Badge className={getStatusColor(ticket.status)}>
                                {ticket.status?.replace('_', ' ').toUpperCase()}
                              </Badge>
                              <Badge className={getPriorityColor(ticket.prioridade)}>
                                {ticket.prioridade?.toUpperCase()}
                              </Badge>
                              {ticket.area && (
                                <Badge variant="outline">
                                  {ticket.area.replace('_', ' ').toUpperCase()}
                                </Badge>
                              )}
                              <span className="text-gray-400">
                                {ticket.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') || 'Data não disponível'}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            
            {getDisplayedTickets().length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {activeFilter === 'com_notificacoes_nao_lidas' 
                    ? 'Nenhum chamado com notificações não lidas'
                    : 'Nenhum chamado encontrado'
                  }
                </h3>
                <p className="text-gray-600">
                  {activeFilter === 'com_notificacoes_nao_lidas'
                    ? 'Todos os seus chamados estão em dia! 🎉'
                    : activeFilter === 'todos'
                      ? 'Comece criando seu primeiro chamado.'
                      : `Não há chamados com o filtro "${filterCards.find(c => c.id === activeFilter)?.title}".`
                  }
                </p>
                {activeFilter === 'todos' && (
                  <Button onClick={() => navigate('/novo-chamado')} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Chamado
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
