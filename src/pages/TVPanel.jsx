import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  BarChart3, Clock, Zap, CheckCircle, AlertTriangle, TrendingUp, Folder,
  Activity, Wifi, UserCheck, AlertOctagon, Target, Award, PlusCircle,
  ArrowRightCircle, TrendingDown, ClipboardList, Flag, GitPullRequest
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

// ✅ NOVO HELPER para pegar a data mais recente de um ticket de forma confiável
const getLatestTimestamp = (ticket) => {
    const dates = [
        ticket.dataUltimaAtualizacao?.toDate?.(),
        ticket.createdAt?.toDate?.()
    ].filter(Boolean); // Filtra valores nulos ou undefined
    return new Date(Math.max.apply(null, dates));
};


const TVPanel = () => {
  // --- Estados de Dados ---
  const [stats, setStats] = useState({ total: 0, abertos: 0, emAndamento: 0, concluidos: 0 });
  const [projectStats, setProjectStats] = useState({ ativos: 0, concluidos: 0 });
  const [activityFeed, setActivityFeed] = useState([]);
  
  // --- Estados para Novos Cards e Correções ---
  const [oldTicketsCount, setOldTicketsCount] = useState(0);
  const [untreatedByArea, setUntreatedByArea] = useState([]);
  const [topResolvers, setTopResolvers] = useState([]);
  const [slaStats, setSlaStats] = useState({ violated: 0, atRisk: 0 });
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0); // ✅ NOVO ESTADO
  
  // --- Estados de UI ---
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const RESOLUTION_GOAL = 95;

  useEffect(() => {
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);

    const ticketsQuery = query(collection(db, 'chamados'));
    const projectsQuery = query(collection(db, 'projetos'));
    
    let projectNames = {};

    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      projectNames = projectsData.reduce((acc, p) => ({ ...acc, [p.id]: p.nome }), {});
      setProjectStats({
        ativos: projectsData.filter(p => p.status !== 'concluido').length,
        concluidos: projectsData.filter(p => p.status === 'concluido').length,
      });
    });

    const unsubscribeTickets = onSnapshot(ticketsQuery, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      
      const openTickets = tickets.filter(t => t.status === 'aberto');
      
      // 1. Estatísticas Gerais
      setStats({
        total: tickets.length,
        abertos: openTickets.length,
        emAndamento: tickets.filter(t => ['em_analise', 'enviado_para_area', 'em_execucao', 'em_tratativa'].includes(t.status)).length,
        concluidos: tickets.filter(t => t.status === 'concluido').length,
      });

      // 2. Chamados Antigos (> 24h)
      setOldTicketsCount(openTickets.filter(t => t.createdAt?.toDate && (agora - t.createdAt.toDate()) / (1000 * 60 * 60) > 24).length);

      // 3. Foco de Atenção (Áreas com chamados abertos)
      const untreatedCountByArea = openTickets.reduce((acc, ticket) => {
        const area = ticket.area || 'Não definida';
        acc[area] = (acc[area] || 0) + 1;
        return acc;
      }, {});
      setUntreatedByArea(Object.entries(untreatedCountByArea).map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count).slice(0, 3));
      
      // ✅ 4. NOVO CARD: Aguardando Gerência
      setPendingApprovalCount(tickets.filter(t => t.status === 'aguardando_aprovacao').length);

      // ✅ 5. CORREÇÃO Top Resolutores do Mês
      const executedThisMonth = tickets.filter(t => {
          const lastUpdate = getLatestTimestamp(t);
          return t.status === 'executado_aguardando_validacao' && lastUpdate >= inicioMes;
      });
      const resolversCount = executedThisMonth.reduce((acc, ticket) => {
        const resolver = ticket.responsavelNome || ticket.area || 'Não identificado';
        acc[resolver] = (acc[resolver] || 0) + 1;
        return acc;
      }, {});
      setTopResolvers(Object.entries(resolversCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 3));
      
      // 6. Cálculo de SLA
      const slaConfig = { baixa: 48, media: 24, alta: 12, urgente: 2 };
      let violatedCount = 0;
      let atRiskCount = 0;
      tickets.filter(t => t.status !== 'concluido' && t.status !== 'cancelado').forEach(ticket => {
        const slaHours = slaConfig[ticket.prioridade];
        if (slaHours && ticket.createdAt?.toDate) {
          const elapsedHours = (agora - ticket.createdAt.toDate()) / (1000 * 60 * 60);
          if (elapsedHours > slaHours) violatedCount++;
          else if (elapsedHours > slaHours * 0.75) atRiskCount++;
        }
      });
      setSlaStats({ violated: violatedCount, atRisk: atRiskCount });

      // ✅ 7. CORREÇÃO Feed de Atividades
      const sortedTickets = [...tickets].sort((a, b) => getLatestTimestamp(b) - getLatestTimestamp(a));
      setActivityFeed(sortedTickets.slice(0, 10).map(ticket => { // Aumentado para 10
        const timestamp = getLatestTimestamp(ticket);
        let message, icon;
        const projectName = projectNames[ticket.projetoId] ? `(${projectNames[ticket.projetoId]})` : '';
        if(ticket.status === 'aberto') { [message, icon] = [`Novo: "${ticket.titulo}" ${projectName}`, PlusCircle]; }
        else if(ticket.status === 'concluido') { [message, icon] = [`Concluído: "${ticket.titulo}" ${projectName}`, CheckCircle]; }
        else if(ticket.status === 'executado_aguardando_validacao') { [message, icon] = [`Executado: "${ticket.titulo}" ${projectName}`, UserCheck]; }
        else { [message, icon] = [`Atualizado: "${ticket.titulo}" ${projectName}`, ArrowRightCircle]; }
        return { id: ticket.id, message, icon, timeAgo: formatTimeAgo(timestamp), status: ticket.status };
      }));
      
      setLastUpdate(new Date());
      if (isLoading) setIsLoading(false);
    });

    return () => {
      clearInterval(clockInterval);
      unsubscribeTickets();
      unsubscribeProjects();
    };
  }, [isLoading]);

  const resolutionRate = stats.total > 0 ? (stats.concluidos / stats.total * 100) : 0;

  if (isLoading) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div><h2 className="text-2xl font-bold">Conectando ao Painel Operacional...</h2></div></div>;
  }

  return (
    <div className="min-h-screen h-screen max-h-screen bg-gray-900 text-white p-4 flex flex-col gap-4">
      {/* Header */}
      <header className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-4xl font-bold text-white">📊 Painel Operacional</h1>
          <p className="text-xl text-gray-300">Métricas da Operação em Tempo Real</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono text-green-400">{currentTime.toLocaleTimeString('pt-BR')}</div>
          <div className="text-lg text-gray-300">{currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
        </div>
      </header>

      {/* ✅ NOVO LAYOUT HORIZONTAL COM FLEXBOX */}
      <div className="flex flex-grow gap-4 min-h-0">
        
        {/* Coluna Principal de Métricas */}
        <main className="flex flex-col flex-grow gap-4 w-3/4">
          
          {/* Linha 1: KPIs Principais */}
          <section className="grid grid-cols-5 gap-4">
            <div className="bg-blue-800/80 border border-blue-600 rounded-xl p-4 flex flex-col justify-center"><div className="flex justify-between items-center mb-1"><h3 className="text-lg font-bold">Total</h3><BarChart3 className="h-6 w-6" /></div><div className="text-5xl font-bold">{stats.total}</div></div>
            <div className="bg-orange-800/80 border border-orange-600 rounded-xl p-4 flex flex-col justify-center"><div className="flex justify-between items-center mb-1"><h3 className="text-lg font-bold">Abertos</h3><AlertOctagon className="h-6 w-6" /></div><div className="text-5xl font-bold">{stats.abertos}</div></div>
            <div className="bg-teal-800/80 border border-teal-600 rounded-xl p-4 flex flex-col justify-center"><div className="flex justify-between items-center mb-1"><h3 className="text-lg font-bold">Em Andamento</h3><Zap className="h-6 w-6" /></div><div className="text-5xl font-bold">{stats.emAndamento}</div></div>
            <div className="bg-purple-800/80 border border-purple-600 rounded-xl p-4 flex flex-col justify-center"><div className="flex justify-between items-center mb-1"><h3 className="text-lg font-bold">Aprov. Gerência</h3><GitPullRequest className="h-6 w-6" /></div><div className="text-5xl font-bold">{pendingApprovalCount}</div></div>
            <div className="bg-green-800/80 border border-green-600 rounded-xl p-4 flex flex-col justify-center"><div className="flex justify-between items-center mb-1"><h3 className="text-lg font-bold">Concluídos</h3><CheckCircle className="h-6 w-6" /></div><div className="text-5xl font-bold">{stats.concluidos}</div></div>
          </section>

          {/* Linha 2: Alertas e Análises */}
          <section className="grid grid-cols-4 gap-4 flex-grow">
              <div className="bg-red-800/80 border border-red-600 rounded-xl p-4 flex flex-col justify-center">
                  <h3 className="text-lg font-bold mb-2">Status do SLA</h3>
                  <div className="flex items-center mb-2"><TrendingDown className="h-6 w-6 mr-3 text-red-400" /><span className="text-4xl font-bold">{slaStats.violated}</span><span className="ml-2">Violado(s)</span></div>
                  <div className="flex items-center"><Flag className="h-6 w-6 mr-3 text-yellow-400" /><span className="text-4xl font-bold">{slaStats.atRisk}</span><span className="ml-2">Em Risco</span></div>
              </div>
              <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 flex flex-col">
                  <h3 className="text-lg font-bold mb-2 flex items-center"><Target className="h-5 w-5 mr-2 text-yellow-400" />Foco de Atenção</h3>
                  <div className="space-y-2 flex-grow flex flex-col justify-center">
                      {untreatedByArea.length > 0 ? untreatedByArea.map(item => (
                        <div key={item.area} className="flex justify-between items-center bg-gray-700 p-2 rounded-lg"><span className="font-medium text-yellow-300">{item.area}</span><span className="font-bold text-2xl text-white bg-yellow-600 rounded-md px-2">{item.count}</span></div>
                      )) : <p className="text-gray-400 text-center py-4">Nenhum chamado aberto!</p>}
                  </div>
              </div>
              <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 flex flex-col">
                  <h3 className="text-lg font-bold mb-2">Taxa de Resolução</h3>
                  <div className="flex items-center justify-between mb-2"><span className="text-5xl font-bold text-green-400">{resolutionRate.toFixed(1)}%</span><span className="text-sm text-gray-300">Meta: {RESOLUTION_GOAL}%</span></div>
                  <div className="w-full bg-gray-700 rounded-full h-4"><div className="bg-green-500 h-4 rounded-full progress-bar" style={{width: `${resolutionRate}%`}}></div></div>
              </div>
              <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 flex flex-col">
                  <h3 className="text-lg font-bold mb-2 flex items-center"><Award className="h-5 w-5 mr-2 text-green-400" />Top Executores do Mês</h3>
                  <div className="space-y-2 flex-grow flex flex-col justify-center">
                      {topResolvers.length > 0 ? topResolvers.map(item => (
                          <div key={item.name} className="flex items-center bg-gray-700 p-2 rounded-lg"><span className="font-medium text-green-300 flex-grow">{item.name}</span><span className="font-bold text-2xl text-white bg-green-600 rounded-md px-3">{item.count}</span></div>
                      )) : <p className="text-gray-400 text-center py-4">Nenhuma execução este mês.</p>}
                  </div>
              </div>
          </section>

        </main>

        {/* Coluna do Feed de Atividades */}
        <aside className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-lg flex flex-col w-1/4">
          <h3 className="text-xl font-bold mb-4 flex items-center flex-shrink-0"><Activity className="h-6 w-6 mr-2 text-cyan-400" />Feed de Atividades</h3>
          <div className="space-y-3 overflow-y-auto flex-grow custom-scrollbar pr-2">
            {activityFeed.map((item, index) => {
              const iconColor = item.status === 'aberto' ? "text-blue-400" : item.status === 'concluido' ? "text-green-400" : item.status === 'executado_aguardando_validacao' ? "text-yellow-400" : "text-gray-400";
              return (
                <div key={`${item.id}-${index}`} className="flex items-start animate-fade-in"><item.icon className={`h-5 w-5 mt-1 mr-3 flex-shrink-0 ${iconColor}`} /><div className="min-w-0"><p className="text-white text-sm truncate" title={item.message}>{item.message}</p><p className="text-xs text-gray-400">{item.timeAgo}</p></div></div>);
              })}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TVPanel;
