/**
 * Pool de conexões com o PostgreSQL.
 *
 * Todo acesso ao banco passa por aqui, o que dá um ponto único para
 * instrumentar e permite trocar a implementação nos testes.
 */
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

pool.on('error', (err) => {
  // Erro num cliente ocioso do pool. Sem esse handler o processo cai.
  console.error('Erro inesperado no pool do Postgres:', err.message);
});

/**
 * Executa uma query parametrizada.
 *
 * Sempre use placeholders ($1, $2...) — nunca concatene valores na string,
 * sob risco de SQL injection.
 *
 * @param {string} text - SQL com placeholders
 * @param {Array}  [params] - Valores dos placeholders
 * @returns {Promise<import('pg').QueryResult>}
 *
 * @example
 * const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
 */
function query(text, params) {
  return pool.query(text, params);
}

/** Verifica se o banco responde. Usado pelo /health. */
async function isHealthy() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

module.exports = { pool, query, isHealthy };
