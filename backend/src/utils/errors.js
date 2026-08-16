/**
 * Erro com status HTTP associado.
 *
 * Lançar `new ApiError(400, 'mensagem')` em qualquer ponto faz o middleware
 * de erro responder com o status e a mensagem corretos, sem precisar passar
 * o `res` adiante.
 */
class ApiError extends Error {
  /**
   * @param {number} status - Código HTTP
   * @param {string} message - Mensagem exibida ao cliente
   * @param {object} [details] - Detalhes extras (ex.: erros por campo)
   */
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (details) this.details = details;
  }
}

/**
 * Envolve um handler assíncrono para que rejeições de promise cheguem ao
 * middleware de erro. Sem isso, um `await` que falha derruba a requisição
 * em timeout silencioso.
 *
 * @param {Function} handler
 * @returns {Function}
 *
 * @example
 * router.post('/login', asyncHandler(async (req, res) => { ... }));
 */
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = { ApiError, asyncHandler };
