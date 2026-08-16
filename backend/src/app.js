/**
 * Montagem do app Express.
 *
 * Separado do index.js de propósito: aqui o app é construído mas não sobe
 * servidor, o que permite ao Supertest testá-lo sem ocupar porta.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config');
const db = require('./db');
const authRoutes = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');
const { router: uploadRoutes, UPLOAD_DIR } = require('./routes/uploads');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { asyncHandler } = require('./utils/errors');

const app = express();

// ---------- segurança e parsing ----------
// crossOriginResourcePolicy relaxado para que o web (porta 3001) consiga
// exibir as imagens servidas pela API (porta 3000).
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Necessário para req.ip refletir o cliente real atrás de proxy/load balancer
// — sem isso o rate limit contaria todo mundo como o mesmo IP.
app.set('trust proxy', 1);

// ---------- rotas ----------

/**
 * GET /health
 * Diagnóstico do serviço. Sem autenticação.
 *
 * Responde 200 se a API está de pé e 503 se o banco não responde, para que
 * um monitoramento externo consiga distinguir os dois casos.
 */
app.get(
  '/health',
  asyncHandler(async (req, res) => {
    const dbOk = await db.isHealthy();
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'OK' : 'DEGRADED',
      database: dbOk ? 'connected' : 'unavailable',
      timestamp: new Date(),
      app: 'Lixo na Rua API v1.0',
    });
  })
);

app.use('/auth', authRoutes);
app.use('/complaints', complaintRoutes);
app.use('/uploads', uploadRoutes);

// Imagens enviadas. `express.static` já barra path traversal.
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// ---------- 404 e erros (sempre por último) ----------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
