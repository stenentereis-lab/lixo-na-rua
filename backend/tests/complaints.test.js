/**
 * Testes das rotas de denúncias.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo_de_teste';
process.env.JWT_EXPIRY = '1h';

const request = require('supertest');

const mockDb = require('./helpers/testDb').createTestDb();
jest.mock('../src/db', () => mockDb);

const app = require('../src/app');
const testDb = mockDb;

const DENUNCIA = {
  title: 'Lixo acumulado na calçada',
  description: 'Sacos há mais de uma semana',
  latitude: -15.7942,
  longitude: -48.0192,
  category: 'trash',
};

/** Cria um usuário e devolve o token. */
async function criarUsuario(email = 'maria@example.com') {
  const res = await request(app)
    .post('/auth/register')
    .send({ email, password: 'senha-forte-123', nome: 'Maria Silva' });
  return { token: res.body.token, user: res.body.user };
}

let token;
let user;

beforeEach(async () => {
  testDb.reset();
  ({ token, user } = await criarUsuario());
});

describe('POST /complaints', () => {
  it('cria denúncia com os dados enviados', async () => {
    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send(DENUNCIA);

    expect(res.status).toBe(201);
    expect(res.body.complaint).toMatchObject({
      title: DENUNCIA.title,
      latitude: DENUNCIA.latitude,
      longitude: DENUNCIA.longitude,
      category: 'trash',
      status: 'reported',
    });
    expect(res.body.complaint.id).toBeTruthy();
  });

  it('associa a denúncia ao usuário do token', async () => {
    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send(DENUNCIA);

    expect(res.body.complaint.user_id).toBe(user.id);
  });

  it('ignora user_id enviado no corpo', async () => {
    const outro = await criarUsuario('outro@example.com');

    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...DENUNCIA, user_id: outro.user.id });

    // Aceitar user_id do corpo permitiria denunciar no nome de outra pessoa.
    expect(res.body.complaint.user_id).toBe(user.id);
  });

  it('ignora status enviado no corpo', async () => {
    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...DENUNCIA, status: 'resolved' });

    // Só a moderação muda status.
    expect(res.body.complaint.status).toBe('reported');
  });

  it('exige autenticação', async () => {
    const res = await request(app).post('/complaints').send(DENUNCIA);
    expect(res.status).toBe(401);
  });

  it('usa categoria "trash" por padrão', async () => {
    const { category, ...semCategoria } = DENUNCIA;

    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send(semCategoria);

    expect(res.body.complaint.category).toBe('trash');
  });

  it('aceita coordenada zero', async () => {
    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...DENUNCIA, latitude: 0, longitude: 0 });

    // Zero é coordenada válida (golfo da Guiné). Validação por valor
    // falsy rejeitaria indevidamente.
    expect(res.status).toBe(201);
    expect(res.body.complaint.latitude).toBe(0);
  });

  it('aceita coordenadas como texto (multipart manda string)', async () => {
    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...DENUNCIA, latitude: '-15.7942', longitude: '-48.0192' });

    expect(res.status).toBe(201);
    expect(res.body.complaint.latitude).toBe(-15.7942);
  });

  it('recusa latitude fora do intervalo', async () => {
    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...DENUNCIA, latitude: 91 });

    expect(res.status).toBe(400);
    expect(res.body.details.latitude).toMatch(/-90 e 90/);
  });

  it('recusa longitude fora do intervalo', async () => {
    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...DENUNCIA, longitude: -181 });

    expect(res.status).toBe(400);
    expect(res.body.details.longitude).toBeTruthy();
  });

  it('recusa coordenada não numérica', async () => {
    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...DENUNCIA, latitude: 'perto do mercado' });

    expect(res.status).toBe(400);
    expect(res.body.details.latitude).toBeTruthy();
  });

  it('recusa denúncia sem título', async () => {
    const { title, ...semTitulo } = DENUNCIA;

    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send(semTitulo);

    expect(res.status).toBe(400);
    expect(res.body.details.title).toBeTruthy();
  });

  it('recusa categoria desconhecida', async () => {
    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...DENUNCIA, category: 'foguete' });

    expect(res.status).toBe(400);
    expect(res.body.details.category).toBeTruthy();
  });

  it('recusa denúncia sem coordenadas', async () => {
    const res = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Só o título' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details).sort()).toEqual([
      'latitude',
      'longitude',
    ]);
  });
});

describe('GET /complaints', () => {
  beforeEach(async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/complaints')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...DENUNCIA, title: `Denúncia ${i}` });
    }
  });

  it('lista as denúncias com o total', async () => {
    const res = await request(app).get('/complaints');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
  });

  it('é pública, não exige token', async () => {
    const res = await request(app).get('/complaints');
    expect(res.status).toBe(200);
  });

  it('não expõe a geometria interna', async () => {
    const res = await request(app).get('/complaints');
    expect(res.body.data[0].location_geom).toBeUndefined();
  });

  it('respeita a paginação', async () => {
    const res = await request(app).get('/complaints?page=1&limit=2');

    expect(res.body.data).toHaveLength(2);
    expect(res.body.limit).toBe(2);
    expect(res.body.total).toBe(3); // total é do conjunto, não da página
  });

  it('devolve a segunda página', async () => {
    const res = await request(app).get('/complaints?page=2&limit=2');
    expect(res.body.data).toHaveLength(1);
  });

  it('limita o tamanho da página em 100', async () => {
    const res = await request(app).get('/complaints?limit=99999');
    expect(res.body.limit).toBe(100);
  });

  it('filtra por categoria', async () => {
    await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...DENUNCIA, category: 'sewage' });

    const res = await request(app).get('/complaints?category=sewage');

    expect(res.body.total).toBe(1);
    expect(res.body.data[0].category).toBe('sewage');
  });

  it('recusa filtro de status inválido', async () => {
    const res = await request(app).get('/complaints?status=inventado');
    expect(res.status).toBe(400);
  });

  it('filtra as denúncias do próprio usuário com mine=true', async () => {
    const outro = await criarUsuario('outro@example.com');
    await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${outro.token}`)
      .send({ ...DENUNCIA, title: 'Do outro usuário' });

    const res = await request(app)
      .get('/complaints?mine=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.total).toBe(3);
    expect(res.body.data.every((c) => c.user_id === user.id)).toBe(true);
  });

  it('exige login para usar mine=true', async () => {
    const res = await request(app).get('/complaints?mine=true');
    expect(res.status).toBe(401);
  });
});

describe('GET /complaints/:id', () => {
  it('devolve a denúncia pelo id', async () => {
    const criada = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${token}`)
      .send(DENUNCIA);

    const res = await request(app).get(`/complaints/${criada.body.complaint.id}`);

    expect(res.status).toBe(200);
    expect(res.body.complaint.title).toBe(DENUNCIA.title);
  });

  it('responde 404 para id inexistente', async () => {
    const res = await request(app).get(
      '/complaints/00000000-0000-0000-0000-000000000000'
    );
    expect(res.status).toBe(404);
  });

  it('responde 400 para id malformado, não 500', async () => {
    // Sem validação de formato, o cast do Postgres viraria erro interno.
    const res = await request(app).get('/complaints/abc');
    expect(res.status).toBe(400);
  });
});

describe('POST /uploads', () => {
  it('exige autenticação', async () => {
    const res = await request(app).post('/uploads');
    expect(res.status).toBe(401);
  });

  it('recusa requisição sem arquivo', async () => {
    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('aceita imagem e devolve a URL', async () => {
    // PNG 1x1 mínimo válido.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );

    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', png, { filename: 'foto.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/.+\.png$/);
    // Nome aleatório: manter o do cliente permitiria sobrescrita e path traversal.
    expect(res.body.filename).not.toBe('foto.png');
  });

  it('recusa arquivo que não é imagem', async () => {
    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('não sou imagem'), {
        filename: 'script.sh',
        contentType: 'application/x-sh',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/formato não suportado/i);
  });
});
