import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { projectService } from '../services/projectService';
import { ticketService } from '../services/ticketService';
import { userService } from '../services/userService';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import NotificationCenter from '../components/NotificationCenter';
import {
  Calendar,
  Users,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  BarChart3,
  PlusCircle,
  Search,
  Filter,
  Settings,
  Eye,
  ChevronDown,
  ChevronUp,
  Grid3X3,
  List,
  Save,
  X,
  Bookmark,
  BookmarkCheck,
  MoreVertical,
  Trash2,
  Edit,
  Star,
  StarOff
} from 'lucide-react';

const DashboardPage = () => {
  const { user } = useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();

  // Estados principais
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [expandedProjects, setExpandedProjects] = useState({});

  // Novos estados para as funcionalidades solicitadas
  const [savedFilters, setSavedFilters] = useState([]);
  const [showSaveFilterDialog, setShowSaveFilterDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [favoriteFilters, setFavoriteFilters] = useState([]);
  const [quickFilters, setQuickFilters] = useState([]);
  const [viewMode, setViewMode] = useState('cards');

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [projectsData, ticketsData, usersData] = await Promise.all([
          projectService.getAllProjects(),
          ticketService.getAllTickets(),
          userService.getAllUsers()
        ]);

        setProjects(projectsData || []);
        setTickets(ticketsData || []);
        setUsers(usersData || []);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setError('Erro ao carregar dados do dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (user && userProfile) {
      loadData();
    }
  }, [user, userProfile]);

  // Listener em tempo real para tickets
  useEffect(() => {
    if (!user || !userProfile) return;

    let unsubscribe;

    try {
      const ticketsRef = collection(db, 'tickets');
      let q;

      if (userProfile.funcao === 'administrador' || userProfile.funcao === 'gerente') {
        q = query(ticketsRef);
      } else {
        q = query(
          ticketsRef,
          where('criadoPor', '==', user.uid)
        );
      }

      unsubscribe = onSnapshot(q, (snapshot) => {
        const ticketsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTickets(ticketsData);
      }, (error) => {
        console.error('Erro no listener de tickets:', error);
      });
    } catch (error) {
      console.error('Erro ao configurar listener:', error);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, userProfile]);

  // Função para obter cor do status
  const getStatusColor = (status) => {
    const colors = {
      'aberto': 'bg-blue-100 text-blue-800',
      'em_tratativa': 'bg-yellow-100 text-yellow-800',
      'em_execucao': 'bg-purple-100 text-purple-800',
      'executado_aguardando_validacao': 'bg-orange-100 text-orange-800',
      'concluido': 'bg-green-100 text-green-800',
      'cancelado': 'bg-red-100 text-red-800',
      'arquivado': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Função para obter cor da prioridade
  const getPriorityColor = (priority) => {
    const colors = {
      'baixa': 'bg-green-100 text-green-800',
      'media': 'bg-yellow-100 text-yellow-800',
      'alta': 'bg-orange-100 text-orange-800',
      'urgente': 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  // Função para obter texto do status
  const getStatusText = (status) => {
    const statusTexts = {
      'aberto': 'Aberto',
      'em_tratativa': 'Em Tratativa',
      'em_execucao': 'Em Execução',
      'executado_aguardando_validacao': 'Aguardando Validação',
      'concluido': 'Concluído',
      'cancelado': 'Cancelado',
      'arquivado': 'Arquivado'
    };
    return statusTexts[status] || status;
  };

  // Filtrar tickets
  const filteredTickets = useMemo(() => {
    let filtered = tickets.filter(ticket => {
      if (!showArchived && ticket.status === 'arquivado') return false;
      
      if (searchTerm && !ticket.titulo.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (selectedProject && ticket.projetoId !== selectedProject) return false;
      if (selectedStatus && ticket.status !== selectedStatus) return false;
      if (selectedArea && ticket.area !== selectedArea) return false;
      if (selectedPriority && ticket.prioridade !== selectedPriority) return false;
      if (selectedUser && ticket.criadoPor !== selectedUser) return false;

      return true;
    });

    // Aplicar filtro ativo
    if (activeFilter !== 'todos') {
      filtered = filtered.filter(ticket => {
        switch (activeFilter) {
          case 'abertos':
            return ['aberto', 'em_tratativa', 'em_execucao'].includes(ticket.status);
          case 'concluidos':
            return ticket.status === 'concluido';
          case 'urgentes':
            return ticket.prioridade === 'urgente';
          case 'meus':
            return ticket.criadoPor === user?.uid;
          case 'atribuidos':
            return ticket.atribuidoA === user?.uid;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [tickets, searchTerm, selectedProject, selectedStatus, selectedArea, selectedPriority, selectedUser, showArchived, activeFilter, user]);

  // Calcular estatísticas
  const stats = useMemo(() => {
    const totalTickets = filteredTickets.length;
    const openTickets = filteredTickets.filter(t => ['aberto', 'em_tratativa', 'em_execucao'].includes(t.status)).length;
    const completedTickets = filteredTickets.filter(t => t.status === 'concluido').length;
    const urgentTickets = filteredTickets.filter(t => t.prioridade === 'urgente').length;

    return {
      totalTickets,
      openTickets,
      completedTickets,
      urgentTickets,
      completionRate: totalTickets > 0 ? Math.round((completedTickets / totalTickets) * 100) : 0
    };
  }, [filteredTickets]);

  // Cards de filtros
  const filterCards = [
    { id: 'todos', title: 'Todos os Chamados', icon: FileText, color: 'blue' },
    { id: 'abertos', title: 'Em Andamento', icon: Clock, color: 'yellow' },
    { id: 'concluidos', title: 'Concluídos', icon: CheckCircle, color: 'green' },
    { id: 'urgentes', title: 'Urgentes', icon: AlertCircle, color: 'red' },
    { id: 'meus', title: 'Meus Chamados', icon: Users, color: 'purple' },
    { id: 'atribuidos', title: 'Atribuídos a Mim', icon: Star, color: 'orange' }
  ];

  // Contar tickets por filtro
  const getFilterCount = (filterId) => {
    switch (filterId) {
      case 'todos':
        return tickets.filter(t => !showArchived ? t.status !== 'arquivado' : true).length;
      case 'abertos':
        return tickets.filter(t => ['aberto', 'em_tratativa', 'em_execucao'].includes(t.status)).length;
      case 'concluidos':
        return tickets.filter(t => t.status === 'concluido').length;
      case 'urgentes':
        return tickets.filter(t => t.prioridade === 'urgente').length;
      case 'meus':
        return tickets.filter(t => t.criadoPor === user?.uid).length;
      case 'atribuidos':
        return tickets.filter(t => t.atribuidoA === user?.uid).length;
      default:
        return 0;
    }
  };

  // Agrupar tickets por projeto
  const getTicketsByProject = () => {
    const grouped = {};
    filteredTickets.forEach(ticket => {
      const project = projects.find(p => p.id === ticket.projetoId);
      const projectName = project ? project.nome : 'Sem Projeto';
      
      if (!grouped[projectName]) {
        grouped[projectName] = [];
      }
      grouped[projectName].push(ticket);
    });
    return grouped;
  };

  // Toggle expansão do projeto
  const toggleProjectExpansion = (projectName) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectName]: !prev[projectName]
    }));
  };

  // Navegar para ticket
  const handleTicketClick = (ticketId) => {
    navigate('/chamado/' + ticketId);
  };

  // Limpar filtros
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedProject('');
    setSelectedStatus('');
    setSelectedArea('');
    setSelectedPriority('');
    setSelectedUser('');
    setDateRange('');
    setActiveFilter('todos');
  };

  // Tickets para exibir (limitados se necessário)
  const displayedTickets = filteredTickets.slice(0, 50);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Dashboard
            </h1>
            <p className="text-slate-600 mt-1">
              Bem-vindo, {userProfile?.nome || user?.displayName || 'Usuário'}!
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <Button
              onClick={() => navigate('/novo-chamado')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl px-6 py-3"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Novo Chamado
            </Button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total de Chamados</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalTickets}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Em Andamento</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.openTickets}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-xl">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Concluídos</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.completedTickets}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Urgentes</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.urgentTickets}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-xl">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg rounded-2xl">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar chamados..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 rounded-xl border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-40 rounded-xl border-slate-300">
                    <SelectValue placeholder="Projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os Projetos</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-40 rounded-xl border-slate-300">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os Status</SelectItem>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="em_tratativa">Em Tratativa</SelectItem>
                    <SelectItem value="em_execucao">Em Execução</SelectItem>
                    <SelectItem value="executado_aguardando_validacao">Aguardando Validação</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="archived"
                    checked={showArchived}
                    onCheckedChange={setShowArchived}
                  />
                  <label htmlFor="archived" className="text-sm text-slate-600">
                    Mostrar Arquivados
                  </label>
                </div>

                {/* Toggle de visualização */}
                <div className="flex items-center bg-slate-100 rounded-xl p-1">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-lg"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                    className="rounded-lg"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </div>

                {(searchTerm || selectedProject || selectedStatus || selectedArea || selectedPriority || selectedUser) && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="rounded-xl border-slate-300 hover:bg-slate-50"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de filtros elegantes e responsivos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {filterCards.map((card) => {
            const IconComponent = card.icon;
            const isActive = activeFilter === card.id;
            const count = getFilterCount(card.id);
            
            return (
              <Card
                key={card.id}
                className={'cursor-pointer transition-all duration-300 transform hover:scale-105 ' + (
                  isActive 
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-500 shadow-lg shadow-blue-500/25' 
                    : 'bg-white/80 backdrop-blur-sm hover:bg-white border-slate-200/60 hover:border-slate-300 shadow-sm hover:shadow-md'
                ) + ' rounded-2xl overflow-hidden'}
                onClick={() => setActiveFilter(card.id)}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className={'p-3 rounded-xl ' + (
                      isActive 
                        ? 'bg-white/20 backdrop-blur-sm' 
                        : 'bg-gradient-to-br from-slate-100 to-slate-200'
                    )}>
                      <IconComponent 
                        className={'h-6 w-6 ' + (
                          isActive ? 'text-white' : 'text-slate-600'
                        )} 
                      />
                    </div>
                    <div className="space-y-1">
                      <p className={'text-xs sm:text-sm font-medium leading-tight ' + (
                        isActive ? 'text-white/90' : 'text-slate-700'
                      )}>
                        {card.title}
                      </p>
                      <p className={'text-xl sm:text-2xl font-bold ' + (
                        isActive ? 'text-white' : 'text-slate-900'
                      )}>
                        {count}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Indicador de filtro ativo */}
        {activeFilter !== 'todos' && (
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-sm border border-blue-200/60 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Filter className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <span className="text-sm font-semibold text-blue-900">
                  Filtro ativo: {filterCards.find(c => c.id === activeFilter)?.title}
                </span>
                <p className="text-xs text-blue-700">
                  {filteredTickets.length} chamado(s) encontrado(s)
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilter('todos')}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-100/50 rounded-xl"
            >
              <X className="h-4 w-4 mr-1" />
              Remover
            </Button>
          </div>
        )}
        
        {/* Visualização dos chamados */}
        {viewMode === 'list' ? (
          <Card className="overflow-hidden rounded-2xl border-slate-200/60 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                      <TableHead className="font-semibold text-slate-700 px-6 py-4">Título</TableHead>
                      <TableHead className="font-semibold text-slate-700 px-6 py-4">Projeto</TableHead>
                      <TableHead className="font-semibold text-slate-700 px-6 py-4">Status</TableHead>
                      <TableHead className="font-semibold text-slate-700 px-6 py-4">Prioridade</TableHead>
                      <TableHead className="font-semibold text-slate-700 px-6 py-4">Criado em</TableHead>
                      <TableHead className="font-semibold text-slate-700 px-6 py-4 text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedTickets.map((ticket) => {
                      const project = projects.find(p => p.id === ticket.projetoId);
                      return (
                        <TableRow 
                          key={ticket.id}
                          className="hover:bg-slate-50/80 transition-colors duration-200 border-b border-slate-100 cursor-pointer"
                          onClick={() => handleTicketClick(ticket.id)}
                        >
                          <TableCell className="px-6 py-4">
                            <div className="font-medium text-slate-900">{ticket.titulo}</div>
                            <div className="text-sm text-slate-500 truncate max-w-xs">
                              {ticket.descricao}
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <span className="text-sm text-slate-600">
                              {project?.nome || 'Sem projeto'}
                            </span>
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <Badge className={'text-xs px-3 py-1 rounded-xl font-medium ' + getStatusColor(ticket.status)}>
                              {getStatusText(ticket.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <Badge className={'text-xs px-3 py-1 rounded-xl font-medium ' + getPriorityColor(ticket.prioridade)}>
                              {ticket.prioridade}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-sm text-slate-600">
                            {ticket.criadoEm ? new Date(ticket.criadoEm.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A'}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center">
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                
                {displayedTickets.length === 0 && (
                  <div className="p-8 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {activeFilter === 'todos' ? 'Nenhum chamado encontrado' : 'Nenhum chamado neste filtro'}
                    </h3>
                    <p className="text-gray-500">
                      {activeFilter === 'todos' 
                        ? 'Não há chamados para exibir no momento.' 
                        : 'Não há chamados com o filtro "' + (filterCards.find(c => c.id === activeFilter)?.title || '') + '" aplicado.'
                      }
                    </p>
                    {activeFilter !== 'todos' && (
                      <Button
                        variant="outline"
                        onClick={() => setActiveFilter('todos')}
                        className="rounded-xl px-6 py-3 bg-white hover:bg-slate-50 border-slate-300 hover:border-slate-400 transition-all duration-200"
                      >
                        Ver Todos os Chamados
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(getTicketsByProject()).map(([projectName, projectTickets]) => (
                <Card key={projectName} className="overflow-hidden rounded-2xl border-slate-200/60 shadow-lg bg-white/80 backdrop-blur-sm">
                  <button
                    onClick={() => toggleProjectExpansion(projectName)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50/80 transition-all duration-200"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                        <Calendar className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{projectName}</h3>
                        <p className="text-sm text-slate-600">{projectTickets.length} chamado(s)</p>
                      </div>
                    </div>
                    {expandedProjects[projectName] ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </button>

                  {expandedProjects[projectName] && (
                    <div className="border-t border-slate-200/60 bg-slate-50/30">
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projectTickets.map((ticket) => (
                          <Card
                            key={ticket.id}
                            className={'cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-2xl overflow-hidden ' + (
                              ticket.prioridade === 'urgente'
                                ? 'border-red-200 bg-gradient-to-br from-red-50 to-pink-50 hover:border-red-300'
                                : 'bg-white/90 backdrop-blur-sm border-slate-200/60 hover:border-slate-300'
                            )}
                            onClick={() => handleTicketClick(ticket.id)}
                          >
                            <CardContent className="p-5">
                              <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                  <h4 className="font-semibold text-slate-900 leading-tight line-clamp-2">
                                    {ticket.titulo}
                                  </h4>
                                  {ticket.prioridade === 'urgente' && (
                                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 ml-2" />
                                  )}
                                </div>
                                
                                <p className="text-sm text-slate-600 line-clamp-2">
                                  {ticket.descricao}
                                </p>
                                
                                <div className="flex flex-wrap gap-2">
                                  <Badge className={'text-xs px-3 py-1 rounded-xl font-medium ' + getStatusColor(ticket.status)}>
                                    {getStatusText(ticket.status)}
                                  </Badge>
                                  <Badge className={'text-xs px-3 py-1 rounded-xl font-medium ' + getPriorityColor(ticket.prioridade)}>
                                    {ticket.prioridade}
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span>
                                    {ticket.criadoEm ? new Date(ticket.criadoEm.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A'}
                                  </span>
                                  <span className="flex items-center">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Ver detalhes
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))}

              {Object.keys(getTicketsByProject()).length === 0 && (
                <Card className="rounded-2xl border-slate-200/60 bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-12 text-center">
                    <FileText className="h-16 w-16 text-slate-400 mx-auto mb-6" />
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">
                      {activeFilter === 'todos' ? 'Nenhum chamado encontrado' : 'Nenhum chamado neste filtro'}
                    </h3>
                    <p className="text-slate-500 mb-6">
                      {activeFilter === 'todos' 
                        ? 'Não há chamados para exibir no momento.' 
                        : 'Não há chamados com o filtro "' + (filterCards.find(c => c.id === activeFilter)?.title || '') + '" aplicado.'
                      }
                    </p>
                    {activeFilter !== 'todos' && (
                      <Button
                        variant="outline"
                        onClick={() => setActiveFilter('todos')}
                        className="mt-4"
                      >
                        Ver Todos os Chamados
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
      </div>
    </div>
  );
};

export default DashboardPage;

