/**
 * Configuração central, lida do ambiente.
 *
 * Falha cedo e com mensagem clara se algo essencial estiver faltando —
 * melhor quebrar no boot do que produzir erro obscuro em runtime.
 */
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

const DEFAULT_DEV_SECRET = 'dev_secret_change_in_prod_12345';
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error(
    'JWT_SECRET não definido. Copie backend/.env.example para backend/.env.'
  );
}

if (isProduction && jwtSecret === DEFAULT_DEV_SECRET) {
  throw new Error(
    'JWT_SECRET ainda é o valor de desenvolvimento. Gere um segredo aleatório antes de subir para produção.'
  );
}

module.exports = {
  env,
  isProduction,
  isTest: env === 'test',
  port: Number(process.env.PORT) || 3000,

  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },

  jwt: {
    secret: jwtSecret,
    expiry: process.env.JWT_EXPIRY || '7d',
  },

  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : '*',

  /** Custo do bcrypt. 10 é o equilíbrio usual entre segurança e latência. */
  bcryptRounds: 10,
};
