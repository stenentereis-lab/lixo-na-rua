/**
 * Rotas de denúncias.
 *
 * POST   /complaints      — cria 🔒
 * GET    /complaints      — lista paginada
 * GET    /complaints/:id  — detalhe
 */
const express = require('express');

const db = require('../db');
const { ApiError, asyncHandler } = require('../utils/errors');
const {
  validateComplaint,
  validatePagination,
  validateModeration,
  CATEGORIAS,
  STATUS,
} = require('../utils/validators');
const {
  requireAuth,
  optionalAuth,
  requireRole,
} = require('../middleware/auth');

const router = express.Router();

/**
 * Colunas devolvidas pela API.
 *
 * `location_geom` fica de fora de propósito: é derivada de lat/lng por
 * trigger e o formato binário do PostGIS não serve para o cliente.
 */
const CAMPOS = `
  id, user_id, title, description,
  latitude, longitude, accuracy_meters, image_url,
  status, category, created_at, updated_at
`;

/** Formato UUID, para rejeitar `/complaints/abc` antes de ir ao banco. */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /complaints  🔒
 * Registra uma denúncia.
 *
 * O `user_id` vem do token, nunca do corpo — aceitá-lo do cliente
 * permitiria criar denúncia no nome de outra pessoa.
 *
 * @body {string} title
 * @body {string} [description]
 * @body {number} latitude  - -90 a 90
 * @body {number} longitude - -180 a 180
 * @body {string} [category='trash']
 * @body {string} [image_url]
 * @returns 201 { complaint } | 400 validação | 401
 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const dados = validateComplaint(req.body);

    const { rows } = await db.query(
      `INSERT INTO complaints
         (user_id, title, description, latitude, longitude,
          accuracy_meters, category, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${CAMPOS}`,
      [
        req.user.id,
        dados.title,
        dados.description,
        dados.latitude,
        dados.longitude,
        dados.accuracy_meters,
        dados.category,
        dados.image_url,
      ]
    );

    res.status(201).json({ complaint: rows[0] });
  })
);

/**
 * GET /complaints
 * Lista denúncias, mais recentes primeiro.
 *
 * @query {number} [page=1]
 * @query {number} [limit=20]  - teto de 100
 * @query {string} [status]
 * @query {string} [category]
 * @query {string} [mine]      - 'true' devolve só as do usuário logado 🔒
 * @returns 200 { data, page, limit, total }
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = validatePagination(req.query);

    // Filtros montados dinamicamente, sempre com placeholders — nunca
    // concatenando valor na string, para não abrir SQL injection.
    const where = [];
    const params = [];

    if (req.query.status) {
      if (!STATUS.includes(req.query.status)) {
        throw new ApiError(400, `Status inválido. Use: ${STATUS.join(', ')}`);
      }
      params.push(req.query.status);
      where.push(`status = $${params.length}`);
    }

    if (req.query.category) {
      if (!CATEGORIAS.includes(req.query.category)) {
        throw new ApiError(
          400,
          `Categoria inválida. Use: ${CATEGORIAS.join(', ')}`
        );
      }
      params.push(req.query.category);
      where.push(`category = $${params.length}`);
    }

    if (req.query.mine === 'true') {
      if (!req.user) {
        throw new ApiError(401, 'Faça login para ver suas denúncias');
      }
      params.push(req.user.id);
      where.push(`user_id = $${params.length}`);
    }

    // Filtro por confiabilidade da coordenada. Denúncias sem o dado ficam
    // de fora: não dá para afirmar que são precisas.
    if (req.query.max_accuracy) {
      const limite = Number(req.query.max_accuracy);
      if (!Number.isFinite(limite) || limite <= 0) {
        throw new ApiError(400, 'max_accuracy deve ser um número maior que zero');
      }
      params.push(limite);
      where.push(`accuracy_meters IS NOT NULL AND accuracy_meters <= $${params.length}`);
    }

    const clausula = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = await db.query(
      `SELECT COUNT(*)::int AS total FROM complaints ${clausula}`,
      params
    );

    const { rows } = await db.query(
      `SELECT ${CAMPOS}
         FROM complaints
         ${clausula}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ data: rows, page, limit, total: total.rows[0].total });
  })
);

/**
 * GET /complaints/:id
 *
 * @returns 200 { complaint } | 400 id malformado | 404
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!UUID_REGEX.test(req.params.id)) {
      // Sem essa checagem o Postgres devolveria erro de cast como 500.
      throw new ApiError(400, 'Identificador inválido');
    }

    const { rows } = await db.query(
      `SELECT ${CAMPOS} FROM complaints WHERE id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Denúncia não encontrada');
    }

    res.json({ complaint: rows[0] });
  })
);

/**
 * PATCH /complaints/:id  🔒 moderator | admin
 * Muda o status de uma denúncia e registra quem decidiu.
 *
 * @body {string} status - novo status; transições em utils/validators
 * @body {string} [motivo] - obrigatório quando status = 'rejected'
 * @returns 200 { complaint } | 400 transição inválida | 403 | 404
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole('moderator', 'admin'),
  asyncHandler(async (req, res) => {
    if (!UUID_REGEX.test(req.params.id)) {
      throw new ApiError(400, 'Identificador inválido');
    }

    const atual = await db.query(
      'SELECT status FROM complaints WHERE id = $1',
      [req.params.id]
    );

    if (atual.rows.length === 0) {
      throw new ApiError(404, 'Denúncia não encontrada');
    }

    const statusAntes = atual.rows[0].status;
    const { status, motivo } = validateModeration(req.body, statusAntes);

    // A mudança e o registro de auditoria precisam acontecer juntos: uma
    // denúncia com status novo e sem histórico seria uma decisão sem autor.
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `UPDATE complaints SET status = $2 WHERE id = $1
         RETURNING ${CAMPOS}`,
        [req.params.id, status]
      );

      await client.query(
        `INSERT INTO moderations
           (complaint_id, moderator_id, status_antes, status_depois, motivo)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, req.user.id, statusAntes, status, motivo]
      );

      await client.query('COMMIT');
      res.json({ complaint: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

/**
 * GET /complaints/:id/moderations  🔒 moderator | admin
 * Histórico de decisões sobre uma denúncia.
 *
 * @returns 200 { data } | 400 | 403
 */
router.get(
  '/:id/moderations',
  requireAuth,
  requireRole('moderator', 'admin'),
  asyncHandler(async (req, res) => {
    if (!UUID_REGEX.test(req.params.id)) {
      throw new ApiError(400, 'Identificador inválido');
    }

    const { rows } = await db.query(
      `SELECT m.id, m.status_antes, m.status_depois, m.motivo, m.created_at,
              u.nome AS moderador_nome
         FROM moderations m
         LEFT JOIN users u ON u.id = m.moderator_id
        WHERE m.complaint_id = $1
        ORDER BY m.created_at DESC`,
      [req.params.id]
    );

    res.json({ data: rows });
  })
);

/**
 * DELETE /complaints/:id  🔒
 * Remove uma denúncia. O autor pode remover a própria; admin pode remover
 * qualquer uma.
 *
 * @returns 204 | 400 | 403 | 404
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!UUID_REGEX.test(req.params.id)) {
      throw new ApiError(400, 'Identificador inválido');
    }

    const { rows } = await db.query(
      'SELECT user_id FROM complaints WHERE id = $1',
      [req.params.id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Denúncia não encontrada');
    }

    const ehDono = rows[0].user_id === req.user.id;
    const ehAdmin = req.user.role === 'admin';

    if (!ehDono && !ehAdmin) {
      throw new ApiError(403, 'Você só pode remover suas próprias denúncias');
    }

    await db.query('DELETE FROM complaints WHERE id = $1', [req.params.id]);
    res.status(204).end();
  })
);

module.exports = router;
