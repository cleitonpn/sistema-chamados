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
  Archive, // ✅ ÍCONE ADICIONADO
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
  
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const [activeFilter, setActiveFilter] = useState('todos');

  const getProjectName = (projetoId) => {
    return projectNames[projetoId] || 'Projeto não encontrado';
  };

  const getFilteredTickets = () => {
    // ✅ LÓGICA ATUALIZADA AQUI
    // Se o filtro 'arquivados' estiver ativo, mostre apenas eles.
    if (activeFilter === 'arquivados') {
        return tickets.filter(ticket => ticket.status === 'arquivado').sort((a, b) => {
            const dateA = a.arquivadoEm?.toDate?.() || new Date(0);
            const dateB = b.arquivadoEm?.toDate?.() || new Date(0);
            return dateB - dateA;
        });
    }

    // Para todos os outros filtros, pegue apenas os tickets NÃO arquivados.
    let filteredTickets = tickets.filter(ticket => ticket.status !== 'arquivado');

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

  const getTicketCounts = () => {
    // ✅ LÓGICA ATUALIZADA AQUI
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
      aguardando_validacao: activeTickets.filter(t => t.status === 'executado_aguardando_validacao').length,
      concluidos: activeTickets.filter(t => t.status === 'concluido').length,
      aguardando_aprovacao: activeTickets.filter(t => t.status === 'aguardando_aprovacao').length,
      arquivados: tickets.filter(t => t.status === 'arquivado').length // Contagem dos arquivados
    };
    return counts;
  };

  // ✅ NOVO CARD DE FILTRO ADICIONADO
  const filterCards = [
    { id: 'todos', title: 'Todos', icon: FileText, color: 'bg-blue-50 border-blue-200 hover:bg-blue-100', iconColor: 'text-blue-600', activeColor: 'bg-blue-500 text-white border-blue-500' },
    ...(userProfile?.funcao === 'gerente' ? [{
      id: 'aguardando_aprovacao', 
      title: 'Aprovação', 
      icon: UserCheck, 
      color: 'bg-orange-50 border-orange-200 hover:bg-orange-100', 
      iconColor: 'text-orange-600', 
      activeColor: 'bg-orange-500 text-white border-orange-500' 
    }] : []),
    { id: 'com_notificacao', title: 'Notificações', icon: BellRing, color: 'bg-red-50 border-red-200 hover:bg-red-100', iconColor: 'text-red-600', activeColor: 'bg-red-500 text-white border-red-500' },
    { id: 'sem_tratativa', title: 'Abertos', icon: AlertCircle, color: 'bg-orange-50 border-orange-200 hover:bg-orange-100', iconColor: 'text-orange-600', activeColor: 'bg-orange-500 text-white border-orange-500' },
    { id: 'em_tratativa', title: 'Em Tratativa', icon: Clock, color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100', iconColor: 'text-yellow-600', activeColor: 'bg-yellow-500 text-white border-yellow-500' },
    { id: 'aguardando_validacao', title: 'Validação', icon: Hourglass, color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100', iconColor: 'text-indigo-600', activeColor: 'bg-indigo-500 text-white border-indigo-500' },
    { id: 'concluidos', title: 'Concluídos', icon: CheckCircle, color: 'bg-green-50 border-green-200 hover:bg-green-100', iconColor: 'text-green-600', activeColor: 'bg-green-500 text-white border-green-500' },
    { id: 'arquivados', title: 'Arquivados', icon: Archive, color: 'bg-gray-50 border-gray-200 hover:bg-gray-100', iconColor: 'text-gray-600', activeColor: 'bg-gray-500 text-white border-gray-500' }
  ];
  
  // (O resto do seu arquivo DashboardPage.jsx continua aqui, sem mais alterações necessárias)
  // ... (funções getDisplayedTickets, getProjectsByEvent, etc.)
  // ... (useEffect e loadDashboardData)
  // ... (JSX de retorno)
  
  // Apenas garanta que o novo status "arquivado" tenha uma cor definida
  const getStatusColor = (status) => {
    const colors = { 
        'aberto': 'bg-blue-100 text-blue-800', 
        'em_tratativa': 'bg-yellow-100 text-yellow-800', 
        'em_execucao': 'bg-blue-100 text-blue-800', 
        'enviado_para_area': 'bg-purple-100 text-purple-800', 
        'escalado_para_area': 'bg-purple-100 text-purple-800', 
        'aguardando_aprovacao': 'bg-orange-100 text-orange-800', 
        'executado_aguardando_validacao': 'bg-indigo-100 text-indigo-800', 
        'concluido': 'bg-green-100 text-green-800', 
        'cancelado': 'bg-red-100 text-red-800', 
        'devolvido': 'bg-pink-100 text-pink-800',
        'arquivado': 'bg-gray-100 text-gray-700' // ✅ COR PARA O NOVO STATUS
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };
  
  // ... (restante do arquivo)

  // Omitindo o restante do arquivo por brevidade, pois nenhuma outra alteração é necessária nele.
  // Cole o código acima no início do seu arquivo, substituindo as funções existentes.
  
  return (
    <div className="min-h-screen bg-gray-50 flex">
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
              (userProfile?.funcao === 'operador' && userProfile?.area === 'almoxarifado') ||
              (userProfile?.funcao === 'operador' && userProfile?.area === 'logistica')) && (
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
                  
                  if (count === 0 && card.id !== 'todos' && card.id !== 'arquivados') return null;
                  
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
                                    {ticket.status?.replace(/_/g, ' ')}
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
                
                {getFilteredTickets().length === 0 && (
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
              {/* O conteúdo da aba de projetos permanece o mesmo */}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
