/**
 * Upload de imagens.
 *
 * MVP: grava em disco local (`backend/uploads/`) e serve como estático.
 * Ver docs/DECISOES.md #010 — em produção isso vira S3 ou equivalente,
 * porque disco local não sobrevive a deploy em container nem escala para
 * mais de uma instância.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const express = require('express');
const multer = require('multer');

const { ApiError } = require('../utils/errors');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Tipos aceitos. Formatos que a câmera de celular produz. */
const MIME_PERMITIDOS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic', // padrão do iPhone
};

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Nome aleatório: usar o nome enviado pelo cliente permitiria
    // sobrescrever arquivos e path traversal ("../../etc/passwd").
    const ext = MIME_PERMITIDOS[file.mimetype] || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: TAMANHO_MAXIMO, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!MIME_PERMITIDOS[file.mimetype]) {
      return cb(
        new ApiError(
          400,
          `Formato não suportado: ${file.mimetype}. Envie JPEG, PNG, WebP ou HEIC.`
        )
      );
    }
    cb(null, true);
  },
});

/**
 * POST /uploads  🔒
 * Recebe uma imagem e devolve a URL pública.
 *
 * Requisição: multipart/form-data com o campo `image`.
 *
 * @returns 201 { url, filename, size } | 400 formato/tamanho | 401
 *
 * @example
 * curl -X POST http://localhost:3000/uploads \
 *   -H "Authorization: Bearer TOKEN" \
 *   -F "image=@foto.jpg"
 */
router.post(
  '/',
  requireAuth,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (!err) return next();

      // Erros do multer têm código próprio; traduzimos para mensagem útil.
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new ApiError(
            400,
            `Imagem muito grande. O limite é ${TAMANHO_MAXIMO / 1024 / 1024} MB.`
          )
        );
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ApiError(400, 'Envie a imagem no campo "image".'));
      }
      next(err);
    });
  },
  (req, res) => {
    if (!req.file) {
      throw new ApiError(400, 'Nenhuma imagem enviada.');
    }

    res.status(201).json({
      url: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      size: req.file.size,
    });
  }
);

module.exports = { router, UPLOAD_DIR };
