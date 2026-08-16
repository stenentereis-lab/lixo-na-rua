/**
 * Rotas de autenticação.
 *
 * POST /auth/register — cria conta
 * POST /auth/login    — autentica
 * GET  /auth/me       — dados do usuário logado 🔒
 */
const express = require('express');
const bcrypt = require('bcryptjs');

const db = require('../db');
const config = require('../config');
const { ApiError, asyncHandler } = require('../utils/errors');
const { validateRegister, validateLogin } = require('../utils/validators');
const { generateToken, requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

/** Campos do usuário que podem sair na resposta. Nunca inclui password_hash. */
const PUBLIC_FIELDS = 'id, email, nome, role, created_at';

/**
 * POST /auth/register
 * Cria uma conta e já devolve o token, para o usuário não precisar
 * fazer login logo em seguida.
 *
 * @body {string} email
 * @body {string} password - mínimo 8 caracteres
 * @body {string} nome
 * @returns 201 { user, token } | 400 validação | 409 e-mail já cadastrado
 */
router.post(
  '/register',
  rateLimit({ max: 10, windowMs: 60 * 60 * 1000 }),
  asyncHandler(async (req, res) => {
    const { email, password, nome } = validateRegister(req.body);

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

    let result;
    try {
      result = await db.query(
        `INSERT INTO users (email, password_hash, nome)
         VALUES ($1, $2, $3)
         RETURNING ${PUBLIC_FIELDS}`,
        [email, passwordHash, nome]
      );
    } catch (err) {
      // 23505 = unique_violation. Deixar o banco decidir evita a condição de
      // corrida que existiria em "SELECT antes, INSERT depois".
      if (err.code === '23505' || /unique/i.test(err.message || '')) {
        throw new ApiError(409, 'Este e-mail já está cadastrado');
      }
      throw err;
    }

    const user = result.rows[0];
    res.status(201).json({ user, token: generateToken(user) });
  })
);

/**
 * POST /auth/login
 *
 * @body {string} email
 * @body {string} password
 * @returns 200 { user, token } | 400 validação | 401 credenciais | 429 excesso
 */
router.post(
  '/login',
  rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }),
  asyncHandler(async (req, res) => {
    const { email, password } = validateLogin(req.body);

    const { rows } = await db.query(
      `SELECT ${PUBLIC_FIELDS}, password_hash FROM users WHERE email = $1`,
      [email]
    );

    const user = rows[0];

    // Mesmo erro para e-mail inexistente e senha errada: mensagens distintas
    // permitiriam descobrir quais e-mails estão cadastrados.
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      throw new ApiError(401, 'E-mail ou senha inválidos');
    }

    delete user.password_hash;
    res.json({ user, token: generateToken(user) });
  })
);

/**
 * GET /auth/me  🔒
 * Devolve o usuário do token. Útil para o app restaurar a sessão ao abrir.
 *
 * @returns 200 { user } | 401 token ausente/inválido | 404 conta removida
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      // Token válido de conta que não existe mais.
      throw new ApiError(404, 'Usuário não encontrado');
    }

    res.json({ user: rows[0] });
  })
);

module.exports = router;
