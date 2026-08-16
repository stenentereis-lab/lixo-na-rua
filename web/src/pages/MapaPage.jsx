/**
 * Página do mapa: visão geral das denúncias com filtros e números.
 */
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import MapaDenuncias, {
  CORES_CATEGORIA,
  ROTULO_CATEGORIA,
} from '../components/MapaDenuncias';

const ROTULO_STATUS = {
  reported: 'Enviadas',
  validated: 'Confirmadas',
  resolved: 'Resolvidas',
  rejected: 'Rejeitadas',
};

export default function MapaPage() {
  const [geojson, setGeojson] = useState(null);
  const [stats, setStats] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const [categoria, setCategoria] = useState('');
  const [status, setStatus] = useState('');
  const [modoCalor, setModoCalor] = useState(false);

  useEffect(() => {
    carregar();
  }, [categoria, status]);

  async function carregar() {
    setErro('');
    try {
      const [pontos, numeros] = await Promise.all([
        api.geojson({ category: categoria, status }),
        api.stats(),
      ]);
      setGeojson(pontos);
      setStats(numeros);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  const totalVisivel = geojson?.features?.length ?? 0;

  return (
    <div className="mapa-pagina">
      <section className="card">
        <div className="mapa-topo">
          <div>
            <h2>Mapa de denúncias</h2>
            <p className="subtitle-sm">
              {carregando
                ? 'Carregando...'
                : `${totalVisivel} ${totalVisivel === 1 ? 'ponto' : 'pontos'} no mapa`}
            </p>
          </div>

          <div className="mapa-controles">
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias</option>
              {Object.entries(ROTULO_CATEGORIA).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`btn-toggle ${modoCalor ? 'ativo' : ''}`}
              onClick={() => setModoCalor((v) => !v)}
            >
              {modoCalor ? 'Ver marcadores' : 'Ver mapa de calor'}
            </button>
          </div>
        </div>

        {erro && <div className="alerta">{erro}</div>}

        {!carregando && totalVisivel === 0 && !erro && (
          <div className="vazio">
            Nenhuma denúncia com esses filtros. Envie a primeira pelo app no
            celular.
          </div>
        )}

        <MapaDenuncias geojson={geojson} modoCalor={modoCalor} />

        {!modoCalor && (
          <div className="legenda">
            {Object.entries(ROTULO_CATEGORIA).map(([valor, rotulo]) => (
              <span key={valor} className="legenda-item">
                <i style={{ background: CORES_CATEGORIA[valor] }} />
                {rotulo}
              </span>
            ))}
          </div>
        )}
      </section>

      {stats && (
        <section className="card">
          <h2>Números</h2>

          <div className="numeros">
            <div className="numero-destaque">
              <strong>{stats.total}</strong>
              <span>denúncias no total</span>
            </div>
          </div>

          <div className="colunas">
            <div>
              <h3>Por status</h3>
              {stats.by_status.length === 0 ? (
                <p className="subtitle-sm">Sem dados ainda</p>
              ) : (
                <ul className="barras">
                  {stats.by_status.map((s) => (
                    <li key={s.status}>
                      <span>{ROTULO_STATUS[s.status] || s.status}</span>
                      <div className="barra">
                        <div
                          style={{
                            width: `${(s.total / stats.total) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{s.total}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3>Por categoria</h3>
              {stats.by_category.length === 0 ? (
                <p className="subtitle-sm">Sem dados ainda</p>
              ) : (
                <ul className="barras">
                  {stats.by_category.map((c) => (
                    <li key={c.category}>
                      <span>{ROTULO_CATEGORIA[c.category] || c.category}</span>
                      <div className="barra">
                        <div
                          style={{
                            width: `${(c.total / stats.total) * 100}%`,
                            background: CORES_CATEGORIA[c.category],
                          }}
                        />
                      </div>
                      <strong>{c.total}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
