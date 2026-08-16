/**
 * Ponto de entrada do servidor.
 *
 * A construção do app fica em app.js; aqui só sobe a porta e cuida do
 * encerramento limpo.
 */
const app = require('./app');
const config = require('./config');
const db = require('./db');

const server = app.listen(config.port, async () => {
  console.log(`✅ Server running on http://localhost:${config.port}`);

  const dbOk = await db.isHealthy();
  if (dbOk) {
    console.log('✅ Database connected');
  } else {
    console.error('❌ Database indisponível.');
    console.error('   O Postgres está rodando? cd C:\\lixo-na-rua && docker compose up -d postgres');
    console.error('   Depois digite "rs" aqui para reiniciar.');
  }
});

/**
 * Encerramento limpo: para de aceitar conexões novas, termina as em
 * andamento e só então fecha o pool do banco.
 */
function shutdown(signal) {
  console.log(`\n${signal} recebido, encerrando...`);
  server.close(async () => {
    await db.pool.end();
    console.log('Encerrado.');
    process.exit(0);
  });

  // Se algo travar, não fica pendurado para sempre.
  setTimeout(() => {
    console.error('Encerramento forçado após timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
