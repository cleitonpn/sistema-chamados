import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService } from '@/services/ticketService';
import { messageService } from '@/services/messageService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import notificationService from '@/services/notificationService';
import { TICKET_CATEGORIES } from '@/constants/ticketCategories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  Building, 
  Tag, 
  Calendar,
  MessageSquare,
  Send,
  Paperclip,
  Image as ImageIcon,
  Download,
  Archive,
  ArchiveRestore,
  Link,
  Users,
  History,
  FolderOpen,
  Folder,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus
} from 'lucide-react';

const TicketDetailPage = () => {
  // ✅ CORREÇÃO: Usar ticketId diretamente como no arquivo que funciona
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [conclusionImages, setConclusionImages] = useState([]);
  const [conclusionMessage, setConclusionMessage] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [escalationArea, setEscalationArea] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [escalationManagement, setEscalationManagement] = useState('');
  const [escalationManagementReason, setEscalationManagementReason] = useState('');
  const [escalationConsultorReason, setEscalationConsultorReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [managements, setManagements] = useState([]);
  const [areas, setAreas] = useState([]);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const conclusionFileInputRef = useRef(null);

  useEffect(() => {
    if (ticketId && user) {
      loadTicketData();
      loadUsers();
      loadManagements();
      loadAreas();
    }
  }, [ticketId, user]);

  const loadTicketData = async () => {
    console.log("🔍 Iniciando carregamento do chamado:", ticketId);
    try {
      setLoading(true);
      setError(null);

      // Buscar dados do chamado
      const ticketData = await ticketService.getTicketById(ticketId);
      if (!ticketData) {
        setError('Chamado não encontrado');
        return;
      }
      setTicket(ticketData);
      console.log("✅ Chamado carregado:", ticketData);

      // Carregar projetos - compatibilidade com versões antigas e novas
      const projectsToLoad = [];
      
      // Verifica se é um chamado antigo (com projetoId)
      if (ticketData.projetoId) {
        console.log("📁 Carregando projeto único:", ticketData.projetoId);
        try {
          const projectData = await projectService.getProjectById(ticketData.projetoId);
          if (projectData) {
            projectsToLoad.push(projectData);
          }
        } catch (err) {
          console.warn("⚠️ Erro ao carregar projeto único:", err);
        }
      }
      // Verifica se é um chamado novo (com projetos array)
      else if (ticketData.projetos?.length > 0) {
        console.log("📁 Carregando múltiplos projetos:", ticketData.projetos);
        try {
          const projectsData = await Promise.allSettled(
            ticketData.projetos.map(projectId => {
              if (!projectId || typeof projectId !== 'string') {
                console.warn('⚠️ ID de projeto inválido:', projectId);
                return Promise.resolve(null);
              }
              return projectService.getProjectById(projectId);
            })
          );
          
          projectsData.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
              projectsToLoad.push(result.value);
            }
          });
        } catch (err) {
          console.warn("⚠️ Erro ao carregar múltiplos projetos:", err);
        }
      }

      setProjects(projectsToLoad);
      console.log("✅ Projetos carregados:", projectsToLoad);

      // Carregar mensagens
      try {
        const messagesData = await messageService.getMessagesByTicket(ticketId);
        setMessages(messagesData || []);
        console.log("✅ Mensagens carregadas:", messagesData?.length || 0);
      } catch (err) {
        console.warn("⚠️ Erro ao carregar mensagens:", err);
        setMessages([]);
      }

    } catch (error) {
      console.error('❌ Erro ao carregar dados do chamado:', error);
      setError('Erro ao carregar os detalhes do chamado');
    } finally {
      setLoading(false);
      console.log("🏁 Carregamento finalizado");
    }
  };
        
  const loadUsers = async () => {
    try {
      const usersData = await userService.getAllUsers();
      setUsers(usersData || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadManagements = async () => {
    try {
      const managementsData = await userService.getManagements();
      setManagements(managementsData || []);
    } catch (error) {
      console.error('Erro ao carregar gerências:', error);
    }
  };

  const loadAreas = async () => {
    try {
      const areasData = await userService.getAreas();
      setAreas(areasData || []);
    } catch (error) {
      console.error('Erro ao carregar áreas:', error);
    }
  };

  // Função para criar chamado vinculado
  const handleCreateLinkedTicket = () => {
    if (!ticket || projects.length === 0) return;
    
    const linkedTicketData = {
      linkedTicketId: ticketId,
      linkedTicketTitle: ticket.titulo,
      linkedTicketDescription: ticket.descricao,
      linkedTicketCreator: ticket.criadoPorNome,
      linkedTicketArea: ticket.area,
      linkedTicketProject: projects[0]?.nome || '',
      linkedTicketEvent: projects[0]?.evento || ''
    };

    navigate('/novo-chamado', { state: linkedTicketData });
  };

  // Função para rejeitar/devolver chamado
  const handleRejectTicket = async () => {
    if (!rejectReason.trim()) {
      alert('Por favor, informe o motivo da rejeição/devolução.');
      return;
    }

    try {
      const updateData = {
        status: 'enviado_para_area',
        rejectReason: rejectReason,
        rejectedAt: new Date(),
        rejectedBy: user.uid,
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      await ticketService.updateTicket(ticketId, updateData);
      
      // Notificar o criador
      if (ticket.criadoPor !== user.uid) {
        await notificationService.createNotification({
          userId: ticket.criadoPor,
          type: 'ticket_rejected',
          title: 'Chamado Rejeitado/Devolvido',
          message: `Seu chamado "${ticket.titulo}" foi rejeitado/devolvido. Motivo: ${rejectReason}`,
          ticketId: ticketId
        });
      }

      setShowRejectModal(false);
      setRejectReason('');
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao rejeitar chamado:', error);
      alert('Erro ao rejeitar chamado');
    }
  };

  // Função para enviar mensagem
  const handleSendMessage = async () => {
    if (!newMessage.trim() && selectedImages.length === 0) return;

    try {
      setSending(true);
      await messageService.sendMessage(ticketId, {
        content: newMessage,
        images: selectedImages,
        senderId: user.uid,
        senderName: userProfile?.nome || user.email
      });

      setNewMessage('');
      setSelectedImages([]);
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  // Função para atualizar status
  const handleStatusUpdate = async (status) => {
    try {
      const updateData = {
        status: status,
        updatedAt: new Date(),
        updatedBy: user.uid
      };

      if (status === 'concluido' && conclusionMessage) {
        updateData.conclusionMessage = conclusionMessage;
        updateData.conclusionImages = conclusionImages;
        updateData.completedAt = new Date();
      }

      await ticketService.updateTicket(ticketId, updateData);
      await loadTicketData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status');
    }
  };

  // Função para formatar data
  const formatDate = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleString('pt-BR');
  };

  // Função para renderizar menções
  const renderMentions = (content) => {
    if (!content) return '';
    
    return content.replace(/@(\w+)/g, (match, username) => {
      return `<span class="bg-blue-100 text-blue-800 px-1 rounded">${match}</span>`;
    });
  };

  // Função para lidar com menções no input
  const handleMentionInput = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    // Detectar @ para mostrar sugestões
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const query = value.substring(lastAtIndex + 1);
      if (query.length >= 0) {
        const filtered = users.filter(user => 
          user.nome?.toLowerCase().includes(query.toLowerCase()) ||
          user.email?.toLowerCase().includes(query.toLowerCase())
        );
        setMentionSuggestions(filtered.slice(0, 5));
        setShowMentions(true);
        setMentionQuery(query);
      }
    } else {
      setShowMentions(false);
    }
  };

  // Função para selecionar menção
  const selectMention = (user) => {
    const lastAtIndex = newMessage.lastIndexOf('@');
    const beforeMention = newMessage.substring(0, lastAtIndex);
    const afterMention = newMessage.substring(lastAtIndex + mentionQuery.length + 1);
    setNewMessage(`${beforeMention}@${user.nome} ${afterMention}`);
    setShowMentions(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando dados do chamado...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="mt-4 text-red-600">{error}</p>
            <Button onClick={() => navigate('/dashboard')} className="mt-4">
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <p className="mt-4 text-gray-600">Chamado não encontrado</p>
            <Button onClick={() => navigate('/dashboard')} className="mt-4">
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Chamado #{ticket.numero}
              </h1>
              <p className="text-gray-600">{ticket.titulo}</p>
            </div>
          </div>
          <Badge variant={ticket.status === 'concluido' ? 'default' : 'secondary'}>
            {ticket.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detalhes do Chamado */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhes do Chamado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Descrição</h3>
                  <p className="text-gray-700 mt-1">{ticket.descricao}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Área</h4>
                    <p className="text-gray-700">{ticket.area}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Categoria</h4>
                    <p className="text-gray-700">{ticket.categoria}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Criado por</h4>
                    <p className="text-gray-700">{ticket.criadoPorNome}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Data de criação</h4>
                    <p className="text-gray-700">{formatDate(ticket.criadoEm)}</p>
                  </div>
                </div>

                {/* Flag de Item Extra */}
                {ticket.itemExtra && (
                  <div className="flex items-center space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-semibold text-orange-800">ITEM EXTRA</p>
                      {ticket.motivoItemExtra && (
                        <p className="text-sm text-orange-700">{ticket.motivoItemExtra}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Projetos */}
            {projects.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    {projects.length > 1 ? (
                      <FolderOpen className="h-5 w-5 mr-2" />
                    ) : (
                      <Folder className="h-5 w-5 mr-2" />
                    )}
                    {projects.length > 1 ? `Projetos (${projects.length})` : 'Projeto'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projects.map((project, index) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{project.nome}</h3>
                            <p className="text-sm text-gray-600">{project.evento}</p>
                            <p className="text-sm text-gray-500">
                              {project.cidade} - {formatDate(project.dataInicio)} a {formatDate(project.dataFim)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/projeto/${project.id}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conversas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Conversas ({messages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nenhuma mensagem ainda</p>
                  ) : (
                    messages.map((message, index) => (
                      <div key={index} className="flex space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold text-sm">{message.senderName}</p>
                            <p className="text-xs text-gray-500">{formatDate(message.timestamp)}</p>
                          </div>
                          <div 
                            className="mt-1"
                            dangerouslySetInnerHTML={{ __html: renderMentions(message.content) }}
                          />
                          {message.images && message.images.length > 0 && (
                            <div className="mt-2 flex space-x-2">
                              {message.images.map((image, imgIndex) => (
                                <img
                                  key={imgIndex}
                                  src={image}
                                  alt={`Anexo ${imgIndex + 1}`}
                                  className="w-20 h-20 object-cover rounded cursor-pointer"
                                  onClick={() => window.open(image, '_blank')}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Nova mensagem */}
                <div className="mt-4 border-t pt-4">
                  <div className="relative">
                    <Textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={handleMentionInput}
                      placeholder="Digite sua mensagem... (use @ para mencionar usuários)"
                      className="min-h-[80px] pr-20"
                    />
                    
                    {/* Sugestões de menção */}
                    {showMentions && mentionSuggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 w-full bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                        {mentionSuggestions.map((user, index) => (
                          <div
                            key={index}
                            className="p-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => selectMention(user)}
                          >
                            <p className="font-medium">{user.nome}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="absolute bottom-2 right-2 flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSendMessage}
                        disabled={sending || (!newMessage.trim() && selectedImages.length === 0)}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Imagens selecionadas */}
                  {selectedImages.length > 0 && (
                    <div className="mt-2 flex space-x-2">
                      {selectedImages.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image}
                            alt={`Selecionada ${index + 1}`}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <button
                            onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      files.forEach(file => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          setSelectedImages(prev => [...prev, e.target.result]);
                        };
                        reader.readAsDataURL(file);
                      });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Ações */}
            <Card>
              <CardHeader>
                <CardTitle>Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Botão Criar Chamado Vinculado */}
                {userProfile?.area === 'logistica' && (
                  <Button
                    onClick={handleCreateLinkedTicket}
                    className="w-full"
                    variant="outline"
                  >
                    <Link className="h-4 w-4 mr-2" />
                    Criar Chamado Vinculado
                  </Button>
                )}

                {/* Botão Rejeitar/Devolver */}
                <Button
                  onClick={() => setShowRejectModal(true)}
                  className="w-full"
                  variant="destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar / Devolver
                </Button>

                {/* Outros botões de ação */}
                <Button
                  onClick={() => handleStatusUpdate('em_tratativa')}
                  className="w-full"
                  variant="outline"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Iniciar Tratativa
                </Button>

                <Button
                  onClick={() => handleStatusUpdate('concluido')}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Concluir
                </Button>
              </CardContent>
            </Card>

            {/* Pessoas Envolvidas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Pessoas Envolvidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Criador */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-semibold text-blue-900">Criador</p>
                        <p className="text-sm text-blue-700">{ticket.criadoPorNome}</p>
                        <p className="text-xs text-blue-600">{ticket.area}</p>
                      </div>
                    </div>
                  </div>

                  {/* Responsável atual */}
                  {ticket.responsavelAtual && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-900">Responsável Atual</p>
                          <p className="text-sm text-green-700">{ticket.responsavelAtual}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Histórico */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="h-5 w-5 mr-2" />
                  Histórico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Abertura */}
                  <div className="flex items-start space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="font-semibold text-blue-800">Chamado Aberto</p>
                      <p className="text-xs text-gray-500">{formatDate(ticket.criadoEm)}</p>
                      <p className="text-sm text-gray-700">Por: {ticket.criadoPorNome}</p>
                    </div>
                  </div>

                  {/* Outras movimentações */}
                  {ticket.updatedAt && (
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-semibold text-yellow-800">Última Atualização</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.updatedAt)}</p>
                      </div>
                    </div>
                  )}

                  {ticket.completedAt && (
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-green-600 rounded-full mt-2"></div>
                      <div>
                        <p className="font-semibold text-green-800">Chamado Concluído</p>
                        <p className="text-xs text-gray-500">{formatDate(ticket.completedAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal de Rejeição */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Rejeitar / Devolver Chamado</h3>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Informe o motivo da rejeição/devolução..."
              className="mb-4"
            />
            <div className="flex space-x-3">
              <Button
                onClick={handleRejectTicket}
                variant="destructive"
                disabled={!rejectReason.trim()}
              >
                Confirmar
              </Button>
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetailPage;

