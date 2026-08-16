/**
 * Seleciona o driver de armazenamento.
 *
 * As rotas conversam com esta interface e não sabem onde o arquivo é
 * gravado. Trocar disco local por S3 é mudar variável de ambiente, sem
 * tocar em código — foi o que permitiu adiar a decisão de nuvem sem
 * criar dívida no código. Ver docs/DECISOES.md #018.
 *
 * Interface do driver:
 *   salvar(buffer, { mimetype }) -> { key, url, size }
 *   remover(key)                 -> void
 */
const config = require('../config');

const local = require('./local');

/** @type {typeof local} */
let driver;

if (config.storage.driver === 's3') {
  // Carregado só quando escolhido: o SDK da AWS é pesado e não faz
  // sentido inicializá-lo em desenvolvimento com disco local.
  driver = require('./s3');
} else {
  driver = local;
}

module.exports = driver;
