/**
 * Armazenamento em disco local.
 *
 * Padrão em desenvolvimento. Em produção use o driver S3 — disco de
 * container é efêmero e não é compartilhado entre instâncias.
 * Ver docs/DECISOES.md #018.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

/** Extensão a partir do tipo MIME. */
const EXTENSAO = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

/**
 * Grava a imagem e devolve a referência.
 *
 * @param {Buffer} buffer
 * @param {object} opcoes
 * @param {string} opcoes.mimetype
 * @returns {Promise<{ key: string, url: string, size: number }>}
 */
async function salvar(buffer, { mimetype }) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // Nome aleatório: usar o nome enviado pelo cliente permitiria
  // sobrescrever arquivos de outros usuários e path traversal.
  const key = `${crypto.randomUUID()}${EXTENSAO[mimetype] || '.jpg'}`;

  await fs.writeFile(path.join(UPLOAD_DIR, key), buffer);

  return { key, url: `/uploads/${key}`, size: buffer.length };
}

/**
 * Remove uma imagem. Não falha se o arquivo já não existir.
 * @param {string} key
 */
async function remover(key) {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(key)));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

module.exports = { salvar, remover, UPLOAD_DIR, nome: 'local' };
