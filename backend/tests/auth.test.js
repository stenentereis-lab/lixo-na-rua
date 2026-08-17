/**
 * Testes das rotas de autenticação.
 *
 * O módulo src/db é substituído por um banco em memória, então a suíte
 * não precisa de Docker nem de Postgres.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo_de_teste';
process.env.JWT_EXPIRY = '1h';

const request = require('supertest');
const jwt = require('jsonwebtoken');

// O jest.mock sofre hoisting para o topo do arquivo, antes das declarações
// de const. Por isso a variável precisa do prefixo "mock" — é a única
// exceção que o Jest permite referenciar dentro da factory.
const mockDb = require('./helpers/testDb').createTestDb();
jest.mock('../src/db', () => mockDb);

const app = require('../src/app');
const testDb = mockDb;

const VALID_USER = {
  email: 'maria@example.com',
  password: 'senha-forte-123',
  nome: 'Maria Silva',
  accepted_terms: true,
  terms_version: '1.0',
  acknowledged_privacy: true,
  privacy_version: '1.0',
};

beforeEach(() => {
  testDb.reset();
});

describe('POST /auth/register', () => {
  it('cria a conta e devolve token', async () => {
    const res = await request(app).post('/auth/register').send(VALID_USER);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: 'maria@example.com',
      nome: 'Maria Silva',
      role: 'user',
    });
    expect(res.body.user.id).toBeTruthy();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.legal_acceptance_required).toBe(false);
  });

  it('nunca devolve o hash da senha', async () => {
    const res = await request(app).post('/auth/register').send(VALID_USER);

    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(VALID_USER.password);
  });

  it('normaliza e-mail para minúsculo e sem espaços', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_USER, email: '  Maria@Example.COM  ' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('maria@example.com');
  });

  it('recusa e-mail duplicado com 409', async () => {
    await request(app).post('/auth/register').send(VALID_USER);
    const res = await request(app).post('/auth/register').send(VALID_USER);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/já está cadastrado/i);
  });

  it('trata e-mail duplicado ignorando maiúsculas', async () => {
    await request(app).post('/auth/register').send(VALID_USER);
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_USER, email: 'MARIA@EXAMPLE.COM' });

    expect(res.status).toBe(409);
  });

  it('recusa e-mail inválido', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_USER, email: 'nao-e-email' });

    expect(res.status).toBe(400);
    expect(res.body.details.email).toBeTruthy();
  });

  it('recusa senha curta', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_USER, password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.details.password).toMatch(/8 caracteres/);
  });

  it('recusa corpo vazio listando todos os campos', async () => {
    const res = await request(app).post('/auth/register').send({});

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details).sort()).toEqual([
      'accepted_terms',
      'acknowledged_privacy',
      'email',
      'nome',
      'password',
      'privacy_version',
      'terms_version',
    ]);
  });

  it('recusa cadastro sem os aceites jurídicos', async () => {
    const res = await request(app).post('/auth/register').send({
      email: VALID_USER.email,
      password: VALID_USER.password,
      nome: VALID_USER.nome,
    });

    expect(res.status).toBe(400);
    expect(res.body.details.accepted_terms).toBeTruthy();
    expect(res.body.details.acknowledged_privacy).toBeTruthy();
  });

  it('grava documento, versão e data de cada aceite', async () => {
    const res = await request(app).post('/auth/register').send(VALID_USER);
    const { rows } = await testDb.query(
      'SELECT document_type, version, accepted_at FROM legal_acceptances WHERE user_id = $1 ORDER BY document_type',
      [res.body.user.id]
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => [row.document_type, row.version])).toEqual([
      ['privacy', '1.0'],
      ['terms', '1.0'],
    ]);
    expect(rows.every((row) => row.accepted_at)).toBe(true);
  });

  it('não permite escolher o próprio papel (escalada de privilégio)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_USER, role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
  });

  it('emite token com id e papel do usuário', async () => {
    const res = await request(app).post('/auth/register').send(VALID_USER);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);

    expect(payload.sub).toBe(res.body.user.id);
    expect(payload.role).toBe('user');
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send(VALID_USER);
  });

  it('autentica com credenciais corretas', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(VALID_USER.email);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('aceita e-mail com outra caixa', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'MARIA@example.com', password: VALID_USER.password });

    expect(res.status).toBe(200);
  });

  it('recusa senha errada com 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: 'senha-errada' });

    expect(res.status).toBe(401);
  });

  it('usa a mesma mensagem para e-mail inexistente e senha errada', async () => {
    const senhaErrada = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: 'senha-errada' });

    const emailInexistente = await request(app)
      .post('/auth/login')
      .send({ email: 'ninguem@example.com', password: 'qualquer-senha' });

    // Mensagens distintas revelariam quais e-mails estão cadastrados.
    expect(emailInexistente.status).toBe(senhaErrada.status);
    expect(emailInexistente.body.error).toBe(senhaErrada.body.error);
  });

  it('recusa corpo sem senha', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email });

    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me', () => {
  let token;
  let userId;

  beforeEach(async () => {
    const res = await request(app).post('/auth/register').send(VALID_USER);
    token = res.body.token;
    userId = res.body.user.id;
  });

  it('devolve o usuário do token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user.email).toBe(VALID_USER.email);
  });

  it('recusa requisição sem header', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('recusa token malformado', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer nao-e-um-token');

    expect(res.status).toBe(401);
  });

  it('recusa esquema diferente de Bearer', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Basic ${token}`);

    expect(res.status).toBe(401);
  });

  it('recusa token expirado com mensagem clara', async () => {
    const expirado = jwt.sign({ sub: userId, role: 'user' }, process.env.JWT_SECRET, {
      expiresIn: '-1s',
    });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expirado}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expirada/i);
  });

  it('recusa token assinado com outro segredo', async () => {
    const forjado = jwt.sign({ sub: userId, role: 'admin' }, 'segredo-errado');

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${forjado}`);

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/legal-acceptance', () => {
  it('exige aceite de conta antiga antes de usar rotas protegidas', async () => {
    const cadastro = await request(app).post('/auth/register').send(VALID_USER);
    await testDb.query('DELETE FROM legal_acceptances WHERE user_id = $1', [
      cadastro.body.user.id,
    ]);

    const login = await request(app).post('/auth/login').send({
      email: VALID_USER.email,
      password: VALID_USER.password,
    });
    expect(login.body.user.legal_acceptance_required).toBe(true);

    const bloqueada = await request(app)
      .post('/complaints')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ title: 'Teste', latitude: -20, longitude: -54 });
    expect(bloqueada.status).toBe(403);
    expect(bloqueada.body.details.legal_acceptance_required).toBe(true);

    const aceite = await request(app)
      .post('/auth/legal-acceptance')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        accepted_terms: true,
        terms_version: '1.0',
        acknowledged_privacy: true,
        privacy_version: '1.0',
      });
    expect(aceite.status).toBe(200);
    expect(aceite.body.user.legal_acceptance_required).toBe(false);
  });

  it('recusa versão antiga ou caixa não marcada', async () => {
    const cadastro = await request(app).post('/auth/register').send(VALID_USER);
    const res = await request(app)
      .post('/auth/legal-acceptance')
      .set('Authorization', `Bearer ${cadastro.body.token}`)
      .send({
        accepted_terms: true,
        terms_version: '0.9',
        acknowledged_privacy: false,
        privacy_version: '1.0',
      });
    expect(res.status).toBe(400);
    expect(res.body.details.terms_version).toBeTruthy();
    expect(res.body.details.acknowledged_privacy).toBeTruthy();
  });
});

describe('rotas inexistentes', () => {
  it('responde 404 em JSON', async () => {
    const res = await request(app).get('/rota/que/nao/existe');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});
