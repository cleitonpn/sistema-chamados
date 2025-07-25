import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { ticketService } from '../services/ticketService';
import { userService } from '../services/userService';
import notificationService from '../services/notificationService';
import { collection, query, where, onSnapshot } from 'firebase/firestore'; // onSnapshot já está aqui, ótimo!
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
  BellRing,
  Lock
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

  const [activeFilter, setActiveFilter] = useState('todos');

  // Função para buscar nome do projeto
  const getProjectName = (projetoId) => {
    return projectNames[projetoId] || 'Projeto não encontrado';
  };

  // Função para filtrar chamados baseado no filtro ativo
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
      case 'devolvido':
        filteredTickets = filteredTickets.filter(ticket => 
          ticket.status === 'devolvido' || 
          (ticket.historico && ticket.historico.some(h => h.acao === 'devolvido'))
        );
        break;
      case 'aguardando_validacao':
        filteredTickets = filteredTickets.filter(ticket => 
          ticket.status === 'executado_aguardando_validacao'
        );
        break;
      case 'concluidos':
        filteredTickets = filteredTickets.filter(ticket => ticket.status === 'concluido');
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

  // Função para contar chamados por categoria
  const getTicketCounts = () => {
    const counts = {
      todos: tickets.length,
      com_notificacao: Object.keys(ticketNotifications).length,
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
      concluidos: tickets.filter(t => t.status === 'concluido').length
    };
    return counts;
  };

  // Configuração dos cards de filtro
  const filterCards = [
    { id: 'todos', title: 'Todos', icon: FileText, color: 'bg-blue-50 border-blue-200 hover:bg-blue-100', iconColor: 'text-blue-600', activeColor: 'bg-blue-500 text-white border-blue-500' },
    { id: 'com_notificacao', title: 'Notificações', icon: BellRing, color: 'bg-red-50 border-red-200 hover:bg-red-100', iconColor: 'text-red-600', activeColor: 'bg-red-500 text-white border-red-500' },
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

  useEffect(() => {
    if (authInitialized && !user) {
      navigate('/login');
    }
  }, [authInitialized, user, navigate]);

  // ✅ NOVO useEffect para carregar dados e configurar listeners em tempo real
  useEffect(() => {
    if (!authInitialized || !user || !userProfile) {
      // Se não estiver autenticado ou o perfil não carregou, não faz nada
      if (authInitialized && user && !userProfile) setLoading(false);
      return;
    }

    setLoading(true);
    console.log('🔄 Configurando listeners em tempo real para:', userProfile.funcao);

    // Carrega dados que não precisam de atualização em tempo real (ou com menor frequência)
    const loadStaticData = async () => {
      try {
        const [allProjects, allUsers] = await Promise.all([
          projectService.getAllProjects(),
          userService.getAllUsers()
        ]);

        const projectNamesMap = {};
        allProjects.forEach(project => {
          projectNamesMap[project.id] = project.nome;
        });
        setProjectNames(projectNamesMap);

        // Filtra projetos baseado na função do usuário
        let userProjects = allProjects;
        if (userProfile.funcao === 'produtor') {
            userProjects = allProjects.filter(p => p.produtorId === user.uid);
        } else if (userProfile.funcao === 'consultor') {
            userProjects = allProjects.filter(p => p.consultorId === user.uid);
        }
        setProjects(userProjects);
        setUsers(allUsers);

      } catch (error) {
        console.error('❌ Erro ao carregar dados estáticos (projetos, usuários):', error);
      }
    };

    loadStaticData();

    // Define a consulta (query) base para os chamados
    const ticketsCollection = collection(db, 'chamados');
    let ticketsQuery = query(ticketsCollection); // Por padrão, busca todos
    
    // Adapta a query de acordo com a função do usuário
    // IMPORTANTE: Adapte essas regras `where` para corresponderem exatamente às regras de segurança do seu Firestore.
    if (userProfile.funcao === 'operador') {
      ticketsQuery = query(ticketsCollection, where('areasEnvolvidas', 'array-contains', userProfile.area));
    } else if (userProfile.funcao === 'produtor') {
      // Produtor vê chamados dos seus projetos. Isso requer carregar os projetos primeiro.
      // A lógica de filtro pós-busca será mantida por simplicidade, mas o ideal seria otimizar a query.
      // Esta parte continua filtrando no cliente após a busca.
    } else if (userProfile.funcao === 'consultor') {
       // Consultor vê chamados que criou ou que são de seus projetos.
       // O Firestore não permite queries com 'OU' em campos diferentes. 
       // Manteremos a filtragem no cliente.
    } else if (userProfile.funcao === 'usuario_padrao') {
       ticketsQuery = query(ticketsCollection, where('criadoPor', '==', user.uid));
    }
    // Admin e Gerente continuam com a query que busca todos os chamados.

    // Configura o listener em tempo real
    const unsubscribe = onSnapshot(ticketsQuery, (querySnapshot) => {
      let fetchedTickets = [];
      querySnapshot.forEach((doc) => {
        fetchedTickets.push({ id: doc.id, ...doc.data() });
      });

      console.log(`Real-time update: ${fetchedTickets.length} chamados recebidos.`);
      
      // ✅ INÍCIO DA LÓGICA DE FILTRAGEM PÓS-BUSCA (já existente)
      // Esta lógica é necessária para regras complexas que não podem ser feitas em uma única query do Firestore.
      const filterConfidential = (ticket) => {
        if (!ticket.isConfidential) return true;
        const isCreator = ticket.criadoPor === user.uid;
        const isAdmin = userProfile?.funcao === 'administrador';
        return isCreator || isAdmin;
      };

      let finalTickets = fetchedTickets;

      if (userProfile.funcao === 'produtor') {
        const produtorProjectIds = projects.map(p => p.id);
        finalTickets = fetchedTickets.filter(ticket => 
            produtorProjectIds.includes(ticket.projetoId) && filterConfidential(ticket)
        );
      } else if (userProfile.funcao === 'consultor') {
          const consultorProjectIds = projects.map(p => p.id);
          finalTickets = fetchedTickets.filter(ticket => {
            const isFromConsultorProject = consultorProjectIds.includes(ticket.projetoId);
            const isOpenedByConsultor = ticket.criadoPor === user.uid;
            const isEscalatedToConsultor = ticket.escalonamentos?.some(esc => 
              esc.consultorId === user.uid || esc.responsavelId === user.uid
            );
            return (isFromConsultorProject || isOpenedByConsultor || isEscalatedToConsultor) && filterConfidential(ticket);
        });
      } else if (userProfile.funcao !== 'operador' && userProfile.funcao !== 'administrador' && userProfile.funcao !== 'gerente') {
        // Filtro de confidencialidade para outras funções que veem todos os chamados inicialmente
        finalTickets = fetchedTickets.filter(filterConfidential);
      }
      // Operadores já são filtrados pela query e podem ver chamados confidenciais de sua área.
      // Admins/Gerentes veem tudo.

      setTickets(finalTickets);
      // ✅ FIM DA LÓGICA DE FILTRAGEM

      if (loading) setLoading(false); // Para o loading inicial apenas na primeira carga
    }, (error) => {
      console.error("❌ Erro no listener de chamados: ", error);
      setLoading(false);
    });

    // Função de limpeza: será chamada quando o componente for desmontado
    return () => {
      console.log('Unsubscribing from ticket updates.');
      unsubscribe();
    };

  }, [authInitialized, user, userProfile, navigate, projects]); // `projects` é uma dependência para o filtro de produtor/consultor


  useEffect(() => {
    if (tickets.length > 0 && user?.uid) {
      const unsubscribe = notificationService.subscribeToNotifications(user.uid, (allNotifications) => {
        const counts = {};
        allNotifications.forEach(notification => {
          if (notification.ticketId && !notification.lida) {
            counts[notification.ticketId] = (counts[notification.ticketId] || 0) + 1;
          }
        });
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const counts = getTicketCounts();

  // O RESTANTE DO SEU CÓDIGO JSX CONTINUA IGUAL...
  // ...
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ... O seu JSX a partir daqui ... */}
      <div className={`${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <h1 className="text-xl font-semibold text-gray-900">Gestão de Chamados</h1>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {(userProfile?.funcao === 'produtor' || userProfile?.funcao === 'consultor' || userProfile?.funcao === 'administrador' || 
              (userProfile?.funcao === 'operador' && userProfile?.area === 'operacional') ||
              (userProfile?.funcao === 'operador' && userProfile?.area === 'comunicacao_visual') ||
              (userProfile?.funcao === 'operador' && userProfile?.area === 'almoxarifado')) && (
              <Button 
                onClick={() => navigate('/novo-chamado')}
                className="w-full justify-start mb-4"
              >
                <Plus className="h-4 w-4 mr-3" />
                Novo Chamado
              </Button>
            )}
            
            {userProfile?.funcao === 'administrador' && (
              <Button 
                onClick={() => navigate('/novo-projeto')}
                variant="outline"
                className="w-full justify-start mb-4"
              >
                <Plus className="h-4 w-4 mr-3" />
                Novo Projeto
              </Button>
            )}
            
            <Button 
              onClick={() => navigate('/projetos')}
              variant="ghost"
              className="w-full justify-start"
            >
              <FolderOpen className="h-4 w-4 mr-3" />
              Ver Projetos
            </Button>
            
            <Button 
              onClick={() => navigate('/cronograma')}
              variant="ghost"
              className="w-full justify-start"
            >
              <Calendar className="h-4 w-4 mr-3" />
              Cronograma
            </Button>
            
            {userProfile?.funcao === 'administrador' && (
              <>
                <Button 
                  onClick={() => navigate('/eventos')}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <Calendar className="h-4 w-4 mr-3" />
                  Eventos
                </Button>
                
                <Button 
                  onClick={() => navigate('/usuarios')}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <Users className="h-4 w-4 mr-3" />
                  Usuários
                </Button>
                
                <Button 
                  onClick={() => navigate('/relatorios')}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <BarChart3 className="h-4 w-4 mr-3" />
                  Relatórios
                </Button>
                
                <Button 
                  onClick={() => navigate('/analytics')}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <BarChart3 className="h-4 w-4 mr-3" />
                  Analytics
                </Button>
                
                <Button 
                  onClick={() => navigate('/admin/painel')}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <BarChart3 className="h-4 w-4 mr-3" />
                  Painel Admin
                </Button>
              </>
            )}
          </div>
        </nav>
        
        <div className="absolute bottom-0 w-full p-4 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start">
                <User className="h-4 w-4 mr-3" />
                {userProfile?.nome || user?.email}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
                <p className="text-sm text-gray-500">
                  Bem-vindo, {userProfile?.nome || user?.email} ({userProfile?.funcao})
                </p>
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
              <TabsTrigger value="chamados" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Chamados</span>
              </TabsTrigger>
              <TabsTrigger value="projetos" className="flex items-center space-x-2">
                <FolderOpen className="h-4 w-4" />
                <span>Projetos</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chamados" className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-3 mb-6">
                {filterCards.map((card) => {
                  const IconComponent = card.icon;
                  const isActive = activeFilter === card.id;
                  const count = counts[card.id];
                  
                  return (
                    <Card
                      key={card.id}
                      className={`cursor-pointer transition-all duration-200 ${
                        isActive ? card.activeColor : card.color
                      } hover:shadow-md`}
                      onClick={() => setActiveFilter(card.id)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col items-center text-center space-y-2">
                          <IconComponent 
                            className={`h-5 w-5 sm:h-6 sm:w-6 ${
                              isActive ? 'text-white' : card.iconColor
                            }`} 
                          />
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
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

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
                          <p className="text-xs text-gray-500">{projectTickets.length} chamado{projectTickets.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </button>
                    
                    {expandedProjects[projectName] && (
                      <div className="border-t bg-gray-50/50 p-4 space-y-3">
                        {projectTickets.map((ticket) => {
                          const isAwaitingApproval = ticket.status === 'aguardando_aprovacao' && 
                                                   userProfile?.funcao === 'gerente' && 
                                                   ticket.gerenteResponsavelId === user.uid;
                          
                          const cardClassName = `${bulkActionMode ? 'cursor-default' : 'cursor-pointer hover:shadow-md'} transition-shadow ${
                            isAwaitingApproval 
                              ? 'bg-orange-50 border-2 border-orange-400 shadow-lg ring-2 ring-orange-200' 
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
                                      {ticket.isConfidential && (
                                        <Lock className="h-4 w-4 text-orange-500 flex-shrink-0" title="Chamado Confidencial" />
                                      )}
                                      <h3 className="font-medium text-sm md:text-base truncate">{ticket.titulo}</h3>
                                      {ticketNotifications[ticket.id] && (
                                        <Badge className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                          {ticketNotifications[ticket.id]}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs md:text-sm text-gray-600 mt-1 line-clamp-2">{ticket.descricao}</p>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                                    <div className="text-right text-xs text-gray-500">
                                      <div className="flex flex-col items-end">
                                        <span className="font-medium">
                                          {(ticket.dataUltimaAtualizacao?.toDate?.() || ticket.createdAt?.toDate?.())?.toLocaleDateString('pt-BR') || 'N/A'}
                                        </span>
                                        <span className="text-xs opacity-75">
                                          {(ticket.dataUltimaAtualizacao?.toDate?.() || ticket.createdAt?.toDate?.())?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || ''}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTicketClick(ticket.id);
                                      }}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className={`${getStatusColor(ticket.status)} text-xs`}>
                                    {ticket.status?.replace('_', ' ')}
                                  </Badge>
                                  <Badge className={`${getPriorityColor(ticket.prioridade)} text-xs`}>
                                    {ticket.prioridade}
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {ticket.area?.replace('_', ' ')}
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
                
                {Object.keys(getTicketsByProject()).length === 0 && (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {activeFilter === 'todos' ? 'Nenhum chamado encontrado' : 'Nenhum chamado neste filtro'}
                      </h3>
                      <p className="text-gray-500">
                        {activeFilter === 'todos' 
                          ? 'Não há chamados para exibir no momento.' 
                          : `Não há chamados com o filtro "${filterCards.find(c => c.id === activeFilter)?.title}" aplicado.`
                        }
                      </p>
                      {activeFilter !== 'todos' && (
                        <Button
                          variant="outline"
                          onClick={() => setActiveFilter('todos')}
                          className="mt-4"
                        >
                          Ver todos os chamados
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="projetos" className="space-y-6">
              <div className="space-y-4">
                {Object.entries(getProjectsByEvent()).map(([eventName, eventProjects]) => (
                  <div key={eventName} className="border rounded-lg">
                    <button
                      onClick={() => toggleEventExpansion(eventName)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        {expandedEvents[eventName] ? (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        )}
                        <h3 className="font-semibold text-lg">{eventName}</h3>
                        <Badge variant="secondary" className="ml-2">
                          {eventProjects.length} projeto{eventProjects.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </button>
                    
                    {expandedEvents[eventName] && (
                      <div className="border-t bg-gray-50/50 p-4 space-y-3">
                        {eventProjects.map((project) => (
                          <Card 
                            key={project.id} 
                            className="cursor-pointer hover:shadow-md transition-shadow bg-white"
                            onClick={() => handleProjectClick(project)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                  <h4 className="font-medium">{project.nome}</h4>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline">
                                      {project.status?.replace('_', ' ')}
                                    </Badge>
                                    <span className="text-xs text-gray-500">
                                      {project.local}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right text-xs text-gray-500">
                                  <div>
                                    {project.dataInicio && new Date(project.dataInicio.seconds * 1000).toLocaleDateString('pt-BR')}
                                  </div>
                                  <div>
                                    {project.dataFim && new Date(project.dataFim.seconds * 1000).toLocaleDateString('pt-BR')}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                {Object.keys(getProjectsByEvent()).length === 0 && (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum projeto encontrado</h3>
                      <p className="text-gray-500">Não há projetos para exibir no momento.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
