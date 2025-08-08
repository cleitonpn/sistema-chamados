// Arquivo: src/contexts/AuthContext.jsx - VERSÃO CORRIGIDA
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase'; // Verifique se o caminho está correto

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setUser(user);
          const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
          if (userDoc.exists()) {
            // A CORREÇÃO CRUCIAL ESTÁ AQUI:
            // Nós juntamos o ID do documento com o resto dos dados (.data())
            setUserProfile({ id: userDoc.id, ...userDoc.data() });
          } else {
            console.warn("Usuário autenticado, mas sem perfil no Firestore.");
            setUserProfile(null);
          }
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('Erro no listener de autenticação:', error);
        setUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
        setAuthInitialized(true);
      }
    });

    return unsubscribe;
  }, []);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const register = async (email, password, userData) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'usuarios', result.user.uid), {
      email: email,
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return result;
  };

  const value = {
    user,
    userProfile,
    login,
    logout,
    register,
    loading,
    authInitialized
  };

  // Não renderiza nada até que a verificação inicial de auth esteja completa
  return (
    <AuthContext.Provider value={value}>
      {authInitialized ? children : null /* ou uma tela de loading global */}
    </AuthContext.Provider>
  );
};
