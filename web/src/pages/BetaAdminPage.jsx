import { useEffect, useState } from 'react';
import { api } from '../services/api';

const STATUS = {
  pending: 'Pendente',
  invited: 'Convidado',
  accepted: 'Participando',
  declined: 'Recusou',
  removed: 'Removido',
};

export default function BetaAdminPage() {
  const [inscricoes, setInscricoes] = useState([]);
  const [summary, setSummary] = useState({ total: 0 });
  const [filtro, setFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState('');

  useEffect(() => { carregar(); }, [filtro]);

  async function carregar(event) {
    event?.preventDefault();
    setCarregando(true); setErro('');
    try {
      const result = await api.listarInscricoesBeta({ status: filtro, search: busca });
      setInscricoes(result.data);
      setSummary(result.summary);
    } catch (err) { setErro(err.message); }
    finally { setCarregando(false); }
  }

  async function alterarStatus(id, status) {
    setProcessando(id); setErro('');
    try {
      await api.atualizarInscricaoBeta(id, status);
      await carregar();
    } catch (err) { setErro(err.message); }
    finally { setProcessando(''); }
  }

  return <section className="card beta-admin">
    <div className="mapa-topo">
      <div><h2>Inscrições do programa beta</h2><p className="subtitle-sm">Acompanhamento dos testadores cadastrados</p></div>
      <button className="btn btn-recarregar" type="button" onClick={() => carregar()} disabled={carregando}>Atualizar</button>
    </div>

    <div className="beta-resumo">
      <div><strong>{summary.total || 0}</strong><span>Total</span></div>
      {Object.entries(STATUS).map(([key, label]) => <div key={key}><strong>{summary[key] || 0}</strong><span>{label}</span></div>)}
    </div>

    <form className="beta-filtros" onSubmit={carregar}>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, e-mail, cidade ou aparelho" />
      <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
        <option value="">Todas as situações</option>
        {Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <button className="btn" type="submit">Buscar</button>
    </form>

    {erro && <div className="alerta">{erro}</div>}
    {carregando && <div className="vazio">Carregando inscrições...</div>}
    {!carregando && !erro && inscricoes.length === 0 && <div className="vazio">Nenhuma inscrição encontrada.</div>}

    {!carregando && inscricoes.length > 0 && <div className="beta-tabela-wrap"><table className="beta-tabela">
      <thead><tr><th>Participante</th><th>Local</th><th>Aparelho</th><th>Cadastro</th><th>Situação</th></tr></thead>
      <tbody>{inscricoes.map((item) => <tr key={item.id}>
        <td><strong>{item.nome}</strong><a href={`mailto:${item.email}`}>{item.email}</a></td>
        <td>{item.cidade}/{item.uf}</td>
        <td>{item.aparelho}<small>Android {item.android_version}</small></td>
        <td>{new Date(item.created_at).toLocaleString('pt-BR')}</td>
        <td><select value={item.status} disabled={processando === item.id} onChange={(e) => alterarStatus(item.id, e.target.value)}>
          {Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
