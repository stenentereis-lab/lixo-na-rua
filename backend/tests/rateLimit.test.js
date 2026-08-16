/**
 * Testes do limitador de tentativas.
 *
 * Nas rotas o middleware fica desligado durante os testes (senão a suíte se
 * autobloqueia), então aqui ele é ligado explicitamente com `enabled: true`.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo_de_teste';

const express = require('express');
const request = require('supertest');
const { rateLimit } = require('../src/middleware/rateLimit');
const { errorHandler } = require('../src/middleware/errorHandler');

/** App mínimo com uma rota protegida pelo limitador. */
function buildApp(options) {
  const app = express();
  app.get('/tentar', rateLimit({ enabled: true, ...options }), (req, res) =>
    res.json({ ok: true })
  );
  app.use(errorHandler);
  return app;
}

describe('rateLimit', () => {
  it('libera requisições dentro do limite', async () => {
    const app = buildApp({ max: 3, windowMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/tentar');
      expect(res.status).toBe(200);
    }
  });

  it('bloqueia com 429 ao ultrapassar o limite', async () => {
    const app = buildApp({ max: 2, windowMs: 60_000 });

    await request(app).get('/tentar');
    await request(app).get('/tentar');
    const res = await request(app).get('/tentar');

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/muitas tentativas/i);
  });

  it('informa Retry-After quando bloqueia', async () => {
    const app = buildApp({ max: 1, windowMs: 60_000 });

    await request(app).get('/tentar');
    const res = await request(app).get('/tentar');

    expect(res.headers['retry-after']).toBeTruthy();
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('libera novamente após a janela expirar', async () => {
    const app = buildApp({ max: 1, windowMs: 50 });

    await request(app).get('/tentar');
    expect((await request(app).get('/tentar')).status).toBe(429);

    await new Promise((r) => setTimeout(r, 60));

    expect((await request(app).get('/tentar')).status).toBe(200);
  });

  it('fica inerte quando desabilitado', async () => {
    const app = buildApp({ max: 1, windowMs: 60_000, enabled: false });

    for (let i = 0; i < 5; i++) {
      expect((await request(app).get('/tentar')).status).toBe(200);
    }
  });
});
