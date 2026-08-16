import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import './App.css';

/**
 * Decide o que mostrar conforme a sessão.
 *
 * Enquanto `loading` for true o token ainda está sendo validado — mostrar a
 * tela de login aqui faria a interface piscar para quem já está logado.
 */
function Rotas() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="carregando">
        <p>Carregando...</p>
      </div>
    );
  }

  return isAuthenticated ? <DashboardPage /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Rotas />
    </AuthProvider>
  );
}
