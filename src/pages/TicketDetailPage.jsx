import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService } from '@/services/ticketService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { messageService } from '@/services/messageService';
import notificationService from '@/services/notificationService';
import ImageUpload from '@/components/ImageUpload';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Clock,
  User,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Camera,
  Calendar,
  MapPin,
  Loader2,
  ExternalLink,
  Upload,
  X,
  Image as ImageIcon,
  Settings,
  AtSign,
  Lock,
  UserCheck,
  PlusCircle,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Archive,
  ArchiveRestore,
  Link as LinkIcon,
  ClipboardEdit,
  Printer,
} from 'lucide-react';

const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  // Estados principais
  const [ticket, setTicket] = useState(null);
  const [project, setProject] = useState(null);
  const [projectsMap, setProjectsMap] = useState({});
  const [linkedProjectIds, setLinkedProjectIds] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Estados para anexar links
  const [attachedLinks, setAttachedLinks] = useState([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkDescription, setNewLinkDescription] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [savingLink, setSavingLink] = useState(false);

  // Resolve nome do responsável do projeto a partir de possíveis formatos (Id/Uid/Nome/Email/responsaveis{})
  const resolveUserNameByProjectField = (proj, base) => {
    if (!proj) return null;
    const id = proj?.[base + 'Id'] || proj?.[base + 'Uid'] || proj?.responsaveis?.[base]?.id;
    if (id && Array.isArray(users)) {
      const u = users.find(u => u.uid === id || u.id === id);
      if (u?.nome) return u.nome;
    }
    const nome = proj?.[base + 'Nome'] || proj?.responsaveis?.[base]?.nome;
    if (nome) return nome;
    const email = proj?.[base + 'Email'] || proj?.responsaveis?.[base]?.email;
    if (email && Array.isArray(users)) {
      const u = users.find(u => u.email === email);
      if (u?.nome) return u.nome;
      return email;
    }
    return null;
  };

  // Estados do chat
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatImages, setChatImages] = useState([]);

  // Estados de atualização de status
  const [newStatus, setNewStatus] = useState('');
  const [conclusionImages, setConclusionImages] = useState([]);
  const [conclusionDescription, setConclusionDescription] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [showAreaSelector, setShowAreaSelector] = useState(false);

  // Estados para escalação separada
  const [escalationArea, setEscalationArea] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);

  // Estados para escalação para gerência
  const [managementArea, setManagementArea] = useState('');
  const [managementReason, setManagementReason] = useState('');
  const [isEscalatingToManagement, setIsEscalatingToManagement] = useState(false);

  // Estados para escalação para consultor
  const [consultorReason, setConsultorReason] = useState('');
  const [isEscalatingToConsultor, setIsEscalatingToConsultor] = useState(false);

  // Estados para menções de usuários e histórico
  const [users, setUsers] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);
  
  // Estados para o fluxo de correção e reenvio
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');

  // Estado para exibir link do chamado pai
  const [parentTicketForLink, setParentTicketForLink] = useState(null);

  // Função para imprimir o chamado
  const handlePrint = () => {
    // Criar uma nova janela para impressão
    const printWindow = window.open('', '_blank');
    
    // Gerar o conteúdo HTML para impressão
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chamado #${ticket.numero || ticketId.slice(-6)} - ${ticket.titulo}</title>
          <style>
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
            }
            
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            
            .header h1 {
              margin: 0;
              color: #2563eb;
              font-size: 24px;
            }
            
            .header p {
              margin: 5px 0;
              color: #666;
            }
            
            .section {
              margin-bottom: 25px;
              page-break-inside: avoid;
            }
            
            .section-title {
              font-size: 18px;
              font-weight: bold;
              color: #1f2937;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 5px;
              margin-bottom: 15px;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 15px;
            }
            
            .info-item {
              margin-bottom: 10px;
            }
            
            .info-label {
              font-weight: bold;
              color: #374151;
              margin-bottom: 3px;
            }
            
            .info-value {
              color: #6b7280;
            }
            
            .description {
              background-color: #f9fafb;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #2563eb;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
              text-transform: uppercase;
            }
            
            .status-aberto { background-color: #dbeafe; color: #1e40af; }
            .status-em_tratativa { background-color: #fef3c7; color: #92400e; }
            .status-concluido { background-color: #d1fae5; color: #065f46; }
            .status-cancelado { background-color: #fee2e2; color: #991b1b; }
            
            .history-item {
              display: flex;
              align-items: flex-start;
              margin-bottom: 12px;
              padding: 10px;
              background-color: #f8fafc;
              border-radius: 6px;
            }
            
            .history-icon {
              width: 20px;
              height: 20px;
              margin-right: 10px;
              margin-top: 2px;
            }
            
            .history-content {
              flex: 1;
            }
            
            .history-description {
              font-weight: 500;
              margin-bottom: 2px;
            }
            
            .history-date {
              font-size: 12px;
              color: #6b7280;
            }
            
            .message-item {
              margin-bottom: 15px;
              padding: 12px;
              border-radius: 8px;
              border-left: 3px solid #e5e7eb;
            }
            
            .message-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            }
            
            .message-sender {
              font-weight: bold;
              color: #374151;
            }
            
            .message-date {
              font-size: 12px;
              color: #6b7280;
            }
            
            .message-content {
              white-space: pre-wrap;
              word-wrap: break-word;
              line-height: 1.5;
            }
            
            .extra-item {
              background-color: #fef3c7;
              border: 1px solid #f59e0b;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 15px;
            }
            
            .extra-title {
              font-weight: bold;
              color: #92400e;
              margin-bottom: 8px;
            }
            
            .print-date {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
            }
            
            @page {
              margin: 1in;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Chamado #${ticket.numero || ticketId.slice(-6)}</h1>
            <p><strong>${ticket.titulo}</strong></p>
            <p>Impresso em: ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          
          <div class="section">
            <div class="section-title">📋 Informações Básicas</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Status:</div>
                <div class="info-value">
                  <span class="status-badge status-${ticket.status}">${getStatusText(ticket.status)}</span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">Prioridade:</div>
                <div class="info-value">${ticket.prioridade || 'Não definida'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Área:</div>
                <div class="info-value">${ticket.area || 'Não especificada'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Tipo:</div>
                <div class="info-value">${ticket.tipo || 'Não especificado'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Criado por:</div>
                <div class="info-value">${ticket.criadoPorNome || 'Não disponível'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Criado em:</div>
                <div class="info-value">${formatDate(ticket.createdAt || ticket.criadoEm)}</div>
              </div>
            </div>
            ${project ? `
              <div class="info-item">
                <div class="info-label">Projeto:</div>
                <div class="info-value">${project.nome}</div>
              </div>
            ` : ''}
          </div>
          
          <div class="section">
            <div class="section-title">📝 Descrição</div>
            <div class="description">${ticket.descricao || 'Descrição não disponível'}</div>
          </div>
          
          ${(ticket.isExtra || ticket.itemExtra) ? `
            <div class="section">
              <div class="extra-item">
                <div class="extra-title">🔥 ITEM EXTRA</div>
                ${(ticket.motivoExtra || ticket.motivoItemExtra) ? `
                  <div><strong>Motivo:</strong> ${ticket.motivoExtra || ticket.motivoItemExtra}</div>
                ` : ''}
              </div>
            </div>
          ` : ''}
          
          ${historyEvents.length > 0 ? `
            <div class="section">
              <div class="section-title">📅 Histórico de Alterações</div>
              ${historyEvents.map(event => `
                <div class="history-item">
                  <div class="history-content">
                    <div class="history-description">${event.description} ${event.userName}</div>
                    <div class="history-date">${formatDate(event.date)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          ${messages.length > 0 ? `
            <div class="section">
              <div class="section-title">💬 Histórico de Mensagens</div>
              ${messages.map(message => `
                <div class="message-item">
                  <div class="message-header">
                    <span class="message-sender">${message.remetenteNome || 'Sistema'}</span>
                    <span class="message-date">${formatDate(message.criadoEm)}</span>
                  </div>
                  <div class="message-content">${message.conteudo}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          ${(ticket.attachedLinks && ticket.attachedLinks.length > 0) ? `
            <div class="section">
              <div class="section-title">🔗 Links Anexados</div>
              ${ticket.attachedLinks.map(link => `
                <div class="info-item">
                  <div class="info-label">${link.description}:</div>
                  <div class="info-value">${link.url}</div>
                  <div class="history-date">Anexado por ${link.addedByName} em ${formatDate(link.addedAt)}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          <div class="print-date">
            Documento gerado automaticamente pelo Sistema de Gestão de Chamados
          </div>
        </body>
      </html>
    `;
    
    // Escrever o conteúdo na nova janela
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Aguardar o carregamento e imprimir
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  // Função auxiliar para obter texto do status
  const getStatusText = (status) => {
    const statusMap = {
      'aberto': 'Aberto',
      'em_tratativa': 'Em Tratativa',
      'em_execucao': 'Em Execução',
      'concluido': 'Concluído',
      'cancelado': 'Cancelado',
      'arquivado': 'Arquivado',
      'devolvido': 'Devolvido',
      'aguardando_aprovacao': 'Aguardando Aprovação',
      'enviado_para_area': 'Enviado para Área',
      'escalado_para_area': 'Escalado para Área',
      'escalado_para_gerencia': 'Escalado para Gerência',
      'escalado_para_consultor': 'Escalado para Consultor',
      'transferido_para_produtor': 'Transferido para Produtor',
      'executado_aguardando_validacao': 'Executado - Aguardando Validação'
    };
    return statusMap[status] || status;
  };

  // Função para adicionar link
  const handleAddLink = async () => {
    if (!newLinkUrl.trim()) {
      alert('Por favor, insira uma URL válida');
      return;
    }

    try {
      setSavingLink(true);
      
      const linkData = {
        url: newLinkUrl.trim(),
        description: newLinkDescription.trim() || 'Link anexado',
        addedBy: user.uid,
        addedByName: userProfile?.nome || user.email,
        addedAt: new Date()
      };

      // Atualizar o array de links anexados
      const updatedLinks = [...(ticket.attachedLinks || []), linkData];
      
      // Salvar no banco de dados
      await ticketService.updateTicket(ticketId, {
        attachedLinks: updatedLinks,
        updatedAt: new Date()
      });

      // Atualizar estado local
      setAttachedLinks(updatedLinks);
      setTicket(prev => ({ ...prev, attachedLinks: updatedLinks }));
      
      // Limpar formulário
      setNewLinkUrl('');
      setNewLinkDescription('');
      setShowLinkForm(false);
      
      // Adicionar mensagem no chat informando sobre o link
      await messageService.addMessage(ticketId, {
        conteudo: `📎 Link anexado: ${linkData.description}\n🔗 ${linkData.url}`,
        remetenteId: user.uid,
        remetenteNome: userProfile?.nome || user.email,
        tipo: 'link_attachment'
      });
      
      // Recarregar mensagens
      const messagesData = await messageService.getMessagesByTicket(ticketId);
      setMessages(messagesData || []);
      
    } catch (error) {
      console.error('Erro ao anexar link:', error);
      alert('Erro ao anexar link. Tente novamente.');
    } finally {
      setSavingLink(false);
    }
  };

  // Função para remover link
  const handleRemoveLink = async (linkIndex) => {
    if (!confirm('Tem certeza que deseja remover este link?')) return;
    
    try {
      const updatedLinks = attachedLinks.filter((_, index) => index !== linkIndex);
      
      await ticketService.updateTicket(ticketId, {
        attachedLinks: updatedLinks,
        updatedAt: new Date()
      });
      
      setAttachedLinks(updatedLinks);
      setTicket(prev => ({ ...prev, attachedLinks: updatedLinks }));
      
    } catch (error) {
      console.error('Erro ao remover link:', error);
      alert('Erro ao remover link. Tente novamente.');
    }
  };

  const loadTicketData = async () => {
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);

      const ticketData = await ticketService.getTicketById(ticketId);
      if (!ticketData) {
        throw new Error('Chamado não encontrado');
      }

      setTicket(ticketData);

      if (ticketData.chamadoPaiId) {
          const parentTicketData = await ticketService.getTicketById(ticketData.chamadoPaiId);
          setParentTicketForLink(parentTicketData);
      }

      const _linkedIds = Array.isArray(ticketData.projetos) && ticketData.projetos.length > 0
        ? ticketData.projetos
        : (ticketData.projetoId ? [ticketData.projetoId] : []);
      setLinkedProjectIds(_linkedIds);
      if (_linkedIds.length > 0) {
        const entries = await Promise.all(
          _linkedIds.map(async (pid) => {
            try { const pdata = await projectService.getProjectById(pid); return [pid, pdata]; }
            catch(e) { console.error('Erro ao carregar projeto', pid, e); return [pid, null]; }
          })
        );
        const map = Object.fromEntries(entries);
        setProjectsMap(map);
        setActiveProjectId(_linkedIds[0]);
        setProject(map[_linkedIds[0]] || null);
      } else {
        setProjectsMap({});
        setActiveProjectId(null);
        setProject(null);
      }
      const messagesData = await messageService.getMessagesByTicket(ticketId);
      setMessages(messagesData || []);

    } catch (err) {
      setError(err.message || 'Erro ao carregar chamado');
    } finally {
      setLoading(false);
    }
  };

  // Selecionar um projeto vinculado
  const handleSelectProject = (pid) => {
    setActiveProjectId(pid);
    const p = projectsMap[pid] || null;
    setProject(p);
  };

  useEffect(() => {
    if (ticketId && user) {
      loadTicketData();
      markNotificationsAsRead();
    }
  }, [ticketId, user]);

  // useEffect para carregar links anexados
  useEffect(() => {
    if (ticket && ticket.attachedLinks) {
      setAttachedLinks(ticket.attachedLinks);
    }
  }, [ticket]);

  useEffect(() => {
    if (ticket && userProfile && user) {
      if (ticket.confidencial || ticket.isConfidential) {
        const isCreator   = ticket.criadoPor === user.uid;
        const isAdmin     = userProfile.funcao === 'administrador';
        const isGerente   = userProfile.funcao === 'gerente';
        const isOperator  = userProfile.funcao === 'operador';
        const areaOp      = userProfile.area;
        const operatorInvolved = isOperator && (
          [ticket.area, ticket.areaDeOrigem, ticket.areaDestino, ticket.areaQueRejeitou].includes(areaOp) ||
          (Array.isArray(ticket.areasEnvolvidas) && ticket.areasEnvolvidas.includes(areaOp))
        );
        if (!isCreator && !isAdmin && !isGerente && !operatorInvolved) {
          setAccessDenied(true);
        }
      }
    }
  }, [ticket, userProfile, user]);

  const markNotificationsAsRead = async () => {
    if (!user?.uid || !ticketId) return;
    try {
      await notificationService.markTicketNotificationsAsRead(user.uid, ticketId);
    } catch (error) {
      console.error('❌ Erro ao marcar notificações como lidas:', error);
    }
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await userService.getAllUsers();
        setUsers(allUsers);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };
    loadUsers();
  }, []);
    
  const handleArchiveTicket = async () => {
    if (!window.confirm('Tem certeza que deseja arquivar este chamado? Ele sairá da visualização principal e só poderá ser consultado.')) return;
    setUpdating(true);
    try {
        await ticketService.updateTicket(ticketId, {
            status: 'arquivado',
            arquivadoEm: new Date(),
            arquivadoPor: user.uid,
            dataUltimaAtualizacao: new Date()
        });
        alert('Chamado arquivado com sucesso!');
        navigate('/dashboard');
    } catch (error) {
        alert('Ocorreu um erro ao arquivar o chamado.');
        setUpdating(false);
    }
  };

  const handleUnarchiveTicket = async () => {
    if (!window.confirm('Deseja desarquivar este chamado? Ele voltará para a lista de concluídos.')) return;
    setUpdating(true);
    try {
        await ticketService.updateTicket(ticketId, {
            status: 'concluido',
            arquivadoEm: null,
            arquivadoPor: null,
            dataUltimaAtualizacao: new Date()
        });
        alert('Chamado desarquivado com sucesso!');
        loadTicketData();
    } catch (error) {
        alert('Ocorreu um erro ao desarquivar o chamado.');
    } finally {
        setUpdating(false);
    }
  };
    
  const getUserNameById = (userId) => {
      if (!users || !userId) return 'Sistema';
      const userFound = users.find(u => u.uid === userId || u.id === userId);
      return userFound?.nome || 'Usuário desconhecido';
  };
  
  useEffect(() => {
    if (ticket && users.length > 0) {
        const events = [];
        if (ticket.criadoEm) { events.push({ date: ticket.criadoEm, description: 'Chamado criado por', userName: ticket.criadoPorNome || getUserNameById(ticket.criadoPor), Icon: PlusCircle, color: 'text-blue-500' }); }
        if (ticket.escaladoEm && ticket.motivoEscalonamentoGerencial) { events.push({ date: ticket.escaladoEm, description: 'Escalado para gerência por', userName: getUserNameById(ticket.escaladoPor), Icon: Shield, color: 'text-purple-500' }); }
        if (ticket.aprovadoEm) { events.push({ date: ticket.aprovadoEm, description: 'Aprovado por', userName: getUserNameById(ticket.aprovadoPor), Icon: ThumbsUp, color: 'text-green-500' }); }
        if (ticket.rejeitadoEm) { events.push({ date: ticket.rejeitadoEm, description: 'Rejeitado / Devolvido por', userName: getUserNameById(ticket.rejeitadoPor), Icon: ThumbsDown, color: 'text-red-500' }); }
        if (ticket.concluidoEm) { events.push({ date: ticket.concluidoEm, description: 'Concluído por', userName: getUserNameById(ticket.concluidoPor), Icon: CheckCircle, color: 'text-green-600' }); }
        const sortedEvents = events.sort((a, b) => (a.date.toDate ? a.date.toDate() : new Date(a.date)) - (b.date.toDate ? b.date.toDate() : new Date(b.date)));
        setHistoryEvents(sortedEvents);
    }
  }, [ticket, users]);

  const detectMentions = (text, position) => {
    const beforeCursor = text.substring(0, position);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const filtered = users.filter(user => user.nome.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)).slice(0, 5);
      setMentionQuery(query);
      setMentionSuggestions(filtered);
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
      setMentionSuggestions([]);
      setMentionQuery('');
    }
  };

  const insertMention = (user) => {
    const beforeCursor = newMessage.substring(0, cursorPosition);
    const afterCursor = newMessage.substring(cursorPosition);
    const beforeMention = beforeCursor.replace(/@\w*$/, '');
    const newText = beforeMention + `@${user.nome} ` + afterCursor;
    setNewMessage(newText);
    setShowMentionSuggestions(false);
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = beforeMention.length + user.nome.length + 2;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleTextareaChange = (e) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setNewMessage(value);
    setCursorPosition(position);
    detectMentions(value, position);
  };

  const handleTextareaKeyDown = (e) => {
    if (showMentionSuggestions && e.key === 'Escape') {
      setShowMentionSuggestions(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Data não disponível';
    try {
      let dateObj = (date.toDate && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
      if (isNaN(dateObj.getTime())) return 'Data inválida';
      return dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Erro na data';
    }
  };

  const getStatusColor = (status) => {
    const colors = { 
        'aberto': 'bg-blue-100 text-blue-800', 
        'em_tratativa': 'bg-yellow-100 text-yellow-800', 
        'em_execucao': 'bg-blue-100 text-blue-800', 
        'enviado_para_area': 'bg-purple-100 text-purple-800', 
        'escalado_para_area': 'bg-purple-100 text-purple-800', 
        'escalado_para_gerencia': 'bg-purple-100 text-purple-800', 
        'escalado_para_consultor': 'bg-purple-100 text-purple-800', 
        'aguardando_aprovacao': 'bg-orange-100 text-orange-800', 
        'aprovado': 'bg-green-100 text-green-800', 
        'rejeitado': 'bg-red-100 text-red-800', 
        'devolvido': 'bg-red-100 text-red-800', 
        'concluido': 'bg-green-100 text-green-800', 
        'cancelado': 'bg-gray-100 text-gray-800', 
        'arquivado': 'bg-gray-100 text-gray-800', 
        'transferido_para_produtor': 'bg-indigo-100 text-indigo-800', 
        'executado_aguardando_validacao': 'bg-teal-100 text-teal-800' 
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getAvailableStatuses = (currentStatus, userRole) => {
    if (userRole === 'administrador') {
      return [
        { value: 'aberto', label: 'Aberto' },
        { value: 'em_tratativa', label: 'Em Tratativa' },
        { value: 'concluido', label: 'Concluído' },
        { value: 'cancelado', label: 'Cancelado' },
        { value: 'arquivado', label: 'Arquivado' }
      ];
    }

    if (userRole === 'gerente' && currentStatus === 'aguardando_aprovacao' && ticket.responsavelAtual === user.uid) {
      return [
        { value: 'aprovado', label: 'Aprovar' },
        { value: 'reprovado', label: 'Reprovar' }
      ];
    }

    if (userRole === 'produtor' && currentStatus === 'transferido_para_produtor' && ticket.produtorResponsavelId === user.uid) {
      return [{ value: 'executado_aguardando_validacao', label: 'Executar' }];
    }

    if (userRole === 'operador') {
      if (currentStatus === 'aberto') {
        return [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }];
      }
      if (currentStatus === 'em_tratativa') {
        return [
          { value: 'concluido', label: 'Concluir' },
          { value: 'enviado_para_area', label: 'Enviar para Outra Área' },
          { value: 'rejeitado', label: 'Devolver' }
        ];
      }
      if (currentStatus === 'executado_aguardando_validacao') {
        return [{ value: 'concluido', label: 'Validar e Concluir' }];
      }
    }

    if ((userRole === 'consultor' || userRole === 'produtor') && currentStatus === 'executado_aguardando_validacao') {
      return [{ value: 'concluido', label: 'Validar e Concluir' }];
    }

    return [];
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;

    setUpdating(true);
    try {
      const updateData = {
        status: newStatus,
        dataUltimaAtualizacao: new Date()
      };

      if (newStatus === 'concluido') {
        updateData.concluidoEm = new Date();
        updateData.concluidoPor = user.uid;
        if (conclusionDescription.trim()) {
          updateData.observacoesConclusao = conclusionDescription.trim();
        }
        if (conclusionImages.length > 0) {
          updateData.imagensConclusao = conclusionImages;
        }
      }

      if (newStatus === 'rejeitado' || newStatus === 'enviado_para_area') {
        if (!conclusionDescription.trim()) {
          alert('Por favor, forneça um motivo para esta ação.');
          setUpdating(false);
          return;
        }
        updateData.motivoRejeicao = conclusionDescription.trim();
        updateData.rejeitadoEm = new Date();
        updateData.rejeitadoPor = user.uid;
        
        if (newStatus === 'enviado_para_area' && selectedArea) {
          updateData.areaDestino = selectedArea;
          updateData.areaQueRejeitou = userProfile.area;
        }
      }

      if (newStatus === 'em_tratativa') {
        updateData.iniciadoEm = new Date();
        updateData.iniciadoPor = user.uid;
      }

      await ticketService.updateTicket(ticketId, updateData);
      
      setNewStatus('');
      setConclusionDescription('');
      setConclusionImages([]);
      setSelectedArea('');
      setShowAreaSelector(false);
      
      await loadTicketData();
      
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do chamado');
    } finally {
      setUpdating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && chatImages.length === 0) return;

    setSendingMessage(true);
    try {
      const messageData = {
        conteudo: newMessage.trim(),
        remetenteId: user.uid,
        remetenteNome: userProfile?.nome || user.email,
        criadoEm: new Date(),
        imagens: chatImages
      };

      await messageService.addMessage(ticketId, messageData);
      
      setNewMessage('');
      setChatImages([]);
      
      const messagesData = await messageService.getMessagesByTicket(ticketId);
      setMessages(messagesData || []);
      
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleEscalateToArea = async () => {
    if (!escalationArea || !escalationReason) {
      alert('Por favor, selecione a área e forneça um motivo.');
      return;
    }

    setIsEscalating(true);
    try {
      const updateData = {
        status: 'escalado_para_area',
        areaEscalada: escalationArea,
        escaladoEm: new Date(),
        escaladoPor: user.uid,
        motivoEscalonamento: escalationReason,
        dataUltimaAtualizacao: new Date()
      };

      await ticketService.updateTicket(ticketId, updateData);

      setEscalationArea('');
      setEscalationReason('');
      await loadTicketData();
      
    } catch (error) {
      console.error('Erro ao escalar chamado:', error);
      alert('Erro ao escalar chamado');
    } finally {
      setIsEscalating(false);
    }
  };

  const handleManagementEscalation = async () => {
    if (!managementArea || !managementReason) {
      alert('Por favor, selecione a gerência e forneça um motivo.');
      return;
    }

    setIsEscalatingToManagement(true);
    try {
      // Encontra o gerente correspondente na lista de todos os usuários
      const targetManager = users.find(user => user.area === managementArea.replace('gerente_', '') && user.funcao === 'gerente');

      if (!targetManager) {
        alert(`Erro: Nenhum gerente encontrado para a área "${managementArea}". Verifique o cadastro de usuários.`);
        console.error('Nenhum gerente encontrado para a área:', managementArea);
        setIsEscalatingToManagement(false);
        return;
      }

      const managerUid = targetManager.id; // O ID do documento do usuário é o UID

      const updateData = {
        status: 'aguardando_aprovacao',
        gerenciaDestino: managementArea,
        escaladoEm: new Date(),
        escaladoPor: user.uid,
        motivoEscalonamentoGerencial: managementReason,
        responsavelAtual: managerUid, // <-- CORREÇÃO PRINCIPAL AQUI
        dataUltimaAtualizacao: new Date()
      };

      await ticketService.updateTicket(ticketId, updateData);

      // Mensagem para o chat
      const escalationMessage = {
        userId: user.uid,
        remetenteNome: userProfile.nome || user.email,
        conteudo: `👨‍💼 **Chamado escalado para ${managementArea.replace('gerente_', '').replace('_', ' ').toUpperCase()}**\n\n**Motivo:** ${managementReason}\n\n**Gerente Responsável:** ${targetManager.nome}`,
        criadoEm: new Date(),
        type: 'management_escalation'
      };
      await messageService.sendMessage(ticketId, escalationMessage);

      // Notificação para o gerente
      await notificationService.notifyManagementEscalation(
        ticketId,
        ticket,
        managerUid, // Usando o UID do gerente encontrado
        user.uid,
        managementReason
      );
      console.log('✅ Notificação de escalação gerencial enviada');
      
      await loadTicketData();
      setManagementArea('');
      setManagementReason('');
      alert('Chamado escalado para gerência com sucesso!');

    } catch (error) {
      console.error('Erro ao escalar para gerência:', error);
      alert('Erro ao escalar para gerência: ' + error.message);
    } finally {
      setIsEscalatingToManagement(false);
    }
  };

  const handleConsultorEscalation = async () => {
    if (!consultorReason) {
      alert('Por favor, forneça um motivo para escalar para o consultor.');
      return;
    }

    setIsEscalatingToConsultor(true);
    try {
      const updateData = {
        status: 'escalado_para_consultor',
        escaladoEm: new Date(),
        escaladoPor: user.uid,
        motivoEscalonamentoConsultor: consultorReason,
        dataUltimaAtualizacao: new Date()
      };

      await ticketService.updateTicket(ticketId, updateData);

      setConsultorReason('');
      await loadTicketData();
      
    } catch (error) {
      console.error('Erro ao escalar para consultor:', error);
      alert('Erro ao escalar para consultor');
    } finally {
      setIsEscalatingToConsultor(false);
    }
  };

  const handleResubmitTicket = async () => {
    if (!additionalInfo.trim()) {
      alert('Por favor, forneça as informações adicionais solicitadas.');
      return;
    }

    setIsResubmitting(true);
    try {
      const updateData = {
        status: 'aberto',
        informacoesAdicionais: additionalInfo.trim(),
        reenviado: true,
        reenviadoEm: new Date(),
        areaQueRejeitou: null,
        motivoRejeicao: null,
        dataUltimaAtualizacao: new Date()
      };

      await ticketService.updateTicket(ticketId, updateData);

      const messageData = {
        conteudo: `📝 **Chamado corrigido e reenviado**\n\n**Informações adicionais:**\n${additionalInfo.trim()}`,
        remetenteId: user.uid,
        remetenteNome: userProfile?.nome || user.email,
        criadoEm: new Date(),
        tipo: 'resubmission'
      };

      await messageService.addMessage(ticketId, messageData);
      
      setAdditionalInfo('');
      await loadTicketData();
      
    } catch (error) {
      console.error('Erro ao reenviar chamado:', error);
      alert('Erro ao reenviar chamado');
    } finally {
      setIsResubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert className="max-w-md">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Você não tem permissão para visualizar este chamado confidencial.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Chamado não encontrado.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isArchived = ticket.status === 'arquivado';
  const availableStatuses = getAvailableStatuses(ticket.status, userProfile?.funcao);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Chamado #{ticket.numero || ticketId.slice(-6)}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(ticket.status)}>
                  {getStatusText(ticket.status)}
                </Badge>
                {ticket.prioridade && (
                  <Badge variant="outline" className="text-xs">
                    {ticket.prioridade}
                  </Badge>
                )}
                {(ticket.confidencial || ticket.isConfidential) && (
                  <Badge variant="destructive" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Confidencial
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Botão de Imprimir */}
          <Button
            onClick={handlePrint}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {parentTicketForLink && (
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Este chamado é derivado de:{' '}
                  <Link
                    to={`/chamado/${parentTicketForLink.id}`}
                    className="font-medium underline hover:no-underline"
                  >
                    #{parentTicketForLink.numero || parentTicketForLink.id.slice(-6)} - {parentTicketForLink.titulo}
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <ClipboardEdit className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Detalhes do Chamado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs sm:text-sm font-medium text-gray-700">Título</Label>
                  <p className="text-sm sm:text-base text-gray-900 break-words">{ticket.titulo || 'Título não disponível'}</p>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm font-medium text-gray-700">Descrição</Label>
                  <p className="text-sm sm:text-base text-gray-900 whitespace-pre-wrap break-words">{ticket.descricao || 'Descrição não disponível'}</p>
                </div>
                {ticket.imagens && ticket.imagens.length > 0 && (
                  <div>
                    <Label className="text-xs sm:text-sm font-medium text-gray-700 mb-2 block">📷 Imagens Anexadas</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {ticket.imagens.map((imagem, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imagem.url}
                            alt={imagem.name || `Imagem do chamado ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-75 transition-opacity shadow-sm hover:shadow-md"
                            onClick={() => window.open(imagem.url, '_blank')}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="hidden w-full h-32 bg-gray-100 rounded-lg border border-gray-200 items-center justify-center">
                            <div className="text-center">
                              <ImageIcon className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                              <p className="text-xs text-gray-500">Erro ao carregar</p>
                            </div>
                          </div>
                          {imagem.name && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="truncate">{imagem.name}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(ticket.isExtra || ticket.itemExtra) && (
                  <div className="p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-orange-600 font-semibold text-sm sm:text-base">🔥 ITEM EXTRA</span>
                    </div>
                    {(ticket.motivoExtra || ticket.motivoItemExtra) && (
                      <div>
                        <Label className="text-xs sm:text-sm font-medium text-orange-700">Motivo do Item Extra</Label>
                        <p className="text-sm sm:text-base text-orange-900 whitespace-pre-wrap break-words">{ticket.motivoExtra || ticket.motivoItemExtra}</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Área</Label>
                    <p className="text-gray-900">{ticket.area || 'Não especificada'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Tipo</Label>
                    <p className="text-gray-900">{ticket.tipo || 'Não especificado'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Criado em</Label>
                    <p className="text-gray-900">{formatDate(ticket.createdAt || ticket.criadoEm)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Criado por</Label>
                    <p className="text-gray-900">{ticket.criadoPorNome || 'Não disponível'}</p>
                  </div>
                </div>
                {ticket.imagensIniciais && ticket.imagensIniciais.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Imagens Iniciais</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {ticket.imagensIniciais.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-75 transition-opacity"
                            onClick={() => window.open(imageUrl, '_blank')}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="hidden w-full h-24 bg-gray-100 rounded-lg border border-gray-200 items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {user && ticket.criadoPor === user.uid && ticket.status === 'enviado_para_area' && ticket.areaQueRejeitou && (
              <Card className="bg-yellow-50 border-yellow-300">
                <CardHeader>
                  <CardTitle className="flex items-center text-yellow-900">
                    <ClipboardEdit className="h-5 w-5 mr-2" />
                    Ação Necessária: Corrigir e Reenviar Chamado
                  </CardTitle>
                  <CardDescription className="text-yellow-800">
                    Este chamado foi devolvido pela área de{' '}
                    <strong className="font-semibold">{ticket.areaQueRejeitou.replace('_', ' ').toUpperCase()}</strong>. 
                    Por favor, adicione as informações solicitadas e reenvie.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {ticket.motivoRejeicao && (
                       <div className="p-3 bg-white border border-gray-200 rounded-md">
                         <Label className="text-xs font-medium text-gray-700">Motivo da Devolução</Label>
                         <p className="text-sm text-gray-800 whitespace-pre-wrap">{ticket.motivoRejeicao}</p>
                       </div>
                    )}
                    <div>
                      <Label htmlFor="additional-info" className="font-semibold text-gray-800">
                        Novas Informações / Correções *
                      </Label>
                      <Textarea
                        id="additional-info"
                        placeholder="Forneça aqui os detalhes ou correções solicitadas pela outra área..."
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                        rows={4}
                        className="mt-2"
                        disabled={isResubmitting}
                      />
                    </div>
                    <Button 
                      onClick={handleResubmitTicket} 
                      disabled={!additionalInfo.trim() || isResubmitting} 
                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      {isResubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Reenviar para {ticket.areaQueRejeitou.replace('_', ' ')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card para Anexar Links */}
            {!isArchived && userProfile && (userProfile.funcao === 'operador' || userProfile.funcao === 'administrador' || userProfile.funcao === 'produtor') && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    Links Anexados
                  </CardTitle>
                  <CardDescription>
                    Anexe links de documentos (Google Drive, OneDrive, etc.) relacionados a este chamado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Exibir links existentes */}
                  {(ticket.attachedLinks || []).length > 0 && (
                    <div className="space-y-3 mb-4">
                      <Label className="text-sm font-medium">Links Anexados:</Label>
                      {(ticket.attachedLinks || []).map((link, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <ExternalLink className="h-4 w-4 text-blue-600" />
                              <a 
                                href={link.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 font-medium truncate"
                              >
                                {link.description}
                              </a>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Anexado por {link.addedByName} em {formatDate(link.addedAt)}
                            </p>
                          </div>
                          {(userProfile.funcao === 'administrador' || link.addedBy === user.uid) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveLink(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulário para adicionar novo link */}
                  {!showLinkForm ? (
                    <Button 
                      onClick={() => setShowLinkForm(true)}
                      variant="outline"
                      className="w-full border-dashed border-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Anexar Novo Link
                    </Button>
                  ) : (
                    <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div>
                        <Label htmlFor="link-url" className="text-sm font-medium">
                          URL do Link *
                        </Label>
                        <Input
                          id="link-url"
                          type="url"
                          placeholder="https://drive.google.com/..."
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          className="mt-1"
                          disabled={savingLink}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="link-description" className="text-sm font-medium">
                          Descrição do Link
                        </Label>
                        <Input
                          id="link-description"
                          placeholder="Ex: Documentação do projeto, Orçamento aprovado..."
                          value={newLinkDescription}
                          onChange={(e) => setNewLinkDescription(e.target.value)}
                          className="mt-1"
                          disabled={savingLink}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleAddLink}
                          disabled={!newLinkUrl.trim() || savingLink}
                          className="flex-1"
                        >
                          {savingLink ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <LinkIcon className="h-4 w-4 mr-2" />
                          )}
                          Anexar Link
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setShowLinkForm(false);
                            setNewLinkUrl('');
                            setNewLinkDescription('');
                          }}
                          disabled={savingLink}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Chat/Mensagens */}
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Mensagens ({messages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nenhuma mensagem ainda.</p>
                  ) : (
                    messages.map((message, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-gray-900">
                              {message.remetenteNome || 'Sistema'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(message.criadoEm)}
                            </p>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-1">
                            {message.conteudo}
                          </p>
                          {message.imagens && message.imagens.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {message.imagens.map((img, imgIndex) => (
                                <img
                                  key={imgIndex}
                                  src={img.url}
                                  alt={`Anexo ${imgIndex + 1}`}
                                  className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-75 transition-opacity"
                                  onClick={() => window.open(img.url, '_blank')}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {!isArchived && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Textarea
                        ref={textareaRef}
                        placeholder="Digite sua mensagem..."
                        value={newMessage}
                        onChange={handleTextareaChange}
                        onKeyDown={handleTextareaKeyDown}
                        rows={3}
                        disabled={sendingMessage}
                      />
                      {showMentionSuggestions && (
                        <div className="absolute bottom-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-32 overflow-y-auto">
                          {mentionSuggestions.map((user, index) => (
                            <button
                              key={index}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center space-x-2"
                              onClick={() => insertMention(user)}
                            >
                              <AtSign className="h-4 w-4 text-gray-400" />
                              <span>{user.nome}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <ImageUpload
                        onImagesChange={setChatImages}
                        maxImages={3}
                        disabled={sendingMessage}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={(!newMessage.trim() && chatImages.length === 0) || sendingMessage}
                      >
                        {sendingMessage ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Enviar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {linkedProjectIds.length > 0 && (
              <Card>
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Projeto{linkedProjectIds.length > 1 ? 's' : ''} Vinculado{linkedProjectIds.length > 1 ? 's' : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {linkedProjectIds.length > 1 && (
                    <div className="mb-4">
                      <Label className="text-sm font-medium text-gray-700">Selecionar Projeto</Label>
                      <Select value={activeProjectId || ''} onValueChange={handleSelectProject}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecione um projeto" />
                        </SelectTrigger>
                        <SelectContent>
                          {linkedProjectIds.map(pid => {
                            const proj = projectsMap[pid];
                            return (
                              <SelectItem key={pid} value={pid}>
                                {proj?.nome || `Projeto ${pid.slice(-6)}`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {project ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Nome</Label>
                        <p className="text-gray-900">{project.nome}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Cliente</Label>
                        <p className="text-gray-900">{project.cliente || 'Não informado'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Evento</Label>
                        <p className="text-gray-900">{project.evento || 'Não informado'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Status</Label>
                        <Badge variant="outline">{project.status || 'Não definido'}</Badge>
                      </div>
                      {project.dataInicio && (
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Data de Início</Label>
                          <p className="text-gray-900">{formatDate(project.dataInicio)}</p>
                        </div>
                      )}
                      {project.dataFim && (
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Data de Fim</Label>
                          <p className="text-gray-900">{formatDate(project.dataFim)}</p>
                        </div>
                      )}
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/projeto/${activeProjectId}`)}
                          className="w-full"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ver Projeto Completo
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Projeto não encontrado</p>
                  )}
                </CardContent>
              </Card>
            )}

            {!isArchived && availableStatuses.length > 0 && (
              <Card>
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Ações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs sm:text-sm font-medium text-gray-700">Atualizar Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione uma ação" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStatuses.map(status => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(newStatus === 'rejeitado' || newStatus === 'enviado_para_area') && (
                    <div>
                      <Label className="text-xs sm:text-sm font-medium text-gray-700">
                        {newStatus === 'rejeitado' ? 'Motivo da Rejeição' : 'Motivo do Envio'} *
                      </Label>
                      <Textarea
                        placeholder="Descreva o motivo..."
                        value={conclusionDescription}
                        onChange={(e) => setConclusionDescription(e.target.value)}
                        rows={3}
                        className="mt-1"
                        disabled={updating}
                      />
                    </div>
                  )}
                  {newStatus === 'enviado_para_area' && (
                    <div>
                      <Label className="text-xs sm:text-sm font-medium text-gray-700">Área de Destino *</Label>
                      <Select value={selectedArea} onValueChange={setSelectedArea}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecione a área" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compras">Compras</SelectItem>
                          <SelectItem value="locacao">Locação</SelectItem>
                          <SelectItem value="producao">Produção</SelectItem>
                          <SelectItem value="logistica">Logística</SelectItem>
                          <SelectItem value="financeiro">Financeiro</SelectItem>
                          <SelectItem value="operacional">Operacional</SelectItem>
                          <SelectItem value="comunicacao_visual">Comunicação Visual</SelectItem>
                          <SelectItem value="almoxarifado">Almoxarifado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {newStatus === 'concluido' && (
                    <div>
                      <Label className="text-xs sm:text-sm font-medium text-gray-700">Observações da Conclusão (Opcional)</Label>
                      <Textarea
                        placeholder="Adicione observações sobre a conclusão..."
                        value={conclusionDescription}
                        onChange={(e) => setConclusionDescription(e.target.value)}
                        rows={3}
                        className="mt-1"
                        disabled={updating}
                      />
                    </div>
                  )}
                  {newStatus === 'concluido' && (
                    <div>
                      <Label className="text-xs sm:text-sm font-medium text-gray-700">Imagens da Conclusão (Opcional)</Label>
                      <ImageUpload
                        onImagesChange={setConclusionImages}
                        maxImages={5}
                        disabled={updating}
                      />
                    </div>
                  )}
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={!newStatus || updating || ((newStatus === 'rejeitado' || newStatus === 'enviado_para_area') && !conclusionDescription.trim())}
                    className="w-full"
                  >
                    {updating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Atualizar Status
                  </Button>
                </CardContent>
              </Card>
            )}

            {historyEvents.length > 0 && (
              <Card>
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Histórico do Chamado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {historyEvents.map((event, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 ${event.color}`}>
                          <event.Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{event.description}</span>{' '}
                            <span className="text-gray-600">{event.userName}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(event.date)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {userProfile?.funcao === 'administrador' && (
              <Card>
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="flex items-center text-base sm:text-lg text-gray-700">
                    <Shield className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Ações Administrativas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!isArchived ? (
                    <Button
                      onClick={handleArchiveTicket}
                      variant="outline"
                      className="w-full text-gray-600 border-gray-300 hover:bg-gray-50"
                      disabled={updating}
                    >
                      {updating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Archive className="h-4 w-4 mr-2" />
                      )}
                      Arquivar Chamado
                    </Button>
                  ) : (
                    <Button
                      onClick={handleUnarchiveTicket}
                      variant="outline"
                      className="w-full text-blue-600 border-blue-300 hover:bg-blue-50"
                      disabled={updating}
                    >
                      {updating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                      )}
                      Desarquivar Chamado
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;

