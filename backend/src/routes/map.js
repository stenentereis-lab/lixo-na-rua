/**
 * Endpoints geográficos.
 *
 * GET /map/nearby   — denúncias num raio a partir de um ponto
 * GET /map/geojson  — FeatureCollection para desenhar no mapa
 * GET /map/stats    — números agregados para o painel
 *
 * É aqui que o PostGIS paga o investimento: as três rotas dependem do
 * índice GIST em `location_geom` para responder rápido conforme a base
 * cresce. Ver docs/DECISOES.md #001.
 */
const express = require('express');

const db = require('../db');
const { asyncHandler } = require('../utils/errors');
const {
  validateNearby,
  validateBbox,
  validatePagination,
  CATEGORIAS,
  STATUS,
} = require('../utils/validators');

const router = express.Router();

/**
 * Monta os filtros opcionais de status e categoria.
 *
 * @param {object} query - req.query
 * @param {Array} params - array de parâmetros, alterado no lugar
 * @returns {string[]} condições SQL já com placeholders
 */
function filtrosOpcionais(query, params) {
  const where = [];

  if (query.status && STATUS.includes(query.status)) {
    params.push(query.status);
    where.push(`status = $${params.length}`);
  }
  if (query.category && CATEGORIAS.includes(query.category)) {
    params.push(query.category);
    where.push(`category = $${params.length}`);
  }

  return where;
}

/**
 * GET /map/nearby
 * Denúncias dentro de um raio, da mais próxima para a mais distante.
 *
 * @query {number} lat    - obrigatório
 * @query {number} lng    - obrigatório
 * @query {number} radius - metros, padrão 1000, máximo 50000
 * @query {string} [status]
 * @query {string} [category]
 * @query {number} [limit=100]
 * @returns 200 { data, center, radius, total }
 *
 * @example
 * GET /map/nearby?lat=-15.7942&lng=-48.0192&radius=500
 */
router.get(
  '/nearby',
  asyncHandler(async (req, res) => {
    const { lat, lng, radius } = validateNearby(req.query);
    const { limit } = validatePagination({ limit: req.query.limit || 100 });

    // ST_DWithin com geography calcula em metros sobre o elipsoide e é a
    // única forma que usa o índice GIST. Comparar ST_Distance num WHERE
    // forçaria varredura completa da tabela.
    const params = [lng, lat, radius];
    const where = [
      `ST_DWithin(
         location_geom::geography,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         $3
       )`,
      ...filtrosOpcionais(req.query, params),
    ];

    params.push(limit);

    const { rows } = await db.query(
      `SELECT id, user_id, title, description,
              latitude, longitude, image_url, status, category,
              created_at,
              ROUND(
                ST_Distance(
                  location_geom::geography,
                  ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                )::numeric
              )::int AS distance_meters
         FROM complaints
        WHERE ${where.join(' AND ')}
        ORDER BY distance_meters ASC
        LIMIT $${params.length}`,
      params
    );

    res.json({
      data: rows,
      center: { latitude: lat, longitude: lng },
      radius,
      total: rows.length,
    });
  })
);

/**
 * GET /map/geojson
 * Devolve uma FeatureCollection, formato que Leaflet, Mapbox e OpenLayers
 * consomem direto, sem conversão no cliente.
 *
 * @query {string} [bbox] - "oeste,sul,leste,norte"; sem ela, devolve tudo
 * @query {string} [status]
 * @query {string} [category]
 * @query {number} [limit=1000]
 * @returns 200 FeatureCollection
 */
router.get(
  '/geojson',
  asyncHandler(async (req, res) => {
    const bbox = validateBbox(req.query.bbox);
    const limite = Math.min(5000, Number(req.query.limit) || 1000);

    const params = [];
    const where = [];

    if (bbox) {
      // ST_MakeEnvelope monta o retângulo visível; && é o operador de
      // interseção que usa o índice espacial.
      params.push(bbox.oeste, bbox.sul, bbox.leste, bbox.norte);
      where.push(
        `location_geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)`
      );
    }

    where.push(...filtrosOpcionais(req.query, params));
    params.push(limite);

    const clausula = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT id, title, description, latitude, longitude,
              image_url, status, category, created_at
         FROM complaints
         ${clausula}
        ORDER BY created_at DESC
        LIMIT $${params.length}`,
      params
    );

    // Montamos o GeoJSON na aplicação em vez de usar ST_AsGeoJSON: o
    // resultado é o mesmo e evita converter texto de volta para objeto.
    res.json({
      type: 'FeatureCollection',
      features: rows.map((r) => ({
        type: 'Feature',
        id: r.id,
        geometry: {
          type: 'Point',
          // GeoJSON usa [longitude, latitude] — nessa ordem.
          coordinates: [Number(r.longitude), Number(r.latitude)],
        },
        properties: {
          title: r.title,
          description: r.description,
          image_url: r.image_url,
          status: r.status,
          category: r.category,
          created_at: r.created_at,
        },
      })),
    });
  })
);

/**
 * GET /map/stats
 * Agregados para o painel: totais por status, por categoria e por dia.
 *
 * @query {number} [days=30] - janela da série temporal
 * @returns 200 { total, by_status, by_category, last_days }
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const dias = Math.min(365, Math.max(1, Number(req.query.days) || 30));

    // Uma ida ao banco por agregação. São três queries pequenas e
    // indexadas; juntar tudo numa só deixaria o SQL ilegível sem ganho real.
    const [total, porStatus, porCategoria, porDia] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS total FROM complaints'),
      db.query(
        `SELECT status, COUNT(*)::int AS total
           FROM complaints GROUP BY status ORDER BY total DESC`
      ),
      db.query(
        `SELECT category, COUNT(*)::int AS total
           FROM complaints GROUP BY category ORDER BY total DESC`
      ),
      db.query(
        `SELECT DATE(created_at) AS dia, COUNT(*)::int AS total
           FROM complaints
          WHERE created_at >= NOW() - ($1 || ' days')::interval
          GROUP BY dia
          ORDER BY dia ASC`,
        [dias]
      ),
    ]);

    res.json({
      total: total.rows[0].total,
      by_status: porStatus.rows,
      by_category: porCategoria.rows,
      last_days: porDia.rows,
      window_days: dias,
    });
  })
);

module.exports = router;
