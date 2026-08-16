/**
 * Testes de moderação e autorização por papel.
 *
 * A pergunta central aqui não é "funciona?", e sim "quem consegue fazer
 * o quê?" — a maior parte dos testes verifica que um usuário comum NÃO
 * consegue moderar.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo_de_teste';
process.env.JWT_EXPIRY = '1h';

const request = require('supertest');

const mockDb = require('./helpers/testDb').createTestDb();
jest.mock('../src/db', () => mockDb);

const app = require('../src/app');
const testDb = mockDb;
const { generateToken } = require('../src/middleware/auth');

const DENUNCIA = {
  title: 'Lixo acumulado na calçada',
  latitude: -15.7942,
  longitude: -48.0192,
  category: 'trash',
};

/**
 * Cria um usuário com o papel pedido.
 * O papel é gravado direto no banco porque o cadastro pela API sempre
 * cria 'user' — o que é justamente o comportamento desejado.
 */
async function criarUsuario(email, role = 'user') {
  const res = await request(app)
    .post('/auth/register')
    .send({ email, password: 'senha-forte-123', nome: `Teste ${role}` });

  const user = res.body.user;

  if (role !== 'user') {
    await testDb.query('UPDATE users SET role = $2 WHERE id = $1', [
      user.id,
      role,
    ]);
    // Token novo, já com o papel atualizado.
    return { user: { ...user, role }, token: generateToken({ id: user.id, role }) };
  }

  return { user, token: res.body.token };
}

/** Cria uma denúncia e devolve o objeto criado. */
async function criarDenuncia(token, extras = {}) {
  const res = await request(app)
    .post('/complaints')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...DENUNCIA, ...extras });
  return res.body.complaint;
}

let cidadao;
let moderador;
let admin;

beforeEach(async () => {
  testDb.reset();
  cidadao = await criarUsuario('cidadao@example.com', 'user');
  moderador = await criarUsuario('moderador@example.com', 'moderator');
  admin = await criarUsuario('admin@example.com', 'admin');
});

describe('PATCH /complaints/:id — autorização', () => {
  it('bloqueia usuário comum com 403', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${cidadao.token}`)
      .send({ status: 'validated' });

    expect(res.status).toBe(403);
  });

  it('bloqueia o autor de moderar a própria denúncia', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${cidadao.token}`)
      .send({ status: 'validated' });

    // Ser dono não dá poder de moderação — senão qualquer um validaria
    // a própria denúncia.
    expect(res.status).toBe(403);
  });

  it('bloqueia requisição sem token com 401', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .send({ status: 'validated' });

    expect(res.status).toBe(401);
  });

  it('permite moderador', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'validated' });

    expect(res.status).toBe(200);
    expect(res.body.complaint.status).toBe('validated');
  });

  it('permite admin', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'validated' });

    expect(res.status).toBe(200);
  });

  it('ignora papel forjado num token de outro segredo', async () => {
    const jwt = require('jsonwebtoken');
    const d = await criarDenuncia(cidadao.token);
    const forjado = jwt.sign(
      { sub: cidadao.user.id, role: 'admin' },
      'segredo-errado'
    );

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${forjado}`)
      .send({ status: 'validated' });

    expect(res.status).toBe(401);
  });
});

describe('PATCH /complaints/:id — transições de status', () => {
  it('aceita reported -> validated', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'validated' });

    expect(res.body.complaint.status).toBe('validated');
  });

  it('aceita validated -> resolved', async () => {
    const d = await criarDenuncia(cidadao.token);

    await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'validated' });

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(200);
    expect(res.body.complaint.status).toBe('resolved');
  });

  it('recusa reported -> resolved', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'resolved' });

    // Marcar como resolvida sem ninguém ter confirmado que existe.
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/não é possível mudar/i);
  });

  it('recusa mudança para o mesmo status', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'reported' });

    expect(res.status).toBe(400);
  });

  it('recusa status inexistente', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'arquivado' });

    expect(res.status).toBe(400);
  });

  it('exige status no corpo', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('permite reabrir uma denúncia rejeitada', async () => {
    const d = await criarDenuncia(cidadao.token);

    await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'rejected', motivo: 'Foto ilegível' });

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'reported' });

    expect(res.status).toBe(200);
    expect(res.body.complaint.status).toBe('reported');
  });
});

describe('PATCH /complaints/:id — rejeição exige motivo', () => {
  it('recusa rejeição sem motivo', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'rejected' });

    // Rejeitar sem explicar deixa o cidadão sem saber o que corrigir.
    expect(res.status).toBe(400);
    expect(res.body.details.motivo).toBeTruthy();
  });

  it('aceita rejeição com motivo', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'rejected', motivo: 'Local já limpo na visita' });

    expect(res.status).toBe(200);
    expect(res.body.complaint.status).toBe('rejected');
  });

  it('não exige motivo para validar', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'validated' });

    expect(res.status).toBe(200);
  });
});

describe('GET /complaints/:id/moderations', () => {
  it('registra quem decidiu e por quê', async () => {
    const d = await criarDenuncia(cidadao.token);

    await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'rejected', motivo: 'Duplicada' });

    const res = await request(app)
      .get(`/complaints/${d.id}/moderations`)
      .set('Authorization', `Bearer ${moderador.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      status_antes: 'reported',
      status_depois: 'rejected',
      motivo: 'Duplicada',
    });
  });

  it('acumula o histórico em ordem', async () => {
    const d = await criarDenuncia(cidadao.token);

    await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'validated' });

    await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'resolved' });

    const res = await request(app)
      .get(`/complaints/${d.id}/moderations`)
      .set('Authorization', `Bearer ${moderador.token}`);

    expect(res.body.data).toHaveLength(2);
  });

  it('não registra nada quando a moderação falha', async () => {
    const d = await criarDenuncia(cidadao.token);

    await request(app)
      .patch(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`)
      .send({ status: 'resolved' }); // transição inválida

    const res = await request(app)
      .get(`/complaints/${d.id}/moderations`)
      .set('Authorization', `Bearer ${moderador.token}`);

    expect(res.body.data).toHaveLength(0);
  });

  it('bloqueia usuário comum', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .get(`/complaints/${d.id}/moderations`)
      .set('Authorization', `Bearer ${cidadao.token}`);

    expect(res.status).toBe(403);
  });
});

describe('DELETE /complaints/:id', () => {
  it('permite o autor remover a própria denúncia', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .delete(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${cidadao.token}`);

    expect(res.status).toBe(204);

    const busca = await request(app).get(`/complaints/${d.id}`);
    expect(busca.status).toBe(404);
  });

  it('impede remover denúncia de outra pessoa', async () => {
    const outro = await criarUsuario('outro@example.com');
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .delete(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${outro.token}`);

    expect(res.status).toBe(403);
  });

  it('permite admin remover qualquer denúncia', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .delete(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(204);
  });

  it('moderador não pode remover — só mudar status', async () => {
    const d = await criarDenuncia(cidadao.token);

    const res = await request(app)
      .delete(`/complaints/${d.id}`)
      .set('Authorization', `Bearer ${moderador.token}`);

    // Remoção apaga a trilha; moderação preserva. São poderes distintos.
    expect(res.status).toBe(403);
  });

  it('exige autenticação', async () => {
    const d = await criarDenuncia(cidadao.token);
    const res = await request(app).delete(`/complaints/${d.id}`);
    expect(res.status).toBe(401);
  });

  it('responde 404 para denúncia inexistente', async () => {
    const res = await request(app)
      .delete('/complaints/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(404);
  });
});
