import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import NewTicketForm from '../components/forms/NewTicketForm';

const NewTicketPage = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [linkedTicketData, setLinkedTicketData] = useState(null);

  // ✅ NOVO: Verificar se há chamado vinculado nos parâmetros da URL
  useEffect(() => {
    const linkedParam = searchParams.get('linked');
    
    if (linkedParam) {
      try {
        const linkedData = JSON.parse(decodeURIComponent(linkedParam));
        setLinkedTicketData(linkedData);
        console.log('Chamado vinculado detectado:', linkedData);
      } catch (error) {
        console.error('Erro ao processar parâmetro de chamado vinculado:', error);
      }
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="px-4 py-6 md:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {linkedTicketData ? 'Novo Chamado Vinculado' : 'Novo Chamado'}
            </h1>
            <p className="text-gray-600 mt-1">
              {linkedTicketData 
                ? `Criando chamado de pagamento vinculado ao chamado #${linkedTicketData.numero}`
                : 'Preencha as informações abaixo para criar um novo chamado'
              }
            </p>
          </div>
          
          {/* ✅ NOVO: Passar linkedTicketData como prop */}
          <NewTicketForm linkedTicket={linkedTicketData} />
        </div>
      </main>
    </div>
  );
};

export default NewTicketPage;

