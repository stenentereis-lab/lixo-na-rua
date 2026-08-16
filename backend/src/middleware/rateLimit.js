/**
 * Limitador de tentativas, em memória.
 *
 * Protege o login contra força bruta. Simples de propósito, sem dependência
 * externa.
 *
 * ⚠️ Limitação conhecida: o contador vive na memória do processo. Com mais de
 * uma instância da API, cada uma terá o seu. Ao escalar horizontalmente,
 * troque por um contador no Redis (o serviço já está no docker-compose).
 */
const { ApiError } = require('../utils/errors');
const config = require('../config');

/**
 * @param {object}  [options]
 * @param {number}  [options.max=10]      Tentativas permitidas na janela
 * @param {number}  [options.windowMs=900000] Tamanho da janela (padrão 15 min)
 * @param {string}  [options.message]     Mensagem do erro 429
 * @param {boolean} [options.enabled]     Padrão: ligado, exceto em teste
 * @returns {Function} middleware do Express
 *
 * @example
 * router.post('/login', rateLimit({ max: 5 }), handler);
 */
function rateLimit({
  max = 10,
  windowMs = 15 * 60 * 1000,
  message = 'Muitas tentativas. Tente novamente em alguns minutos.',
  // Desligado por padrão em teste: a suíte dispara dezenas de requisições
  // do mesmo IP e seria bloqueada. O middleware tem teste próprio, que
  // passa `enabled: true` explicitamente.
  enabled = !config.isTest,
} = {}) {
  if (!enabled) {
    return (req, res, next) => next();
  }

  /** @type {Map<string, { count: number, resetAt: number }>} */
  const hits = new Map();

  // Limpeza periódica para a Map não crescer sem limite.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);

  // Não segura o processo aberto (importante para o Jest encerrar).
  if (typeof cleanup.unref === 'function') cleanup.unref();

  return (req, res, next) => {
    const key = req.ip || 'desconhecido';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;

    if (entry.count > max) {
      const segundos = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(segundos));
      return next(new ApiError(429, message));
    }

    next();
  };
}

module.exports = { rateLimit };
