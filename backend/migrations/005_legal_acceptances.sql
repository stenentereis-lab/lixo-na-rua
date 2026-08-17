-- Aceites jurídicos versionados. Não altera retroativamente usuários existentes:
-- eles devem aceitar a versão vigente na próxima abertura do aplicativo.
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type text        NOT NULL CHECK (document_type IN ('terms', 'privacy')),
  version       text        NOT NULL,
  accepted_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_type, version)
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user
  ON legal_acceptances (user_id, document_type, version);

COMMENT ON TABLE legal_acceptances IS
  'Prova do aceite: usuário, documento, versão e data. Não guarda CPF nem senha.';
