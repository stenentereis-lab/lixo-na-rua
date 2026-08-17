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

  storage: {
    /** 'local' (disco) ou 's3' (S3 ou compatível) */
    driver: process.env.STORAGE_DRIVER || 'local',
    /** Tamanho máximo de imagem aceito, em bytes. */
    maxFileSize: Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  },

  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || 'us-east-1',
    /** Vazio = AWS. Preenchido = R2, B2, Spaces, MinIO... */
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    /** Domínio próprio ou CDN na frente do bucket. */
    publicUrl: process.env.S3_PUBLIC_URL,
  },
};

// Falha no boot em vez de descobrir só no primeiro upload que falta credencial.
if (module.exports.storage.driver === 's3') {
  const faltando = ['bucket', 'accessKeyId', 'secretAccessKey'].filter(
    (k) => !module.exports.s3[k]
  );

  if (faltando.length > 0) {
    throw new Error(
      `STORAGE_DRIVER=s3 exige as variáveis: ${faltando
        .map((k) => `S3_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`)
        .join(', ')}. Veja docs/DEPLOY.md.`
    );
  }

  // Valores de exemplo não substituídos. Sem esta checagem, o backend sobe
  // normalmente e só quebra no primeiro upload de um usuário real — com
  // erro 500 genérico, que não diz nada a quem está na rua tentando
  // denunciar. Aconteceu em produção com <account-id> literal.
  const comExemplo = Object.entries(module.exports.s3)
    .filter(([, v]) => typeof v === 'string' && /[<>]/.test(v))
    .map(([k]) => k);

  if (comExemplo.length > 0) {
    throw new Error(
      `Valores de exemplo não substituídos em: ${comExemplo.join(', ')}. ` +
        'Troque os trechos entre < > pelos valores reais. Veja docs/DEPLOY.md.'
    );
  }

  // Endpoint precisa ser URL válida antes de o SDK tentar usá-lo.
  if (module.exports.s3.endpoint) {
    try {
      new URL(module.exports.s3.endpoint);
    } catch {
      throw new Error(
        `S3_ENDPOINT não é uma URL válida: "${module.exports.s3.endpoint}"`
      );
    }
  }

  if (module.exports.s3.publicUrl) {
    try {
      new URL(module.exports.s3.publicUrl);
    } catch {
      throw new Error(
        `S3_PUBLIC_URL não é uma URL válida: "${module.exports.s3.publicUrl}"`
      );
    }
  }
}

if (isProduction && module.exports.storage.driver === 'local') {
  console.warn(
    '⚠️  STORAGE_DRIVER=local em produção: disco de container é efêmero e\n' +
      '   as fotos serão perdidas no próximo deploy. Ver docs/DEPLOY.md.'
  );
}
