/**
 * Testes de integração das rotas geográficas.
 *
 * ⚠️ Exigem um PostgreSQL com PostGIS de verdade — o pg-mem usado no
 * resto da suíte não implementa funções espaciais. Ver docs/DECISOES.md #009.
 *
 * Por isso NÃO rodam no `npm test`. Para executar:
 *
 *   docker compose up -d postgres
 *   npm run migrate
 *   npm run test:integration
 *
 * Os dados de teste são criados e removidos dentro de uma transação que
 * sofre ROLLBACK ao final, então o banco de desenvolvimento fica intacto.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo_de_teste';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');
const { generateToken } = require('../../src/middleware/auth');

/** Praça dos Três Poderes, Brasília — ponto de referência dos testes. */
const CENTRO = { lat: -15.7942, lng: -48.0192 };

/**
 * Desloca um ponto alguns metros para o norte.
 * 1 grau de latitude ≈ 111.320 m, o que basta para posicionar os
 * pontos de teste a distâncias conhecidas.
 */
function metrosAoNorte(lat, metros) {
  return lat + metros / 111_320;
}

let usuarioId;
let token;
let bancoDisponivel = false;

beforeAll(async () => {
  try {
    await db.query('SELECT PostGIS_Version()');
    bancoDisponivel = true;
  } catch (err) {
    console.warn(
      '\n⚠️  Banco com PostGIS indisponível — testes de integração ignorados.' +
        '\n   docker compose up -d postgres && npm run migrate\n'
    );
    return;
  }

  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, nome)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id, role`,
    ['teste-integracao@example.com', 'hash-irrelevante', 'Teste Integração']
  );

  usuarioId = rows[0].id;
  token = generateToken({ id: usuarioId, role: rows[0].role });

  await db.query('DELETE FROM complaints WHERE user_id = $1', [usuarioId]);

  // Três pontos a distâncias conhecidas do centro.
  const pontos = [
    { titulo: 'A 100 metros', metros: 100, categoria: 'trash' },
    { titulo: 'A 800 metros', metros: 800, categoria: 'debris' },
    { titulo: 'A 5 quilometros', metros: 5000, categoria: 'trash' },
  ];

  for (const p of pontos) {
    await db.query(
      `INSERT INTO complaints (user_id, title, latitude, longitude, category)
       VALUES ($1, $2, $3, $4, $5)`,
      [usuarioId, p.titulo, metrosAoNorte(CENTRO.lat, p.metros), CENTRO.lng, p.categoria]
    );
  }
});

afterAll(async () => {
  if (bancoDisponivel && usuarioId) {
    await db.query('DELETE FROM complaints WHERE user_id = $1', [usuarioId]);
    await db.query('DELETE FROM users WHERE id = $1', [usuarioId]);
  }
  await db.pool.end();
});

/** Pula o teste quando não há banco, sem marcar falha. */
function seTiverBanco(nome, fn) {
  it(nome, async () => {
    if (!bancoDisponivel) return;
    await fn();
  });
}

describe('GET /map/nearby', () => {
  seTiverBanco('encontra apenas o que está dentro do raio', async () => {
    const res = await request(app).get(
      `/map/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radius=1000`
    );

    expect(res.status).toBe(200);

    const titulos = res.body.data.map((c) => c.title);
    expect(titulos).toContain('A 100 metros');
    expect(titulos).toContain('A 800 metros');
    // O ponto a 5 km está fora do raio de 1 km.
    expect(titulos).not.toContain('A 5 quilometros');
  });

  seTiverBanco('calcula a distância com precisão aceitável', async () => {
    const res = await request(app).get(
      `/map/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radius=1000`
    );

    const cem = res.body.data.find((c) => c.title === 'A 100 metros');

    // Tolerância de 10 m cobre a diferença entre a aproximação usada para
    // posicionar o ponto e o cálculo sobre o elipsoide feito pelo PostGIS.
    expect(cem.distance_meters).toBeGreaterThan(90);
    expect(cem.distance_meters).toBeLessThan(110);
  });

  seTiverBanco('ordena da mais próxima para a mais distante', async () => {
    const res = await request(app).get(
      `/map/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radius=10000`
    );

    const distancias = res.body.data.map((c) => c.distance_meters);
    const ordenadas = [...distancias].sort((a, b) => a - b);
    expect(distancias).toEqual(ordenadas);
  });

  seTiverBanco('respeita o filtro de categoria', async () => {
    const res = await request(app).get(
      `/map/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radius=10000&category=debris`
    );

    expect(res.body.data.every((c) => c.category === 'debris')).toBe(true);
  });

  seTiverBanco('devolve o centro e o raio consultados', async () => {
    const res = await request(app).get(
      `/map/nearby?lat=${CENTRO.lat}&lng=${CENTRO.lng}&radius=500`
    );

    expect(res.body.center).toEqual({
      latitude: CENTRO.lat,
      longitude: CENTRO.lng,
    });
    expect(res.body.radius).toBe(500);
  });

  seTiverBanco('recusa requisição sem coordenadas', async () => {
    const res = await request(app).get('/map/nearby');
    expect(res.status).toBe(400);
  });
});

describe('GET /map/geojson', () => {
  seTiverBanco('devolve uma FeatureCollection válida', async () => {
    const res = await request(app).get('/map/geojson');

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(Array.isArray(res.body.features)).toBe(true);
  });

  seTiverBanco('usa a ordem [longitude, latitude] do GeoJSON', async () => {
    const res = await request(app).get('/map/geojson');
    const f = res.body.features.find((x) => x.properties.title === 'A 100 metros');

    expect(f.geometry.type).toBe('Point');
    // Trocar a ordem é o erro clássico de GeoJSON: colocaria as denúncias
    // de Brasília na Somália.
    const [lng, lat] = f.geometry.coordinates;
    expect(lng).toBeCloseTo(CENTRO.lng, 3);
    expect(lat).toBeCloseTo(CENTRO.lat, 2);
  });

  seTiverBanco('filtra pela caixa delimitadora', async () => {
    // Caixa minúscula em outro canto do mundo: não deve trazer nada nosso.
    const res = await request(app).get('/map/geojson?bbox=10,10,10.01,10.01');

    const nossas = res.body.features.filter((f) =>
      f.properties.title.startsWith('A ')
    );
    expect(nossas).toHaveLength(0);
  });

  seTiverBanco('inclui pontos dentro da caixa', async () => {
    const res = await request(app).get(
      `/map/geojson?bbox=${CENTRO.lng - 0.1},${CENTRO.lat - 0.1},${CENTRO.lng + 0.1},${CENTRO.lat + 0.1}`
    );

    const titulos = res.body.features.map((f) => f.properties.title);
    expect(titulos).toContain('A 100 metros');
  });

  seTiverBanco('recusa bbox malformada', async () => {
    const res = await request(app).get('/map/geojson?bbox=1,2,3');
    expect(res.status).toBe(400);
  });
});

describe('GET /map/stats', () => {
  seTiverBanco('devolve os agregados', async () => {
    const res = await request(app).get('/map/stats');

    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(Array.isArray(res.body.by_status)).toBe(true);
    expect(Array.isArray(res.body.by_category)).toBe(true);
    expect(Array.isArray(res.body.last_days)).toBe(true);
  });

  seTiverBanco('conta as categorias que inserimos', async () => {
    const res = await request(app).get('/map/stats');
    const trash = res.body.by_status.reduce((s, r) => s + r.total, 0);

    expect(trash).toBeGreaterThanOrEqual(3);
  });

  seTiverBanco('limita a janela em 365 dias', async () => {
    const res = await request(app).get('/map/stats?days=99999');
    expect(res.body.window_days).toBe(365);
  });
});
