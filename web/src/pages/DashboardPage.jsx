/**
 * Área autenticada: mapa das denúncias e dados da conta.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import MapaPage from './MapaPage';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [aba, setAba] = useState('mapa');

  return (
    <div className="app-wrap">
      <header className="topo">
        <div>
          <h1>Lixo na Rua</h1>
          <p className="subtitle">Olá, {user.nome}</p>
        </div>
        <button className="btn btn-secundario" onClick={logout}>
          Sair
        </button>
      </header>

      <nav className="abas">
        <button
          className={aba === 'mapa' ? 'ativa' : ''}
          onClick={() => setAba('mapa')}
        >
          Mapa
        </button>
        <button
          className={aba === 'conta' ? 'ativa' : ''}
          onClick={() => setAba('conta')}
        >
          Minha conta
        </button>
      </nav>

      {aba === 'mapa' ? (
        <MapaPage />
      ) : (
        <section className="card">
          <h2>Sua conta</h2>
          <dl className="dados">
            <dt>Nome</dt>
            <dd>{user.nome}</dd>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
            <dt>Perfil</dt>
            <dd>{user.role}</dd>
          </dl>

          <h2 style={{ marginTop: 24 }}>Próximos passos</h2>
          <ul className="lista-status">
            <li>✓ Autenticação</li>
            <li>✓ Captura de foto com GPS no app</li>
            <li>✓ Mapa de denúncias</li>
            <li>Moderação — validar e rejeitar denúncias</li>
            <li>Integração com órgãos públicos</li>
          </ul>
        </section>
      )}
    </div>
  );
}
