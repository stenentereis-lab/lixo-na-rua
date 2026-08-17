/**
 * Tela de entrada: login e cadastro no mesmo formulário, alternando o modo.
 *
 * Layout em duas colunas — a arte da marca à esquerda, o formulário à
 * direita. Em telas estreitas a arte some e sobra só a logo no topo do
 * formulário: num celular, a arte empurraria os campos para fora da tela.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { login, register } = useAuth();

  const [modo, setModo] = useState('login'); // 'login' | 'cadastro'
  const [form, setForm] = useState({ nome: '', email: '', password: '' });
  const [erro, setErro] = useState('');
  const [erroCampo, setErroCampo] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [cientePrivacidade, setCientePrivacidade] = useState(false);

  const isCadastro = modo === 'cadastro';

  function alternarModo() {
    setModo(isCadastro ? 'login' : 'cadastro');
    setErro('');
    setErroCampo({});
  }

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    // Limpa o erro do campo assim que o usuário corrige.
    setErroCampo((e) => ({ ...e, [campo]: undefined }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setErroCampo({});
    setEnviando(true);

    try {
      if (isCadastro) {
        await register({
          ...form,
          accepted_terms: aceitouTermos,
          terms_version: '1.0',
          acknowledged_privacy: cientePrivacidade,
          privacy_version: '1.0',
        });
      } else {
        await login(form.email, form.password);
      }
    } catch (err) {
      setErro(err.message);
      setErroCampo(err.details || {});
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-grid">
        <aside className="auth-arte" aria-hidden="true">
          <img src="/banner.jpg" alt="" />
        </aside>

        <form className="card auth-card" onSubmit={enviar} noValidate>
          <img src="/logo.png" alt="Lixo na Rua" className="auth-logo" />

          <p className="subtitle">
            {isCadastro
              ? 'Crie sua conta para começar a denunciar'
              : 'Entre para acompanhar suas denúncias'}
          </p>

          {erro && (
            <div className="alerta" role="alert">
              {erro}
            </div>
          )}

          {isCadastro && (
            <label className="campo">
              <span>Nome</span>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => alterar('nome', e.target.value)}
                autoComplete="name"
                placeholder="Maria Silva"
              />
              {erroCampo.nome && <small className="erro">{erroCampo.nome}</small>}
            </label>
          )}

          <label className="campo">
            <span>E-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => alterar('email', e.target.value)}
              autoComplete="email"
              placeholder="voce@exemplo.com"
            />
            {erroCampo.email && <small className="erro">{erroCampo.email}</small>}
          </label>

          <label className="campo">
            <span>Senha</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => alterar('password', e.target.value)}
              autoComplete={isCadastro ? 'new-password' : 'current-password'}
              placeholder={isCadastro ? 'Mínimo 8 caracteres' : ''}
            />
            {erroCampo.password && (
              <small className="erro">{erroCampo.password}</small>
            )}
          </label>

          {isCadastro && (
            <div className="aceites-legais">
              <label>
                <input
                  type="checkbox"
                  checked={aceitouTermos}
                  onChange={(e) => setAceitouTermos(e.target.checked)}
                />{' '}
                Li e aceito os{' '}
                <a href="/legal/termos.html" target="_blank" rel="noreferrer">
                  Termos de Uso (v1.0)
                </a>.
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={cientePrivacidade}
                  onChange={(e) => setCientePrivacidade(e.target.checked)}
                />{' '}
                Li e estou ciente da{' '}
                <a href="/legal/privacidade.html" target="_blank" rel="noreferrer">
                  Política de Privacidade (v1.0)
                </a>.
              </label>
            </div>
          )}

          <button type="submit" className="btn" disabled={enviando}>
            {enviando ? 'Aguarde...' : isCadastro ? 'Criar conta' : 'Entrar'}
          </button>

          <p className="alternar">
            {isCadastro ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
            <button type="button" className="link" onClick={alternarModo}>
              {isCadastro ? 'Entrar' : 'Cadastre-se'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
