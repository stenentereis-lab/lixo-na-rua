/**
 * Estado de autenticação compartilhado.
 *
 * Guarda o usuário logado, restaura a sessão ao abrir o app e expõe
 * login / cadastro / logout para as telas.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStorage } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Começa carregando: enquanto o token não é validado, não dá para saber
  // se o usuário está logado — mostrar a tela de login aqui causaria um
  // "piscar" indevido em quem já tem sessão.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => tokenStorage.clear()) // token expirado ou inválido
      .finally(() => setLoading(false));
  }, []);

  /** Autentica e guarda a sessão. Propaga ApiError para a tela exibir. */
  async function login(email, password) {
    const { user, token } = await api.login({ email, password });
    tokenStorage.set(token);
    setUser(user);
    return user;
  }

  /** Cria a conta e já entra — o backend devolve o token no cadastro. */
  async function register(dados) {
    const { user, token } = await api.register(dados);
    tokenStorage.set(token);
    setUser(user);
    return user;
  }

  function logout() {
    tokenStorage.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Acessa o contexto de autenticação.
 * @returns {{ user, loading, login, register, logout, isAuthenticated }}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  }
  return ctx;
}
