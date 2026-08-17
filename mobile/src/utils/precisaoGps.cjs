const PRECISAO_MAXIMA_METROS = 20;
const IDADE_MAXIMA_MS = 10_000;

/**
 * Uma coordenada só serve para registrar o ponto da denúncia quando o
 * aparelho informa a margem de erro e a leitura é recente.
 */
function avaliarLocalizacao(
  local,
  agora = Date.now(),
  precisaoMaxima = PRECISAO_MAXIMA_METROS,
  idadeMaxima = IDADE_MAXIMA_MS
) {
  if (!local) return { aceita: false, motivo: 'ausente' };

  if (local.accuracy === null || local.accuracy === undefined || local.accuracy === '') {
    return { aceita: false, motivo: 'precisao_desconhecida' };
  }

  const precisao = Number(local.accuracy);
  if (!Number.isFinite(precisao)) {
    return { aceita: false, motivo: 'precisao_desconhecida' };
  }

  if (precisao > precisaoMaxima) {
    return { aceita: false, motivo: 'imprecisa', precisao };
  }

  const timestamp = Number(local.timestamp);
  if (!Number.isFinite(timestamp) || agora - timestamp > idadeMaxima) {
    return { aceita: false, motivo: 'antiga', precisao };
  }

  return { aceita: true, motivo: 'ok', precisao };
}

module.exports = {
  PRECISAO_MAXIMA_METROS,
  IDADE_MAXIMA_MS,
  avaliarLocalizacao,
};
