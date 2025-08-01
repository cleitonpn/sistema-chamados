import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { projectService } from '../../services/projectService';
import { ticketService, TICKET_TYPES, PRIORITIES } from '../../services/ticketService';
import { userService, AREAS } from '../../services/userService';
import { imageService } from '../../services/imageService';
import { TICKET_CATEGORIES, getCategoriesByArea } from '../../constants/ticketCategories';
import notificationService from '../../services/notificationService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Upload, 
  X, 
  AlertCircle, 
  Bot, 
  Sparkles, 
  RefreshCw, 
  TrendingUp, 
  Lock,
  Link, // ✅ NOVO: Ícone para vinculação
  ExternalLink // ✅ NOVO: Ícone para link externo
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, getDoc, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

// ✅ NOVO: Props para receber chamado vinculado
const NewTicketForm = ({ projectId, onClose, onSuccess, linkedTicket = null }) => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // ✅ NOVO: Estado para chamado vinculado
  const [linkedTicketData, setLinkedTicketData] = useState(null);
  
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    area: '',
    tipo: '',
    prioridade: 'media',
    isExtra: false,
    motivoExtra: '',
    isConfidential: false,
    observacoes: '',
    // ✅ NOVO: Campo para chamado vinculado
    chamadoVinculado: null
  });

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ✅ NOVO: Verificar se há chamado vinculado na URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const linkedParam = urlParams.get('linked');
    
    if (linkedParam) {
      try {
        const linkedData = JSON.parse(decodeURIComponent(linkedParam));
        setLinkedTicketData(linkedData);
        
        // Pré-preencher formulário para pagamento de frete
        setFormData(prev => ({
          ...prev,
          area: 'financeiro',
          tipo: 'pagamento_frete',
          titulo: `Pagamento de Frete - ${linkedData.titulo}`,
          descricao: `Solicitação de pagamento de frete referente ao chamado vinculado.\n\nDetalhes do chamado original:\n- Título: ${linkedData.titulo}\n- Descrição: ${linkedData.descricao}\n- Projeto: ${linkedData.projetoNome}`,
          prioridade: 'alta',
          chamadoVinculado: linkedData
        }));
        
        // Selecionar projeto automaticamente se disponível
        if (linkedData.projetoId) {
          setSelectedProject({ id: linkedData.projetoId, nome: linkedData.projetoNome });
        }
        
      } catch (error) {
        console.error('Erro ao processar chamado vinculado:', error);
      }
    } else if (linkedTicket) {
      // Usar prop linkedTicket se fornecida
      setLinkedTicketData(linkedTicket);
      setFormData(prev => ({
        ...prev,
        chamadoVinculado: linkedTicket
      }));
    }
  }, [location.search, linkedTicket]);

  // Carregar projetos
  useEffect(() => {
    const loadProjects = async () => {
      try {
        let projectsData = [];
        
        if (userProfile.funcao === 'administrador') {
          projectsData = await projectService.getAllProjects();
        } else if (userProfile.funcao === 'consultor') {
          projectsData = await projectService.getProjectsByConsultor(user.uid);
        } else if (userProfile.funcao === 'produtor') {
          projectsData = await projectService.getProjectsByProdutor(user.uid);
        } else if (userProfile.funcao === 'operador') {
          projectsData = await projectService.getAllProjects();
        }
        
        setProjects(projectsData);
        
        // Se há um projeto específico (prop), selecionar automaticamente
        if (projectId && projectsData.length > 0) {
          const project = projectsData.find(p => p.id === projectId);
          if (project) {
            setSelectedProject(project);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar projetos:', error);
        setError('Erro ao carregar projetos');
      }
    };

    if (user && userProfile) {
      loadProjects();
    }
  }, [user, userProfile, projectId]);

  // Atualizar categorias quando área muda
  useEffect(() => {
    if (formData.area) {
      const categories = getCategoriesByArea(formData.area);
      setAvailableCategories(categories);
      
      // Limpar tipo se não for válido para a nova área
      if (formData.tipo && !categories.some(cat => cat.value === formData.tipo)) {
        setFormData(prev => ({ ...prev, tipo: '' }));
      }
    } else {
      setAvailableCategories([]);
    }
  }, [formData.area]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Limpar mensagens ao editar
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleImageUpload = (uploadedImages) => {
    setImages(uploadedImages);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações
    if (!formData.titulo.trim()) {
      setError('Título é obrigatório');
      return;
    }
    
    if (!formData.descricao.trim()) {
      setError('Descrição é obrigatória');
      return;
    }
    
    if (!formData.area) {
      setError('Área é obrigatória');
      return;
    }
    
    if (!formData.tipo) {
      setError('Tipo é obrigatório');
      return;
    }
    
    if (!selectedProject) {
      setError('Projeto é obrigatório');
      return;
    }

    if (formData.isExtra && !formData.motivoExtra.trim()) {
      setError('Motivo do item extra é obrigatório');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Preparar dados do chamado
      const ticketData = {
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim(),
        area: formData.area,
        tipo: formData.tipo,
        prioridade: formData.prioridade,
        projetoId: selectedProject.id,
        projetoNome: selectedProject.nome,
        criadoPor: user.uid,
        criadoPorNome: userProfile.nome || user.email,
        criadoPorFuncao: userProfile.funcao,
        criadoPorArea: userProfile.area,
        imagens: images,
        itemExtra: formData.isExtra,
        motivoItemExtra: formData.isExtra ? formData.motivoExtra.trim() : null,
        confidencial: formData.isConfidential,
        observacoes: formData.observacoes.trim() || null,
        // ✅ NOVO: Incluir dados do chamado vinculado
        chamadoVinculado: formData.chamadoVinculado
      };

      console.log('Criando chamado:', ticketData);
      
      const ticketId = await ticketService.createTicket(ticketData);
      
      // ✅ NOVO: Notificação específica para chamados vinculados
      if (formData.chamadoVinculado) {
        try {
          await notificationService.notifyLinkedTicketCreated(ticketId, ticketData, formData.chamadoVinculado);
        } catch (notificationError) {
          console.error('Erro ao enviar notificação de chamado vinculado:', notificationError);
        }
      } else {
        // Notificação normal
        try {
          await notificationService.notifyTicketCreated(ticketId, ticketData);
        } catch (notificationError) {
          console.error('Erro ao enviar notificação:', notificationError);
        }
      }

      setSuccess('Chamado criado com sucesso!');
      
      // Callback de sucesso
      if (onSuccess) {
        onSuccess(ticketId);
      }
      
      // Redirecionar para o chamado criado após um breve delay
      setTimeout(() => {
        navigate(`/chamado/${ticketId}`);
      }, 1500);

    } catch (error) {
      console.error('Erro ao criar chamado:', error);
      setError('Erro ao criar chamado: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>Novo Chamado</span>
          {/* ✅ NOVO: Indicador de chamado vinculado */}
          {linkedTicketData && (
            <Badge variant="secondary" className="ml-2">
              <Link className="h-3 w-3 mr-1" />
              Vinculado
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Preencha as informações abaixo para criar um novo chamado
          {linkedTicketData && (
            <span className="text-blue-600 font-medium">
              {' '}vinculado ao chamado #{linkedTicketData.numero}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* ✅ NOVO: Card de Chamado Vinculado */}
        {linkedTicketData && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center text-blue-800">
                <Link className="h-4 w-4 mr-2" />
                Chamado Vinculado
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-blue-900">Chamado:</span>
                  <span className="text-blue-700">#{linkedTicketData.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-blue-900">Título:</span>
                  <span className="text-blue-700 text-right max-w-xs truncate">
                    {linkedTicketData.titulo}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-blue-900">Criado por:</span>
                  <span className="text-blue-700">{linkedTicketData.criadorNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-blue-900">Área:</span>
                  <span className="text-blue-700 capitalize">
                    {linkedTicketData.area?.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-blue-900">Projeto:</span>
                  <span className="text-blue-700">{linkedTicketData.projetoNome}</span>
                </div>
                
                {/* Link para o chamado original */}
                <div className="pt-2 border-t border-blue-200">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/chamado/${linkedTicketData.id}`, '_blank')}
                    className="text-blue-600 border-blue-300 hover:bg-blue-100"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ver Chamado Original
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mensagens de erro e sucesso */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Seleção de Projeto */}
          <div className="space-y-2">
            <Label htmlFor="project">Projeto *</Label>
            <Select
              value={selectedProject?.id || ''}
              onValueChange={(value) => {
                const project = projects.find(p => p.id === value);
                setSelectedProject(project);
              }}
              disabled={!!linkedTicketData} // Desabilitar se vinculado
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => handleInputChange('titulo', e.target.value)}
              placeholder="Digite o título do chamado"
              maxLength={100}
            />
          </div>

          {/* Área e Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="area">Área *</Label>
              <Select
                value={formData.area}
                onValueChange={(value) => handleInputChange('area', value)}
                disabled={!!linkedTicketData} // Desabilitar se vinculado
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma área" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AREAS).map((area) => (
                    <SelectItem key={area} value={area}>
                      {area.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => handleInputChange('tipo', value)}
                disabled={!formData.area || !!linkedTicketData} // Desabilitar se vinculado
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tipo" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleInputChange('descricao', e.target.value)}
              placeholder="Descreva detalhadamente o chamado"
              rows={4}
              maxLength={1000}
            />
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label htmlFor="prioridade">Prioridade</Label>
            <Select
              value={formData.prioridade}
              onValueChange={(value) => handleInputChange('prioridade', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Item Extra */}
          <div className="flex items-center space-x-2">
            <Switch
              id="isExtra"
              checked={formData.isExtra}
              onCheckedChange={(checked) => handleInputChange('isExtra', checked)}
            />
            <Label htmlFor="isExtra">Item Extra</Label>
          </div>

          {formData.isExtra && (
            <div className="space-y-2">
              <Label htmlFor="motivoExtra">Motivo do Item Extra *</Label>
              <Textarea
                id="motivoExtra"
                value={formData.motivoExtra}
                onChange={(e) => handleInputChange('motivoExtra', e.target.value)}
                placeholder="Explique o motivo do item extra"
                rows={2}
              />
            </div>
          )}

          {/* Confidencial */}
          <div className="flex items-center space-x-2">
            <Switch
              id="isConfidential"
              checked={formData.isConfidential}
              onCheckedChange={(checked) => handleInputChange('isConfidential', checked)}
            />
            <Label htmlFor="isConfidential" className="flex items-center">
              <Lock className="h-4 w-4 mr-1" />
              Chamado Confidencial
            </Label>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => handleInputChange('observacoes', e.target.value)}
              placeholder="Observações adicionais (opcional)"
              rows={2}
            />
          </div>

          {/* Upload de Imagens */}
          <div className="space-y-2">
            <Label>Imagens</Label>
            <ImageUpload onImagesChange={handleImageUpload} />
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-6">
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            )}
            
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  {linkedTicketData && <Link className="h-4 w-4 mr-2" />}
                  Criar Chamado
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default NewTicketForm;

