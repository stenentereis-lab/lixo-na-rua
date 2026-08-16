/**
 * Tratamento centralizado de erros.
 *
 * Deve ser o ÚLTIMO middleware registrado — o Express só entrega o erro a
 * handlers de 4 argumentos posicionados depois das rotas.
 */
const config = require('../config');

/** Rota inexistente. Registrar depois de todas as rotas. */
function notFound(req, res) {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
}

/* eslint-disable no-unused-vars */
/**
 * Converte qualquer erro em resposta JSON consistente.
 *
 * O 4º parâmetro (`next`) é obrigatório: é ele que faz o Express reconhecer
 * a função como handler de erro, mesmo sem ser usado.
 */
function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  // 5xx é falha nossa e precisa aparecer no log. 4xx é erro do cliente,
  // esperado, e só polui a saída.
  if (status >= 500) {
    console.error(`[${req.method} ${req.path}]`, err);
  }

  const body = {
    error:
      status >= 500 && config.isProduction
        ? 'Erro interno do servidor' // não vazar detalhe interno em produção
        : err.message || 'Erro interno do servidor',
  };

  if (err.details) body.details = err.details;
  if (status >= 500 && !config.isProduction) body.stack = err.stack;

  res.status(status).json(body);
}
/* eslint-enable no-unused-vars */

module.exports = { notFound, errorHandler };
