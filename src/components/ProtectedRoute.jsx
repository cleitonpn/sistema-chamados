// Arquivo: src/components/ProtectedRoute.jsx - VERSÃO CORRIGIDA E BLINDADA
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Ajuste o caminho se necessário
import { Loader2 } from 'lucide-react';

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
      <p>Carregando...</p>
    </div>
  </div>
);

const AccessDeniedScreen = ({ message, debugInfo = {} }) => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-600 font-semibold">{message}</p>
        <p className="text-sm text-gray-600 mt-2">
          Você não tem permissão para acessar esta página.
        </p>
        <div className="mt-4 p-4 bg-gray-100 rounded text-left text-xs w-80 mx-auto">
          <strong>Debug Info:</strong><br/>
          {Object.entries(debugInfo).map(([key, value]) => (
            <React.Fragment key={key}>
              <span>{key}: "{value}"</span><br/>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
);


const ProtectedRoute = ({ children, requiredRole = null, requiredRoles = null, requiredArea = null }) => {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  // 1. Se o contexto de autenticação ainda está carregando, mostramos o loading.
  if (loading) {
    return <LoadingScreen />;
  }

  // 2. Se não há usuário, redirecionamos para o login.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Se o usuário existe, mas o perfil ainda não foi carregado, esperamos.
  if (!userProfile) {
    // Isso pode acontecer por um instante entre o login e a busca no Firestore.
    return <LoadingScreen />;
  }
  
  // 4. ***A NOVA VERIFICAÇÃO DE SEGURANÇA***
  // Verificamos se os campos específicos necessários para esta rota já existem no perfil.
  // Se a rota exige uma 'funcao', mas userProfile.funcao ainda é undefined, continuamos carregando.
  if ((requiredRole || requiredRoles) && typeof userProfile.funcao === 'undefined') {
    console.log("⏳ ProtectedRoute: Perfil existe, mas aguardando o campo 'funcao'...");
    return <LoadingScreen />;
  }
  
  // O mesmo para 'area'
  if (requiredArea && typeof userProfile.area === 'undefined') {
    console.log("⏳ ProtectedRoute: Perfil existe, mas aguardando o campo 'area'...");
    return <LoadingScreen />;
  }

  // 5. Agora que temos certeza que os dados existem, verificamos as permissões.
  // Verificar permissão de função única
  if (requiredRole && userProfile.funcao !== requiredRole) {
    return <AccessDeniedScreen 
              message="Acesso negado. Rota restrita." 
              debugInfo={{
                "Sua função": userProfile.funcao,
                "Função requerida": requiredRole,
                "Página": location.pathname
              }} 
            />;
  }

  // Verificar permissão de múltiplas funções
  if (requiredRoles && !requiredRoles.includes(userProfile.funcao)) {
    return <AccessDeniedScreen 
              message="Acesso negado." 
              debugInfo={{
                "Sua função": userProfile.funcao,
                "Funções permitidas": requiredRoles.join(', '),
                "Página": location.pathname
              }} 
            />;
  }

  // Verificar permissão de área
  if (requiredArea && userProfile.area !== requiredArea) {
    return <AccessDeniedScreen 
              message="Acesso de área negado." 
              debugInfo={{
                "Sua área": userProfile.area,
                "Área requerida": requiredArea,
                "Página": location.pathname
              }} 
            />;
  }

  // Se passou por todas as verificações, o acesso é permitido.
  return children;
};

export default ProtectedRoute;
