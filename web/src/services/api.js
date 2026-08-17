/**
 * Cliente HTTP da API.
 *
 * Centraliza URL base, envio do token e tradução de erro, para que as telas
 * não precisem repetir isso.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const TOKEN_KEY = 'lixo_na_rua_token';

/**
 * Tempo limite de cada requisição, em ms.
 *
 * O `fetch` não tem timeout próprio. Sem isto, um servidor inalcançável de
 * um jeito que descarta pacotes em silêncio — comportamento padrão de
 * firewall — deixaria a tela travada em "carregando" para sempre.
 */
const TIMEOUT = 10000;

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/**
 * Erro vindo da API, já com status e detalhes por campo.
 */
export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details || {};
  }
}

/**
 * Faz uma requisição à API.
 *
 * @param {string} path - Caminho, ex.: '/auth/login'
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {object} [options.body] - Serializado como JSON
 * @param {boolean} [options.auth=false] - Envia o token no header
 * @returns {Promise<object>} corpo da resposta
 * @throws {ApiError}
 */
async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = tokenStorage.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controlador = new AbortController();
  const alarme = setTimeout(() => controlador.abort(), TIMEOUT);

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controlador.signal,
    });
  } catch (err) {
    // fetch só rejeita em falha de rede — servidor fora, DNS, CORS — ou
    // quando abortamos por tempo limite.
    throw new ApiError(
      err.name === 'AbortError'
        ? `O servidor não respondeu em ${TIMEOUT / 1000}s. Ele está rodando?`
        : 'Não foi possível falar com o servidor. Ele está rodando?',
      0
    );
  } finally {
    clearTimeout(alarme);
  }

  const isJson = response.headers
    .get('content-type')
    ?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(
      data?.error || `Erro ${response.status}`,
      response.status,
      data?.details
    );
  }

  return data;
}

export const api = {
  betaSignup: (dados) => request('/beta-signups', { method: 'POST', body: dados }),
  health: () => request('/health'),

  /**
   * URL exibível de uma imagem devolvida pela API.
   *
   * Os dois drivers de armazenamento devolvem formatos diferentes:
   *   local → "/uploads/abc.jpg"                    (relativo à API)
   *   S3/R2 → "https://fotos.../denuncias/abc.jpg"  (absoluto)
   *
   * Concatenar a base em cima de uma URL absoluta gera endereço inválido
   * e a imagem some sem erro visível.
   */
  imagemUrl: (caminho) => {
    if (!caminho) return null;
    if (/^https?:\/\//i.test(caminho)) return caminho;
    return `${API_URL}${caminho}`;
  },

  /** @param {{bbox?: string, status?: string, category?: string}} [filtros] */
  geojson: (filtros = {}) => {
    const qs = new URLSearchParams(
      Object.entries(filtros).filter(([, v]) => v)
    ).toString();
    return request(`/map/geojson${qs ? `?${qs}` : ''}`);
  },

  nearby: ({ lat, lng, radius = 1000 }) =>
    request(`/map/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),

  stats: () => request('/map/stats'),

  /** @param {{status?: string, category?: string, page?: number, limit?: number}} [filtros] */
  listarDenuncias: (filtros = {}) => {
    const qs = new URLSearchParams(
      Object.entries(filtros).filter(([, v]) => v)
    ).toString();
    return request(`/complaints${qs ? `?${qs}` : ''}`, { auth: true });
  },

  /** 🔒 moderador ou admin */
  moderar: (id, { status, motivo }) =>
    request(`/complaints/${id}`, {
      method: 'PATCH',
      body: { status, motivo },
      auth: true,
    }),

  /** 🔒 moderador ou admin */
  historicoModeracao: (id) =>
    request(`/complaints/${id}/moderations`, { auth: true }),

  register: (dados) => request('/auth/register', { method: 'POST', body: dados }),
  acceptLegal: (dados) =>
    request('/auth/legal-acceptance', { method: 'POST', body: dados, auth: true }),

  login: (credenciais) =>
    request('/auth/login', { method: 'POST', body: credenciais }),

  me: () => request('/auth/me', { auth: true }),
};
