/**
 * Cliente HTTP da API.
 *
 * Centraliza URL base, envio do token e tradução de erro, para que as telas
 * não precisem repetir isso.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const TOKEN_KEY = 'lixo_na_rua_token';

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

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch só rejeita em falha de rede — servidor fora, DNS, CORS.
    throw new ApiError(
      'Não foi possível falar com o servidor. Ele está rodando?',
      0
    );
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
  health: () => request('/health'),

  register: (dados) => request('/auth/register', { method: 'POST', body: dados }),

  login: (credenciais) =>
    request('/auth/login', { method: 'POST', body: credenciais }),

  me: () => request('/auth/me', { auth: true }),
};
