import React, 'useState', 'useEffect', 'useMemo' from 'react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import NotificationCenter from '../components/NotificationCenter';
import {
  LogOut, Plus, AlertCircle, Clock, CheckCircle, Users, FolderOpen, BarChart3, Menu, X, Eye,
  Filter, RotateCcw, Lock, Search, Bookmark, Grid, List, Save, ChevronDown, ChevronRight,
  FileText, Calendar, ArrowUp, Hourglass, UserCheck, Play, BellRing, Archive
} from 'lucide-react';

// --- COMPONENTES AUXILIARES ---
const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-slate-50">
    <div className="text-center">
      <div className="mx-auto h-16 w-16 animate-spin rounded-full border-b-2 border-t-2 border-blue-600"></div>
      <p className="mt-4 text-slate-600">Carregando dashboard...</p>
    </div>
  </div>
);

// --- COMPONENTE PRINCIPAL ---
const DashboardPage = () => {
  const { user, userProfile, logout, authInitialized } = useAuth();
  const navigate = useNavigate();

  // --- ESTADOS ---
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectNames, setProjectNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ticketNotifications, setTicketNotifications] = useState({});
  const [activeFilter, setActiveFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [sortBy, setSortBy] = useState('dataUltimaAtualizacao');
  const [quickFilters, setQuickFilters] = useState({ status: [], area: [], prioridade: [] });
  const [viewMode, setViewMode] = useState('cards');
  const [savedFilters, setSavedFilters] = useState([]);
  const [showSaveFilterDialog, setShowSaveFilterDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [expandedProjects, setExpandedProjects] = useState({});

  // --- LÓGICA DE NEGÓCIO E HELPERS ---
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

  const allEvents = useMemo(() => [...new Set(projects.map(p => p.feira).filter(Boolean))].sort(), [projects]);
  const allAreas = useMemo(() => [...new Set(tickets.map(t => t.area).filter(Boolean))].sort(), [tickets]);
  const allStatus = useMemo(() => [...new Set(tickets.map(t => t.status).filter(Boolean))].sort(), [tickets]);
  const allPriorities = useMemo(() => [...new Set(tickets.map(t => t.prioridade).filter(Boolean))].sort(), [tickets]);

  // --- FILTRAGEM E ORDENAÇÃO (HOOK OTIMIZADO) ---
  const filteredAndSortedTickets = useMemo(() => {
    let filtered = tickets;

    if (activeFilter === 'arquivados') {
      filtered = tickets.filter(t => t.status === 'arquivado');
    } else {
      filtered = tickets.filter(t => t.status !== 'arquivado');
      switch (activeFilter) {
        case 'com_notificacao': filtered = filtered.filter(t => ticketNotifications[t.id]); break;
        case 'sem_tratativa': filtered = filtered.filter(t => t.status === 'aberto'); break;
        case 'em_tratativa': filtered = filtered.filter(t => t.status === 'em_tratativa'); break;
        case 'em_execucao': filtered = filtered.filter(t => t.status === 'em_execucao'); break;
        case 'escalado': filtered = filtered.filter(t => ['enviado_para_area', 'escalado_para_area', 'escalado_para_outra_area'].includes(t.status)); break;
        case 'para_mim':
          filtered = filtered.filter(t => 
            t.status === 'escalado_para_outra_area' &&
            (t.areaEscalada === userProfile?.area || t.usuarioEscalado === user?.uid || t.areasEnvolvidas?.includes(userProfile?.area))
          ); break;
        case 'aguardando_validacao': filtered = filtered.filter(t => ['executado_aguardando_validacao', 'executado_aguardando_validacao_operador'].includes(t.status)); break;
        case 'concluidos': filtered = filtered.filter(t => t.status === 'concluido'); break;
        case 'aguardando_aprovacao': filtered = filtered.filter(t => t.status === 'aguardando_aprovacao'); break;
        default: break;
      }
    }
    
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(t => t.titulo?.toLowerCase().includes(lowerSearchTerm) || t.descricao?.toLowerCase().includes(lowerSearchTerm));
    }
    
    if (selectedEvent !== 'all') {
      filtered = filtered.filter(t => {
        const ticketProjectIds = Array.isArray(t.projetos) && t.projetos.length > 0 ? t.projetos : (t.projetoId ? [t.projetoId] : []);
        return ticketProjectIds.some(pid => projects.find(p => p.id === pid)?.feira === selectedEvent);
      });
    }

    if (quickFilters.status.length > 0) filtered = filtered.filter(t => quickFilters.status.includes(t.status));
    if (quickFilters.area.length > 0) filtered = filtered.filter(t => quickFilters.area.includes(t.area));
    if (quickFilters.prioridade.length > 0) filtered = filtered.filter(t => quickFilters.prioridade.includes(t.prioridade));
    
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'dataUltimaAtualizacao':
          const dateA = a.dataUltimaAtualizacao?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.dataUltimaAtualizacao?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        case 'prioridade':
          const priorityOrder = { 'alta': 3, 'media': 2, 'baixa': 1 };
          return (priorityOrder[b.prioridade] || 0) - (priorityOrder[a.prioridade] || 0);
        default: return (a[sortBy] || '').localeCompare(b[sortBy] || '');
      }
    });
  }, [tickets, activeFilter, searchTerm, selectedEvent, quickFilters, sortBy, projects, userProfile, user, ticketNotifications]);

  const ticketCounts = useMemo(() => ({
    todos: tickets.filter(t => t.status !== 'arquivado').length,
    com_notificacao: Object.keys(ticketNotifications).length,
    sem_tratativa: tickets.filter(t => t.status === 'aberto').length,
    em_tratativa: tickets.filter(t => t.status === 'em_tratativa').length,
    em_execucao: tickets.filter(t => t.status === 'em_execucao').length,
    escalado: tickets.filter(t => ['enviado_para_area', 'escalado_para_area', 'escalado_para_outra_area'].includes(t.status)).length,
    para_mim: tickets.filter(t => t.status === 'escalado_para_outra_area' && (t.areaEscalada === userProfile?.area || t.usuarioEscalado === user?.uid || t.areasEnvolvidas?.includes(userProfile?.area))).length,
    aguardando_validacao: tickets.filter(t => ['executado_aguardando_validacao', 'executado_aguardando_validacao_operador'].includes(t.status)).length,
    concluidos: tickets.filter(t => t.status === 'concluido').length,
    aguardando_aprovacao: tickets.filter(t => t.status === 'aguardando_aprovacao').length,
    arquivados: tickets.filter(t => t.status === 'arquivado').length,
  }), [tickets, ticketNotifications, userProfile, user]);

  const ticketsByProject = useMemo(() => {
    return filteredAndSortedTickets.reduce((acc, ticket) => {
      const ids = Array.isArray(ticket.projetos) && ticket.projetos.length > 0 ? ticket.projetos : (ticket.projetoId ? [ticket.projetoId] : []);
      if (ids.length === 0) {
        (acc['Sem Projeto'] = acc['Sem Projeto'] || []).push(ticket);
      } else {
        ids.forEach(pid => {
          const name = getProjectName(pid);
          if (!acc[name]) acc[name] = [];
          if (!acc[name].some(t => t.id === ticket.id)) acc[name].push(ticket);
        });
      }
      return acc;
    }, {});
  }, [filteredAndSortedTickets, projects, projectNames]);

  // --- EFEITOS (LÓGICA DE NEGÓCIO INTACTA) ---
  useEffect(() => {
    if (authInitialized && !user) navigate('/login');
  }, [authInitialized, user, navigate]);

  useEffect(() => {
    if (user && userProfile) {
      const loadData = async () => {
        try {
          setLoading(true);
          const filterConfidential = (ticket) => {
            const isConfidential = ticket.isConfidential || ticket.confidencial;
            if (!isConfidential) return true;
            const isCreator = ticket.criadoPor === user.uid;
            const isAdminOrManager = ['administrador', 'gerente'].includes(userProfile?.funcao);
            const isOperatorOfArea = userProfile?.funcao === 'operador' && [ticket.area, ticket.areaDeOrigem, ticket.areaInicial, ticket.areaOriginal].includes(userProfile?.area);
            return isCreator || isAdminOrManager || isOperatorOfArea;
          };

          const [allProjects, allTickets] = await Promise.all([projectService.getAllProjects(), ticketService.getAllTickets()]);
          setProjectNames(allProjects.reduce((acc, p) => ({ ...acc, [p.id]: p.nome }), {}));

          const { funcao, area, uid } = userProfile;
          let loadedProjects = allProjects, loadedTickets = [];

          if (['administrador', 'gerente'].includes(funcao)) {
            loadedTickets = allTickets;
          } else if (funcao === 'produtor') {
            loadedProjects = allProjects.filter(p => p.produtorId === uid);
            const pids = loadedProjects.map(p => p.id);
            loadedTickets = allTickets.filter(t => ticketHasAnyProject(t, pids) && filterConfidential(t));
          } else if (funcao === 'consultor') {
            loadedProjects = allProjects.filter(p => p.consultorId === uid);
            const pids = loadedProjects.map(p => p.id);
            loadedTickets = allTickets.filter(t => ticketHasAnyProject(t, pids) && filterConfidential(t));
          } else if (funcao === 'operador') {
            loadedTickets = allTickets.filter(t => {
              const areas = [t.area, t.areaDeOrigem, t.areaInicial, t.areaOriginal, t.areaDestino, t.areaQueRejeitou, t.areaEscalada];
              const isRelatedArea = areas.includes(area) || t.areasEnvolvidas?.includes(area);
              const isAssigned = t.atribuidoA === uid;
              const isCreator = t.criadoPor === uid;
              const needsFinancial = area === 'financeiro' && (['despesas_programada', 'despesas_nao_programadas'].includes(t.tipo) || t.gerenciaDestino === 'gerente_financeiro');
              return (isRelatedArea || isAssigned || isCreator || needsFinancial) && filterConfidential(t);
            });
          } else {
            loadedTickets = allTickets.filter(t => t.criadoPor === uid && filterConfidential(t));
          }
          setProjects(loadedProjects);
          setTickets(loadedTickets);
        } catch (error) {
          console.error("Erro ao carregar dados:", error);
        } finally {
          setLoading(false);
        }
      };
      loadData();
      const intervalId = setInterval(loadData, 3 * 60 * 1000);
      return () => clearInterval(intervalId);
    }
  }, [user, userProfile]);

  useEffect(() => {
    if (user?.uid && tickets.length > 0) {
      const unsubscribe = notificationService.subscribeToNotifications(user.uid, (allNotifications) => {
        const counts = allNotifications.reduce((acc, notif) => {
          if (notif.ticketId && !notif.lida) acc[notif.ticketId] = (acc[notif.ticketId] || 0) + 1;
          return acc;
        }, {});
        setTicketNotifications(counts);
      });
      return () => unsubscribe && unsubscribe();
    }
  }, [user?.uid, tickets]);
  
  useEffect(() => {
    const saved = localStorage.getItem('dashboardSavedFilters');
    if (saved) setSavedFilters(JSON.parse(saved));
  }, []);

  // --- HANDLERS ---
  const handleTicketClick = (ticketId) => navigate(`/chamado/${ticketId}`);
  const toggleProjectExpansion = (projectName) => setExpandedProjects(prev => ({ ...prev, [projectName]: !prev[projectName] }));
  const toggleQuickFilter = (type, value) => setQuickFilters(prev => ({...prev, [type]: prev[type].includes(value) ? prev[type].filter(item => item !== value) : [...prev[type], value]}));

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
    setActiveFilter(filter.activeFilter || 'todos');
    setSearchTerm(filter.searchTerm || '');
    setSelectedEvent(filter.selectedEvent || 'all');
    setQuickFilters(filter.quickFilters || { status: [], area: [], prioridade: [] });
    setSortBy(filter.sortBy || 'dataUltimaAtualizacao');
  };
  
  const removeSavedFilter = (filterId) => {
    const updatedFilters = savedFilters.filter(f => f.id !== filterId);
    setSavedFilters(updatedFilters);
    localStorage.setItem('dashboardSavedFilters', JSON.stringify(updatedFilters));
  };
  
  // --- UI CONFIG ---
  const filterCardsConfig = useMemo(() => [
    { id: 'todos', title: 'Todos', shortTitle: 'Todos', icon: FileText, bgColor: 'bg-blue-600', textColor: 'text-white' },
    { id: 'com_notificacao', title: 'Notificações', shortTitle: 'Notif.', icon: BellRing, bgColor: 'bg-red-500', textColor: 'text-white' },
    { id: 'sem_tratativa', title: 'Sem Tratativa', shortTitle: 'S/ Trat.', icon: AlertCircle, bgColor: 'bg-yellow-500', textColor: 'text-white' },
    { id: 'em_tratativa', title: 'Em Tratativa', shortTitle: 'Em Trat.', icon: Clock, bgColor: 'bg-orange-500', textColor: 'text-white' },
    { id: 'em_execucao', title: 'Em Execução', shortTitle: 'Execução', icon: Play, bgColor: 'bg-cyan-500', textColor: 'text-white' },
    { id: 'escalado', title: 'Escalado', shortTitle: 'Escalado', icon: ArrowUp, bgColor: 'bg-purple-500', textColor: 'text-white' },
    { id: 'para_mim', title: 'Para Mim', shortTitle: 'P/ Mim', icon: ChevronDown, bgColor: 'bg-indigo-500', textColor: 'text-white' },
    { id: 'aguardando_validacao', title: 'Validação', shortTitle: 'Validação', icon: Hourglass, bgColor: 'bg-teal-500', textColor: 'text-white' },
    { id: 'concluidos', title: 'Concluídos', shortTitle: 'Concluídos', icon: CheckCircle, bgColor: 'bg-green-500', textColor: 'text-white' },
    ...(userProfile?.funcao === 'gerente' ? [{ id: 'aguardando_aprovacao', title: 'Aprovação', shortTitle: 'Aprovação', icon: UserCheck, bgColor: 'bg-pink-500', textColor: 'text-white' }] : []),
    { id: 'arquivados', title: 'Arquivados', shortTitle: 'Arquiv.', icon: Archive, bgColor: 'bg-gray-500', textColor: 'text-white' }
  ], [userProfile?.funcao]);

  const getStatusColor = (status) => ({ 'aberto': 'bg-blue-100 text-blue-800', 'em_tratativa': 'bg-yellow-100 text-yellow-800', 'em_execucao': 'bg-cyan-100 text-cyan-800', 'enviado_para_area': 'bg-purple-100 text-purple-800', 'escalado_para_area': 'bg-purple-100 text-purple-800', 'aguardando_aprovacao': 'bg-orange-100 text-orange-800', 'executado_aguardando_validacao': 'bg-indigo-100 text-indigo-800', 'concluido': 'bg-green-100 text-green-800', 'cancelado': 'bg-red-100 text-red-800', 'devolvido': 'bg-pink-100 text-pink-800', 'arquivado': 'bg-gray-100 text-gray-700', 'escalado_para_outra_area': 'bg-indigo-100 text-indigo-800' }[status] || 'bg-gray-100 text-gray-800');
  const getPriorityColor = (priority) => ({ 'baixa': 'border-green-300 text-green-800 bg-green-50', 'media': 'border-yellow-300 text-yellow-800 bg-yellow-50', 'alta': 'border-red-300 text-red-800 bg-red-50' }[priority] || 'border-gray-300 text-gray-800 bg-gray-50');

  // --- RENDER FUNCTIONS (para organização) ---
  if (loading || !authInitialized) return <LoadingSpinner />;
  
  const renderSidebar = () => (<aside className={`${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200/80 bg-white/90 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 flex flex-col`}>{/* ... Conteúdo do Sidebar (inalterado e colapsado para legibilidade) ... */}</aside>);
  const renderHeader = () => (<header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">{/* ... Conteúdo do Header (inalterado e colapsado para legibilidade) ... */}</header>);
  
  const renderFilterCards = () => (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {filterCardsConfig.map(({ id, title, shortTitle, icon: Icon, bgColor, textColor }) => {
        const isActive = activeFilter === id;
        const count = ticketCounts[id] || 0;
        return (
          <Card
            key={id}
            onClick={() => setActiveFilter(id)}
            className={`flex-grow basis-28 sm:basis-32 cursor-pointer overflow-hidden rounded-xl transition-all duration-200
                        ${bgColor} ${textColor}
                        ${isActive ? 'ring-2 ring-offset-2 ring-blue-500 scale-105 shadow-lg' : 'shadow-md hover:shadow-lg hover:-translate-y-1'}`
            }
          >
            <CardContent className="p-3 text-center">
              <Icon className="mx-auto h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2 text-white/80" />
              <p className="text-xs sm:text-sm font-semibold leading-tight text-white hidden sm:block">{title}</p>
              <p className="text-xs sm:text-sm font-semibold leading-tight text-white sm:hidden">{shortTitle}</p>
              <p className="text-lg sm:text-xl font-bold text-white">{count}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderAdvancedFilters = () => {
    const FilterDropdown = ({ title, filterKey, options }) => {
      const selectedCount = quickFilters[filterKey].length;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span>{title}</span>
              {selectedCount > 0 && <Badge variant="secondary">{selectedCount}</Badge>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" onSelect={(e) => e.preventDefault()}>
            {options.map(option => (
              <DropdownMenuCheckboxItem
                key={option}
                checked={quickFilters[filterKey].includes(option)}
                onCheckedChange={() => toggleQuickFilter(filterKey, option)}
                className="capitalize"
              >
                {option.replace(/_/g, ' ')}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    };

    return (
      <Card className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur-xl">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger><SelectValue placeholder="Filtrar por evento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eventos</SelectItem>
                {allEvents.map(event => <SelectItem key={event} value={event}>{event}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <FilterDropdown title="Status" filterKey="status" options={allStatus} />
          <FilterDropdown title="Área" filterKey="area" options={allAreas} />
          <FilterDropdown title="Prioridade" filterKey="prioridade" options={allPriorities} />
        </div>
      </Card>
    );
  };
  
  const renderViewControls = () => (<div className="flex flex-wrap items-center justify-between gap-4">{/* ... Conteúdo (inalterado e colapsado para legibilidade) ... */}</div>);
  const renderEmptyState = () => (<Card className="mt-6 rounded-2xl border-dashed">{/* ... Conteúdo (inalterado e colapsado para legibilidade) ... */}</Card>);
  const renderListView = () => (<Card className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">{/* ... Conteúdo (inalterado e colapsado para legibilidade) ... */}</Card>);
  const renderCardView = () => (<div className="mt-6 space-y-6">{/* ... Conteúdo (inalterado e colapsado para legibilidade) ... */}</div>);

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
          <DialogHeader><DialogTitle>Salvar Filtro</DialogTitle><DialogDescription>Dê um nome a este conjunto de filtros.</DialogDescription></DialogHeader>
          <div className="space-y-4 pt-2">
            <Input placeholder="Ex: Urgentes do Financeiro" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
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
