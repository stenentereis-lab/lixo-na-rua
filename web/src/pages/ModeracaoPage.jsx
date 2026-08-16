/**
 * Fila de moderação.
 *
 * Visível apenas para moderador e admin — a aba nem aparece para os
 * demais. Ainda assim, o backend valida o papel de novo: esconder botão
 * é conveniência de interface, não controle de acesso.
 */
import { useEffect, useState } from 'react';
import { api, API_URL } from '../services/api';
import { ROTULO_CATEGORIA } from '../components/MapaDenuncias';

const ROTULO_STATUS = {
  reported: 'Aguardando',
  validated: 'Confirmada',
  resolved: 'Resolvida',
  rejected: 'Rejeitada',
};

/** Ações oferecidas conforme o status atual, espelhando as transições do backend. */
const ACOES = {
  reported: [
    { status: 'validated', rotulo: 'Confirmar', tipo: 'primario' },
    { status: 'rejected', rotulo: 'Rejeitar', tipo: 'perigo' },
  ],
  validated: [
    { status: 'resolved', rotulo: 'Marcar resolvida', tipo: 'sucesso' },
    { status: 'rejected', rotulo: 'Rejeitar', tipo: 'perigo' },
  ],
  rejected: [{ status: 'reported', rotulo: 'Reabrir', tipo: 'neutro' }],
  resolved: [{ status: 'validated', rotulo: 'Reabrir', tipo: 'neutro' }],
};

export default function ModeracaoPage() {
  const [denuncias, setDenuncias] = useState([]);
  const [filtro, setFiltro] = useState('reported');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState(null);

  useEffect(() => {
    carregar();
  }, [filtro]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const { data } = await api.listarDenuncias({ status: filtro, limit: 50 });
      setDenuncias(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function decidir(denuncia, acao) {
    let motivo;

    if (acao.status === 'rejected') {
      motivo = window.prompt(
        'Por que esta denúncia está sendo rejeitada?\n' +
          'O motivo fica registrado no histórico.'
      );
      // Cancelou o prompt: não faz nada.
      if (motivo === null) return;
      if (!motivo.trim()) {
        setErro('A rejeição precisa de um motivo.');
        return;
      }
    }

    setProcessando(denuncia.id);
    setErro('');

    try {
      await api.moderar(denuncia.id, { status: acao.status, motivo });
      // Sai da lista se não pertencer mais ao filtro atual.
      setDenuncias((atual) => atual.filter((d) => d.id !== denuncia.id));
    } catch (err) {
      setErro(err.message);
    } finally {
      setProcessando(null);
    }
  }

  return (
    <section className="card">
      <div className="mapa-topo">
        <div>
          <h2>Moderação</h2>
          <p className="subtitle-sm">
            {carregando
              ? 'Carregando...'
              : `${denuncias.length} ${denuncias.length === 1 ? 'denúncia' : 'denúncias'}`}
          </p>
        </div>

        <div className="mapa-controles">
          {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              className={`btn-toggle ${filtro === valor ? 'ativo' : ''}`}
              onClick={() => setFiltro(valor)}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro && <div className="alerta">{erro}</div>}

      {!carregando && denuncias.length === 0 && !erro && (
        <div className="vazio">
          {filtro === 'reported'
            ? 'Nenhuma denúncia aguardando. Fila zerada.'
            : 'Nenhuma denúncia com esse status.'}
        </div>
      )}

      <ul className="fila">
        {denuncias.map((d) => (
          <li key={d.id} className="item-fila">
            {d.image_url && (
              <img
                src={`${API_URL}${d.image_url}`}
                alt=""
                className="miniatura"
              />
            )}

            <div className="item-conteudo">
              <strong>{d.title}</strong>
              {d.description && <p className="item-descricao">{d.description}</p>}

              <p className="item-meta">
                {ROTULO_CATEGORIA[d.category] || d.category} ·{' '}
                {Number(d.latitude).toFixed(5)}, {Number(d.longitude).toFixed(5)} ·{' '}
                {new Date(d.created_at).toLocaleString('pt-BR')}
              </p>

              <div className="item-acoes">
                {(ACOES[d.status] || []).map((acao) => (
                  <button
                    key={acao.status}
                    type="button"
                    className={`btn-acao ${acao.tipo}`}
                    disabled={processando === d.id}
                    onClick={() => decidir(d, acao)}
                  >
                    {processando === d.id ? '...' : acao.rotulo}
                  </button>
                ))}

                <a
                  href={`https://www.openstreetmap.org/?mlat=${d.latitude}&mlon=${d.longitude}#map=18/${d.latitude}/${d.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="link-mapa"
                >
                  Ver no mapa
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
