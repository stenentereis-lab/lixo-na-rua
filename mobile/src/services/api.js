/**
 * Cliente HTTP da API.
 *
 * O endereço do backend é descoberto automaticamente: no celular,
 * "localhost" aponta para o próprio aparelho, não para o seu PC. O Expo
 * expõe o IP da máquina de desenvolvimento em `hostUri` (ex.:
 * "192.168.0.10:8081"), e reaproveitamos esse IP trocando a porta para
 * a do backend.
 *
 * Isso dispensa configurar IP na mão — que é o erro mais comum ao rodar
 * app Expo com backend local.
 */
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PORTA_BACKEND = 3000;
const TOKEN_KEY = 'lixo_na_rua_token';

/**
 * Tempo limite das requisições, em ms.
 *
 * Sem isso, o app trava para sempre quando o servidor está inalcançável de
 * um jeito que descarta pacotes em silêncio — o comportamento padrão de um
 * firewall. O `fetch` não tem timeout próprio: fica pendurado sem erro.
 *
 * Upload tem limite muito maior: uma foto de alguns megabytes saindo de um
 * celular em rede móvel até um servidor na Europa passa de 10s com
 * facilidade. Usar o mesmo limite do login fazia toda denúncia falhar em
 * conexão lenta — que é justamente a situação de quem está na rua.
 */
const TIMEOUT = 15000;
const TIMEOUT_UPLOAD = 120000;

/** IP de rede local: 192.168.x.x, 10.x.x.x ou 172.16-31.x.x */
const IP_LOCAL = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * Descobre a URL do backend.
 *
 * Ordem: configuração explícita → IP detectado pelo Expo → localhost.
 *
 * @returns {string} ex.: "http://192.168.0.10:3000"
 */
function descobrirApiUrl() {
  const configurada = Constants.expoConfig?.extra?.apiUrl;

  // Em desenvolvimento, o IP da máquina do Metro tem prioridade: é lá que
  // o backend local roda. Sem isso, ter apiUrl de produção no app.json
  // impediria testar qualquer mudança do backend sem publicá-la antes.
  const hostUri =
    Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost || '';
  const host = hostUri.split(':')[0];

  if (__DEV__ && IP_LOCAL.test(host)) {
    return `http://${host}:${PORTA_BACKEND}`;
  }

  // Build de produção, ou modo túnel (host vira .exp.direct e não serve
  // para achar o backend).
  if (configurada) return configurada;

  if (IP_LOCAL.test(host)) return `http://${host}:${PORTA_BACKEND}`;

  // Último caso: num celular físico "localhost" é o próprio aparelho.
  // Acontece quando o Expo não detecta a rede (mostra 127.0.0.1).
  return `http://localhost:${PORTA_BACKEND}`;
}

/**
 * Indica se o endereço detectado tem chance de funcionar num celular
 * físico. A tela de login usa isso para avisar antes de o usuário
 * tentar entrar e receber um erro de rede sem explicação.
 */
export const apiUrlSuspeita = () => {
  const url = descobrirApiUrl();
  // https:// é a API de produção — não há nada suspeito nisso.
  if (url.startsWith('https://')) return false;
  return !IP_LOCAL.test(url);
};

export const API_URL = descobrirApiUrl();

export const tokenStorage = {
  get: () => AsyncStorage.getItem(TOKEN_KEY),
  set: (token) => AsyncStorage.setItem(TOKEN_KEY, token),
  clear: () => AsyncStorage.removeItem(TOKEN_KEY),
};

/** Erro da API, já com status e detalhes por campo. */
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
 * @param {string} path
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {object} [options.body]
 * @param {FormData} [options.formData] - para upload de arquivo
 * @param {boolean} [options.auth=false]
 * @returns {Promise<object>}
 * @throws {ApiError}
 */
async function request(
  path,
  { method = 'GET', body, formData, auth = false } = {}
) {
  // Envio de arquivo ganha muito mais tempo que uma chamada comum.
  const limite = formData ? TIMEOUT_UPLOAD : TIMEOUT;
  const headers = {};

  if (body) headers['Content-Type'] = 'application/json';
  // Com FormData o header Content-Type NÃO deve ser definido: o fetch
  // precisa gerar o boundary do multipart sozinho.

  if (auth) {
    const token = await tokenStorage.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // AbortController cancela a requisição no tempo limite. Sem ele, um
  // servidor inalcançável deixaria a promessa pendurada indefinidamente.
  const controlador = new AbortController();
  const alarme = setTimeout(() => controlador.abort(), limite);

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: formData || (body ? JSON.stringify(body) : undefined),
      signal: controlador.signal,
    });
  } catch (err) {
    const expirou = err.name === 'AbortError';
    // Em produção o usuário é um cidadão na rua: dizer "verifique a porta
    // 3000 no firewall" não ajuda ninguém. Mensagem de desenvolvimento só
    // aparece quando a API é local.
    const ehProducao = API_URL.startsWith('https://');

    let mensagem;
    if (ehProducao) {
      mensagem = expirou
        ? formData
          ? 'O envio da foto demorou demais. Tente de novo com um sinal melhor — sua foto continua salva aqui.'
          : 'O servidor demorou para responder. Verifique sua conexão e tente de novo.'
        : 'Não foi possível conectar. Verifique sua internet e tente de novo.';
    } else {
      mensagem = expirou
        ? `O servidor em ${API_URL} não respondeu em ${limite / 1000}s. ` +
          'Verifique se o backend está rodando e se a porta 3000 está liberada no firewall.'
        : `Não consegui falar com o servidor em ${API_URL}. ` +
          'Verifique se o backend está rodando e se o celular está no mesmo Wi-Fi.';
    }

    throw new ApiError(mensagem, 0);
  } finally {
    clearTimeout(alarme);
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
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

/**
 * URL exibível de uma imagem devolvida pela API.
 *
 * Os dois drivers de armazenamento devolvem formatos diferentes:
 *   local → "/uploads/abc.jpg"                    (relativo à API)
 *   S3/R2 → "https://fotos.../denuncias/abc.jpg"  (absoluto)
 *
 * Concatenar a base em cima de uma URL absoluta gera endereço inválido e
 * a imagem simplesmente não carrega.
 *
 * @param {string|null} caminho
 * @returns {string|null}
 */
export function imagemUrl(caminho) {
  if (!caminho) return null;
  if (/^https?:\/\//i.test(caminho)) return caminho;
  return `${API_URL}${caminho}`;
}

export const api = {
  health: () => request('/health'),

  register: (dados) => request('/auth/register', { method: 'POST', body: dados }),

  login: (credenciais) => request('/auth/login', { method: 'POST', body: credenciais }),

  me: () => request('/auth/me', { auth: true }),

  /**
   * Envia a foto e devolve a URL.
   * @param {string} uri - caminho local do arquivo (file://...)
   */
  uploadFoto: (uri) => {
    const formData = new FormData();
    const nome = uri.split('/').pop() || 'foto.jpg';
    const ext = nome.split('.').pop()?.toLowerCase();
    const tipo = ext === 'png' ? 'image/png' : 'image/jpeg';

    formData.append('image', { uri, name: nome, type: tipo });

    return request('/uploads', { method: 'POST', formData, auth: true });
  },

  criarDenuncia: (dados) =>
    request('/complaints', { method: 'POST', body: dados, auth: true }),

  listarDenuncias: (params = '') =>
    request(`/complaints${params}`, { auth: true }),

  /**
   * Denúncias num raio a partir de um ponto.
   * @param {{lat: number, lng: number, radius?: number, category?: string}} p
   */
  proximas: ({ lat, lng, radius = 1000, category }) => {
    const qs = new URLSearchParams({ lat, lng, radius });
    if (category) qs.set('category', category);
    return request(`/map/nearby?${qs}`);
  },
};
