/**
 * Banco em memória para os testes.
 *
 * Usa pg-mem, que fala o protocolo do `pg` e valida SQL de verdade — os
 * testes rodam sem Docker e sem Postgres instalado, o que mantém a suíte
 * rápida e viável no CI.
 *
 * ⚠️ ATENÇÃO — o schema abaixo é uma CÓPIA das migrations.
 * Ao alterar `migrations/*.sql`, atualize este arquivo no mesmo commit.
 * Se os dois divergirem, o teste passa mas a aplicação quebra.
 * Ver docs/DECISOES.md #009.
 *
 * Diferenças deliberadas em relação à migration, por limitação do pg-mem:
 *   - sem a coluna `location_geom` (não há PostGIS)
 *   - sem o trigger `complaints_sync_fields` (depende de ST_MakePoint)
 * Nenhuma das duas é lida pela aplicação: `location_geom` é derivada e
 * nunca sai na API. As consultas espaciais, quando existirem, precisarão
 * de teste de integração contra um Postgres real.
 */
const { newDb } = require('pg-mem');
const { randomUUID } = require('crypto');

/**
 * Cria um banco limpo com o schema da aplicação.
 *
 * @returns {{ pool: object, query: Function, isHealthy: Function, reset: Function }}
 *   Objeto com a mesma interface de src/db.js
 */
function createTestDb() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });

  // pg-mem não traz a extensão pgcrypto; registramos o equivalente.
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid',
    impure: true,
    implementation: () => randomUUID(),
  });

  mem.public.none(`
    CREATE TABLE users (
      id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      email         text        NOT NULL UNIQUE,
      password_hash text        NOT NULL,
      nome          text        NOT NULL,
      role          text        NOT NULL DEFAULT 'user',
      created_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE complaints (
      id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       text        NOT NULL,
      description text,
      latitude    double precision NOT NULL CHECK (latitude  BETWEEN  -90 AND  90),
      longitude   double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
      accuracy_meters double precision CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
      image_url   text,
      status      text        NOT NULL DEFAULT 'reported',
      category    text        NOT NULL DEFAULT 'trash',
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE moderations (
      id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      complaint_id  uuid        NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      moderator_id  uuid        REFERENCES users(id) ON DELETE SET NULL,
      status_antes  text        NOT NULL,
      status_depois text        NOT NULL,
      motivo        text,
      created_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE legal_acceptances (
      id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type text        NOT NULL,
      version       text        NOT NULL,
      accepted_at   timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, document_type, version)
    );

    CREATE TABLE beta_signups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome text NOT NULL,
      email text NOT NULL UNIQUE,
      cidade text NOT NULL,
      uf text NOT NULL,
      aparelho text NOT NULL,
      android_version text NOT NULL,
      age_confirmed boolean NOT NULL,
      terms_version text NOT NULL,
      privacy_version text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();

  return {
    pool,
    query: (text, params) => pool.query(text, params),
    isHealthy: async () => true,
    /** Esvazia as tabelas entre testes, preservando o schema. */
    reset: () =>
      mem.public.none(
        'DELETE FROM beta_signups; DELETE FROM legal_acceptances; DELETE FROM moderations; DELETE FROM complaints; DELETE FROM users;'
      ),
  };
}

module.exports = { createTestDb };
