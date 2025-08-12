import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService } from '@/services/ticketService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { messageService } from '@/services/messageService';
import notificationService from '@/services/notificationService';
import ImageUpload from '@/components/ImageUpload'; // Mantenha este import se ImageUpload for um arquivo separado
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
  FolderOpen,
  Folder,
} from 'lucide-react';

const TicketDetailPage = () => {
    const { ticketId } = useParams();
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();

    // Estados
    const [ticket, setTicket] = useState(null);
    const [projects, setProjects] = useState([]); // <<-- ÚNICA FONTE DA VERDADE PARA PROJETOS
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [chatImages, setChatImages] = useState([]);
    const [newStatus, setNewStatus] = useState('');
    const [conclusionImages, setConclusionImages] = useState([]);
    const [conclusionDescription, setConclusionDescription] = useState('');
    const [escalationArea, setEscalationArea] = useState('');
    const [escalationReason, setEscalationReason] = useState('');
    const [isEscalating, setIsEscalating] = useState(false);
    const [managementArea, setManagementArea] = useState('');
    const [managementReason, setManagementReason] = useState('');
    const [isEscalatingToManagement, setIsEscalatingToManagement] = useState(false);
    const [consultorReason, setConsultorReason] = useState('');
    const [isEscalatingToConsultor, setIsEscalatingToConsultor] = useState(false);
    const [users, setUsers] = useState([]);
    const [historyEvents, setHistoryEvents] = useState([]);
    const [isResubmitting, setIsResubmitting] = useState(false);
    const [additionalInfo, setAdditionalInfo] = useState('');
    const [parentTicketForLink, setParentTicketForLink] = useState(null);

    const textareaRef = useRef(null);

    const loadAllData = async () => {
        try {
            if (!ticketId) throw new Error("ID do chamado não fornecido.");
            
            setLoading(true);
            setError(null);
            setAccessDenied(false);

            // Carregamentos que não dependem do chamado podem vir primeiro
            const usersData = await userService.getAllUsers();
            setUsers(usersData || []);

            // Carrega o chamado principal
            const ticketData = await ticketService.getTicketById(ticketId);
            if (!ticketData) throw new Error('Chamado não encontrado');
            setTicket(ticketData);

            // --- LÓGICA DE CARREGAMENTO DE PROJETOS CORRIGIDA ---
            const projectsToLoad = [];
            if (ticketData.projetoId) { // Formato antigo: um projeto
                console.log("Formato antigo detectado, carregando projeto único...");
                const projectData = await projectService.getProjectById(ticketData.projetoId);
                if (projectData) {
                    projectsToLoad.push(projectData);
                }
            } else if (ticketData.projetos?.length > 0) { // Formato novo: múltiplos projetos
                console.log("Formato novo detectado, carregando múltiplos projetos...");
                const projectPromises = ticketData.projetos.map(id => projectService.getProjectById(id));
                const results = await Promise.allSettled(projectPromises);
                results.forEach(result => {
                    if (result.status === 'fulfilled' && result.value) {
                        projectsToLoad.push(result.value);
                    }
                });
            }
            setProjects(projectsToLoad);
            // --- FIM DA LÓGICA CORRIGIDA ---

            // Carrega o resto em paralelo
            const promises = [];
            if (ticketData.chamadoPaiId) {
                promises.push(ticketService.getTicketById(ticketData.chamadoPaiId).then(setParentTicketForLink));
            }

            promises.push(messageService.getMessagesByTicket(ticketId).then(m => setMessages(m || [])));

            if (user?.uid) {
                promises.push(notificationService.markTicketNotificationsAsRead(user.uid, ticketId));
            }

            await Promise.all(promises);

        } catch (err) {
            console.error('Erro ao carregar dados da página:', err);
            setError(err.message || 'Erro ao carregar o chamado');
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        if (ticketId && user) {
            loadAllData();
        }
    }, [ticketId, user]);

    useEffect(() => {
        if (ticket && userProfile && user) {
            if (ticket.isConfidential) {
                const isCreator = ticket.criadoPor === user.uid;
                const isAdmin = userProfile.funcao === 'administrador';
                const isInvolvedOperator = userProfile.funcao === 'operador' &&
                                           (userProfile.area === ticket.area || userProfile.area === ticket.areaDeOrigem);
                if (!isCreator && !isAdmin && !isInvolvedOperator) {
                    setAccessDenied(true);
                }
            }
        }
    }, [ticket, userProfile, user]);

    useEffect(() => {
        if (ticket && users.length > 0) {
            const getUserNameById = (userId) => {
                if (!userId) return 'Sistema';
                const userFound = users.find(u => u.uid === userId || u.id === userId);
                return userFound?.nome || 'Usuário Desconhecido';
            };

            const events = [];
            if (ticket.criadoEm) events.push({ date: ticket.criadoEm, description: 'Chamado criado por', userName: ticket.criadoPorNome || getUserNameById(ticket.criadoPor), Icon: PlusCircle, color: 'text-blue-500' });
            if (ticket.escaladoEm && ticket.motivoEscalonamentoGerencial) events.push({ date: ticket.escaladoEm, description: 'Escalado para gerência por', userName: getUserNameById(ticket.escaladoPor), Icon: Shield, color: 'text-purple-500' });
            if (ticket.aprovadoEm) events.push({ date: ticket.aprovadoEm, description: 'Aprovado por', userName: getUserNameById(ticket.aprovadoPor), Icon: ThumbsUp, color: 'text-green-500' });
            if (ticket.rejeitadoEm) events.push({ date: ticket.rejeitadoEm, description: 'Rejeitado / Devolvido por', userName: getUserNameById(ticket.rejeitadoPor), Icon: ThumbsDown, color: 'text-red-500' });
            if (ticket.concluidoEm) events.push({ date: ticket.concluidoEm, description: 'Concluído por', userName: getUserNameById(ticket.concluidoPor), Icon: CheckCircle, color: 'text-green-600' });
            if (ticket.arquivadoEm) events.push({ date: ticket.arquivadoEm, description: 'Arquivado por', userName: getUserNameById(ticket.arquivadoPor), Icon: Archive, color: 'text-gray-500' });

            const sortedEvents = events.sort((a, b) => (a.date?.toDate ? a.date.toDate() : new Date(a.date)) - (b.date?.toDate ? b.date.toDate() : new Date(b.date)));
            setHistoryEvents(sortedEvents);
        }
    }, [ticket, users]);

    const formatDate = (date) => {
        if (!date) return 'Data não disponível';
        try {
            const dateObj = (date.toDate && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
            if (isNaN(dateObj.getTime())) return 'Data inválida';
            return dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (error) {
            return 'Erro na data';
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'aberto': 'bg-blue-100 text-blue-800', 'em_tratativa': 'bg-yellow-100 text-yellow-800',
            'enviado_para_area': 'bg-purple-100 text-purple-800', 'escalado_para_outra_area': 'bg-purple-100 text-purple-800',
            'aguardando_aprovacao': 'bg-orange-100 text-orange-800', 'executado_aguardando_validacao': 'bg-indigo-100 text-indigo-800',
            'concluido': 'bg-green-100 text-green-800', 'cancelado': 'bg-red-100 text-red-800',
            'devolvido': 'bg-pink-100 text-pink-800', 'aprovado': 'bg-green-100 text-green-800',
            'reprovado': 'bg-red-100 text-red-800', 'arquivado': 'bg-gray-100 text-gray-700',
            'escalado_para_consultor': 'bg-cyan-100 text-cyan-800', 'executado_pelo_consultor': 'bg-teal-100 text-teal-800',
            'executado_aguardando_validacao_operador': 'bg-indigo-100 text-indigo-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getStatusText = (status) => {
        const statusTexts = {
            'aberto': 'Aberto', 'em_tratativa': 'Em Tratativa', 'enviado_para_area': 'Enviado para Área',
            'escalado_para_outra_area': 'Escalado para Outra Área', 'aguardando_aprovacao': 'Aguardando Aprovação',
            'executado_aguardando_validacao': 'Aguardando Validação', 'concluido': 'Concluído',
            'cancelado': 'Cancelado', 'devolvido': 'Devolvido', 'aprovado': 'Aprovado',
            'reprovado': 'Reprovado', 'arquivado': 'Arquivado', 'escalado_para_consultor': 'Escalado para Consultor',
            'executado_pelo_consultor': 'Executado pelo Consultor',
            'executado_aguardando_validacao_operador': 'Aguardando Validação do Operador'
        };
        return statusTexts[status] || status.replace(/_/g, ' ');
    };

    const getAvailableStatuses = () => {
        if (!ticket || !userProfile || !user) return [];
        const { status: currentStatus, criadoPor, area, atribuidoA, areaDeOrigem, consultorResponsavelId } = ticket;
        const { funcao, area: userArea, uid: userId } = userProfile;
        const isCreator = criadoPor === userId;

        if (isCreator && ['executado_aguardando_validacao', 'executado_aguardando_validacao_operador'].includes(currentStatus)) {
            return [{ value: 'concluido', label: 'Validar e Concluir' }, { value: 'enviado_para_area', label: 'Rejeitar / Devolver' }];
        }
        if (funcao === 'administrador') {
            if (['aberto', 'escalado_para_outra_area', 'enviado_para_area'].includes(currentStatus)) return [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }];
            if (currentStatus === 'em_tratativa') return [{ value: 'executado_aguardando_validacao', label: 'Executado' }];
            if (currentStatus === 'executado_aguardando_validacao' && !isCreator) return [{ value: 'concluido', label: 'Forçar Conclusão (Admin)' }];
            if (currentStatus === 'aguardando_aprovacao') return [{ value: 'aprovado', label: 'Aprovar' }, { value: 'rejeitado', label: 'Reprovar' }];
        }
        if (funcao === 'operador' && (area === userArea || atribuidoA === userId)) {
            if (['aberto', 'escalado_para_outra_area', 'enviado_para_area'].includes(currentStatus)) {
                const actions = [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }];
                if (areaDeOrigem && areaDeOrigem !== area) {
                    actions.push({ value: 'enviado_para_area', label: 'Rejeitar / Devolver' });
                }
                return actions;
            }
            if (currentStatus === 'em_tratativa') return [{ value: 'executado_aguardando_validacao_operador', label: 'Executado' }];
            if (currentStatus === 'executado_pelo_consultor') return [{ value: 'em_tratativa', label: 'Continuar Tratativa' }, { value: 'executado_aguardando_validacao', label: 'Finalizar Execução' }];
        }
        if (funcao === 'consultor' && consultorResponsavelId === userId && currentStatus === 'escalado_para_consultor') {
            return [{ value: 'executado_pelo_consultor', label: 'Executar e Devolver para a Área' }];
        }
        return [];
    };

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && chatImages.length === 0) || !user || !ticket) return;
        setSendingMessage(true);
        try {
            const messageData = {
                userId: user.uid, remetenteNome: userProfile?.nome || user.email,
                conteudo: newMessage.trim(), imagens: chatImages, criadoEm: new Date(), type: 'user_message'
            };
            await messageService.sendMessage(ticketId, messageData);
            await notificationService.notifyNewMessage(ticketId, ticket, messageData, user.uid);
            await loadAllData();
            setNewMessage('');
            setChatImages([]);
        } catch (error) {
            setError('Erro ao enviar mensagem: ' + error.message);
        } finally {
            setSendingMessage(false);
        }
    };
    
    const handleStatusUpdate = async () => {
        if (!newStatus) return;
        if ((newStatus === 'rejeitado' || newStatus === 'enviado_para_area') && !conclusionDescription.trim()) {
            alert('Por favor, forneça um motivo para a rejeição/devolução.');
            return;
        }
        setUpdating(true);
        try {
            let updateData = { status: newStatus, atualizadoPor: user.uid, dataUltimaAtualizacao: new Date() };
            let systemMessageContent = `Status atualizado para: ${getStatusText(newStatus)}`;

            if (newStatus === 'concluido') {
                updateData.conclusaoDescricao = conclusionDescription;
                updateData.conclusaoImagens = conclusionImages;
                updateData.concluidoEm = new Date();
                updateData.concluidoPor = user.uid;
                systemMessageContent = `✅ Chamado concluído por ${userProfile.nome}.`;
            } else if (newStatus === 'rejeitado') {
                updateData.motivoRejeicao = conclusionDescription;
                updateData.rejeitadoEm = new Date();
                updateData.rejeitadoPor = user.uid;
                systemMessageContent = `❌ Chamado reprovado pelo gerente. Motivo: ${conclusionDescription}`;
            } else if (newStatus === 'enviado_para_area') {
                if (!ticket.areaDeOrigem) throw new Error('A área de origem para devolução não foi encontrada.');
                updateData.motivoRejeicao = conclusionDescription;
                updateData.rejeitadoEm = new Date();
                updateData.rejeitadoPor = user.uid;
                updateData.areaQueRejeitou = ticket.area;
                updateData.area = ticket.areaDeOrigem;
                systemMessageContent = `🔄 Chamado devolvido para: ${updateData.area.replace(/_/g, ' ')}. Motivo: ${conclusionDescription}`;
            } else if (newStatus === 'aprovado' && ticket.status === 'aguardando_aprovacao' && userProfile.funcao === 'gerente') {
                updateData.status = 'em_tratativa';
                updateData.area = ticket.areaDeOrigem || ticket.area;
                updateData.aprovadoEm = new Date();
                updateData.aprovadoPor = user.uid;
                systemMessageContent = `✅ Chamado aprovado pelo gerente e retornado para a área responsável.`;
            } else if (newStatus === 'executado_pelo_consultor') {
                updateData.area = ticket.areaDeOrigem;
                updateData.consultorResponsavelId = null;
                systemMessageContent = `👨‍🎯 Chamado executado pelo consultor e devolvido para: ${ticket.areaDeOrigem?.replace('_', ' ').toUpperCase()}`;
            }

            await ticketService.updateTicket(ticketId, updateData);
            await messageService.sendMessage(ticketId, { userId: 'system', remetenteNome: 'Sistema', conteudo: systemMessageContent, criadoEm: new Date(), type: 'status_update' });
            await notificationService.notifyStatusChange(ticketId, ticket, newStatus, ticket.status, user.uid);
            await loadAllData();
            setNewStatus('');
            setConclusionDescription('');
            setConclusionImages([]);
        } catch (error) {
            setError('Erro ao atualizar status: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };
    
    const handleArchiveTicket = async () => {
        if (!window.confirm('Tem certeza que deseja arquivar este chamado?')) return;
        setUpdating(true);
        try {
            await ticketService.updateTicket(ticketId, {
                status: 'arquivado', arquivadoEm: new Date(), arquivadoPor: user.uid,
                dataUltimaAtualizacao: new Date()
            });
            await loadAllData();
        } catch (error) {
            setError('Ocorreu um erro ao arquivar o chamado.');
        } finally {
            setUpdating(false);
        }
    };

    const handleUnarchiveTicket = async () => {
        if (!window.confirm('Deseja desarquivar este chamado?')) return;
        setUpdating(true);
        try {
            await ticketService.updateTicket(ticketId, {
                status: 'concluido', arquivadoEm: null, arquivadoPor: null,
                dataUltimaAtualizacao: new Date()
            });
            await loadAllData();
        } catch (error) {
            setError('Ocorreu um erro ao desarquivar o chamado.');
        } finally {
            setUpdating(false);
        }
    };

    const handleEscalation = async () => {
        if (!escalationArea || !escalationReason.trim()) return;
        setIsEscalating(true);
        try {
            await ticketService.escalateTicketToArea(ticketId, escalationArea, {
                status: 'escalado_para_outra_area', area: escalationArea,
                motivoEscalonamento: escalationReason, atualizadoPor: user?.uid,
                dataUltimaAtualizacao: new Date()
            });
            await messageService.sendMessage(ticketId, {
                userId: 'system', remetenteNome: 'Sistema',
                conteudo: `🔄 Chamado escalado para ${escalationArea.replace('_', ' ').toUpperCase()}. Motivo: ${escalationReason}`,
                criadoEm: new Date(), type: 'escalation'
            });
            await loadAllData();
            setEscalationArea('');
            setEscalationReason('');
        } catch (error) {
            setError('Erro ao escalar chamado: ' + error.message);
        } finally {
            setIsEscalating(false);
        }
    };
    
    const handleManagementEscalation = async () => {
        if (!managementArea || !managementReason.trim()) return;
        const targetArea = managementArea.replace('gerente_', '');
        const targetManager = users.find(u => u.funcao === 'gerente' && u.area === targetArea);
        if (!targetManager) { alert(`Erro: Nenhum gerente encontrado para a área "${targetArea}".`); return; }
        
        setIsEscalatingToManagement(true);
        try {
            const updateData = {
                status: 'aguardando_aprovacao', areaDeOrigem: ticket.area,
                gerenteResponsavelId: targetManager.uid, motivoEscalonamentoGerencial: managementReason,
                escaladoPor: user.uid, escaladoEm: new Date(),
                dataUltimaAtualizacao: new Date()
            };
            await ticketService.updateTicket(ticketId, updateData);
            await messageService.sendMessage(ticketId, {
                userId: 'system', remetenteNome: 'Sistema',
                conteudo: `👨‍💼 Chamado escalado para Gerência. Motivo: ${managementReason}`,
                criadoEm: new Date(), type: 'management_escalation'
            });
            await loadAllData();
            setManagementArea('');
            setManagementReason('');
        } catch (error) {
            setError('Erro ao escalar para gerência: ' + error.message);
        } finally {
            setIsEscalatingToManagement(false);
        }
    };

    const handleConsultorEscalation = async () => {
        const mainProject = projects.length > 0 ? projects[0] : null;
        if (!consultorReason.trim() || !mainProject?.consultorId) return;
        setIsEscalatingToConsultor(true);
        try {
            await ticketService.updateTicket(ticketId, {
                status: 'escalado_para_consultor', areaDeOrigem: ticket.area,
                consultorResponsavelId: mainProject.consultorId, motivoEscalonamentoConsultor: consultorReason,
                escaladoPor: user.uid, escaladoEm: new Date(),
                dataUltimaAtualizacao: new Date()
            });
            await messageService.sendMessage(ticketId, {
                userId: 'system', remetenteNome: 'Sistema',
                conteudo: `👨‍🎯 Chamado escalado para CONSULTOR. Motivo: ${consultorReason}`,
                criadoEm: new Date(), type: 'consultor_escalation'
            });
            await loadAllData();
            setConsultorReason('');
        } catch (error) {
            setError('Erro ao escalar para consultor: ' + error.message);
        } finally {
            setIsEscalatingToConsultor(false);
        }
    };

    const handleTransferToProducer = async () => {
        const mainProject = projects.length > 0 ? projects[0] : null;
        if (!mainProject?.produtorId) return;
        setUpdating(true);
        try {
            await ticketService.updateTicket(ticketId, {
                status: 'transferido_para_produtor', produtorResponsavelId: mainProject.produtorId,
                transferidoPor: user.uid, transferidoEm: new Date(),
                dataUltimaAtualizacao: new Date()
            });
            await messageService.sendMessage(ticketId, {
                userId: 'system', remetenteNome: 'Sistema',
                conteudo: `🏭 Chamado transferido para PRODUTOR DO PROJETO.`,
                criadoEm: new Date(), type: 'producer_transfer'
            });
            await loadAllData();
        } catch (error) {
            setError('Erro ao transferir para produtor: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleResubmitTicket = async () => {
        if (!additionalInfo.trim() || !ticket?.areaQueRejeitou) return;
        setIsResubmitting(true);
        try {
            await ticketService.updateTicket(ticketId, {
                status: 'aberto', area: ticket.areaQueRejeitou,
                areaDeOrigem: ticket.area, areaQueRejeitou: null,
                descricao: `${ticket.descricao}\n\n--- INFORMAÇÕES ADICIONAIS (${formatDate(new Date())}) ---\n${additionalInfo}`,
                atualizadoPor: user.uid, dataUltimaAtualizacao: new Date()
            });
            await messageService.sendMessage(ticketId, {
                userId: 'system', remetenteNome: 'Sistema',
                conteudo: `📬 Chamado reenviado com informações adicionais para a área: ${ticket.areaQueRejeitou.replace(/_/g, ' ')}.`,
                criadoEm: new Date(), type: 'status_update'
            });
            await loadAllData();
            setAdditionalInfo('');
        } catch (error) {
            setError('Ocorreu um erro ao reenviar o chamado: ' + error.message);
        } finally {
            setIsResubmitting(false);
        }
    };

    if (loading) return (<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" /><p className="text-lg font-semibold">Carregando chamado...</p></div></div>);
    if (error) return (<div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-lg border-red-500"><CardHeader className="text-center"><AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" /><CardTitle className="text-2xl text-red-700">Ocorreu um Erro</CardTitle></CardHeader><CardContent className="text-center"><p className="mb-6">{error}</p><Button onClick={() => navigate('/dashboard')} variant="destructive"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></CardContent></Card></div>);
    if (accessDenied) return (<div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-lg border-yellow-500"><CardHeader className="text-center"><Lock className="h-16 w-16 text-yellow-500 mx-auto mb-4" /><CardTitle className="text-2xl text-yellow-700">Acesso Restrito</CardTitle></CardHeader><CardContent className="text-center"><p className="mb-6">Este chamado é confidencial e você não tem permissão para visualizá-lo.</p><Button onClick={() => navigate('/dashboard')} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></CardContent></Card></div>);
    if (!ticket) return (<div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-lg"><CardHeader className="text-center"><XCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" /><CardTitle className="text-2xl">Chamado Não Encontrado</CardTitle></CardHeader><CardContent className="text-center"><p className="mb-6">O chamado que você procura não existe.</p><Button onClick={() => navigate('/dashboard')} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></CardContent></Card></div>);

    const isArchived = ticket.status === 'arquivado';
    const availableStatuses = getAvailableStatuses();

    return (
        <div className="min-h-screen bg-gray-50">
            <Header title={`Chamado #${ticket.numero || ticketId.slice(-8)}`} />
            <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
                <div className="mb-4 sm:mb-6">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="mb-3 sm:mb-4"><ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />Voltar ao Dashboard</Button>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0 flex-1"><h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 break-words">{ticket.titulo}</h2><p className="text-gray-600 mt-1">Criado em {formatDate(ticket.criadoEm)} por {ticket.criadoPorNome}</p></div>
                        <div className="flex items-center space-x-2">{ticket.isConfidential && <Badge variant="outline" className="border-orange-400 bg-orange-50 text-orange-700"><Lock className="h-3 w-3 mr-1.5" />Confidencial</Badge>}<Badge className={getStatusColor(ticket.status)}>{getStatusText(ticket.status)}</Badge></div>
                    </div>
                </div>

                {parentTicketForLink && <Card className="mb-6 bg-amber-50 border-amber-200"><CardHeader><CardTitle className="flex items-center text-base text-amber-900"><LinkIcon className="h-4 w-4 mr-2" />Vinculado ao Chamado Pai</CardTitle></CardHeader><CardContent><Link to={`/chamado/${parentTicketForLink.id}`} className="text-blue-600 hover:underline">Ver Chamado Original: {parentTicketForLink.titulo}</Link></CardContent></Card>}
                {isArchived && <Alert variant="default" className="mb-6 bg-gray-100 border-gray-300"><Archive className="h-4 w-4" /><AlertDescription>Este chamado está arquivado e é somente para consulta.</AlertDescription></Alert>}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Card><CardHeader><CardTitle className="flex items-center"><AlertCircle className="h-5 w-5 mr-2" />Detalhes do Chamado</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label>Título</Label><p>{ticket.titulo}</p></div><div><Label>Descrição</Label><p className="whitespace-pre-wrap">{ticket.descricao}</p></div>{ticket.imagens && ticket.imagens.length > 0 && <div><Label className="mb-2 block">Imagens Anexadas</Label><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{ticket.imagens.map((img, i) => <a key={i} href={img.url} target="_blank" rel="noopener noreferrer"><img src={img.url} alt={img.name} className="w-full h-32 object-cover rounded-lg border"/></a>)}</div></div>}{ticket.isExtra && <div className="p-3 bg-orange-50 border-orange-200 rounded-lg"><div className="flex items-center gap-2"><span className="font-semibold text-orange-700">🔥 ITEM EXTRA</span></div>{ticket.motivoExtra && <div><Label>Motivo</Label><p className="text-orange-900">{ticket.motivoExtra}</p></div>}</div>}<div className="grid grid-cols-2 gap-4"><div><Label>Área</Label><p>{ticket.area}</p></div><div><Label>Tipo</Label><p>{ticket.tipo}</p></div></div></CardContent></Card>
                        {user && ticket.criadoPor === user.uid && ticket.status === 'enviado_para_area' && ticket.areaQueRejeitou && <Card className="bg-yellow-50 border-yellow-300"><CardHeader><CardTitle className="flex items-center text-yellow-900"><ClipboardEdit className="h-5 w-5 mr-2" />Ação Necessária: Corrigir e Reenviar</CardTitle><CardDescription className="text-yellow-800">Devolvido pela área <strong>{ticket.areaQueRejeitou.replace(/_/g, ' ')}</strong>. Adicione as informações e reenvie.</CardDescription></CardHeader><CardContent className="space-y-4">{ticket.motivoRejeicao && <div className="p-3 bg-white border rounded-md"><Label>Motivo da Devolução</Label><p>{ticket.motivoRejeicao}</p></div>}<div><Label htmlFor="additional-info" className="font-semibold">Novas Informações/Correções *</Label><Textarea id="additional-info" placeholder="Forneça os detalhes solicitados..." value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} rows={4} className="mt-2" disabled={isResubmitting}/></div><Button onClick={handleResubmitTicket} disabled={!additionalInfo.trim() || isResubmitting} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">{isResubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Send className="h-4 w-4 mr-2"/>}Reenviar para {ticket.areaQueRejeitou.replace(/_/g, ' ')}</Button></CardContent></Card>}
                        <Card><CardHeader><CardTitle className="flex items-center"><MessageSquare className="h-5 w-5 mr-2" />Conversas ({messages.length})</CardTitle></CardHeader><CardContent><div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2">{messages.length > 0 ? messages.map((msg, i) => <div key={i} className="flex space-x-3"><div className="flex-shrink-0"><div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center"><User className="h-4 w-4 text-white"/></div></div><div className="flex-1"><div className="flex items-center space-x-2"><span className="font-medium">{msg.remetenteNome}</span><span className="text-xs text-gray-500">{formatDate(msg.criadoEm)}</span></div>{msg.conteudo && <p className="mt-1">{msg.conteudo}</p>}{msg.imagens && msg.imagens.length > 0 && <div className="grid grid-cols-2 gap-2 mt-2">{msg.imagens.map((url, idx) => <a key={idx} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`Anexo ${idx+1}`} className="w-full h-20 object-cover rounded border"/></a>)}</div>}</div></div>) : <p className="text-center text-gray-500 py-4">Nenhuma mensagem ainda.</p>}</div>{!isArchived && <div className="border-t pt-4 space-y-3"><Textarea ref={textareaRef} placeholder="Digite sua mensagem..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} rows={3} disabled={sendingMessage}/><ImageUpload onImagesUploaded={setChatImages} existingImages={chatImages} maxImages={3} buttonText="Anexar ao Chat"/><div className="flex justify-end"><Button onClick={handleSendMessage} disabled={sendingMessage || (!newMessage.trim() && chatImages.length === 0)}>{sendingMessage ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Send className="h-4 w-4 mr-2"/>}Enviar</Button></div></div>}</CardContent></Card>
                        {!isArchived && (userProfile?.funcao === 'operador' || userProfile?.funcao === 'administrador') && <Card><CardHeader><CardTitle className="flex items-center"><span className="text-xl mr-2">🔄</span>Escalar Chamado</CardTitle><CardDescription>Transfira este chamado para outra área.</CardDescription></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="escalation-area">Área de Destino *</Label><Select value={escalationArea} onValueChange={setEscalationArea}><SelectTrigger><SelectValue placeholder="Selecione a área"/></SelectTrigger><SelectContent><SelectItem value="logistica">Logística</SelectItem><SelectItem value="compras">Compras</SelectItem></SelectContent></Select></div><div><Label htmlFor="escalation-reason">Motivo *</Label><Textarea id="escalation-reason" value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} placeholder="Descreva o motivo da escalação..." className="mt-2"/></div><Button onClick={handleEscalation} disabled={!escalationArea || !escalationReason.trim() || isEscalating} className="w-full">{isEscalating ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Send className="h-4 w-4 mr-2"/>}Enviar para Área</Button></CardContent></Card>}
                        {!isArchived && (userProfile?.funcao === 'operador' || userProfile?.funcao === 'administrador') && projects.length > 0 && projects[0]?.consultorId && <Card><CardHeader><CardTitle className="flex items-center"><span className="text-xl mr-2">👨‍🎯</span>Escalar para Consultor</CardTitle><CardDescription>Escale para o consultor do projeto.</CardDescription></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="consultor-reason">Motivo da Escalação *</Label><Textarea id="consultor-reason" value={consultorReason} onChange={(e) => setConsultorReason(e.target.value)} placeholder="Descreva o motivo..." className="mt-2"/></div><Button onClick={handleConsultorEscalation} disabled={!consultorReason.trim() || isEscalatingToConsultor} className="w-full">{isEscalatingToConsultor ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : "👨‍🎯"}Enviar para Consultor</Button></CardContent></Card>}
                        {!isArchived && (userProfile?.funcao === 'operador' || userProfile?.funcao === 'administrador') && <Card><CardHeader><CardTitle className="flex items-center"><span className="text-xl mr-2">👨‍💼</span>Escalar para Gerência</CardTitle><CardDescription>Escale para aprovação gerencial.</CardDescription></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="management-area">Gerência de Destino *</Label><Select value={managementArea} onValueChange={setManagementArea}><SelectTrigger><SelectValue placeholder="Selecione a gerência"/></SelectTrigger><SelectContent><SelectItem value="gerente_operacional">Gerência Operacional</SelectItem></SelectContent></Select></div><div><Label htmlFor="management-reason">Motivo *</Label><Textarea id="management-reason" value={managementReason} onChange={(e) => setManagementReason(e.target.value)} placeholder="Descreva o motivo..." className="mt-2"/></div><Button onClick={handleManagementEscalation} disabled={!managementArea || !managementReason.trim() || isEscalatingToManagement} className="w-full">{isEscalatingToManagement ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : "👨‍💼"}Enviar para Gerência</Button></CardContent></Card>}
                        {!isArchived && userProfile?.funcao === 'operador' && projects.length > 0 && projects[0]?.produtorId && <Card><CardHeader><CardTitle className="flex items-center"><span className="text-xl mr-2">🏭</span>Transferir para Produtor</CardTitle><CardDescription>Transfira para o produtor do projeto.</CardDescription></CardHeader><CardContent><div className="p-4 bg-blue-50 border rounded-lg text-center"><p>O chamado será transferido para o produtor responsável.</p></div><Button onClick={handleTransferToProducer} disabled={updating} className="w-full mt-4">{updating ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : "🏭"}Enviar para Produtor</Button></CardContent></Card>}
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        {projects.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center">
                                        {projects.length > 1 ? <FolderOpen className="h-5 w-5 mr-2"/> : <Folder className="h-5 w-5 mr-2"/>}
                                        {projects.length > 1 ? `Projetos (${projects.length})` : 'Projeto'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {projects.map((p) => (
                                        <div key={p.id} className="p-3 border rounded-lg">
                                            <p className="font-semibold">{p.nome}</p>
                                            <p className="text-sm text-gray-600">{p.cliente}</p>
                                            {p.local && <p className="text-sm text-gray-500">{p.local}</p>}
                                            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate(`/projeto/${p.id}`)}><ExternalLink className="h-4 w-4 mr-2"/>Ver Detalhes do Projeto</Button>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                        
                        {!isArchived && <Card><CardHeader><CardTitle className="flex items-center"><LinkIcon className="h-5 w-5 mr-2"/>Vincular Chamado</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600 mb-4">Crie um novo chamado que ficará vinculado a este.</p><Button className="w-full" variant="outline" onClick={() => navigate('/novo-chamado', { state: { linkedTicketId: ticket.id } })}><PlusCircle className="h-4 w-4 mr-2"/>Criar Chamado Vinculado</Button></CardContent></Card>}
                        {!isArchived && availableStatuses.length > 0 && <Card><CardHeader><CardTitle className="flex items-center"><Settings className="h-5 w-5 mr-2"/>Ações</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label>Alterar Status</Label><Select value={newStatus} onValueChange={setNewStatus}><SelectTrigger><SelectValue placeholder="Selecione uma ação"/></SelectTrigger><SelectContent>{availableStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>{(newStatus === 'concluido' || newStatus === 'enviado_para_area' || newStatus === 'rejeitado') && <div className="space-y-3"><div><Label>{newStatus === 'concluido' ? 'Descrição da Conclusão' : 'Motivo da Rejeição/Devolução'}</Label><Textarea placeholder={newStatus === 'concluido' ? "Descreva como foi resolvido..." : "Explique o motivo..."} value={conclusionDescription} onChange={(e) => setConclusionDescription(e.target.value)} rows={3}/></div>{newStatus === 'concluido' && <div><Label>Evidências (Imagens)</Label><ImageUpload onImagesUploaded={setConclusionImages} existingImages={conclusionImages} maxImages={5} buttonText="Anexar Evidências"/></div>}</div>}<Button onClick={handleStatusUpdate} disabled={!newStatus || updating} className="w-full">{updating ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <CheckCircle className="h-4 w-4 mr-2"/>}{updating ? 'Atualizando...' : 'Confirmar Ação'}</Button></CardContent></Card>}
                        {!isArchived && userProfile?.funcao === 'administrador' && ticket.status === 'concluido' && <Card><CardHeader><CardTitle className="flex items-center"><Archive className="h-5 w-5 mr-2"/>Ações de Arquivo</CardTitle></CardHeader><CardContent><Button onClick={handleArchiveTicket} disabled={updating} variant="outline" className="w-full">{updating ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Archive className="h-4 w-4 mr-2"/>}Arquivar Chamado</Button></CardContent></Card>}
                        <Card><CardHeader><CardTitle className="flex items-center"><Clock className="h-5 w-5 mr-2"/>Histórico do Chamado</CardTitle></CardHeader><CardContent><div className="space-y-4">{historyEvents.length > 0 ? historyEvents.map((event, i) => <div key={i} className="flex items-start space-x-3"><div className="flex flex-col items-center"><span className={`flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ${event.color}`}><event.Icon className="h-5 w-5"/></span>{i < historyEvents.length - 1 && <div className="h-6 w-px bg-gray-200"/>}</div><div className="flex-1 pt-1.5"><p className="text-sm text-gray-800">{event.description} <span className="font-semibold text-gray-900">{event.userName}</span></p><p className="text-xs text-gray-500 mt-0.5">{formatDate(event.date)}</p></div></div>) : <p className="text-sm text-center text-gray-500">Nenhum evento registrado.</p>}</div></CardContent></Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketDetailPage;
