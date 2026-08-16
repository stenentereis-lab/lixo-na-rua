/**
 * Armazenamento em S3 ou compatível.
 *
 * Funciona com AWS S3 e com qualquer serviço que fale o mesmo protocolo —
 * Cloudflare R2, Backblaze B2, DigitalOcean Spaces, MinIO. Basta apontar
 * `S3_ENDPOINT` para o provedor escolhido.
 *
 * Para um app cívico, R2 e B2 costumam sair bem mais barato que a AWS
 * porque não cobram transferência de saída. Ver docs/DEPLOY.md.
 */
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const config = require('../config');

const EXTENSAO = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

let cliente;

/** Cria o cliente sob demanda, para o driver local não pagar esse custo. */
function obterCliente() {
  if (cliente) return cliente;

  cliente = new S3Client({
    region: config.s3.region,
    // endpoint vazio = AWS S3; preenchido = provedor compatível
    ...(config.s3.endpoint ? { endpoint: config.s3.endpoint } : {}),
    // Provedores compatíveis exigem path-style; a AWS usa virtual-hosted.
    forcePathStyle: Boolean(config.s3.endpoint),
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
  });

  return cliente;
}

/**
 * Envia a imagem e devolve a referência.
 *
 * @param {Buffer} buffer
 * @param {object} opcoes
 * @param {string} opcoes.mimetype
 * @returns {Promise<{ key: string, url: string, size: number }>}
 */
async function salvar(buffer, { mimetype }) {
  const key = `denuncias/${crypto.randomUUID()}${EXTENSAO[mimetype] || '.jpg'}`;

  await obterCliente().send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      // Cache longo: o conteúdo nunca muda, já que a chave é aleatória.
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return { key, url: urlPublica(key), size: buffer.length };
}

/**
 * URL pública do objeto.
 *
 * `S3_PUBLIC_URL` permite servir por CDN ou domínio próprio em vez do
 * endereço bruto do bucket.
 *
 * @param {string} key
 * @returns {string}
 */
function urlPublica(key) {
  if (config.s3.publicUrl) {
    return `${config.s3.publicUrl.replace(/\/$/, '')}/${key}`;
  }
  if (config.s3.endpoint) {
    return `${config.s3.endpoint.replace(/\/$/, '')}/${config.s3.bucket}/${key}`;
  }
  return `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
}

/** @param {string} key */
async function remover(key) {
  await obterCliente().send(
    new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key })
  );
}

module.exports = { salvar, remover, urlPublica, nome: 's3' };
