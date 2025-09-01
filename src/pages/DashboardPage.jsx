import React, { useState, useEffect, useMemo } from 'react';
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
  Lock,
  Search,
  ArrowUpDown,
  Star,
  StarOff,
  Grid,
  List,
  Save,
  Bookmark
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
  
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const [activeFilter, setActiveFilter] = useState('todos');

  // Novos estados para as funcionalidades solicitadas
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [sortBy, setSortBy] = useState('dataUltimaAtualizacao');
  const [quickFilters, setQuickFilters] = useState({
    status: [],
    area: [],
    prioridade: []
  });
  const [viewMode, setViewMode] = useState('cards'); // 'cards' ou 'list'
  const [savedFilters, setSavedFilters] = useState([]);
  const [showSaveFilterDialog, setShowSaveFilterDialog] = useState(false);
  const [filterName, setFilterName] = useState('');

  // Tickets considerados 'abertos/ativos' para Produtor/Consultor
  const isActiveTicket = (t) => !['concluido','cancelado','arquivado'].includes(t.status);
  const ticketHasAnyProject = (t, ids) => {
    if (!ids || ids.length === 0) return false;
    if (Array.isArray(t.projetos) && t.projetos.length) return t.projetos.some(id => ids.includes(id));
    if (t.projetoId) return ids.includes(t.projetoId);
    return false;
  };

  const getProjectName = (projetoId) => {
    const project = projects.find(p => p.id === projetoId);
    if (project) {
      return project.feira ? `${project.nome} – ${project.feira}` : project.nome;
    }
    return projectNames[projetoId] || 'Projeto não encontrado';
  };

  // Função para obter todos os eventos únicos
  const getAllEvents = () => {
    const events = [...new Set(projects.map(p => p.feira).filter(Boolean))];
    return events.sort();
  };

  // Função para obter áreas únicas dos tickets
  const getAllAreas = () => {
    const areas = [...new Set(tickets.map(t => t.area).filter(Boolean))];
    return areas.sort();
  };

  // Função para obter status únicos dos tickets
  const getAllStatus = () => {
    const status = [...new Set(tickets.map(t => t.status).filter(Boolean))];
    return status.sort();
  };

  // Função para obter prioridades únicas dos tickets
  const getAllPriorities = () => {
    const priorities = [...new Set(tickets.map(t => t.prioridade).filter(Boolean))];
    return priorities.sort();
  };

  const getFilteredTickets = () => {
    let filteredTickets = tickets;

    // Se o filtro 'arquivados' estiver ativo, mostre apenas eles.
    if (activeFilter === 'arquivados') {
      filteredTickets = tickets.filter(ticket => ticket.status === 'arquivado');
    } else {
      // Para todos os outros filtros, pegue apenas os tickets NÃO arquivados.
      filteredTickets = tickets.filter(ticket => ticket.status !== 'arquivado');

      switch (activeFilter) {
        case 'todos':
          // 'todos' agora significa 'todos os ativos'
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
            ticket.status === 'executado_aguardando_validacao' || ticket.status === 'executado_aguardando_validacao_operador'
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
    }

    // Aplicar filtro de busca
    if (searchTerm) {
      filteredTickets = filteredTickets.filter(ticket => 
        ticket.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Aplicar filtro por evento
    if (selectedEvent && selectedEvent !== 'all') {
      filteredTickets = filteredTickets.filter(ticket => {
        const ticketProjectIds = Array.isArray(ticket.projetos) && ticket.projetos.length > 0
          ? ticket.projetos
          : (ticket.projetoId ? [ticket.projetoId] : []);
        
        return ticketProjectIds.some(projectId => {
          const project = projects.find(p => p.id === projectId);
          return project?.feira === selectedEvent;
        });
      });
    }

    // Aplicar filtros rápidos
    if (quickFilters.status.length > 0) {
      filteredTickets = filteredTickets.filter(ticket => quickFilters.status.includes(ticket.status));
    }
    if (quickFilters.area.length > 0) {
      filteredTickets = filteredTickets.filter(ticket => quickFilters.area.includes(ticket.area));
    }
    if (quickFilters.prioridade.length > 0) {
      filteredTickets = filteredTickets.filter(ticket => quickFilters.prioridade.includes(ticket.prioridade));
    }

    // Aplicar ordenação
    return filteredTickets.sort((a, b) => {
      switch (sortBy) {
        case 'dataUltimaAtualizacao':
          const dateA = a.dataUltimaAtualizacao?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.dataUltimaAtualizacao?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        case 'prioridade':
          const priorityOrder = { 'alta': 3, 'media': 2, 'baixa': 1 };
          return (priorityOrder[b.prioridade] || 0) - (priorityOrder[a.prioridade] || 0);
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'titulo':
          return (a.titulo || '').localeCompare(b.titulo || '');
        default:
          return 0;
      }
    });
  };

  const getTicketCounts = () => {
    const activeTickets = tickets.filter(t => t.status !== 'arquivado');
    const counts = {
      todos: activeTickets.length,
      com_notificacao: Object.keys(ticketNotifications).length,
      sem_tratativa: activeTickets.filter(t => t.status === 'aberto').length,
      em_tratativa: activeTickets.filter(t => t.status === 'em_tratativa').length,
      em_execucao: activeTickets.filter(t => t.status === 'em_execucao').length,
      escalado: activeTickets.filter(t => 
        t.status === 'enviado_para_area' || t.status === 'escalado_para_area'
      ).length,
      escalado_para_mim: activeTickets.filter(t => {
        if (t.status === 'escalado_para_outra_area') {
          if (t.areaEscalada === userProfile?.area) return true;
          if (t.usuarioEscalado === user?.uid || t.usuarioEscalado === userProfile?.email || t.usuarioEscalado === userProfile?.nome) return true;
          if (t.areasEnvolvidas && t.areasEnvolvidas.includes(userProfile?.area)) return true;
        }
        return false;
      }).length,
     aguardando_validacao: activeTickets.filter(t => t.status === 'executado_aguardando_validacao' || t.status === 'executado_aguardando_validacao_operador').length,
      concluidos: activeTickets.filter(t => t.status === 'concluido').length,
      aguardando_aprovacao: activeTickets.filter(t => t.status === 'aguardando_aprovacao').length,
      arquivados: tickets.filter(t => t.status === 'arquivado').length
    };
    return counts;
  };

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
    { id: 'concluidos', title: 'Concluídos', icon: CheckCircle, color: 'bg-green-50 border-green-200 hover:bg-green-100', iconColor: 'text-green-600', activeColor: 'bg-green-500 text-white border-green-500' },
    { id: 'arquivados', title: 'Arquivados', icon: Archive, color: 'bg-gray-50 border-gray-200 hover:bg-gray-100', iconColor: 'text-gray-600', activeColor: 'bg-gray-500 text-white border-gray-500' }
  ];

  const getDisplayedTickets = () => getFilteredTickets();
  
  const getTicketsByProject = () => {
    const grouped = {};
    const displayedTickets = getDisplayedTickets();
    displayedTickets.forEach(ticket => {
      const ids = Array.isArray(ticket.projetos) && ticket.projetos.length > 0
        ? ticket.projetos
        : (ticket.projetoId ? [ticket.projetoId] : []);
      if (ids.length === 0) {
        if (!grouped['Sem Projeto']) grouped['Sem Projeto'] = [];
        grouped['Sem Projeto'].push(ticket);
      } else {
        ids.forEach(pid => {
          const name = getProjectName(pid);
          if (!grouped[name]) grouped[name] = [];
          grouped[name].push(ticket);
        });
      }
    });
    return grouped;
  };

  const toggleEventExpansion = (eventName) => setExpandedEvents(prev => ({ ...prev, [eventName]: !prev[eventName] }));
  const toggleProjectExpansion = (projectName) => setExpandedProjects(prev => ({ ...prev, [projectName]: !prev[projectName] }));
  const handleTicketClick = (ticketId) => navigate(`/chamado/${ticketId}`);

  const getStatusColor = (status) => {
    const colors = { 'aberto': 'bg-blue-100 text-blue-800', 'em_tratativa': 'bg-yellow-100 text-yellow-800', 'em_execucao': 'bg-blue-100 text-blue-800', 'enviado_para_area': 'bg-purple-100 text-purple-800', 'escalado_para_area': 'bg-purple-100 text-purple-800', 'aguardando_aprovacao': 'bg-orange-100 text-orange-800', 'executado_aguardando_validacao': 'bg-indigo-100 text-indigo-800', 'concluido': 'bg-green-100 text-green-800', 'cancelado': 'bg-red-100 text-red-800', 'devolvido': 'bg-pink-100 text-pink-800', 'arquivado': 'bg-gray-100 text-gray-700' };
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

  // Função para adicionar/remover filtros rápidos
  const toggleQuickFilter = (type, value) => {
    setQuickFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value) 
        ? prev[type].filter(item => item !== value)
        : [...prev[type], value]
    }));
  };

  // Função para limpar todos os filtros
  const clearAllFilters = () => {
    setActiveFilter('todos');
    setSearchTerm('');
    setSelectedEvent('all');
    setQuickFilters({ status: [], area: [], prioridade: [] });
    setSortBy('dataUltimaAtualizacao');
  };

  // Função para salvar filtro atual
  const saveCurrentFilter = () => {
    if (!filterName.trim()) return;
    
    const newFilter = {
      id: Date.now().toString(),
      name: filterName,
      activeFilter,
      searchTerm,
      selectedEvent,
      quickFilters,
      sortBy
    };

    const updatedFilters = [...savedFilters, newFilter];
    setSavedFilters(updatedFilters);
    localStorage.setItem('dashboardSavedFilters', JSON.stringify(updatedFilters));
    
    setFilterName('');
    setShowSaveFilterDialog(false);
  };

  // Função para aplicar filtro salvo
  const applySavedFilter = (filter) => {
    setActiveFilter(filter.activeFilter);
    setSearchTerm(filter.searchTerm);
    setSelectedEvent(filter.selectedEvent);
    setQuickFilters(filter.quickFilters);
    setSortBy(filter.sortBy);
  };

  // Função para remover filtro salvo
  const removeSavedFilter = (filterId) => {
    const updatedFilters = savedFilters.filter(f => f.id !== filterId);
    setSavedFilters(updatedFilters);
    localStorage.setItem('dashboardSavedFilters', JSON.stringify(updatedFilters));
  };

  // Carregar filtros salvos do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dashboardSavedFilters');
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    }
  }, []);

  const loadTicketNotifications = async () => {
    if (!user?.uid || !tickets.length) return;
    try {
      const notificationCounts = {};
      for (const ticket of tickets) {
        try {
          const count = await notificationService.getUnreadNotificationsByTicket(user.uid, ticket.id);
          if (count > 0) {
            notificationCounts[ticket.id] = count;
          }
        } catch (ticketError) {
          console.warn(`⚠️ Erro ao carregar notificações do chamado ${ticket.id}:`, ticketError);
        }
      }
      setTicketNotifications(notificationCounts);
    } catch (error) {
      console.error('❌ Erro ao carregar notificações dos chamados:', error);
      setTicketNotifications({});
    }
  };

 useEffect(() => {
  if (authInitialized && user && userProfile && user.uid) {
    // 1. Carrega os dados imediatamente quando a página abre
    console.log("Carregando dados iniciais...");
    loadDashboardData();

    // 2. Configura um intervalo para recarregar os dados a cada 3 minutos
    const tresMinutos = 3 * 60 * 1000;
    const intervalId = setInterval(() => {
      console.log("Recarregando dados automaticamente...");
      loadDashboardData();
    }, tresMinutos);

    // 3. Limpa o intervalo quando o usuário sai da página (MUITO IMPORTANTE)
    return () => {
      clearInterval(intervalId);
    };

  } else if (authInitialized && !user) {
    navigate('/login');
  } else if (authInitialized && user && !userProfile) {
    setLoading(false);
  }
}, [user, userProfile, authInitialized, navigate]);

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

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Carregando dados para:', userProfile?.funcao);
      
      const filterConfidential = (ticket) => {
  // ✅ VERIFICA AMBOS OS CAMPOS POSSÍVEIS
  const isConfidential = ticket.isConfidential || ticket.confidencial;
  
  if (!isConfidential) {
    return true;
  }
  
  const isCreator = ticket.criadoPor === user.uid;
  const isAdmin = userProfile?.funcao === 'administrador';
  
  // ✅ NOVA LÓGICA: Operadores podem ver chamados confidenciais da sua área
  const isOperatorOfArea = userProfile?.funcao === 'operador' && (
    ticket.area === userProfile?.area ||
    ticket.areaDeOrigem === userProfile?.area ||
    ticket.areaInicial === userProfile?.area ||
    ticket.areaOriginal === userProfile?.area
  );
  
  // ✅ GERENTES PODEM VER TODOS OS CONFIDENCIAIS
  const isManager = userProfile?.funcao === 'gerente';
  
  return isCreator || isAdmin || isOperatorOfArea || isManager;
};

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
        const produtorProjects = allProjects.filter(project => project.produtorId === user.uid);
        const produtorProjectIds = produtorProjects.map(p => p.id);
        const produtorTickets = allTickets.filter(t => ticketHasAnyProject(t, produtorProjectIds) && filterConfidential(t));
        setProjects(produtorProjects);
        setTickets(produtorTickets);
        setUsers(allUsers);
        const projectNamesMap = {};
        produtorProjects.forEach(project => { projectNamesMap[project.id] = project.nome; });
        setProjectNames(projectNamesMap);
      } else if (userProfile?.funcao === 'consultor') {
        console.log('👨‍💼 Consultor: carregando projetos próprios e chamados (somente abertos)');
        const [allProjects, allTickets, allUsers] = await Promise.all([
          projectService.getAllProjects(),
          ticketService.getAllTickets(),
          userService.getAllUsers()
        ]);
        const consultorProjects = allProjects.filter(project => project.consultorId === user.uid);
        const consultorProjectIds = consultorProjects.map(p => p.id);
        const consultorTickets = allTickets.filter(t => ticketHasAnyProject(t, consultorProjectIds) && filterConfidential(t));
        setProjects(consultorProjects);
        setTickets(consultorTickets);
        setUsers(allUsers);
        const projectNamesMap = {};
        allProjects.forEach(project => { projectNamesMap[project.id] = project.nome; });
        setProjectNames(projectNamesMap);
      } else if (userProfile?.funcao === 'operador') {
  console.log('⚙️ Operador: carregando chamados da área (inclui histórico)');
  const [allProjects, allTickets, allUsers] = await Promise.all([
    projectService.getAllProjects(),
    ticketService.getAllTickets(),
    userService.getAllUsers()
  ]);
  
  const areaOp = userProfile.area;
  const operatorTickets = allTickets.filter(t => {
    // ✅ CONDIÇÕES EXPANDIDAS PARA GARANTIR VISIBILIDADE
    const atual = t.area === areaOp;
    const origem = t.areaDeOrigem === areaOp || t.areaInicial === areaOp || t.areaOriginal === areaOp;
    const destino = t.areaDestino === areaOp;
    const devolvido = t.status === 'enviado_para_area' && (t.area === areaOp || t.areaDeOrigem === areaOp);
    const rejeitou = t.areaQueRejeitou === areaOp;
    const envolvido = Array.isArray(t.areasEnvolvidas) && t.areasEnvolvidas.includes(areaOp);
    const atribuido = t.atribuidoA === user.uid;
    const abertoPeloUsuario = t.criadoPor === user.uid;
    
    // ✅ NOVA CONDIÇÃO: Chamados escalados para a área do operador
    const escaladoParaArea = t.status === 'escalado_para_outra_area' && t.areaEscalada === areaOp;
    
    // ✅ NOVA CONDIÇÃO: Chamados transferidos para a área
    const transferidoParaArea = t.status === 'transferido_para_area' && t.areaDestino === areaOp;
    
    // ✅ CONDIÇÃO ESPECIAL PARA FINANCEIRO: Incluir chamados que precisam de aprovação financeira
    const precisaFinanceiro = areaOp === 'financeiro' && (
      t.tipo === 'despesas_programada' || 
      t.tipo === 'despesas_nao_programadas' ||
      t.area === 'financeiro' ||
      t.areaDeOrigem === 'financeiro' ||
      t.gerenciaDestino === 'gerente_financeiro'
    );
    
    return (atual || origem || destino || devolvido || rejeitou || envolvido || 
            atribuido || abertoPeloUsuario || escaladoParaArea || 
            transferidoParaArea || precisaFinanceiro) && filterConfidential(t);
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
        console.log('👔 Gerente: carregando TODOS os dados');
        const [allProjects, allTickets, allUsers] = await Promise.all([
          projectService.getAllProjects(),
          ticketService.getAllTickets(),
          userService.getAllUsers()
        ]);
        
        setProjects(allProjects);
        setUsers(allUsers);
        setTickets(allTickets);
        
        const projectNamesMap = {};
        allProjects.forEach(project => {
          projectNamesMap[project.id] = project.nome;
        });
        setProjectNames(projectNamesMap);
        
      } else {
        console.log('👤 Usuário padrão: carregando dados básicos');
        const [allProjects, userTickets, allUsers] = await Promise.all([
          projectService.getAllProjects(),
          ticketService.getTicketsByUser(user.uid),
          userService.getAllUsers()
        ]);
        
        setProjects(allProjects);
        setTickets(userTickets);
        setUsers(allUsers);
        
        const projectNamesMap = {};
        allProjects.forEach(project => {
          projectNamesMap[project.id] = project.nome;
        });
        setProjectNames(projectNamesMap);
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados do dashboard:', error);
      setProjects([]);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

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
  const displayedTickets = getDisplayedTickets();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Sidebar com design mais elegante */}
      <div className={`${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-72 bg-white/95 backdrop-blur-xl shadow-2xl border-r border-slate-200/60 transform transition-all duration-300 ease-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-20 px-6 border-b border-slate-200/50 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Gestão</h1>
              <p className="text-sm text-slate-500 -mt-1">Chamados</p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>
        
        <nav className="mt-8 px-4">
          <div className="space-y-2">
            {(userProfile?.funcao === 'produtor' || userProfile?.funcao === 'consultor' || userProfile?.funcao === 'administrador' || 
              (userProfile?.funcao === 'operador' && userProfile?.area === 'operacional') ||
              (userProfile?.funcao === 'operador' && userProfile?.area === 'comunicacao_visual') ||
              (userProfile?.funcao === 'operador' && userProfile?.area === 'almoxarifado') ||
              (userProfile?.funcao === 'operador' && userProfile?.area === 'logistica')) && (
              <Button 
                onClick={() => navigate('/novo-chamado')}
                className="w-full justify-start mb-6 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
              >
                <Plus className="h-5 w-5 mr-3" />
                <span className="font-medium">Novo Chamado</span>
              </Button>
            )}
            
            {userProfile?.funcao === 'administrador' && (
              <Button 
                onClick={() => navigate('/novo-projeto')}
                variant="outline"
                className="w-full justify-start mb-4 h-11 border-slate-200 hover:bg-slate-50 rounded-xl transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-3" />
                <span className="font-medium">Novo Projeto</span>
              </Button>
            )}
            
            <div className="space-y-1">
              <Button 
                onClick={() => navigate('/projetos')}
                variant="ghost"
                className="w-full justify-start h-11 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-700 hover:text-slate-900"
              >
                <FolderOpen className="h-4 w-4 mr-3" />
                <span className="font-medium">Ver Projetos</span>
              </Button>
              
              <Button 
                onClick={() => navigate('/cronograma')}
                variant="ghost"
                className="w-full justify-start h-11 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-700 hover:text-slate-900"
              >
                <Calendar className="h-4 w-4 mr-3" />
                <span className="font-medium">Cronograma</span>
              </Button>
              
              {userProfile?.funcao === 'administrador' && (
                <>
                  <Button 
                    onClick={() => navigate('/eventos')}
                    variant="ghost"
                    className="w-full justify-start h-11 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-700 hover:text-slate-900"
                  >
                    <Calendar className="h-4 w-4 mr-3" />
                    <span className="font-medium">Eventos</span>
                  </Button>
                  
                  <Button 
                    onClick={() => navigate('/usuarios')}
                    variant="ghost"
                    className="w-full justify-start h-11 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-700 hover:text-slate-900"
                  >
                    <Users className="h-4 w-4 mr-3" />
                    <span className="font-medium">Usuários</span>
                  </Button>
                  
                  <Button 
                    onClick={() => navigate('/relatorios')}
                    variant="ghost"
                    className="w-full justify-start h-11 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-700 hover:text-slate-900"
                  >
                    <BarChart3 className="h-4 w-4 mr-3" />
                    <span className="font-medium">Relatórios</span>
                  </Button>
                  
                  <Button 
                    onClick={() => navigate('/analytics')}
                    variant="ghost"
                    className="w-full justify-start h-11 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-700 hover:text-slate-900"
                  >
                    <BarChart3 className="h-4 w-4 mr-3" />
                    <span className="font-medium">Analytics</span>
                  </Button>
                  
                  <Button 
                    onClick={() => navigate('/admin/painel')}
                    variant="ghost"
                    className="w-full justify-start h-11 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-700 hover:text-slate-900"
                  >
                    <BarChart3 className="h-4 w-4 mr-3" />
                    <span className="font-medium">Painel Admin</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>
        
        <div className="absolute bottom-0 w-full p-4 border-t border-slate-200/50 bg-gradient-to-t from-slate-50/80 to-transparent">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start h-12 hover:bg-slate-100 rounded-xl transition-all duration-200">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center mr-3 text-white text-sm font-medium">
                  {(userProfile?.nome || user?.email)?.charAt(0)?.toUpperCase()}
                </div>
                <div className="text-left overflow-hidden">
                  <p className="font-medium text-slate-900 truncate">{userProfile?.nome || user?.email}</p>
                  <p className="text-xs text-slate-500 capitalize truncate">{userProfile?.funcao}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={logout} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile overlay com blur elegante */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header redesigned - mais elegante e responsivo */}
        <header className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-slate-200/60 sticky top-0 z-30">
          <div className="flex items-center justify-between h-20 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <Menu className="h-6 w-6 text-slate-700" />
              </button>
              <div className="flex items-center space-x-4">
                <div className="hidden sm:block">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Dashboard
                  </h2>
                  <p className="text-sm text-slate-500 -mt-1">
                    Bem-vindo, <span className="font-medium text-slate-700">{userProfile?.nome || user?.email}</span>
                  </p>
                </div>
                <div className="sm:hidden">
                  <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationCenter />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-gradient-to-b from-transparent to-slate-50/30">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
            {/* Campo de busca elegante */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Pesquisar chamados por título ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-14 text-lg bg-white/80 backdrop-blur-sm border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md focus:shadow-lg transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Filtros e controles elegantes */}
            <div className="bg-white/60 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-6">
              <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                  {/* Filtro por evento */}
                  <div className="flex-1 min-w-[200px]">
                    <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                      <SelectTrigger className="h-12 bg-white/70 backdrop-blur-sm border-slate-200/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                        <SelectValue placeholder="Filtrar por evento" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        <SelectItem value="all" className="rounded-lg">Todos os eventos</SelectItem>
                        {getAllEvents().map(event => (
                          <SelectItem key={event} value={event} className="rounded-lg">{event}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ordenação */}
                  <div className="flex-1 min-w-[180px]">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-12 bg-white/70 backdrop-blur-sm border-slate-200/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        <SelectItem value="dataUltimaAtualizacao" className="rounded-lg">Data de atualização</SelectItem>
                        <SelectItem value="prioridade" className="rounded-lg">Prioridade</SelectItem>
                        <SelectItem value="status" className="rounded-lg">Status</SelectItem>
                        <SelectItem value="titulo" className="rounded-lg">Título</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Controles de ação */}
                <div className="flex items-center gap-3">
                  {/* Toggle de visualização */}
                  <div className="flex items-center bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-xl p-1 shadow-sm">
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('cards')}
                      className={`h-9 px-4 rounded-lg transition-all duration-200 ${
                        viewMode === 'cards' 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                          : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className={`h-9 px-4 rounded-lg transition-all duration-200 ${
                        viewMode === 'list' 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                          : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Filtros salvos */}
                  <div className="flex gap-2">
                    {savedFilters.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-10 px-4 bg-white/70 backdrop-blur-sm border-slate-200/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                            <Bookmark className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">Filtros Salvos</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 rounded-xl border-slate-200 shadow-xl">
                          {savedFilters.map(filter => (
                            <div key={filter.id} className="flex items-center justify-between p-2">
                              <DropdownMenuItem 
                                onClick={() => applySavedFilter(filter)}
                                className="flex-1 cursor-pointer rounded-lg"
                              >
                                <Star className="h-4 w-4 mr-2 text-yellow-500" />
                                {filter.name}
                              </DropdownMenuItem>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSavedFilter(filter.id);
                                }}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowSaveFilterDialog(true)}
                      className="h-10 px-4 bg-white/70 backdrop-blur-sm border-slate-200/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Salvar</span>
                    </Button>

                    {(searchTerm || selectedEvent !== 'all' || sortBy !== 'dataUltimaAtualizacao') && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={clearAllFilters}
                        className="h-10 px-4 bg-white/70 backdrop-blur-sm border-red-200/60 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Limpar</span>
                      </Button>
                    )}
            {/* Tags/Chips para filtros rápidos */}
            <div className="bg-white/60 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Filtros Rápidos</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-3 block">Status:</label>
                  <div className="flex flex-wrap gap-2">
                    {getAllStatus().map(status => (
                      <Badge
                        key={status}
                        variant={quickFilters.status.includes(status) ? 'default' : 'outline'}
                        className={`cursor-pointer transition-all duration-200 px-3 py-1.5 rounded-xl ${
                          quickFilters.status.includes(status) 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                            : 'bg-white/70 hover:bg-blue-50 text-slate-700 border-slate-300 hover:border-blue-300'
                        }`}
                        onClick={() => toggleQuickFilter('status', status)}
                      >
                        {status.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-3 block">Área:</label>
                  <div className="flex flex-wrap gap-2">
                    {getAllAreas().map(area => (
                      <Badge
                        key={area}
                        variant={quickFilters.area.includes(area) ? 'default' : 'outline'}
                        className={`cursor-pointer transition-all duration-200 px-3 py-1.5 rounded-xl ${
                          quickFilters.area.includes(area) 
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm' 
                            : 'bg-white/70 hover:bg-indigo-50 text-slate-700 border-slate-300 hover:border-indigo-300'
                        }`}
                        onClick={() => toggleQuickFilter('area', area)}
                      >
                        {area.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-3 block">Prioridade:</label>
                  <div className="flex flex-wrap gap-2">
                    {getAllPriorities().map(priority => (
                      <Badge
                        key={priority}
                        variant={quickFilters.prioridade.includes(priority) ? 'default' : 'outline'}
                        className={`cursor-pointer transition-all duration-200 px-3 py-1.5 rounded-xl ${
                          quickFilters.prioridade.includes(priority) 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' 
                            : 'bg-white/70 hover:bg-emerald-50 text-slate-700 border-slate-300 hover:border-emerald-300'
                        }`}
                        onClick={() => toggleQuickFilter('prioridade', priority)}
                      >
                        {priority}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Cards de filtros elegantes e responsivos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
              {filterCards.map((card) => {
                const IconComponent = card.icon;
                const isActive = activeFilter === card.id;
                const count = counts[card.id];
                
                return (
                  <Card
                    key={card.id}
                    className={`cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                      isActive 
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-500 shadow-lg shadow-blue-500/25' 
                        : 'bg-white/80 backdrop-blur-sm hover:bg-white border-slate-200/60 hover:border-slate-300 shadow-sm hover:shadow-md'
                    } rounded-2xl overflow-hidden`}
                    onClick={() => setActiveFilter(card.id)}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div className={`p-3 rounded-xl ${
                          isActive 
                            ? 'bg-white/20 backdrop-blur-sm' 
                            : 'bg-gradient-to-br from-slate-100 to-slate-200'
                        }`}>
                          <IconComponent 
                            className={`h-6 w-6 ${
                              isActive ? 'text-white' : 'text-slate-600'
                            }`} 
                          />
                        </div>
                        <div className="space-y-1">
                          <p className={`text-xs sm:text-sm font-medium leading-tight ${
                            isActive ? 'text-white/90' : 'text-slate-700'
                          }`}>
                            {card.title}
                          </p>
                          <p className={`text-xl sm:text-2xl font-bold ${
                            isActive ? 'text-white' : 'text-slate-900'
                          }`}>
                            {count}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge className="bg-blue-600 text-white px-3 py-1 rounded-xl text-xs">
                        {counts[activeFilter]} chamado{counts[activeFilter] !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveFilter('todos')}
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-xl transition-all duration-200"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar filtro
                </Button>
              </div>
            )}
            
            {/* Visualização dos chamados */}
            {viewMode === 'list' ? (
              // Visualização em lista/tabela elegante
              <Card className="overflow-hidden rounded-2xl border-slate-200/60 shadow-lg">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                          <TableHead className="font-semibold text-slate-700 px-6 py-4">Título</TableHead>
                          <TableHead className="font-semibold text-slate-700 px-4 py-4">Status</TableHead>
                          <TableHead className="font-semibold text-slate-700 px-4 py-4">Prioridade</TableHead>
                          <TableHead className="font-semibold text-slate-700 px-4 py-4">Área</TableHead>
                          <TableHead className="font-semibold text-slate-700 px-4 py-4">Projeto/Evento</TableHead>
                          <TableHead className="font-semibold text-slate-700 px-4 py-4">Atualização</TableHead>
                          <TableHead className="w-[80px] px-4 py-4"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredAndSortedTickets().map((ticket) => {
                          const projectInfo = getProjectInfo(ticket);
                          return (
                            <TableRow 
                              key={ticket.id} 
                              className="hover:bg-slate-50/80 transition-colors duration-200 border-b border-slate-100 cursor-pointer"
                              onClick={() => handleTicketClick(ticket.id)}
                            >
                              <TableCell className="px-6 py-4">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    {(ticket.isConfidential || ticket.confidencial) && (
                                      <Lock className="h-4 w-4 text-orange-500 flex-shrink-0" title="Chamado Confidencial" />
                                    )}
                                    <h3 className="font-medium text-slate-900 truncate max-w-xs">{ticket.titulo}</h3>
                                    {ticketNotifications[ticket.id] && (
                                      <Badge className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                        {ticketNotifications[ticket.id]}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-600 truncate max-w-md">{(ticket.isConfidential || ticket.confidencial) ? 'Descrição confidencial' : ticket.descricao}</p>
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <Badge className={`${getStatusColor(ticket.status)} text-xs px-3 py-1 rounded-xl`}>
                                  {ticket.status?.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <Badge className={`${getPriorityColor(ticket.prioridade)} text-xs px-3 py-1 rounded-xl`}>
                                  {ticket.prioridade}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <span className="text-sm text-slate-600 capitalize">
                                  {ticket.area?.replace('_', ' ')}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <span className="text-sm text-slate-700 font-medium truncate max-w-xs block">
                                  {projectInfo}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <div className="text-sm text-slate-600">
                                  <div className="font-medium">
                                    {(ticket.dataUltimaAtualizacao?.toDate?.() || ticket.createdAt?.toDate?.())?.toLocaleDateString('pt-BR') || 'N/A'}
                                  </div>
                                  <div className="text-xs opacity-75">
                                    {(ticket.dataUltimaAtualizacao?.toDate?.() || ticket.createdAt?.toDate?.())?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || ''}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTicketClick(ticket.id);
                                  }}
                                  className="h-8 w-8 p-0 hover:bg-blue-100 rounded-lg transition-colors duration-200"
                                >
                                  <Eye className="h-4 w-4 text-slate-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {getFilteredAndSortedTickets().length === 0 && (
                    <div className="p-12 text-center">
                      <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-700 mb-2">
                        {activeFilter === 'todos' ? 'Nenhum chamado encontrado' : 'Nenhum chamado neste filtro'}
                      </h3>
                      <p className="text-slate-500 mb-4">
                        {activeFilter === 'todos' 
                          ? 'Não há chamados para exibir no momento.' 
                          : `Não há chamados com o filtro "${filterCards.find(c => c.id === activeFilter)?.title}" aplicado.`
                        }
                      </p>
                      {activeFilter !== 'todos' && (
                        <Button
                          variant="outline"
                          onClick={() => setActiveFilter('todos')}
                          className="rounded-xl"
                        >
                          Ver todos os chamados
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
                    <TableBody>
                      {displayedTickets.map(ticket => (
                        <TableRow 
                          key={ticket.id} 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => handleTicketClick(ticket.id)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {(ticket.isConfidential || ticket.confidencial) && (
                                <Lock className="h-4 w-4 text-orange-500" title="Chamado Confidencial" />
                              )}
                              <span className="font-medium">{ticket.titulo}</span>
                              {ticketNotifications[ticket.id] && (
                                <Badge className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                  {ticketNotifications[ticket.id]}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(ticket.status)} text-xs`}>
                              {ticket.status?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getPriorityColor(ticket.prioridade)} text-xs`}>
                              {ticket.prioridade}
                            </Badge>
                          </TableCell>
                          <TableCell>{ticket.area?.replace('_', ' ')}</TableCell>
                          <TableCell>
                            {(() => {
                              const ids = Array.isArray(ticket.projetos) && ticket.projetos.length > 0
                                ? ticket.projetos
                                : (ticket.projetoId ? [ticket.projetoId] : []);
                              return ids.length > 0 ? getProjectName(ids[0]) : 'Sem Projeto';
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-500">
                              {(ticket.dataUltimaAtualizacao?.toDate?.() || ticket.createdAt?.toDate?.())?.toLocaleDateString('pt-BR') || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
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
                      ))}
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
                          : `Não há chamados com o filtro "${filterCards.find(c => c.id === activeFilter)?.title}" aplicado.`
                        }
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              // Visualização em cards elegantes (agrupada por projeto)
              <div className="space-y-6">
                {Object.entries(getTicketsByProject()).map(([projectName, projectTickets]) => (
                  <Card key={projectName} className="overflow-hidden rounded-2xl border-slate-200/60 shadow-lg bg-white/80 backdrop-blur-sm">
                    <button
                      onClick={() => toggleProjectExpansion(projectName)}
                      className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50/80 transition-all duration-200"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-xl transition-all duration-200 ${expandedProjects[projectName] ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                          {expandedProjects[projectName] ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-slate-900">{projectName}</h3>
                          <p className="text-sm text-slate-500 mt-1">
                            {projectTickets.length} chamado{projectTickets.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-blue-600 text-white px-4 py-2 rounded-xl">
                        {projectTickets.length}
                      </Badge>
                    </button>
                    
                    {expandedProjects[projectName] && (
                      <div className="border-t border-slate-200/60 bg-gradient-to-b from-slate-50/50 to-slate-50/30 p-6">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {projectTickets.map((ticket) => {
                            const isAwaitingApproval = ticket.status === 'aguardando_aprovacao' && 
                                                     userProfile?.funcao === 'gerente' && 
                                                     ticket.gerenteResponsavelId === user.uid;
                            
                            return (
                              <Card 
                                key={ticket.id} 
                                className={`cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-2xl overflow-hidden ${
                                  isAwaitingApproval 
                                    ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-300 shadow-lg' 
                                    : 'bg-white/90 backdrop-blur-sm border-slate-200/60 hover:border-slate-300'
                                }`}
                                onClick={() => handleTicketClick(ticket.id)}
                              >
                                <CardContent className="p-5">
                                  <div className="space-y-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-center gap-2">
                                          {(ticket.isConfidential || ticket.confidencial) && (
                                            <div className="p-1 bg-orange-100 rounded-lg">
                                              <Lock className="h-4 w-4 text-orange-600" title="Chamado Confidencial" />
                                            </div>
                                          )}
                                          <h4 className="font-semibold text-slate-900 truncate text-base">{ticket.titulo}</h4>
                                          {ticketNotifications[ticket.id] && (
                                            <Badge className="bg-red-500 text-white text-xs px-2 py-1 rounded-full shadow-sm">
                                              {ticketNotifications[ticket.id]}
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                                          {(ticket.isConfidential || ticket.confidencial) ? 'Descrição confidencial' : ticket.descricao}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge className={`${getStatusColor(ticket.status)} text-xs px-3 py-1 rounded-xl font-medium`}>
                                        {ticket.status?.replace('_', ' ')}
                                      </Badge>
                                      <Badge className={`${getPriorityColor(ticket.prioridade)} text-xs px-3 py-1 rounded-xl font-medium`}>
                                        {ticket.prioridade}
                                      </Badge>
                                      {ticket.area && (
                                        <Badge variant="outline" className="text-xs px-3 py-1 rounded-xl bg-slate-50 text-slate-600 border-slate-300">
                                          {ticket.area?.replace('_', ' ')}
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                                      <div className="text-xs text-slate-500">
                                        <div className="font-medium">
                                          {(ticket.dataUltimaAtualizacao?.toDate?.() || ticket.createdAt?.toDate?.())?.toLocaleDateString('pt-BR') || 'N/A'}
                                        </div>
                                        <div className="opacity-75">
                                          {(ticket.dataUltimaAtualizacao?.toDate?.() || ticket.createdAt?.toDate?.())?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || ''}
                                        </div>
                                      </div>
                                      
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTicketClick(ticket.id);
                                        }}
                                        className="h-8 w-8 p-0 hover:bg-blue-100 rounded-lg transition-all duration-200"
                                      >
                                        <Eye className="h-4 w-4 text-slate-600" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
                
                {Object.keys(getTicketsByProject()).length === 0 && (
                  <Card className="rounded-2xl border-slate-200/60 bg-white/80 backdrop-blur-sm">
                    <CardContent className="p-12 text-center">
                      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center">
                        <FileText className="h-10 w-10 text-slate-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-800 mb-3">
                        {activeFilter === 'todos' ? 'Nenhum chamado encontrado' : 'Nenhum chamado neste filtro'}
                      </h3>
                      <p className="text-slate-500 mb-6 max-w-md mx-auto leading-relaxed">
                        {activeFilter === 'todos' 
                          ? 'Não há chamados para exibir no momento.' 
                          : `Não há chamados com o filtro "${filterCards.find(c => c.id === activeFilter)?.title}" aplicado.`
                        }
                      </p>
                      {activeFilter !== 'todos' && (
                        <Button
                          variant="outline"
                          onClick={() => setActiveFilter('todos')}
                          className="rounded-xl px-6 py-3 bg-white hover:bg-slate-50 border-slate-300 hover:border-slate-400 transition-all duration-200"
                        >
                          Ver todos os chamados
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            
            {/* Dialog para salvar filtros */}
            <Dialog open={showSaveFilterDialog} onOpenChange={setShowSaveFilterDialog}>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Salvar Filtro</DialogTitle>
                  <DialogDescription>
                    Dê um nome para este conjunto de filtros
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Nome do filtro..."
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    className="rounded-xl"
                  />
                  <div className="flex justify-end space-x-3">
                    <Button variant="outline" onClick={() => setShowSaveFilterDialog(false)} className="rounded-xl">
                      Cancelar
                    </Button>
                    <Button onClick={saveCurrentFilter} className="rounded-xl">
                      Salvar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </main>
      </div>
    </div>
  );
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
            )}
          </div>
        </main>
      </div>

      {/* Dialog para salvar filtro */}
      <Dialog open={showSaveFilterDialog} onOpenChange={setShowSaveFilterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Filtro Atual</DialogTitle>
            <DialogDescription>
              Dê um nome para o filtro atual para salvá-lo e aplicá-lo rapidamente no futuro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome do filtro..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowSaveFilterDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={saveCurrentFilter} disabled={!filterName.trim()}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
