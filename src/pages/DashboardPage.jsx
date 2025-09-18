import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { ticketService } from '../services/ticketService';
import { userService } from '../services/userService';
import notificationService from '../services/notificationService';

// ShadCN UI & Lucide Icons
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import NotificationCenter from '../components/NotificationCenter'; // Assumindo que este componente existe
import {
  LogOut, Plus, AlertCircle, Clock, CheckCircle, Users, FolderOpen, BarChart3, Menu, X, Eye,
  Filter, RotateCcw, Lock, Search, Bookmark, Grid, List, Save, ChevronDown, ChevronRight,
  FileText, Calendar, ArrowUp, Hourglass, UserCheck, Play, BellRing, Archive
} from 'lucide-react';

// Otimização: Mover componentes estáticos para fora do render principal
const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-slate-50">
    <div className="text-center">
      <div className="mx-auto h-16 w-16 animate-spin rounded-full border-b-2 border-t-2 border-blue-600"></div>
      <p className="mt-4 text-slate-600">Carregando dashboard...</p>
    </div>
  </div>
);

const DashboardPage = () => {
  const { user, userProfile, logout, authInitialized } = useAuth();
  const navigate = useNavigate();

  // --- ESTADOS DO COMPONENTE ---
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectNames, setProjectNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ticketNotifications, setTicketNotifications] = useState({});
  
  // Estados para filtros e visualização
  const [activeFilter, setActiveFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [sortBy, setSortBy] = useState('dataUltimaAtualizacao');
  const [quickFilters, setQuickFilters] = useState({ status: [], area: [], prioridade: [] });
  const [viewMode, setViewMode] = useState('cards'); // 'cards' ou 'list'
  
  // Estados para filtros salvos
  const [savedFilters, setSavedFilters] = useState([]);
  const [showSaveFilterDialog, setShowSaveFilterDialog] = useState(false);
  const [filterName, setFilterName] = useState('');

  // Estados para UI de Cards aninhados
  const [expandedProjects, setExpandedProjects] = useState({});

  // --- LÓGICA DE NEGÓCIO E HELPERS (INTACTA) ---
  const ticketHasAnyProject = (t, ids) => {
    if (!ids || ids.length === 0) return false;
    const ticketProjectIds = Array.isArray(t.projetos) && t.projetos.length ? t.projetos : (t.projetoId ? [t.projetoId] : []);
    return ticketProjectIds.some(id => ids.includes(id));
  };
  
  const getProjectName = (projetoId) => {
    const project = projects.find(p => p.id === projetoId);
    if (project) return project.feira ? `${project.nome} – ${project.feira}` : project.nome;
    return projectNames[projetoId] || 'Projeto não encontrado';
  };

  const getAllUniqueValues = (key) => [...new Set(tickets.map(t => t[key]).filter(Boolean))].sort();
  const allEvents = useMemo(() => [...new Set(projects.map(p => p.feira).filter(Boolean))].sort(), [projects]);
  const allAreas = useMemo(() => getAllUniqueValues('area'), [tickets]);
  const allStatus = useMemo(() => getAllUniqueValues('status'), [tickets]);
  const allPriorities = useMemo(() => getAllUniqueValues('prioridade'), [tickets]);

  // --- FILTRAGEM E ORDENAÇÃO (Otimizado com useMemo) ---
  const filteredAndSortedTickets = useMemo(() => {
    let filtered = tickets;

    // Filtro principal (abas)
    if (activeFilter === 'arquivados') {
      filtered = tickets.filter(t => t.status === 'arquivado');
    } else {
      filtered = filtered.filter(t => t.status !== 'arquivado'); // Filtrar arquivados em todos os outros
      switch (activeFilter) {
        case 'com_notificacao': filtered = filtered.filter(t => ticketNotifications[t.id]); break;
        case 'sem_tratativa': filtered = filtered.filter(t => t.status === 'aberto'); break;
        case 'em_tratativa': filtered = filtered.filter(t => t.status === 'em_tratativa'); break;
        case 'em_execucao': filtered = filtered.filter(t => t.status === 'em_execucao'); break;
        case 'escalado': filtered = filtered.filter(t => ['enviado_para_area', 'escalado_para_area', 'escalado_para_outra_area'].includes(t.status)); break;
        case 'para_mim':
          filtered = filtered.filter(t => 
            t.status === 'escalado_para_outra_area' &&
            (t.areaEscalada === userProfile?.area || 
             t.usuarioEscalado === user?.uid || 
             t.areasEnvolvidas?.includes(userProfile?.area))
          );
          break;
        case 'aguardando_validacao': filtered = filtered.filter(t => ['executado_aguardando_validacao', 'executado_aguardando_validacao_operador'].includes(t.status)); break;
        case 'concluidos': filtered = filtered.filter(t => t.status === 'concluido'); break;
        case 'aguardando_aprovacao': filtered = filtered.filter(t => t.status === 'aguardando_aprovacao'); break;
        default: break;
      }
    }
    
    // Filtro de busca (Search)
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.titulo?.toLowerCase().includes(lowerSearchTerm) ||
        t.descricao?.toLowerCase().includes(lowerSearchTerm)
      );
    }
    
    // Filtro por evento (Dropdown)
    if (selectedEvent !== 'all') {
      filtered = filtered.filter(t => {
        const ticketProjectIds = Array.isArray(t.projetos) && t.projetos.length > 0 ? t.projetos : (t.projetoId ? [t.projetoId] : []);
        return ticketProjectIds.some(pid => projects.find(p => p.id === pid)?.feira === selectedEvent);
      });
    }

    // Filtros rápidos (Badges)
    if (quickFilters.status.length > 0) filtered = filtered.filter(t => quickFilters.status.includes(t.status));
    if (quickFilters.area.length > 0) filtered = filtered.filter(t => quickFilters.area.includes(t.area));
    if (quickFilters.prioridade.length > 0) filtered = filtered.filter(t => quickFilters.prioridade.includes(t.prioridade));
    
    // Ordenação
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dataUltimaAtualizacao':
          const dateA = a.dataUltimaAtualizacao?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.dataUltimaAtualizacao?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        case 'prioridade':
          const priorityOrder = { 'alta': 3, 'media': 2, 'baixa': 1 };
          return (priorityOrder[b.prioridade] || 0) - (priorityOrder[a.prioridade] || 0);
        case 'status': return (a.status || '').localeCompare(b.status || '');
        case 'titulo': return (a.titulo || '').localeCompare(b.titulo || '');
        default: return 0;
      }
    });
  }, [tickets, activeFilter, searchTerm, selectedEvent, quickFilters, sortBy, projects, userProfile, user, ticketNotifications]);

  // --- CONTAGENS (Otimizado com useMemo) ---
  const ticketCounts = useMemo(() => {
    const counts = {
      todos: tickets.filter(t => t.status !== 'arquivado').length,
      com_notificacao: Object.keys(ticketNotifications).length,
      sem_tratativa: tickets.filter(t => t.status === 'aberto').length,
      em_tratativa: tickets.filter(t => t.status === 'em_tratativa').length,
      em_execucao: tickets.filter(t => t.status === 'em_execucao').length,
      escalado: tickets.filter(t => ['enviado_para_area', 'escalado_para_area', 'escalado_para_outra_area'].includes(t.status)).length,
      para_mim: tickets.filter(t => 
        t.status === 'escalado_para_outra_area' &&
        (t.areaEscalada === userProfile?.area || 
         t.usuarioEscalado === user?.uid || 
         t.areasEnvolvidas?.includes(userProfile?.area))
      ).length,
      aguardando_validacao: tickets.filter(t => ['executado_aguardando_validacao', 'executado_aguardando_validacao_operador'].includes(t.status)).length,
      concluidos: tickets.filter(t => t.status === 'concluido').length,
      aguardando_aprovacao: tickets.filter(t => t.status === 'aguardando_aprovacao').length,
      arquivados: tickets.filter(t => t.status === 'arquivado').length,
    };
    // Ajuste para 'todos' se o filtro principal já for 'arquivados'
    if (activeFilter === 'arquivados') {
        counts.todos = tickets.length; // Inclui arquivados na contagem total se essa for a aba ativa
    }
    return counts;
  }, [tickets, ticketNotifications, userProfile, user, activeFilter]);


  const ticketsByProject = useMemo(() => {
    const grouped = {};
    filteredAndSortedTickets.forEach(ticket => {
      const ids = Array.isArray(ticket.projetos) && ticket.projetos.length > 0 ? ticket.projetos : (ticket.projetoId ? [ticket.projetoId] : []);
      if (ids.length === 0) {
        if (!grouped['Sem Projeto']) grouped['Sem Projeto'] = [];
        grouped['Sem Projeto'].push(ticket);
      } else {
        ids.forEach(pid => {
          const name = getProjectName(pid);
          if (!grouped[name]) grouped[name] = [];
          // Evita duplicados no mesmo grupo
          if (!grouped[name].some(t => t.id === ticket.id)) {
            grouped[name].push(ticket);
          }
        });
      }
    });
    return grouped;
  }, [filteredAndSortedTickets, projects]);

  // --- EFEITOS (LÓGICA INTACTA) ---
  useEffect(() => {
    if (authInitialized && !user) {
      navigate('/login');
    }
  }, [authInitialized, user, navigate]);

  useEffect(() => {
    if (user && userProfile) {
      const loadData = async () => {
        try {
          // A lógica de filtragem por função é complexa e foi mantida exatamente como no original
          const filterConfidential = (ticket) => {
            const isConfidential = ticket.isConfidential || ticket.confidencial;
            if (!isConfidential) return true;
            
            const isCreator = ticket.criadoPor === user.uid;
            const isAdmin = userProfile?.funcao === 'administrador';
            const isManager = userProfile?.funcao === 'gerente';
            const isOperatorOfArea = userProfile?.funcao === 'operador' && [ticket.area, ticket.areaDeOrigem, ticket.areaInicial, ticket.areaOriginal].includes(userProfile?.area);
            
            return isCreator || isAdmin || isManager || isOperatorOfArea;
          };

          let loadedProjects = [];
          let loadedTickets = [];

          const [allProjects, allTickets] = await Promise.all([
            projectService.getAllProjects(),
            ticketService.getAllTickets()
          ]);
          
          const projectNamesMap = allProjects.reduce((acc, p) => ({ ...acc, [p.id]: p.nome }), {});
          setProjectNames(projectNamesMap);

          const { funcao, area, uid } = userProfile;

          if (funcao === 'administrador' || funcao === 'gerente') {
            loadedProjects = allProjects;
            loadedTickets = allTickets;
          } else if (funcao === 'produtor') {
            loadedProjects = allProjects.filter(p => p.produtorId === uid);
            const projectIds = loadedProjects.map(p => p.id);
            loadedTickets = allTickets.filter(t => ticketHasAnyProject(t, projectIds) && filterConfidential(t));
          } else if (funcao === 'consultor') {
            loadedProjects = allProjects.filter(p => p.consultorId === uid);
            const projectIds = loadedProjects.map(p => p.id);
            loadedTickets = allTickets.filter(t => ticketHasAnyProject(t, projectIds) && filterConfidential(t));
          } else if (funcao === 'operador') {
            loadedProjects = allProjects;
            loadedTickets = allTickets.filter(t => {
              const isRelatedArea = [t.area, t.areaDeOrigem, t.areaInicial, t.areaOriginal, t.areaDestino, t.areaQueRejeitou, t.areaEscalada].includes(area);
              const isEnvolved = Array.isArray(t.areasEnvolvidas) && t.areasEnvolvidas.includes(area);
              const isAssigned = t.atribuidoA === uid;
              const isCreator = t.criadoPor === uid;
              const needsFinancial = area === 'financeiro' && (['despesas_programada', 'despesas_nao_programadas'].includes(t.tipo) || t.gerenciaDestino === 'gerente_financeiro');

              return (isRelatedArea || isEnvolved || isAssigned || isCreator || needsFinancial) && filterConfidential(t);
            });
          } else { // Usuário padrão
            loadedProjects = allProjects;
            loadedTickets = allTickets.filter(t => t.criadoPor === uid && filterConfidential(t));
          }

          setProjects(loadedProjects);
          setTickets(loadedTickets);

        } catch (error) {
          console.error("Erro ao carregar dados do dashboard:", error);
          // Tratar erro (ex: mostrar notificação)
        } finally {
          setLoading(false);
        }
      };
      loadData();

      // Recarregar dados a cada 3 minutos
      const intervalId = setInterval(loadData, 3 * 60 * 1000);
      return () => clearInterval(intervalId);
    }
  }, [user, userProfile]);

  useEffect(() => {
    if (user?.uid && tickets.length > 0) {
      const unsubscribe = notificationService.subscribeToNotifications(user.uid, (allNotifications) => {
        const counts = allNotifications.reduce((acc, notif) => {
          if (notif.ticketId && !notif.lida) {
            acc[notif.ticketId] = (acc[notif.ticketId] || 0) + 1;
          }
          return acc;
        }, {});
        setTicketNotifications(counts);
      });
      return () => unsubscribe && unsubscribe();
    }
  }, [user?.uid, tickets]);
  
  // Carregar filtros salvos do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dashboardSavedFilters');
    if (saved) setSavedFilters(JSON.parse(saved));
  }, []);

  // --- MANIPULADORES DE EVENTOS ---
  const handleTicketClick = (ticketId) => navigate(`/chamado/${ticketId}`);
  const toggleProjectExpansion = (projectName) => setExpandedProjects(prev => ({ ...prev, [projectName]: !prev[projectName] }));
  const toggleQuickFilter = (type, value) => {
    setQuickFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value) ? prev[type].filter(item => item !== value) : [...prev[type], value]
    }));
  };

  const clearAllFilters = () => {
    setActiveFilter('todos');
    setSearchTerm('');
    setSelectedEvent('all');
    setQuickFilters({ status: [], area: [], prioridade: [] });
    setSortBy('dataUltimaAtualizacao');
  };

  const saveCurrentFilter = () => {
    if (!filterName.trim()) return;
    const newFilter = { id: Date.now().toString(), name: filterName, activeFilter, searchTerm, selectedEvent, quickFilters, sortBy };
    const updatedFilters = [...savedFilters, newFilter];
    setSavedFilters(updatedFilters);
    localStorage.setItem('dashboardSavedFilters', JSON.stringify(updatedFilters));
    setFilterName('');
    setShowSaveFilterDialog(false);
  };
  
  const applySavedFilter = (filter) => {
    setActiveFilter(filter.activeFilter);
    setSearchTerm(filter.searchTerm);
    setSelectedEvent(filter.selectedEvent);
    setQuickFilters(filter.quickFilters);
    setSortBy(filter.sortBy);
  };

  const removeSavedFilter = (filterId) => {
    const updatedFilters = savedFilters.filter(f => f.id !== filterId);
    setSavedFilters(updatedFilters);
    localStorage.setItem('dashboardSavedFilters', JSON.stringify(updatedFilters));
  };
  
  // --- DEFINIÇÕES DE UI ---
  const filterCardsConfig = useMemo(() => [
    { id: 'todos', title: 'Todos', shortTitle: 'Todos', icon: FileText, bgColor: 'bg-blue-600', textColor: 'text-white' },
    { id: 'com_notificacao', title: 'Notificações', shortTitle: 'Notif.', icon: BellRing, bgColor: 'bg-red-500', textColor: 'text-white' },
    { id: 'sem_tratativa', title: 'Sem Tratativa', shortTitle: 'S/ Trat.', icon: AlertCircle, bgColor: 'bg-yellow-500', textColor: 'text-white' },
    { id: 'em_tratativa', title: 'Em Tratativa', shortTitle: 'Em Trat.', icon: Clock, bgColor: 'bg-orange-500', textColor: 'text-white' },
    { id: 'em_execucao', title: 'Em Execução', shortTitle: 'Execução', icon: Play, bgColor: 'bg-cyan-500', textColor: 'text-white' },
    { id: 'escalado', title: 'Escalado', shortTitle: 'Escalado', icon: ArrowUp, bgColor: 'bg-purple-500', textColor: 'text-white' },
    { id: 'para_mim', title: 'Para Mim', shortTitle: 'P/ Mim', icon: ChevronDown, bgColor: 'bg-indigo-500', textColor: 'text-white' },
    { id: 'aguardando_validacao', title: 'Aguardando Validação', shortTitle: 'Validação', icon: Hourglass, bgColor: 'bg-teal-500', textColor: 'text-white' },
    { id: 'concluidos', title: 'Concluídos', shortTitle: 'Concluídos', icon: CheckCircle, bgColor: 'bg-green-500', textColor: 'text-white' },
    ...(userProfile?.funcao === 'gerente' ? [{ id: 'aguardando_aprovacao', title: 'Aguardando Aprovação', shortTitle: 'Aprovação', icon: UserCheck, bgColor: 'bg-pink-500', textColor: 'text-white' }] : []),
    { id: 'arquivados', title: 'Arquivados', shortTitle: 'Arquiv.', icon: Archive, bgColor: 'bg-gray-500', textColor: 'text-white' }
  ], [userProfile?.funcao]);

  const getStatusColor = (status) => {
    const colors = { 'aberto': 'bg-blue-100 text-blue-800', 'em_tratativa': 'bg-yellow-100 text-yellow-800', 'em_execucao': 'bg-cyan-100 text-cyan-800', 'enviado_para_area': 'bg-purple-100 text-purple-800', 'escalado_para_area': 'bg-purple-100 text-purple-800', 'aguardando_aprovacao': 'bg-orange-100 text-orange-800', 'executado_aguardando_validacao': 'bg-indigo-100 text-indigo-800', 'concluido': 'bg-green-100 text-green-800', 'cancelado': 'bg-red-100 text-red-800', 'devolvido': 'bg-pink-100 text-pink-800', 'arquivado': 'bg-gray-100 text-gray-700', 'escalado_para_outra_area': 'bg-indigo-100 text-indigo-800' };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };
  
  const getPriorityColor = (priority) => {
    const colors = { 'baixa': 'border-green-300 text-green-800 bg-green-50', 'media': 'border-yellow-300 text-yellow-800 bg-yellow-50', 'alta': 'border-red-300 text-red-800 bg-red-50' };
    return colors[priority] || 'border-gray-300 text-gray-800 bg-gray-50';
  };

  // --- RENDERIZAÇÃO ---
  if (loading || !authInitialized) {
    return <LoadingSpinner />;
  }
  
  const renderSidebar = () => (
    <aside className={`${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200/80 bg-white/90 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 flex flex-col`}>
      <div className="flex h-20 items-center justify-between border-b border-slate-200/80 px-6">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Gestão</h1>
            <p className="-mt-1 text-sm text-slate-500">Chamados</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="lg:hidden">
          <X className="h-5 w-5 text-slate-600" />
        </Button>
      </div>
      <nav className="flex-1 space-y-4 p-4">
        {['produtor', 'consultor', 'administrador'].includes(userProfile?.funcao) && (
          <Button onClick={() => navigate('/novo-chamado')} className="h-12 w-full justify-start rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-base shadow-lg transition-all hover:shadow-xl">
            <Plus className="mr-3 h-5 w-5" /> Novo Chamado
          </Button>
        )}
        {userProfile?.funcao === 'administrador' && (
          <Button onClick={() => navigate('/novo-projeto')} variant="outline" className="h-11 w-full justify-start rounded-xl">
            <Plus className="mr-3 h-4 w-4" /> Novo Projeto
          </Button>
        )}
        <div className="space-y-1">
          <Button variant="ghost" onClick={() => navigate('/projetos')} className="w-full justify-start rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900">
            <FolderOpen className="mr-3 h-4 w-4" /> Ver Projetos
          </Button>
          <Button variant="ghost" onClick={() => navigate('/cronograma')} className="w-full justify-start rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900">
            <Calendar className="mr-3 h-4 w-4" /> Cronograma
          </Button>
          {userProfile?.funcao === 'administrador' && (
            <>
              <Button variant="ghost" onClick={() => navigate('/eventos')} className="w-full justify-start rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900">
                <Calendar className="mr-3 h-4 w-4" /> Eventos
              </Button>
              <Button variant="ghost" onClick={() => navigate('/usuarios')} className="w-full justify-start rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900">
                <Users className="mr-3 h-4 w-4" /> Usuários
              </Button>
              <Button variant="ghost" onClick={() => navigate('/relatorios')} className="w-full justify-start rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900">
                <BarChart3 className="mr-3 h-4 w-4" /> Relatórios
              </Button>
            </>
          )}
        </div>
      </nav>
      <div className="mt-auto border-t border-slate-200/80 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto w-full justify-start rounded-xl p-2 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-700">
                {(userProfile?.nome || user?.email)?.charAt(0)?.toUpperCase()}
              </div>
              <div className="ml-3 flex-1 overflow-hidden">
                <p className="truncate font-medium text-slate-900">{userProfile?.nome || user?.email}</p>
                <p className="truncate text-xs capitalize text-slate-500">{userProfile?.funcao?.replace('_', ' ')}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={logout} className="text-red-600 focus:bg-red-50 focus:text-red-700">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );

  const renderHeader = () => (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="lg:hidden">
          <Menu className="h-6 w-6 text-slate-700" />
        </Button>
        <div>
          <h2 className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-xl font-bold text-transparent sm:text-2xl">Dashboard</h2>
          <p className="-mt-1 hidden text-sm text-slate-500 sm:block">
            Bem-vindo, <span className="font-medium text-slate-700">{userProfile?.nome || user?.email}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2 sm:space-x-4">
        <NotificationCenter />
      </div>
    </header>
  );
  
  const renderFilterCards = () => (
    <div className="flex flex-nowrap overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"> {/* Removido gap-3, adicionado flex-nowrap e padding horizontal */}
      {filterCardsConfig.map(({ id, title, shortTitle, icon: Icon, bgColor, textColor }) => {
        const isActive = activeFilter === id;
        const count = ticketCounts[id] || 0;
        return (
          <Card
            key={id}
            onClick={() => setActiveFilter(id)}
            className={`flex-shrink-0 w-[140px] sm:w-[150px] md:w-[160px] lg:w-[140px] xl:w-[145px] 2xl:w-[150px]
                        cursor-pointer overflow-hidden rounded-xl transition-all duration-300 transform hover:-translate-y-1 mx-2
                        ${isActive ? `${bgColor} ${textColor} shadow-lg ${bgColor.replace('bg-', 'shadow-')}/20` : 'bg-white hover:bg-slate-50 hover:shadow-md'}`
            }
          >
            <CardContent className="p-4 text-center">
              <Icon className={`mx-auto h-6 w-6 mb-2 ${isActive ? 'text-white/80' : 'text-slate-500'}`} />
              <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-white' : 'text-slate-800'} hidden sm:block`}>{title}</p>
              <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-white' : 'text-slate-800'} sm:hidden`}>{shortTitle}</p> {/* Título menor para mobile */}
              <p className={`text-xl font-bold ${isActive ? 'text-white' : 'text-slate-900'}`}>{count}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderAdvancedFilters = () => (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur-xl sm:p-6">
      {/* Linha 1: Filtros principais e Ordenação */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="h-11 rounded-lg"><SelectValue placeholder="Filtrar por evento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            {allEvents.map(event => <SelectItem key={event} value={event}>{event}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-11 w-full sm:w-[220px] rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="dataUltimaAtualizacao">Data de atualização</SelectItem>
            <SelectItem value="prioridade">Prioridade</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="titulo">Título</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Linha 2: Filtros rápidos */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-medium text-slate-700">Status:</span>
          {allStatus.map(s => <Badge key={s} onClick={() => toggleQuickFilter('status', s)} variant={quickFilters.status.includes(s) ? 'default' : 'outline'} className="cursor-pointer rounded-md">{s.replace(/_/g, ' ')}</Badge>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-medium text-slate-700">Área:</span>
          {allAreas.map(a => <Badge key={a} onClick={() => toggleQuickFilter('area', a)} variant={quickFilters.area.includes(a) ? 'default' : 'outline'} className="cursor-pointer rounded-md">{a.replace(/_/g, ' ')}</Badge>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-medium text-slate-700">Prioridade:</span>
          {allPriorities.map(p => <Badge key={p} onClick={() => toggleQuickFilter('prioridade', p)} variant={quickFilters.prioridade.includes(p) ? 'default' : 'outline'} className="cursor-pointer rounded-md">{p}</Badge>)}
        </div>
      </div>
    </div>
  );

  const renderViewControls = () => (
    <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Lado esquerdo: Total e Limpar */}
        <div className="flex items-center gap-4">
            <p className="text-sm font-medium text-slate-600">
                {filteredAndSortedTickets.length} chamado{filteredAndSortedTickets.length !== 1 ? 's' : ''} encontrado{filteredAndSortedTickets.length !== 1 ? 's' : ''}
            </p>
            {(searchTerm || selectedEvent !== 'all' || sortBy !== 'dataUltimaAtualizacao' || quickFilters.status.length > 0 || quickFilters.area.length > 0 || quickFilters.prioridade.length > 0 || activeFilter !== 'todos') && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-blue-600 hover:bg-blue-50 hover:text-blue-700">
                  <RotateCcw className="mr-2 h-4 w-4" /> Limpar filtros
              </Button>
            )}
        </div>

        {/* Lado direito: Ações e Visualização */}
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSaveFilterDialog(true)}>
                <Save className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Salvar Filtro</span>
            </Button>
            {savedFilters.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Bookmark className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Filtros Salvos</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                        {savedFilters.map(filter => (
                            <div key={filter.id} className="group flex items-center justify-between pr-2">
                                <DropdownMenuItem onClick={() => applySavedFilter(filter)} className="flex-1 cursor-pointer">
                                    {filter.name}
                                </DropdownMenuItem>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeSavedFilter(filter.id)}>
                                    <X className="h-3 w-3 text-red-500" />
                                </Button>
                            </div>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            <div className="ml-2 flex rounded-lg border bg-slate-100 p-0.5">
                <Button size="sm" onClick={() => setViewMode('cards')} variant={viewMode === 'cards' ? 'default' : 'ghost'} className={`h-8 px-3 rounded-md ${viewMode === 'cards' && 'shadow-sm'}`}>
                    <Grid className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={() => setViewMode('list')} variant={viewMode === 'list' ? 'default' : 'ghost'} className={`h-8 px-3 rounded-md ${viewMode === 'list' && 'shadow-sm'}`}>
                    <List className="h-4 w-4" />
                </Button>
            </div>
        </div>
    </div>
  );

  const renderEmptyState = () => (
    <Card className="mt-6 rounded-2xl border-dashed">
      <CardContent className="p-12 text-center">
        <FileText className="mx-auto h-16 w-16 text-slate-300" />
        <h3 className="mt-4 text-lg font-semibold text-slate-800">Nenhum chamado encontrado</h3>
        <p className="mt-1 text-slate-500">Tente ajustar seus filtros ou aguarde por novos chamados.</p>
        {(searchTerm || selectedEvent !== 'all' || sortBy !== 'dataUltimaAtualizacao' || quickFilters.status.length > 0 || quickFilters.area.length > 0 || quickFilters.prioridade.length > 0 || activeFilter !== 'todos') && (
          <Button onClick={clearAllFilters} className="mt-6 rounded-xl">
            Limpar Todos os Filtros
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const renderListView = () => (
    <Card className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="px-6 py-4">Título</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Atualização</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedTickets.map(ticket => (
              <TableRow key={ticket.id} onClick={() => handleTicketClick(ticket.id)} className="cursor-pointer hover:bg-slate-50/70">
                <TableCell className="px-6 py-4 font-medium">
                  <div className="flex items-center gap-2">
                    {(ticket.isConfidential || ticket.confidencial) && <Lock className="h-4 w-4 flex-shrink-0 text-orange-500" title="Confidencial"/>}
                    <span className="truncate" title={ticket.titulo}>{ticket.titulo}</span>
                    {ticketNotifications[ticket.id] > 0 && <Badge className="bg-red-500 text-white rounded-full px-2">{ticketNotifications[ticket.id]}</Badge>}
                  </div>
                </TableCell>
                <TableCell><Badge className={`${getStatusColor(ticket.status)} font-medium capitalize`}>{ticket.status?.replace(/_/g, ' ')}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={`${getPriorityColor(ticket.prioridade)} font-medium capitalize`}>{ticket.prioridade}</Badge></TableCell>
                <TableCell className="capitalize">{ticket.area?.replace(/_/g, ' ')}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={getProjectName(ticket.projetoId || ticket.projetos?.[0])}>
                  {getProjectName(ticket.projetoId || ticket.projetos?.[0])}
                </TableCell>
                <TableCell className="text-xs text-slate-500">{(ticket.dataUltimaAtualizacao?.toDate?.() || ticket.createdAt?.toDate?.())?.toLocaleString('pt-BR') || 'N/A'}</TableCell>
                <TableCell><Eye className="h-5 w-5 text-slate-400" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
  
  const renderCardView = () => (
    <div className="mt-6 space-y-6">
      {Object.entries(ticketsByProject).map(([projectName, projectTickets]) => (
        <Card key={projectName} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm">
          <button onClick={() => toggleProjectExpansion(projectName)} className="flex w-full items-center justify-between p-4 text-left hover:bg-slate-50/70">
            <div className="flex items-center gap-4">
              <span className={`p-1 rounded-md transition-transform duration-200 ${expandedProjects[projectName] ? 'rotate-90' : ''}`}>
                <ChevronRight className="h-5 w-5 text-slate-500" />
              </span>
              <h3 className="text-lg font-semibold text-slate-900">{projectName}</h3>
            </div>
            <Badge variant="secondary" className="rounded-md">{projectTickets.length}</Badge>
          </button>
          {expandedProjects[projectName] && (
            <div className="border-t border-slate-200/80 bg-slate-50/50 p-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projectTickets.map(ticket => (
                  <Card key={ticket.id} onClick={() => handleTicketClick(ticket.id)} className="cursor-pointer rounded-xl bg-white shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-slate-800 pr-2">{ticket.titulo}</h4>
                        {ticketNotifications[ticket.id] > 0 && <Badge className="bg-red-500 text-white rounded-full px-2">{ticketNotifications[ticket.id]}</Badge>}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{(ticket.isConfidential || ticket.confidencial) ? 'Descrição confidencial' : ticket.descricao}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={`${getStatusColor(ticket.status)} font-medium capitalize`}>{ticket.status?.replace(/_/g, ' ')}</Badge>
                        <Badge variant="outline" className={`${getPriorityColor(ticket.prioridade)} font-medium capitalize`}>{ticket.prioridade}</Badge>
                      </div>
                      <div className="flex items-center justify-between border-t pt-3 mt-2 text-xs text-slate-500">
                        <span>Área: <span className="font-medium capitalize">{ticket.area?.replace(/_/g, ' ')}</span></span>
                        <span>{(ticket.dataUltimaAtualizacao?.toDate?.() || ticket.createdAt?.toDate?.())?.toLocaleDateString('pt-BR') || 'N/A'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {renderSidebar()}
      {mobileMenuOpen && <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" />}
      
      <div className="flex flex-1 flex-col overflow-hidden">
        {renderHeader()}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-screen-2xl space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Pesquisar por título ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-14 rounded-2xl border-slate-200/80 bg-white pl-12 text-base shadow-sm transition-shadow focus:shadow-md"
              />
            </div>

            {renderFilterCards()}
            {renderAdvancedFilters()}
            {renderViewControls()}

            {filteredAndSortedTickets.length === 0 ? renderEmptyState() : (viewMode === 'list' ? renderListView() : renderCardView())}
          </div>
        </main>
      </div>

      <Dialog open={showSaveFilterDialog} onOpenChange={setShowSaveFilterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Filtro</DialogTitle>
            <DialogDescription>Dê um nome a este conjunto de filtros para usá-lo rapidamente no futuro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input placeholder="Ex: Chamados Urgentes do Financeiro" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveFilterDialog(false)}>Cancelar</Button>
              <Button onClick={saveCurrentFilter} disabled={!filterName.trim()}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
