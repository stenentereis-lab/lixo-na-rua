import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LegalAcceptancePage() {
  const { acceptLegal, logout } = useAuth();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await acceptLegal({
        accepted_terms: terms,
        terms_version: '1.0',
        acknowledged_privacy: privacy,
        privacy_version: '1.0',
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="legal-gate">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Documentos atualizados</h1>
        <p>Para continuar, leia e confirme os documentos vigentes.</p>
        {error && <div className="alerta">{error}</div>}
        <label><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> Li e aceito os <a href="/legal/termos.html" target="_blank" rel="noreferrer">Termos de Uso (v1.0)</a>.</label>
        <label><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /> Li e estou ciente da <a href="/legal/privacidade.html" target="_blank" rel="noreferrer">Política de Privacidade (v1.0)</a>.</label>
        <button className="btn" disabled={!terms || !privacy}>Aceitar e continuar</button>
        <button type="button" className="link" onClick={logout}>Sair</button>
      </form>
    </main>
  );
}
