import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService } from '@/services/ticketService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { messageService } from '@/services/messageService';
import notificationService from '@/services/notificationService';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  User,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
  PlusCircle,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Archive,
  ArchiveRestore,
  Link as LinkIcon,
  ClipboardEdit,
  Users,
  History,
  FolderOpen,
  Folder,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Settings,
  Image as ImageIcon
} from 'lucide-react';

// Componente para upload de imagem, se você tiver um separado, pode ajustar.
const ImageUpload = ({ onImagesUploaded, existingImages, maxImages, buttonText }) => {
    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        // Lógica para converter arquivos para URL ou o que for necessário
        const imageUrls = files.map(file => URL.createObjectURL(file)); // Exemplo
        onImagesUploaded(imageUrls);
    };

    return (
        <div>
            <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" id="image-upload-input" />
            <Button as="label" htmlFor="image-upload-input" variant="outline" className="w-full">
                <ImageIcon className="h-4 w-4 mr-2" />
                {buttonText || `Anexar Imagens (Máx: ${maxImages})`}
            </Button>
            {existingImages && existingImages.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                    {existingImages.map((img, index) => (
                        <img key={index} src={img} alt={`preview ${index}`} className="h-20 w-full object-cover rounded" />
                    ))}
                </div>
            )}
        </div>
    );
};


const TicketDetailPage = () => {
    const { ticketId } = useParams();
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();

    // Estados unificados
    const [ticket, setTicket] = useState(null);
    const [projects, setProjects] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [users, setUsers] = useState([]);
    const [historyEvents, setHistoryEvents] = useState([]);
    const [parentTicketForLink, setParentTicketForLink] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [chatImages, setChatImages] = useState([]);
    const [conclusionImages, setConclusionImages] = useState([]);
    const [newStatus, setNewStatus] = useState('');
    const [conclusionDescription, setConclusionDescription] = useState('');
    const [escalationArea, setEscalationArea] = useState('');
    const [escalationReason, setEscalationReason] = useState('');
    const [isEscalating, setIsEscalating] = useState(false);
    const [managementArea, setManagementArea] = useState('');
    const [managementReason, setManagementReason] = useState('');
    const [isEscalatingToManagement, setIsEscalatingToManagement] = useState(false);
    const [consultorReason, setConsultorReason] = useState('');
    const [isEscalatingToConsultor, setIsEscalatingToConsultor] = useState(false);
    const [isResubmitting, setIsResubmitting] = useState(false);
    const [additionalInfo, setAdditionalInfo] = useState('');

    const textareaRef = useRef(null);

    const loadAllData = async () => {
        try {
            if (!ticketId) {
                throw new Error("ID do chamado não fornecido.");
            }
            setLoading(true);
            setError(null);
            setAccessDenied(false);

            const usersData = await userService.getAllUsers();
            setUsers(usersData || []);

            const ticketData = await ticketService.getTicketById(ticketId);
            if (!ticketData) {
                throw new Error('Chamado não encontrado');
            }
            setTicket(ticketData);

            const promises = [];
            if (ticketData.chamadoPaiId) {
                promises.push(ticketService.getTicketById(ticketData.chamadoPaiId).then(setParentTicketForLink));
            }

            if (ticketData.projetoId) {
                promises.push(projectService.getProjectById(ticketData.projetoId).then(p => setProjects(p ? [p] : [])));
            } else if (ticketData.projetos?.length > 0) {
                const projectPromises = ticketData.projetos.map(id => projectService.getProjectById(id));
                promises.push(Promise.all(projectPromises).then(pData => setProjects(pData.filter(Boolean))));
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

            const sortedEvents = events.sort((a, b) => (a.date.toDate ? a.date.toDate() : new Date(a.date)) - (b.date.toDate ? b.date.toDate() : new Date(b.date)));
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
            'enviado_para_area': 'bg-purple-100 text-purple-800', 'aguardando_aprovacao': 'bg-orange-100 text-orange-800',
            'executado_aguardando_validacao': 'bg-indigo-100 text-indigo-800', 'concluido': 'bg-green-100 text-green-800',
            'cancelado': 'bg-red-100 text-red-800', 'devolvido': 'bg-pink-100 text-pink-800',
            'aprovado': 'bg-green-100 text-green-800', 'reprovado': 'bg-red-100 text-red-800',
            'arquivado': 'bg-gray-100 text-gray-700', 'escalado_para_consultor': 'bg-cyan-100 text-cyan-800',
            'executado_pelo_consultor': 'bg-teal-100 text-teal-800', 'executado_aguardando_validacao_operador': 'bg-indigo-100 text-indigo-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getStatusText = (status) => {
        const statusTexts = {
            'aberto': 'Aberto', 'em_tratativa': 'Em Tratativa', 'enviado_para_area': 'Enviado para Área',
            'aguardando_aprovacao': 'Aguardando Aprovação', 'executado_aguardando_validacao': 'Aguardando Validação',
            'concluido': 'Concluído', 'cancelado': 'Cancelado', 'devolvido': 'Devolvido',
            'aprovado': 'Aprovado', 'reprovado': 'Reprovado', 'arquivado': 'Arquivado',
            'escalado_para_consultor': 'Escalado para Consultor', 'executado_pelo_consultor': 'Executado pelo Consultor',
            'executado_aguardando_validacao_operador': 'Aguardando Validação do Operador'
        };
        return statusTexts[status] || status;
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
            if (['aberto', 'enviado_para_area'].includes(currentStatus)) return [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }];
            if (currentStatus === 'em_tratativa') return [{ value: 'executado_aguardando_validacao', label: 'Executado' }];
            if (currentStatus === 'executado_aguardando_validacao' && !isCreator) return [{ value: 'concluido', label: 'Forçar Conclusão (Admin)' }];
            if (currentStatus === 'aguardando_aprovacao') return [{ value: 'aprovado', label: 'Aprovar' }, { value: 'rejeitado', label: 'Reprovar' }];
        }
        if (funcao === 'operador' && (area === userArea || atribuidoA === userId)) {
            if (['aberto', 'enviado_para_area'].includes(currentStatus)) {
                const actions = [{ value: 'em_tratativa', label: 'Iniciar Tratativa' }];
                if (areaDeOrigem && areaDeOrigem !== area) {
                    actions.push({ value: 'enviado_para_area', label: 'Rejeitar / Devolver para Origem' });
                }
                return actions;
            }
            if (currentStatus === 'em_tratativa') return [{ value: 'executado_aguardando_validacao_operador', label: 'Executado (Aguard. Validação)' }];
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
            const updatedMessages = await messageService.getMessagesByTicket(ticketId);
            setMessages(updatedMessages || []);
            setNewMessage('');
            setChatImages([]);
        } catch (error) {
            setError('Erro ao enviar mensagem: ' + error.message);
        } finally {
            setSendingMessage(false);
        }
    };

    const handleStatusUpdate = async () => {
        if (!newStatus || !ticket) return;
        if ((newStatus === 'rejeitado' || newStatus === 'enviado_para_area') && !conclusionDescription.trim()) {
            alert('Por favor, forneça um motivo para a rejeição/devolução.');
            return;
        }
        setUpdating(true);
        try {
            const updateData = { status: newStatus, atualizadoPor: user.uid, dataUltimaAtualizacao: new Date() };
            let systemMessageContent = `Status atualizado para: ${getStatusText(newStatus)}`;

            if (newStatus === 'concluido') {
                updateData.conclusaoDescricao = conclusionDescription;
                updateData.conclusaoImagens = conclusionImages;
                updateData.concluidoEm = new Date();
                updateData.concluidoPor = user.uid;
                systemMessageContent = `✅ Chamado concluído por ${userProfile.nome}. Descrição: ${conclusionDescription || 'N/A'}`;
            } else if (newStatus === 'enviado_para_area') {
                if (!ticket.areaDeOrigem) { throw new Error('A área de origem para devolução não foi encontrada.'); }
                updateData.motivoRejeicao = conclusionDescription;
                updateData.rejeitadoEm = new Date();
                updateData.rejeitadoPor = user.uid;
                updateData.areaQueRejeitou = ticket.area;
                updateData.area = ticket.areaDeOrigem;
                systemMessageContent = `🔄 Chamado devolvido para a área ${ticket.areaDeOrigem.replace(/_/g, ' ')} por ${userProfile.nome}. Motivo: ${conclusionDescription}`;
            }

            await ticketService.updateTicket(ticketId, updateData);
            await messageService.sendMessage(ticketId, {
                userId: 'system', remetenteNome: 'Sistema', conteudo: systemMessageContent,
                criadoEm: new Date(), type: 'status_update'
            });
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

    const handleResubmitTicket = async () => {
        if (!additionalInfo.trim() || !ticket?.areaQueRejeitou) {
            alert('Por favor, preencha as informações solicitadas antes de reenviar.');
            return;
        }
        setIsResubmitting(true);
        try {
            const updateData = {
                status: 'aberto', // Reabre o chamado
                area: ticket.areaQueRejeitou, // Envia de volta para quem rejeitou
                areaDeOrigem: ticket.area, // Salva a área atual como a nova origem
                areaQueRejeitou: null, // Limpa o campo
                descricao: `${ticket.descricao}\n\n--- INFORMAÇÕES ADICIONAIS (${formatDate(new Date())}) ---\n${additionalInfo}`,
                atualizadoPor: user.uid,
                updatedAt: new Date()
            };
            await ticketService.updateTicket(ticketId, updateData);
            await messageService.sendMessage(ticketId, {
                userId: 'system', remetenteNome: 'Sistema',
                conteudo: `📬 Chamado reenviado com informações adicionais para a área: ${ticket.areaQueRejeitou.replace('_', ' ')}.`,
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-lg text-gray-700 font-semibold">Carregando chamado...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-lg shadow-lg border-red-500">
                    <CardHeader className="text-center">
                        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <CardTitle className="text-2xl text-red-700">Ocorreu um Erro</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-gray-600 mb-6">{error}</p>
                        <Button onClick={() => navigate('/dashboard')} variant="destructive">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar ao Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-lg shadow-lg border-yellow-500">
                    <CardHeader className="text-center">
                        <Lock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                        <CardTitle className="text-2xl text-yellow-700">Acesso Restrito</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-gray-600 mb-6">Este é um chamado confidencial e você não tem permissão para visualizá-lo.</p>
                        <Button onClick={() => navigate('/dashboard')} variant="outline">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar ao Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                 <Card className="w-full max-w-lg shadow-lg">
                    <CardHeader className="text-center">
                         <XCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                         <CardTitle className="text-2xl text-gray-700">Chamado não Encontrado</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                         <p className="text-gray-600 mb-6">O chamado que você está procurando não existe ou foi removido.</p>
                         <Button onClick={() => navigate('/dashboard')} variant="outline">
                             <ArrowLeft className="h-4 w-4 mr-2" />
                             Voltar ao Dashboard
                         </Button>
                    </CardContent>
                 </Card>
            </div>
        );
    }
    
    const isArchived = ticket.status === 'arquivado';
    const availableStatuses = getAvailableStatuses();

    return (
        <div className="min-h-screen bg-gray-50">
            <Header title={`Chamado #${ticket.numero || ticketId.slice(-8)}`} />
            <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
                <div className="mb-4 sm:mb-6">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="mb-3 sm:mb-4">
                        <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" /> Voltar ao Dashboard
                    </Button>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 break-words">{ticket.titulo}</h2>
                            <p className="text-gray-600 mt-1">Criado em {formatDate(ticket.criadoEm)} por {ticket.criadoPorNome}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            {ticket.isConfidential && (<Badge variant="outline" className="border-orange-400 bg-orange-50 text-orange-700"><Lock className="h-3 w-3 mr-1.5" />Confidencial</Badge>)}
                            <Badge className={getStatusColor(ticket.status)}>{getStatusText(ticket.status)}</Badge>
                        </div>
                    </div>
                </div>

                {parentTicketForLink && (
                    <Card className="mb-6 bg-amber-50 border-amber-200">
                        <CardHeader><CardTitle className="flex items-center text-base text-amber-900"><LinkIcon className="h-4 w-4 mr-2" />Este chamado é vinculado ao Chamado Pai</CardTitle></CardHeader>
                        <CardContent>
                            <Link to={`/chamado/${parentTicketForLink.id}`} className="text-blue-600 hover:underline">Ver Chamado Original: {parentTicketForLink.titulo}</Link>
                        </CardContent>
                    </Card>
                )}

                {isArchived && (
                    <Alert variant="default" className="mb-6 bg-gray-100 border-gray-300">
                        <Archive className="h-4 w-4" /><AlertDescription>Este chamado está arquivado e é somente para consulta.</AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                    <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                        <Card>
                            <CardHeader><CardTitle className="flex items-center text-lg"><AlertCircle className="h-5 w-5 mr-2" />Detalhes do Chamado</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div><Label className="text-sm font-medium text-gray-700">Título</Label><p>{ticket.titulo}</p></div>
                                <div><Label className="text-sm font-medium text-gray-700">Descrição</Label><p className="whitespace-pre-wrap">{ticket.descricao}</p></div>
                                {ticket.imagens && ticket.imagens.length > 0 && (
                                    <div>
                                        <Label className="text-sm font-medium text-gray-700 mb-2 block">📷 Imagens Anexadas</Label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {ticket.imagens.map((imagem, index) => (
                                                <a key={index} href={imagem.url} target="_blank" rel="noopener noreferrer" className="relative group">
                                                    <img src={imagem.url} alt={imagem.name} className="w-full h-32 object-cover rounded-lg border hover:opacity-75" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {ticket.isExtra && (
                                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                        <p className="font-semibold text-orange-800">🔥 ITEM EXTRA</p>
                                        {ticket.motivoExtra && <p className="text-sm text-orange-900">{ticket.motivoExtra}</p>}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><Label>Área</Label><p>{ticket.area}</p></div>
                                    <div><Label>Tipo</Label><p>{ticket.tipo}</p></div>
                                    <div><Label>Criado em</Label><p>{formatDate(ticket.createdAt || ticket.criadoEm)}</p></div>
                                    <div><Label>Criado por</Label><p>{ticket.criadoPorNome}</p></div>
                                </div>
                            </CardContent>
                        </Card>

                        {user && ticket.criadoPor === user.uid && ticket.status === 'enviado_para_area' && ticket.areaQueRejeitou && (
                            <Card className="bg-yellow-50 border-yellow-300">
                                <CardHeader>
                                    <CardTitle className="flex items-center text-yellow-900"><ClipboardEdit className="h-5 w-5 mr-2" />Ação Necessária: Corrigir e Reenviar</CardTitle>
                                    <CardDescription className="text-yellow-800">Este chamado foi devolvido pela área <strong>{ticket.areaQueRejeitou.replace('_', ' ')}</strong>. Adicione as informações solicitadas e reenvie.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {ticket.motivoRejeicao && (<div className="p-3 bg-white border rounded-md"><Label>Motivo da Devolução</Label><p className="text-sm">{ticket.motivoRejeicao}</p></div>)}
                                    <div>
                                        <Label htmlFor="additional-info" className="font-semibold">Novas Informações / Correções *</Label>
                                        <Textarea id="additional-info" placeholder="Forneça aqui os detalhes solicitados..." value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} rows={4} className="mt-2" disabled={isResubmitting}/>
                                    </div>
                                    <Button onClick={handleResubmitTicket} disabled={!additionalInfo.trim() || isResubmitting} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
                                        {isResubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                        Reenviar para {ticket.areaQueRejeitou.replace('_', ' ')}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                        
                        <Card>
                            <CardHeader><CardTitle className="flex items-center"><MessageSquare className="h-5 w-5 mr-2" />Conversas ({messages.length})</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2">
                                    {messages.length === 0 ? <p className="text-center text-gray-500 py-4">Nenhuma mensagem ainda.</p> :
                                        messages.map((message, index) => (
                                            <div key={index} className="flex space-x-3">
                                                <div className="flex-shrink-0"><div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center"><User className="h-4 w-4 text-white" /></div></div>
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2"><span className="font-medium text-sm">{message.remetenteNome}</span><span className="text-xs text-gray-500">{formatDate(message.criadoEm)}</span></div>
                                                    {message.conteudo && <p className="text-sm mt-1">{message.conteudo}</p>}
                                                    {message.imagens && message.imagens.length > 0 && (
                                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                                            {message.imagens.map((url, i) => (<a key={i} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`Anexo ${i+1}`} className="w-full h-20 object-cover rounded border"/></a>))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                                {!isArchived && (
                                    <div className="border-t pt-4 space-y-3">
                                        <Textarea ref={textareaRef} placeholder="Digite sua mensagem..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} rows={3} disabled={sendingMessage} />
                                        <ImageUpload onImagesUploaded={setChatImages} existingImages={chatImages} maxImages={3} buttonText="Anexar ao Chat" />
                                        <div className="flex justify-end">
                                            <Button onClick={handleSendMessage} disabled={sendingMessage || (!newMessage.trim() && chatImages.length === 0)}>
                                                {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Enviar
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-1 space-y-4 sm:space-y-6">
                        <Card>
                             <CardHeader><CardTitle className="flex items-center"><Folder className="h-5 w-5 mr-2" />Projeto(s)</CardTitle></CardHeader>
                             <CardContent>
                                {projects.length > 0 ? projects.map(p => (
                                    <div key={p.id} className="p-3 border rounded-lg mb-2">
                                        <p className="font-semibold">{p.nome}</p>
                                        <p className="text-sm text-gray-600">{p.cliente}</p>
                                        <Button size="sm" variant="link" className="p-0 h-auto mt-1" onClick={() => navigate(`/projeto/${p.id}`)}>Ver detalhes <ExternalLink className="h-3 w-3 ml-1"/></Button>
                                    </div>
                                )) : <p className="text-sm text-gray-500">Nenhum projeto vinculado.</p>}
                             </CardContent>
                        </Card>

                        {!isArchived && availableStatuses.length > 0 && (
                            <Card>
                                <CardHeader><CardTitle className="flex items-center"><Settings className="h-5 w-5 mr-2" />Ações</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <Label>Alterar Status</Label>
                                    <Select value={newStatus} onValueChange={setNewStatus}><SelectTrigger><SelectValue placeholder="Selecione uma ação" /></SelectTrigger>
                                        <SelectContent>{availableStatuses.map(s => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
                                    </Select>
                                    {(newStatus === 'concluido' || newStatus === 'enviado_para_area') && (
                                        <div className="space-y-3">
                                            <Label>{newStatus === 'concluido' ? 'Descrição da Conclusão' : 'Motivo da Devolução'}</Label>
                                            <Textarea placeholder={newStatus === 'concluido' ? "Descreva como foi resolvido..." : "Explique o motivo..."} value={conclusionDescription} onChange={(e) => setConclusionDescription(e.target.value)} rows={3} />
                                            {newStatus === 'concluido' && (<ImageUpload onImagesUploaded={setConclusionImages} existingImages={conclusionImages} maxImages={5} buttonText="Anexar Evidências"/>)}
                                        </div>
                                    )}
                                    <Button onClick={handleStatusUpdate} disabled={!newStatus || updating} className="w-full">
                                        {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}Confirmar Ação
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader><CardTitle className="flex items-center"><History className="h-5 w-5 mr-2" />Histórico do Chamado</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {historyEvents.length > 0 ? historyEvents.map((event, index) => (
                                        <div key={index} className="flex items-start space-x-3">
                                            <div className="flex flex-col items-center"><span className={`flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ${event.color}`}><event.Icon className="h-5 w-5" /></span>{index < historyEvents.length - 1 && (<div className="h-6 w-px bg-gray-200" />)}</div>
                                            <div className="flex-1 pt-1.5"><p className="text-sm">{event.description} <span className="font-semibold">{event.userName}</span></p><p className="text-xs text-gray-500">{formatDate(event.date)}</p></div>
                                        </div>
                                    )) : <p className="text-sm text-center text-gray-500">Nenhum evento registrado.</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketDetailPage;
