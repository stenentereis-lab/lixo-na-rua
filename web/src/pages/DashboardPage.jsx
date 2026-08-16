/**
 * Área autenticada. Por enquanto mostra a sessão e o status dos serviços;
 * é aqui que entram o mapa e as estatísticas nas próximas semanas.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [saude, setSaude] = useState(null);

  useEffect(() => {
    api.health().then(setSaude).catch(() => setSaude({ status: 'ERRO' }));
  }, []);

  const bancoOk = saude?.database === 'connected';

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
      </section>

      <section className="card">
        <h2>Status dos serviços</h2>
        <ul className="lista-status">
          <li>
            <span className="dot ok" /> Web (React + Vite) — porta 3001
          </li>
          <li>
            <span className={`dot ${saude ? 'ok' : 'checking'}`} /> API (Express)
            — porta 3000
          </li>
          <li>
            <span className={`dot ${bancoOk ? 'ok' : 'error'}`} /> Banco
            (PostgreSQL) — {bancoOk ? 'conectado' : 'indisponível'}
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Próximos passos</h2>
        <ul className="lista-status">
          <li>✓ Autenticação — concluída</li>
          <li>Captura de foto com GPS</li>
          <li>Mapa de denúncias</li>
          <li>Dashboard de estatísticas</li>
        </ul>
      </section>
    </div>
  );
}
