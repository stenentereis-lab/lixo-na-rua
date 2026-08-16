/**
 * Altera o papel de uma conta existente.
 *
 * Promover a admin é operação administrativa, não funcionalidade do app:
 * exige acesso ao servidor, não passa pela API. Por isso não existe rota
 * HTTP equivalente — ela seria alvo óbvio de ataque.
 *
 * Uso:
 *   npm run set-role -- voce@exemplo.com admin
 *   npm run set-role -- fulano@exemplo.com moderator
 *   npm run set-role -- fulano@exemplo.com user
 *
 * O `--` é necessário para o npm repassar os argumentos ao script.
 */
require('dotenv').config();
const { Pool } = require('pg');

const PAPEIS = ['user', 'moderator', 'admin'];

const [, , emailArg, papel] = process.argv;
const email = String(emailArg || '').trim().toLowerCase();

if (!email || !papel) {
  console.error('Uso: npm run set-role -- <email> <papel>');
  console.error(`Papéis: ${PAPEIS.join(', ')}`);
  process.exit(1);
}

if (!PAPEIS.includes(papel)) {
  console.error(`Papel inválido: "${papel}"`);
  console.error(`Use um destes: ${PAPEIS.join(', ')}`);
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  const { rows } = await pool.query(
    `UPDATE users
        SET role = $2
      WHERE email = $1
      RETURNING id, email, nome, role`,
    [email, papel]
  );

  if (rows.length === 0) {
    console.error(`Nenhuma conta encontrada com o e-mail "${email}".`);
    console.error('Cadastre-se pelo app primeiro, depois rode este comando.');
    process.exit(1);
  }

  const u = rows[0];
  console.log(`✅ ${u.nome} <${u.email}> agora é "${u.role}".`);
  console.log('   Saia e entre novamente no app para o token refletir o novo papel.');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    if (err.code === 'ECONNREFUSED') {
      console.error('Não consegui conectar no banco. O Postgres está rodando?');
      console.error('  cd C:\\lixo-na-rua && docker compose up -d postgres');
    } else {
      console.error('Erro:', err.message);
    }
    pool.end();
    process.exit(1);
  });
