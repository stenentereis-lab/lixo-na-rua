/**
 * Autenticação e autorização por JWT.
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { ApiError } = require('../utils/errors');
const db = require('../db');
const { hasCurrentAcceptance } = require('../legal');

/**
 * Gera o token de acesso de um usuário.
 *
 * O payload carrega só id e role. Nada sensível: o conteúdo do JWT é
 * apenas assinado, não criptografado — qualquer um consegue lê-lo.
 *
 * @param {{ id: string, role: string }} user
 * @returns {string} JWT assinado
 */
function generateToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiry,
  });
}

/**
 * Middleware: exige token válido.
 *
 * Preenche `req.user = { id, role }` quando o token confere.
 *
 * @throws {ApiError} 401 se o token estiver ausente, malformado ou expirado
 *
 * @example
 * router.get('/me', requireAuth, (req, res) => res.json(req.user));
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Token de acesso não fornecido'));
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Sessão expirada. Faça login novamente.'
        : 'Token inválido';
    next(new ApiError(401, message));
  }
}

/**
 * Middleware: autentica se houver token, mas não bloqueia se não houver.
 *
 * Para rotas públicas que se comportam de forma diferente para quem está
 * logado — a listagem de denúncias, por exemplo, aceita `?mine=true`.
 * Token inválido é tratado como ausente: quem não mandou credencial não
 * deve receber erro numa rota pública.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // Silencioso de propósito — ver comentário acima.
    }
  }

  next();
}

/**
 * Middleware: exige que o usuário tenha um dos papéis informados.
 * Use sempre depois de `requireAuth`.
 *
 * @param {...string} roles - Papéis permitidos
 *
 * @example
 * router.post('/moderate', requireAuth, requireRole('moderator', 'admin'), handler);
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Não autenticado'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Você não tem permissão para esta ação'));
    }
    next();
  };
}

/** Impede uso autenticado enquanto os documentos vigentes não forem aceitos. */
async function requireLegalAcceptance(req, res, next) {
  try {
    if (!req.user || !(await hasCurrentAcceptance(db, req.user.id))) {
      return next(
        new ApiError(403, 'Aceite os Termos de Uso e a Política de Privacidade para continuar', {
          legal_acceptance_required: true,
        })
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateToken,
  requireAuth,
  optionalAuth,
  requireRole,
  requireLegalAcceptance,
};
