import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  BarChart3, Clock, Zap, CheckCircle, AlertTriangle, TrendingUp, Folder,
  Activity, Wifi, UserCheck, AlertOctagon, Target, Award, PlusCircle,
  ArrowRightCircle, TrendingDown, ClipboardList, Flag
} from 'lucide-react';

// HELPER PARA FORMATAR TEMPO RELATIVO
const formatTimeAgo = (date) => {
  if (!date) return '';
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 5) return "agora";
  let interval = seconds / 31536000;
  if (interval > 1) return `há ${Math.floor(interval)} anos`;
  interval = seconds / 2592000;
  if (interval > 1) return `há ${Math.floor(interval)} meses`;
  interval = seconds / 86400;
  if (interval > 1) return `há ${Math.floor(interval)} dias`;
  interval = seconds / 3600;
  if (interval > 1) return `há ${Math.floor(interval)} horas`;
  interval = seconds / 60;
  if (interval > 1) return `há ${Math.floor(interval)} minutos`;
  return `há ${Math.floor(seconds)} segundos`;
};

const TVPanel = () => {
  // --- Estados de Dados ---
  const [stats, setStats] = useState({ total: 0, abertos: 0, emAndamento: 0, concluidos: 0 });
  const [projectStats, setProjectStats] = useState({ ativos: 0, concluidos: 0 });
  const [activityFeed, setActivityFeed] = useState([]);
  
  // --- Estados para Novos Cards ---
  const [oldTicketsCount, setOldTicketsCount] = useState(0);
  const [untreatedByArea, setUntreatedByArea] = useState([]);
  const [topResolvers, setTopResolvers] = useState([]);
  const [slaStats, setSlaStats] = useState({ violated: 0, atRisk: 0 });
  const [ticketsByType, setTicketsByType] = useState([]);
  
  // --- Estados de UI ---
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const RESOLUTION_GOAL = 95; // Meta de 95% para a taxa de resolução

  useEffect(() => {
    // Atualiza o relógio a cada segundo
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);

    // --- SETUP DOS LISTENERS EM TEMPO REAL ---
    const ticketsQuery = query(collection(db, 'chamados'));
    const projectsQuery = query(collection(db, 'projetos'));
    
    let projectNames = {};

    // Listener para Projetos
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      projectNames = projectsData.reduce((acc, p) => ({ ...acc, [p.id]: p.nome }), {});
      
      setProjectStats({
        ativos: projectsData.filter(p => p.status !== 'concluido').length,
        concluidos: projectsData.filter(p => p.status === 'concluido').length,
      });
    });

    // Listener para Chamados (o cérebro do painel)
    const unsubscribeTickets = onSnapshot(ticketsQuery, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      
      // --- Cálculo de todas as métricas ---
      const openTickets = tickets.filter(t => t.status === 'aberto');
      
      // 1. Estatísticas Gerais
      setStats({
        total: tickets.length,
        abertos: openTickets.length,
        emAndamento: tickets.filter(t => ['em_analise', 'enviado_para_area', 'em_execucao', 'em_tratativa'].includes(t.status)).length,
        concluidos: tickets.filter(t => t.status === 'concluido').length,
      });

      // 2. Chamados Antigos (> 24h)
      const countOldTickets = openTickets.filter(t =>
        t.createdAt?.toDate && (agora - t.createdAt.toDate()) / (1000 * 60 * 60) > 24
      ).length;
      setOldTicketsCount(countOldTickets);

      // 3. Foco de Atenção (Áreas com chamados abertos)
      const untreatedCountByArea = openTickets.reduce((acc, ticket) => {
        const area = ticket.area || 'Não definida';
        acc[area] = (acc[area] || 0) + 1;
        return acc;
      }, {});
      setUntreatedByArea(Object.entries(untreatedCountByArea).map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count).slice(0, 3));

      // 4. Chamados por Tipo
      const countByType = tickets.reduce((acc, ticket) => {
        const type = ticket.tipo || 'Não classificado'; // Usando o campo 'tipo'
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      const totalTicketsForPercentage = tickets.length || 1;
      setTicketsByType(Object.entries(countByType).map(([type, count]) => ({ type, count, percentage: (count / totalTicketsForPercentage) * 100 })).sort((a, b) => b.count - a.count));
      
      // 5. Top Resolutores do Mês
      const concludedThisMonth = tickets.filter(t => t.status === 'concluido' && t.concluidoEm?.toDate && t.concluidoEm.toDate() >= inicioMes);
      const resolversCount = concludedThisMonth.reduce((acc, ticket) => {
        const resolver = ticket.responsavelNome || ticket.area || 'Não identificado';
        acc[resolver] = (acc[resolver] || 0) + 1;
        return acc;
      }, {});
      setTopResolvers(Object.entries(resolversCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 3));
      
      // 6. Cálculo de SLA
      const slaConfig = { baixa: 48, media: 24, alta: 12, urgente: 2 }; // SLA em horas
      let violatedCount = 0;
      let atRiskCount = 0;
      tickets.filter(t => t.status !== 'concluido' && t.status !== 'cancelado').forEach(ticket => {
        const slaHours = slaConfig[ticket.prioridade];
        if (slaHours && ticket.createdAt?.toDate) {
          const elapsedHours = (agora - ticket.createdAt.toDate()) / (1000 * 60 * 60);
          if (elapsedHours > slaHours) {
            violatedCount++;
          } else if (elapsedHours > slaHours * 0.75) { // Em risco se passou de 75% do tempo
            atRiskCount++;
          }
        }
      });
      setSlaStats({ violated: violatedCount, atRisk: atRiskCount });

      // 7. Feed de Atividades
      const sortedTickets = [...tickets].sort((a, b) => (b.dataUltimaAtualizacao?.toDate?.() || 0) - (a.dataUltimaAtualizacao?.toDate?.() || 0));
      setActivityFeed(sortedTickets.slice(0, 7).map(ticket => {
        const timestamp = ticket.dataUltimaAtualizacao?.toDate?.() || ticket.createdAt?.toDate?.();
        let message, icon;
        const projectName = projectNames[ticket.projetoId] ? `(${projectNames[ticket.projetoId]})` : '';
        if(ticket.status === 'aberto') { [message, icon] = [`Novo: "${ticket.titulo}" ${projectName}`, PlusCircle]; }
        else if(ticket.status === 'concluido') { [message, icon] = [`Concluído: "${ticket.titulo}" ${projectName}`, CheckCircle]; }
        else { [message, icon] = [`Atualizado: "${ticket.titulo}" ${projectName}`, ArrowRightCircle]; }
        return { id: ticket.id, message, icon, timeAgo: formatTimeAgo(timestamp), status: ticket.status };
      }));
      
      setLastUpdate(new Date());
      if (isLoading) setIsLoading(false);
    });

    // Função de limpeza para remover os listeners ao desmontar o componente
    return () => {
      clearInterval(clockInterval);
      unsubscribeTickets();
      unsubscribeProjects();
    };
  }, [isLoading]); // Dependência para garantir que o loading seja desligado corretamente

  const resolutionRate = stats.total > 0 ? (stats.concluidos / stats.total * 100) : 0;

  if (isLoading) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div><h2 className="text-2xl font-bold">Conectando ao Painel Operacional...</h2></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-6">
      
      <main className="flex flex-col">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">📊 Painel Operacional</h1>
            <p className="text-2xl text-gray-300">Métricas da Operação em Tempo Real</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-mono text-green-400 mb-1">{currentTime.toLocaleTimeString('pt-BR')}</div>
            <div className="text-xl text-gray-300 mb-2">{currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
            {lastUpdate && <div className="flex items-center justify-end text-green-400"><Wifi className="h-5 w-5 mr-2" /><span className="text-sm">Conectado. Último evento: {formatTimeAgo(lastUpdate)}</span></div>}
          </div>
        </div>

        {/* Linha 1: Métricas de Alerta */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-800/80 border border-red-600 rounded-xl p-4 shadow-lg flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2"><h3 className="text-white text-lg font-bold">SLA Violado</h3><TrendingDown className="h-6 w-6 text-white" /></div>
            <div className="text-5xl font-bold text-white">{slaStats.violated}</div>
            <p className="text-red-200">Chamados com prazo estourado</p>
          </div>
          <div className="bg-yellow-700/80 border border-yellow-500 rounded-xl p-4 shadow-lg flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2"><h3 className="text-white text-lg font-bold">SLA em Risco</h3><Flag className="h-6 w-6 text-white" /></div>
            <div className="text-5xl font-bold text-white">{slaStats.atRisk}</div>
            <p className="text-yellow-200">Prazo terminando (>75%)</p>
          </div>
          <div className="bg-orange-800/80 border border-orange-600 rounded-xl p-4 shadow-lg flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2"><h3 className="text-white text-lg font-bold">Chamados Antigos</h3><AlertOctagon className="h-6 w-6 text-white" /></div>
            <div className="text-5xl font-bold text-white">{oldTicketsCount}</div>
            <p className="text-orange-200">Abertos há mais de 24h</p>
          </div>
          <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 shadow-lg">
             <h3 className="text-white text-lg font-bold mb-2 flex items-center"><Target className="h-5 w-5 mr-2 text-yellow-400" />Foco de Atenção</h3>
             <div className="space-y-1">
                {untreatedByArea.length > 0 ? untreatedByArea.map(item => (
                  <div key={item.area} className="flex justify-between items-center bg-gray-700 p-1 rounded-md"><span className="font-medium text-sm text-yellow-300">{item.area}</span><span className="font-bold text-xl text-white bg-yellow-600 rounded-md px-2">{item.count}</span></div>
                )) : <p className="text-gray-400 text-sm text-center py-2">Nenhum chamado aberto!</p>}
             </div>
          </div>
        </div>
        
        {/* Linha 2: Métricas de Volume e Desempenho */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-800/80 border border-blue-600 rounded-xl p-4 shadow-lg"><div className="flex justify-between items-center mb-2"><h3 className="text-white text-lg font-bold">Total de Chamados</h3><BarChart3 className="h-6 w-6" /></div><div className="text-5xl font-bold">{stats.total}</div></div>
            <div className="bg-teal-800/80 border border-teal-600 rounded-xl p-4 shadow-lg"><div className="flex justify-between items-center mb-2"><h3 className="text-white text-lg font-bold">Em Andamento</h3><Zap className="h-6 w-6" /></div><div className="text-5xl font-bold">{stats.emAndamento}</div></div>
            <div className="bg-green-800/80 border border-green-600 rounded-xl p-4 shadow-lg"><div className="flex justify-between items-center mb-2"><h3 className="text-white text-lg font-bold">Concluídos</h3><CheckCircle className="h-6 w-6" /></div><div className="text-5xl font-bold">{stats.concluidos}</div></div>
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 shadow-lg">
                <h3 className="text-white text-lg font-bold mb-2">Taxa de Resolução</h3>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-4xl font-bold text-green-400">{resolutionRate.toFixed(1)}%</span>
                    <span className="text-sm text-gray-300">Meta: {RESOLUTION_GOAL}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4"><div className="bg-green-500 h-4 rounded-full progress-bar" style={{width: `${resolutionRate}%`}}></div></div>
            </div>
        </div>
        
        {/* Linha 3: Análise e Gamificação */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 shadow-lg">
                <h3 className="text-white text-lg font-bold mb-2 flex items-center"><ClipboardList className="h-5 w-5 mr-2 text-indigo-400" />Chamados por Tipo</h3>
                <div className="space-y-2">
                    {ticketsByType.map(item => (
                        <div key={item.type}>
                            <div className="flex justify-between text-sm mb-1"><span className="font-medium">{item.type}</span><span>{item.count}</span></div>
                            <div className="w-full bg-gray-700 rounded-full h-3"><div className="bg-indigo-500 h-3 rounded-full progress-bar" style={{width: `${item.percentage}%`}}></div></div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 shadow-lg">
                <h3 className="text-white text-lg font-bold mb-2 flex items-center"><Award className="h-5 w-5 mr-2 text-green-400" />Top Resolutores do Mês</h3>
                <div className="space-y-2">
                    {topResolvers.length > 0 ? topResolvers.map(item => (
                        <div key={item.name} className="flex items-center bg-gray-700 p-2 rounded-lg"><span className="font-medium text-green-300 flex-grow">{item.name}</span><span className="font-bold text-2xl text-white bg-green-600 rounded-md px-3">{item.count}</span></div>
                    )) : <p className="text-gray-400 text-center py-4">Nenhum chamado concluído este mês.</p>}
                </div>
            </div>
        </div>

      </main>

      {/* Coluna do Feed de Atividades */}
      <aside className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-lg flex flex-col h-full">
        <h3 className="text-white text-xl font-bold mb-4 flex items-center"><Activity className="h-6 w-6 mr-2 text-cyan-400" />Feed de Atividades</h3>
        <div className="space-y-3 overflow-y-auto flex-grow custom-scrollbar">
          {activityFeed.map((item, index) => {
            const iconColor = item.status === 'aberto' ? "text-blue-400" : item.status === 'concluido' ? "text-green-400" : "text-gray-400";
            return (
              <div key={`${item.id}-${index}`} className="flex items-start animate-fade-in"><item.icon className={`h-5 w-5 mt-1 mr-3 flex-shrink-0 ${iconColor}`} /><div className="min-w-0"><p className="text-white text-sm truncate">{item.message}</p><p className="text-xs text-gray-400">{item.timeAgo}</p></div></div>);
            })}
        </div>
      </aside>
    </div>
  );
};

export default TVPanel;
