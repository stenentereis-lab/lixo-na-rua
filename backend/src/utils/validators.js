/**
 * Validação de entrada.
 *
 * Toda validação acontece no servidor. Validação no cliente é conveniência
 * para o usuário, não barreira de segurança — o cliente pode ser burlado.
 */
const { ApiError } = require('./errors');

/** Formato de e-mail. Deliberadamente permissivo: a verificação real é o envio. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128; // bcrypt trunca em 72 bytes; barrar antes evita surpresa
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MAX_NOME_LENGTH = 120;

/**
 * Normaliza e-mail para comparação: minúsculo e sem espaços nas pontas.
 * "  Maria@Example.COM " -> "maria@example.com"
 *
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Valida o corpo do cadastro.
 *
 * @param {object} body
 * @returns {{ email: string, password: string, nome: string }} dados normalizados
 * @throws {ApiError} 400 com `details` por campo
 */
function validateRegister(body = {}) {
  const errors = {};

  const email = normalizeEmail(body.email);
  if (!email) errors.email = 'E-mail é obrigatório';
  else if (email.length > MAX_EMAIL_LENGTH) errors.email = 'E-mail muito longo';
  else if (!EMAIL_REGEX.test(email)) errors.email = 'E-mail inválido';

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) errors.password = 'Senha é obrigatória';
  else if (password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`;
  else if (password.length > MAX_PASSWORD_LENGTH)
    errors.password = 'Senha muito longa';

  const nome = String(body.nome || '').trim();
  if (!nome) errors.nome = 'Nome é obrigatório';
  else if (nome.length > MAX_NOME_LENGTH) errors.nome = 'Nome muito longo';

  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, 'Dados inválidos', errors);
  }

  return { email, password, nome };
}

/**
 * Valida o corpo do login.
 *
 * Não verifica tamanho de senha aqui: regra de força só vale no cadastro.
 * Aplicá-la no login vazaria informação sobre senhas antigas.
 *
 * @param {object} body
 * @returns {{ email: string, password: string }}
 * @throws {ApiError} 400
 */
function validateLogin(body = {}) {
  const errors = {};

  const email = normalizeEmail(body.email);
  if (!email) errors.email = 'E-mail é obrigatório';

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) errors.password = 'Senha é obrigatória';

  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, 'Dados inválidos', errors);
  }

  return { email, password };
}

const CATEGORIAS = ['trash', 'debris', 'sewage', 'other'];
const STATUS = ['reported', 'validated', 'resolved', 'rejected'];

const MAX_TITLE_LENGTH = 140;
const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * Converte para número aceitando string.
 * O `multipart/form-data` entrega tudo como texto, então "-15.79" precisa
 * virar número antes de validar.
 *
 * @param {*} valor
 * @returns {number|null} null se não for número finito
 */
function toNumber(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * Valida o corpo de criação de denúncia.
 *
 * @param {object} body
 * @returns {{title, description, latitude, longitude, category, image_url}}
 * @throws {ApiError} 400 com `details` por campo
 */
function validateComplaint(body = {}) {
  const errors = {};

  const title = String(body.title || '').trim();
  if (!title) errors.title = 'Título é obrigatório';
  else if (title.length > MAX_TITLE_LENGTH)
    errors.title = `Título deve ter no máximo ${MAX_TITLE_LENGTH} caracteres`;

  const description = String(body.description || '').trim();
  if (description.length > MAX_DESCRIPTION_LENGTH)
    errors.description = `Descrição deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres`;

  // Coordenada 0 é válida (golfo da Guiné), então testamos por null,
  // não por valor falsy — `if (!latitude)` rejeitaria o zero.
  const latitude = toNumber(body.latitude);
  if (latitude === null) errors.latitude = 'Latitude é obrigatória';
  else if (latitude < -90 || latitude > 90)
    errors.latitude = 'Latitude deve estar entre -90 e 90';

  const longitude = toNumber(body.longitude);
  if (longitude === null) errors.longitude = 'Longitude é obrigatória';
  else if (longitude < -180 || longitude > 180)
    errors.longitude = 'Longitude deve estar entre -180 e 180';

  const category = String(body.category || 'trash').trim();
  if (!CATEGORIAS.includes(category))
    errors.category = `Categoria inválida. Use: ${CATEGORIAS.join(', ')}`;

  const imageUrl = String(body.image_url || '').trim();

  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, 'Dados inválidos', errors);
  }

  return {
    title,
    description: description || null,
    latitude,
    longitude,
    category,
    image_url: imageUrl || null,
  };
}

/**
 * Valida e normaliza parâmetros de paginação.
 *
 * @param {object} query
 * @returns {{ page: number, limit: number, offset: number }}
 */
function validatePagination(query = {}) {
  const page = Math.max(1, toNumber(query.page) || 1);
  // Teto de 100: sem limite, um cliente poderia pedir a tabela inteira.
  const limit = Math.min(100, Math.max(1, toNumber(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = {
  normalizeEmail,
  validateRegister,
  validateLogin,
  validateComplaint,
  validatePagination,
  toNumber,
  MIN_PASSWORD_LENGTH,
  CATEGORIAS,
  STATUS,
};
