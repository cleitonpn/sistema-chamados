import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService } from '@/services/ticketService';
import { projectService } from '@/services/projectService';
import { userService } from '@/services/userService';
import { messageService } from '@/services/messageService';
import notificationService from '@/services/notificationService';
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
  Paperclip,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  Settings,
  MapPin
} from 'lucide-react';

// ===================================================================================
// COMPONENTES INTERNOS PARA AUTOSSUFICIÊNCIA DO ARQUIVO
// ===================================================================================

const Header = ({ title }) => (
    <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </div>
    </header>
);

const ImageUpload = ({ onImagesUploaded, existingImages = [], maxImages = 5, buttonText = "Anexar Imagens" }) => {
    const fileInputRef = useRef(null);
    const handleFileChange = (event) => {
        if (!event.target.files) return;
        const files = Array.from(event.target.files);
        onImagesUploaded([...existingImages, ...files].slice(0, maxImages));
    };
    const handleRemoveImage = (index) => onImagesUploaded(existingImages.filter((_, i) => i !== index));
    return (
        <div>
            <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <ImageIcon className="h-4 w-4 mr-2" />
                {buttonText} ({existingImages.length}/{maxImages})
            </Button>
            {existingImages.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                    {existingImages.map((image, index) => (
                        <div key={index} className="relative">
                            <img src={URL.createObjectURL(image)} alt={`preview ${index + 1}`} className="w-full h-20 object-cover rounded" />
                            <button onClick={() => handleRemoveImage(index)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">×</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// ===================================================================================
// COMPONENTE PRINCIPAL DA PÁGINA
// ===================================================================================

const TicketDetailPage = () => {
    const { ticketId } = useParams();
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();

    // Estados
    const [ticket, setTicket] = useState(null);
    const [projects, setProjects] = useState([]);
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

            const [usersData, ticketData] = await Promise.all([
                userService.getAllUsers(),
                ticketService.getTicketById(ticketId)
            ]);
            
            setUsers(usersData || []);

            if (!ticketData) throw new Error('Chamado não encontrado');
            setTicket(ticketData);

            const projectsToLoad = [];
            if (ticketData.projetoId) {
                const projectData = await projectService.getProjectById(ticketData.projetoId);
                if (projectData) projectsToLoad.push(projectData);
            } else if (ticketData.projetos?.length > 0) {
                const results = await Promise.allSettled(ticketData.projetos.map(id => projectService.getProjectById(id)));
                results.forEach(result => {
                    if (result.status === 'fulfilled' && result.value) projectsToLoad.push(result.value);
                });
            }
            setProjects(projectsToLoad);

            const otherPromises = [];
            if (ticketData.chamadoPaiId) {
                otherPromises.push(ticketService.getTicketById(ticketData.chamadoPaiId).then(setParentTicketForLink));
            }
            otherPromises.push(messageService.getMessagesByTicket(ticketId).then(m => setMessages(m || [])));
            if (user?.uid) {
                otherPromises.push(notificationService.markTicketNotificationsAsRead(user.uid, ticketId));
            }
            await Promise.all(otherPromises);

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

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && chatImages.length === 0) || !user || !ticket) return;
        setSendingMessage(true);
        try {
            const messageData = {
                userId: user.uid,
                remetenteNome: userProfile?.nome || user.email,
                conteudo: newMessage.trim(),
                imagens: [], // Deverá ser preenchido com as URLs após o upload
                criadoEm: new Date(),
                type: 'user_message'
            };

            // Se você tiver uma função de upload que retorna URLs
            // const imageUrls = await uploadService.uploadImages(chatImages);
            // messageData.imagens = imageUrls;

            await messageService.sendMessage(ticketId, messageData);
            await notificationService.notifyNewMessage(ticketId, ticket, messageData, user.uid);
            
            // Recarrega apenas as mensagens para uma atualização mais rápida
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
            let updateData = { status: newStatus, atualizadoPor: user.uid, dataUltimaAtualizacao: new Date() };
            let systemMessageContent = `Status atualizado para: ${getStatusText(newStatus)}`;

            if (newStatus === 'concluido') {
                updateData.conclusaoDescricao = conclusionDescription;
                updateData.conclusaoImagens = []; // Adicionar URLs das imagens de conclusão aqui
                updateData.concluidoEm = new Date();
                updateData.concluidoPor = user.uid;
                systemMessageContent = `✅ Chamado concluído por ${userProfile.nome}.`;
            } else if (newStatus === 'rejeitado') {
                updateData.motivoRejeicao = conclusionDescription;
                updateData.rejeitadoEm = new Date();
                updateData.rejeitadoPor = user.uid;
                systemMessageContent = `❌ Chamado reprovado pelo gerente. Motivo: ${conclusionDescription}`;
            } else if (newStatus === 'enviado_para_area') {
                if (!ticket.areaDeOrigem) { throw new Error('A área de origem para devolução não foi encontrada.'); }
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
            await ticketService.updateTicket(ticketId, { status: 'arquivado', arquivadoEm: new Date(), arquivadoPor: user.uid, dataUltimaAtualizacao: new Date() });
            await loadAllData();
        } catch (error) { setError('Ocorreu um erro ao arquivar o chamado.'); } finally { setUpdating(false); }
    };

    const handleUnarchiveTicket = async () => {
        if (!window.confirm('Deseja desarquivar este chamado?')) return;
        setUpdating(true);
        try {
            await ticketService.updateTicket(ticketId, { status: 'concluido', arquivadoEm: null, arquivadoPor: null, dataUltimaAtualizacao: new Date() });
            await loadAllData();
        } catch (error) { setError('Ocorreu um erro ao desarquivar o chamado.'); } finally { setUpdating(false); }
    };

    const handleEscalation = async () => {
        if (!escalationArea || !escalationReason.trim()) return;
        setIsEscalating(true);
        try {
            await ticketService.escalateTicketToArea(ticketId, escalationArea, {
                status: 'escalado_para_outra_area', area: escalationArea,
                motivoEscalonamento: escalationReason, atualizadoPor: user?.uid, dataUltimaAtualizacao: new Date()
            });
            await messageService.sendMessage(ticketId, { userId: 'system', remetenteNome: 'Sistema', conteudo: `🔄 Chamado escalado para ${escalationArea.replace('_', ' ').toUpperCase()}. Motivo: ${escalationReason}`, criadoEm: new Date(), type: 'escalation' });
            await loadAllData();
            setEscalationArea(''); setEscalationReason('');
        } catch (error) { setError('Erro ao escalar chamado: ' + error.message); } finally { setIsEscalating(false); }
    };
    
    const handleManagementEscalation = async () => {
        if (!managementArea || !managementReason.trim()) return;
        const targetArea = managementArea.replace('gerente_', '');
        const targetManager = users.find(u => u.funcao === 'gerente' && u.area === targetArea);
        if (!targetManager) { alert(`Erro: Nenhum gerente encontrado para a área "${targetArea}".`); return; }
        setIsEscalatingToManagement(true);
        try {
            await ticketService.updateTicket(ticketId, {
                status: 'aguardando_aprovacao', areaDeOrigem: ticket.area, gerenteResponsavelId: targetManager.uid,
                motivoEscalonamentoGerencial: managementReason, escaladoPor: user.uid, escaladoEm: new Date(), dataUltimaAtualizacao: new Date()
            });
            await messageService.sendMessage(ticketId, { userId: 'system', remetenteNome: 'Sistema', conteudo: `👨‍💼 Chamado escalado para Gerência. Motivo: ${managementReason}`, criadoEm: new Date(), type: 'management_escalation' });
            await loadAllData();
            setManagementArea(''); setManagementReason('');
        } catch (error) { setError('Erro ao escalar para gerência: ' + error.message); } finally { setIsEscalatingToManagement(false); }
    };

    const handleConsultorEscalation = async () => {
        const mainProject = projects.length > 0 ? projects[0] : null;
        if (!consultorReason.trim() || !mainProject?.consultorId) return;
        setIsEscalatingToConsultor(true);
        try {
            await ticketService.updateTicket(ticketId, {
                status: 'escalado_para_consultor', areaDeOrigem: ticket.area, consultorResponsavelId: mainProject.consultorId,
                motivoEscalonamentoConsultor: consultorReason, escaladoPor: user.uid, escaladoEm: new Date(), dataUltimaAtualizacao: new Date()
            });
            await messageService.sendMessage(ticketId, { userId: 'system', remetenteNome: 'Sistema', conteudo: `👨‍🎯 Chamado escalado para CONSULTOR. Motivo: ${consultorReason}`, criadoEm: new Date(), type: 'consultor_escalation' });
            await loadAllData();
            setConsultorReason('');
        } catch (error) { setError('Erro ao escalar para consultor: ' + error.message); } finally { setIsEscalatingToConsultor(false); }
    };

    const handleTransferToProducer = async () => {
        const mainProject = projects.length > 0 ? projects[0] : null;
        if (!mainProject?.produtorId) return;
        setUpdating(true);
        try {
            await ticketService.updateTicket(ticketId, {
                status: 'transferido_para_produtor', produtorResponsavelId: mainProject.produtorId,
                transferidoPor: user.uid, transferidoEm: new Date(), dataUltimaAtualizacao: new Date()
            });
            await messageService.sendMessage(ticketId, { userId: 'system', remetenteNome: 'Sistema', conteudo: `🏭 Chamado transferido para PRODUTOR DO PROJETO.`, criadoEm: new Date(), type: 'producer_transfer' });
            await loadAllData();
        } catch (error) { setError('Erro ao transferir para produtor: ' + error.message); } finally { setUpdating(false); }
    };

    const handleResubmitTicket = async () => {
        if (!additionalInfo.trim() || !ticket?.areaQueRejeitou) return;
        setIsResubmitting(true);
        try {
            await ticketService.updateTicket(ticketId, {
                status: 'aberto', area: ticket.areaQueRejeitou, areaDeOrigem: ticket.area, areaQueRejeitou: null,
                descricao: `${ticket.descricao}\n\n--- INFORMAÇÕES ADICIONAIS (${formatDate(new Date())}) ---\n${additionalInfo}`,
                atualizadoPor: user.uid, dataUltimaAtualizacao: new Date()
            });
            await messageService.sendMessage(ticketId, { userId: 'system', remetenteNome: 'Sistema', conteudo: `📬 Chamado reenviado com informações para: ${ticket.areaQueRejeitou.replace(/_/g, ' ')}.`, criadoEm: new Date(), type: 'status_update' });
            await loadAllData();
            setAdditionalInfo('');
        } catch (error) { setError('Ocorreu um erro ao reenviar o chamado: ' + error.message); } finally { setIsResubmitting(false); }
    };
    
    const formatDate = (date) => {
        if (!date) return 'Data não disponível';
        const dateObj = date.toDate ? date.toDate() : new Date(date);
        if (isNaN(dateObj)) return 'Data inválida';
        return dateObj.toLocaleString('pt-BR');
    };

    const getStatusText = (status) => {
        const statusMap = {
          'aberto': 'Aberto', 'em_tratativa': 'Em Tratativa', 'executado_aguardando_validacao': 'Executado - Aguardando Validação',
          'concluido': 'Concluído', 'enviado_para_area': 'Enviado para Área', 'aguardando_consultor': 'Aguardando Consultor',
          'aguardando_aprovacao_gerencial': 'Aguardando Aprovação Gerencial', 'cancelado': 'Cancelado', 'arquivado': 'Arquivado'
        };
        return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };
    
    const getStatusColor = (status) => {
        const colorMap = {
          'aberto': 'bg-blue-100 text-blue-800', 'em_tratativa': 'bg-yellow-100 text-yellow-800', 'executado_aguardando_validacao': 'bg-purple-100 text-purple-800',
          'concluido': 'bg-green-100 text-green-800', 'enviado_para_area': 'bg-orange-100 text-orange-800', 'aguardando_consultor': 'bg-cyan-100 text-cyan-800',
          'aguardando_aprovacao_gerencial': 'bg-indigo-100 text-indigo-800', 'cancelado': 'bg-red-100 text-red-800', 'arquivado': 'bg-gray-100 text-gray-800'
        };
        return colorMap[status] || 'bg-gray-100 text-gray-800';
    };

    if (loading) return (<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" /><p className="text-lg font-semibold">Carregando chamado...</p></div></div>);
    if (error) return (<div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-lg border-red-500"><CardHeader className="text-center"><AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" /><CardTitle className="text-2xl text-red-700">Ocorreu um Erro</CardTitle></CardHeader><CardContent className="text-center"><p className="mb-6">{error}</p><Button onClick={() => navigate('/dashboard')} variant="destructive"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></CardContent></Card></div>);
    if (accessDenied) return (<div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-lg border-yellow-500"><CardHeader className="text-center"><Lock className="h-16 w-16 text-yellow-500 mx-auto mb-4" /><CardTitle className="text-2xl text-yellow-700">Acesso Restrito</CardTitle></CardHeader><CardContent className="text-center"><p className="mb-6">Este chamado é confidencial e você não tem permissão para visualizá-lo.</p><Button onClick={() => navigate('/dashboard')} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></CardContent></Card></div>);
    if (!ticket) return (<div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-lg"><CardHeader className="text-center"><XCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" /><CardTitle className="text-2xl">Chamado Não Encontrado</CardTitle></CardHeader><CardContent className="text-center"><p className="mb-6">O chamado que você procura não existe.</p><Button onClick={() => navigate('/dashboard')} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></CardContent></Card></div>);

    const isArchived = ticket.status === 'arquivado';
    const availableStatuses = getAvailableStatuses();

    return (
        <div className="min-h-screen bg-gray-50">
            <Header title={`Chamado #${ticket.id?.substring(0, 8) || 'N/A'}`} />
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
                                <CardHeader><CardTitle className="flex items-center">{projects.length > 1 ? <FolderOpen className="h-5 w-5 mr-2"/> : <Folder className="h-5 w-5 mr-2"/>}{projects.length > 1 ? `Projetos (${projects.length})` : 'Projeto'}</CardTitle></CardHeader>
                                <CardContent className="space-y-3">{projects.map((p) => (<div key={p.id} className="p-3 border rounded-lg"><p className="font-semibold">{p.nome}</p><p className="text-sm text-gray-600">{p.cliente}</p>{p.local && <p className="text-sm text-gray-500">{p.local}</p>}<Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate(`/projeto/${p.id}`)}><ExternalLink className="h-4 w-4 mr-2"/>Ver Detalhes</Button></div>))}</CardContent>
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
