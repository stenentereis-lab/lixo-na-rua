/**
 * Estado de autenticação do app.
 *
 * A sessão fica no AsyncStorage, então o usuário continua logado entre
 * aberturas do app — importante num app de denúncia, onde a pessoa vai
 * usar na rua, com pressa.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStorage } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restaurarSessao();
  }, []);

  async function restaurarSessao() {
    try {
      const token = await tokenStorage.get();
      if (!token) return;

      const { user } = await api.me();
      setUser(user);
    } catch {
      // Token expirado, inválido ou servidor fora: começa deslogado.
      await tokenStorage.clear();
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const { user, token } = await api.login({ email, password });
    await tokenStorage.set(token);
    setUser(user);
    return user;
  }

  async function register(dados) {
    const { user, token } = await api.register(dados);
    await tokenStorage.set(token);
    setUser(user);
    return user;
  }

  async function acceptLegal(dados) {
    const { user } = await api.acceptLegal(dados);
    setUser(user);
    return user;
  }

  async function logout() {
    await tokenStorage.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, acceptLegal, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
