process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo_de_teste';

const request = require('supertest');
const mockDb = require('./helpers/testDb').createTestDb();
jest.mock('../src/db', () => mockDb);
const app = require('../src/app');

const VALID = {
  nome: 'Ana Testadora',
  email: 'ana@example.com',
  cidade: 'Campo Grande',
  uf: 'MS',
  aparelho: 'Samsung Galaxy A54',
  android_version: '14',
  age_confirmed: true,
  accepted_beta_terms: true,
  beta_terms_version: '1.0',
  acknowledged_privacy: true,
  privacy_version: '1.0',
};

beforeEach(() => mockDb.reset());

describe('POST /beta-signups', () => {
  it('registra inscrição válida sem devolver os dados pessoais', async () => {
    const res = await request(app).post('/beta-signups').send(VALID);
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/recebida/i);
    expect(res.body.email).toBeUndefined();
    const { rows } = await mockDb.query('SELECT * FROM beta_signups');
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(VALID.email);
  });

  it('exige maioridade e os dois documentos', async () => {
    const res = await request(app).post('/beta-signups').send({ ...VALID,
      age_confirmed: false, accepted_beta_terms: false, acknowledged_privacy: false });
    expect(res.status).toBe(400);
    expect(res.body.details.age_confirmed).toBeTruthy();
    expect(res.body.details.accepted_beta_terms).toBeTruthy();
    expect(res.body.details.acknowledged_privacy).toBeTruthy();
  });

  it('não permite inscrição duplicada', async () => {
    await request(app).post('/beta-signups').send(VALID);
    const res = await request(app).post('/beta-signups').send(VALID);
    expect(res.status).toBe(409);
  });
});
