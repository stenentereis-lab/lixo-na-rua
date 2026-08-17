import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import LegalAcceptancePage from './pages/LegalAcceptancePage';
import './App.css';

/**
 * Decide o que mostrar conforme a sessão.
 *
 * Enquanto `loading` for true o token ainda está sendo validado — mostrar a
 * tela de login aqui faria a interface piscar para quem já está logado.
 */
function Rotas() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="carregando">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) return <AuthPage />;
  if (user.legal_acceptance_required) return <LegalAcceptancePage />;
  return <DashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Rotas />
    </AuthProvider>
  );
}
