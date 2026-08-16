-- Migration 001 — schema inicial
-- Idempotente: pode rodar mais de uma vez sem quebrar.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ============================================================
-- users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  nome          text        NOT NULL,
  role          text        NOT NULL DEFAULT 'user'
                            CHECK (role IN ('user', 'moderator', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- O UNIQUE em email já cria índice. Busca sempre por email normalizado
-- (minúsculo, sem espaços) — a normalização é feita na aplicação.

COMMENT ON TABLE  users               IS 'Contas de acesso ao aplicativo';
COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt. Nunca armazenar senha em texto puro.';
COMMENT ON COLUMN users.role          IS 'user = cidadão | moderator = valida denúncias | admin = gestão';
