import { useState } from 'react';
import { api } from '../services/api';

const INITIAL = { nome: '', email: '', cidade: '', uf: '', aparelho: '', android_version: '' };
const BETA_APK_URL = import.meta.env.VITE_BETA_APK_URL
  || 'https://expo.dev/artifacts/eas/8eYUfGvqAlH5OjMy7D_hW4qnmxOew8sjiD1Y10othLM.apk';

export default function BetaPage() {
  const [form, setForm] = useState(INITIAL);
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      await api.betaSignup({ ...form, age_confirmed: age, accepted_beta_terms: terms,
        beta_terms_version: '1.1', acknowledged_privacy: privacy, privacy_version: '1.0' });
      setDone(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (done) return <main className="beta-page"><section className="beta-hero card">
    <h1>Inscrição recebida 🌱</h1>
    <p>Obrigado! Sua inscrição foi concluída e o aplicativo beta já está disponível para download.</p>
    <a className="btn" href={BETA_APK_URL} target="_blank" rel="noreferrer">
      Baixar o APK Beta para Android
    </a>
    <small>Ao instalar, o Android poderá pedir autorização para instalar aplicativos desta fonte.</small>
  </section></main>;

  return <main className="beta-page">
    <section className="beta-hero">
      <img src="/logo.png" alt="Lixo na Rua" />
      <span className="beta-badge">PROGRAMA BETA COMUNITÁRIO</span>
      <h1>Ajude a testar uma ferramenta de monitoramento ambiental</h1>
      <p>Buscamos pessoas maiores de 18 anos, com celular Android, para testar fotografia, precisão do GPS, mapa e facilidade de uso.</p>
      <ul><li>Participação gratuita e voluntária</li><li>Ambiente separado — testes não viram denúncias oficiais</li><li>Não fotografe pessoas, placas ou propriedades privadas</li><li>Primeira turma: 30 a 50 participantes</li></ul>
    </section>
    <form className="card beta-form" onSubmit={submit}>
      <h2>Quero participar</h2>{error && <div className="alerta">{error}</div>}
      {[
        ['nome','Nome'],['email','E-mail'],['cidade','Cidade'],['uf','UF (duas letras)'],
        ['aparelho','Modelo do celular'],['android_version','Versão do Android']
      ].map(([field,label]) => <label className="campo" key={field}><span>{label}</span><input
        value={form[field]} onChange={(e)=>change(field,e.target.value)} required maxLength={field==='uf'?2:120}
        type={field==='email'?'email':'text'} /></label>)}
      <label className="beta-check"><input type="checkbox" checked={age} onChange={(e)=>setAge(e.target.checked)} /> Confirmo que tenho 18 anos ou mais.</label>
      <label className="beta-check"><input type="checkbox" checked={terms} onChange={(e)=>setTerms(e.target.checked)} /> Li e aceito o <a href="/legal/termo-beta.html" target="_blank" rel="noreferrer">Termo do Programa Beta</a>.</label>
      <label className="beta-check"><input type="checkbox" checked={privacy} onChange={(e)=>setPrivacy(e.target.checked)} /> Li e estou ciente da <a href="/legal/privacidade.html" target="_blank" rel="noreferrer">Política de Privacidade</a>.</label>
      <button className="btn" disabled={loading || !age || !terms || !privacy}>{loading?'Enviando...':'Enviar inscrição'}</button>
      <small>Não solicitamos CPF, endereço residencial ou documentos.</small>
    </form>
  </main>;
}
