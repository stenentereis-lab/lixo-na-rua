CREATE TABLE IF NOT EXISTS beta_signups (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text        NOT NULL,
  email             text        NOT NULL UNIQUE,
  cidade            text        NOT NULL,
  uf                text        NOT NULL,
  aparelho          text        NOT NULL,
  android_version   text        NOT NULL,
  age_confirmed     boolean     NOT NULL CHECK (age_confirmed),
  terms_version     text        NOT NULL,
  privacy_version   text        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'invited', 'accepted', 'declined', 'removed')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE beta_signups IS
  'Inscrições privadas para o programa comunitário de testes.';
