// Arquivo: src/pages/TicketDetailPage.jsx - COM LOGS DE DIAGNÓSTICO
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService } from '@/services/ticketService';
import { projectService } from '@/services/projectService';
import { messageService } from '@/services/messageService';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Apenas para o botão de voltar

const TicketDetailPage = ({ navigate }) => { // Adicionado navigate como prop para simplicidade
  const { id: ticketId } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ticketId && user) {
      const loadData = async () => {
        console.log("--- PASSO 1: INICIANDO loadData ---");
        try {
          setLoading(true);
          
          console.log("--- PASSO 2: Chamando ticketService.getTicketById... ---");
          const data = await ticketService.getTicketById(ticketId);
          console.log("--- PASSO 3: DADOS DO TICKET RECEBIDOS:", data);
          
          if (data) {
            setTicket(data);
          } else {
            setError(`O chamado com ID ${ticketId} não foi encontrado.`);
          }
        } catch (err) {
          console.error("--- ERRO CAPTURADO NO PASSO 2 ou 3:", err);
          setError(err.message);
        } finally {
          setLoading(false);
          console.log("--- PASSO FINAL: loadData finalizado. ---");
        }
      };
      
      loadData();
    }
  }, [ticketId, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-4">
        <div>
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-700 font-semibold">Carregando dados do chamado...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-4">
        <div className="p-6 border border-red-200 bg-red-50 rounded-lg">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800">Ocorreu um Erro</h2>
          <p className="text-red-700 mt-2 bg-red-100 p-2 rounded">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-center p-4">
       <div className="p-6 border border-green-200 bg-green-50 rounded-lg">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-green-800">Carregamento Concluído!</h1>
          <h2 className="mt-4 text-lg">Título do Chamado: <span className="font-semibold">{ticket?.titulo}</span></h2>
       </div>
    </div>
  );
};

export default TicketDetailPage;
