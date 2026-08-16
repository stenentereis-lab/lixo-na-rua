/**
 * Executor de migrations.
 *
 * Roda, em ordem alfabética, todo arquivo .sql desta pasta que ainda não
 * tenha sido aplicado. O controle é feito pela tabela `schema_migrations`.
 *
 * Uso: npm run migrate
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`   já aplicada: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const client = await pool.connect();

    try {
      // Cada migration roda numa transação: ou aplica inteira, ou nada.
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
        file,
      ]);
      await client.query('COMMIT');
      console.log(`✅ aplicada:    ${file}`);
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ falhou:      ${file}`);
      console.error(`   ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(
    count === 0
      ? '\nBanco já estava atualizado.'
      : `\n${count} migration(s) aplicada(s).`
  );
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('\nMigration interrompida.');
    if (err.code === 'ECONNREFUSED') {
      console.error(
        'Não consegui conectar no banco. O Postgres está rodando?\n' +
          '  cd C:\\lixo-na-rua && docker compose up -d postgres'
      );
    }
    pool.end();
    process.exit(1);
  });
