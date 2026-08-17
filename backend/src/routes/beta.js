const express = require('express');

const db = require('../db');
const { ApiError, asyncHandler } = require('../utils/errors');
const { rateLimit } = require('../middleware/rateLimit');
const { normalizeEmail } = require('../utils/validators');

const router = express.Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UF = /^[A-Z]{2}$/;

function text(value, max = 120) {
  const result = String(value || '').trim();
  return result.length <= max ? result : '';
}

router.post(
  '/',
  rateLimit({ max: 5, windowMs: 60 * 60 * 1000 }),
  asyncHandler(async (req, res) => {
    const data = {
      nome: text(req.body.nome),
      email: normalizeEmail(req.body.email),
      cidade: text(req.body.cidade),
      uf: text(req.body.uf, 2).toUpperCase(),
      aparelho: text(req.body.aparelho),
      android_version: text(req.body.android_version, 40),
    };
    const errors = {};
    for (const field of ['nome', 'cidade', 'aparelho', 'android_version']) {
      if (!data[field]) errors[field] = 'Campo obrigatório';
    }
    if (!EMAIL.test(data.email)) errors.email = 'E-mail inválido';
    if (!UF.test(data.uf)) errors.uf = 'Informe a UF com duas letras';
    if (req.body.age_confirmed !== true) errors.age_confirmed = 'Confirme que tem 18 anos ou mais';
    if (req.body.beta_terms_version !== '1.0' || req.body.accepted_beta_terms !== true) {
      errors.accepted_beta_terms = 'Aceite o Termo do Programa Beta';
    }
    if (req.body.privacy_version !== '1.0' || req.body.acknowledged_privacy !== true) {
      errors.acknowledged_privacy = 'Leia a Política de Privacidade';
    }
    if (Object.keys(errors).length) throw new ApiError(400, 'Revise a inscrição', errors);

    try {
      await db.query(
        `INSERT INTO beta_signups
          (nome, email, cidade, uf, aparelho, android_version, age_confirmed,
           terms_version, privacy_version)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8)`,
        [data.nome, data.email, data.cidade, data.uf, data.aparelho,
          data.android_version, '1.0', '1.0']
      );
    } catch (err) {
      if (err.code === '23505' || /unique/i.test(err.message || '')) {
        throw new ApiError(409, 'Este e-mail já está inscrito');
      }
      throw err;
    }

    res.status(201).json({ message: 'Inscrição recebida com sucesso' });
  })
);

module.exports = router;
