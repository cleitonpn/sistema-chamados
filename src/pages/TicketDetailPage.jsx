// Arquivo: src/pages/TicketDetailPage.jsx - VERSÃO DE TESTE MÍNIMA
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ticketService } from '@/services/ticketService';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const TicketDetailPage = () => {
  const { id: ticketId } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Roda apenas quando o ticketId e o usuário estiverem prontos
    if (ticketId && user) {
      const loadMinimalData = async () => {
        console.log("--- INICIANDO TESTE DE CARREGAMENTO MÍNIMO ---");
        try {
          setLoading(true);
          // A única chamada ao banco de dados
          const data = await ticketService.getTicketById(ticketId);
          console.log("--- DADOS RECEBIDOS NO TESTE:", data);
          
          if (data) {
            setTicket(data);
          } else {
            setError(`O chamado com ID ${ticketId} não foi encontrado.`);
          }
        } catch (err) {
          console.error("--- ERRO CAPTURADO DURANTE O TESTE:", err);
          setError(err.message);
        } finally {
          setLoading(false);
          console.log("--- TESTE DE CARREGAMENTO FINALIZADO ---");
        }
      };
      
      loadMinimalData();
    }
  }, [ticketId, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-4">
        <div>
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-700 font-semibold">Testando carregamento do chamado...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-4">
        <div className="p-6 border border-red-200 bg-red-50 rounded-lg">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800">Erro no Teste</h2>
          <p className="text-red-700 mt-2 bg-red-100 p-2 rounded">{error}</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-6">Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-center p-4">
       <div className="p-6 border border-green-200 bg-green-50 rounded-lg">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-green-800">Teste de Carregamento bem-sucedido!</h1>
          <h2 className="mt-4 text-lg">Título do Chamado: <span className="font-semibold">{ticket?.titulo}</span></h2>
          <p className="mt-4 text-gray-700">Se você está vendo esta mensagem, a busca principal do chamado está funcionando. O erro está na complexidade da versão completa do componente.</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-6">Voltar</Button>
        </div>
    </div>
  );
};

export default TicketDetailPage;
