/**
 * Upload de imagens.
 *
 * A rota não sabe onde o arquivo é gravado: conversa com `src/storage`,
 * que escolhe disco local ou S3 conforme `STORAGE_DRIVER`.
 */
const express = require('express');
const multer = require('multer');

const config = require('../config');
const storage = require('../storage');
const { ApiError, asyncHandler } = require('../utils/errors');
const { requireAuth, requireLegalAcceptance } = require('../middleware/auth');

const router = express.Router();

/** Formatos que a câmera de celular produz. */
const MIME_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic', // padrão do iPhone
];

// Em memória, não em disco: o buffer é entregue ao driver, que decide o
// destino. Gravar em disco antes obrigaria o driver S3 a ler de volta.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.storage.maxFileSize, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!MIME_PERMITIDOS.includes(file.mimetype)) {
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

/** Traduz erros do multer para mensagens úteis. */
function tratarUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = Math.round(config.storage.maxFileSize / 1024 / 1024);
      return next(new ApiError(400, `Imagem muito grande. O limite é ${mb} MB.`));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new ApiError(400, 'Envie a imagem no campo "image".'));
    }
    next(err);
  });
}

/**
 * POST /uploads  🔒
 * Recebe uma imagem e devolve a URL.
 *
 * Requisição: multipart/form-data com o campo `image`.
 *
 * @returns 201 { url, key, size, driver } | 400 | 401
 *
 * @example
 * curl -X POST http://localhost:3000/uploads \
 *   -H "Authorization: Bearer TOKEN" \
 *   -F "image=@foto.jpg"
 */
router.post(
  '/',
  requireAuth,
  requireLegalAcceptance,
  tratarUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, 'Nenhuma imagem enviada.');
    }

    const resultado = await storage.salvar(req.file.buffer, {
      mimetype: req.file.mimetype,
    });

    res.status(201).json({ ...resultado, driver: storage.nome });
  })
);

module.exports = { router };
