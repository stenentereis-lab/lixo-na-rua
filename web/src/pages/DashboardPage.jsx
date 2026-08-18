/**
 * Área autenticada: mapa das denúncias e dados da conta.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import MapaPage from './MapaPage';
import ModeracaoPage from './ModeracaoPage';
import BetaAdminPage from './BetaAdminPage';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [aba, setAba] = useState('mapa');

  // A aba some para quem não pode moderar. Isso é conveniência de
  // interface: o backend valida o papel de novo em cada requisição.
  const podeModerar = user.role === 'moderator' || user.role === 'admin';
  const ehAdmin = user.role === 'admin';

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
        {podeModerar && (
          <button
            className={aba === 'moderacao' ? 'ativa' : ''}
            onClick={() => setAba('moderacao')}
          >
            Moderação
          </button>
        )}
        {ehAdmin && (
          <button
            className={aba === 'inscricoes-beta' ? 'ativa' : ''}
            onClick={() => setAba('inscricoes-beta')}
          >
            Inscrições beta
          </button>
        )}
        <button
          className={aba === 'conta' ? 'ativa' : ''}
          onClick={() => setAba('conta')}
        >
          Minha conta
        </button>
      </nav>

      {aba === 'mapa' && <MapaPage />}
      {aba === 'moderacao' && podeModerar && <ModeracaoPage />}
      {aba === 'inscricoes-beta' && ehAdmin && <BetaAdminPage />}
      {aba === 'conta' && (
        <section className="card">
          <h2>Sua conta</h2>
          <dl className="dados">
            <dt>Nome</dt>
            <dd>{user.nome}</dd>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
            <dt>Perfil</dt>
            <dd>
              {user.role}
              {!podeModerar && (
                <span className="dica">
                  {' '}
                  — para moderar, peça a um admin:{' '}
                  <code>npm run set-role -- {user.email} moderator</code>
                </span>
              )}
            </dd>
          </dl>

          <h2 style={{ marginTop: 24 }}>Próximos passos</h2>
          <ul className="lista-status">
            <li>✓ Autenticação</li>
            <li>✓ Captura de foto com GPS no app</li>
            <li>✓ Mapa de denúncias</li>
            <li>✓ Moderação</li>
            <li>Integração com órgãos públicos</li>
          </ul>
        </section>
      )}
    </div>
  );
}
