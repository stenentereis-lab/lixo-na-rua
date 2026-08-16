-- Migration 003 — auditoria de moderação
-- Idempotente: pode rodar mais de uma vez sem quebrar.

CREATE TABLE IF NOT EXISTS moderations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id  uuid        NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,

  -- SET NULL, não CASCADE: se o moderador sair do sistema, o registro de
  -- que a decisão foi tomada precisa sobreviver. Apagar o histórico junto
  -- com a conta destruiria a trilha de auditoria.
  moderator_id  uuid        REFERENCES users(id) ON DELETE SET NULL,

  status_antes  text        NOT NULL,
  status_depois text        NOT NULL,
  motivo        text,

  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Histórico de uma denúncia, do mais recente para o mais antigo.
CREATE INDEX IF NOT EXISTS idx_moderations_complaint
  ON moderations (complaint_id, created_at DESC);

-- "O que este moderador decidiu?"
CREATE INDEX IF NOT EXISTS idx_moderations_moderator
  ON moderations (moderator_id, created_at DESC);

COMMENT ON TABLE  moderations               IS 'Trilha de auditoria: toda mudança de status de denúncia é registrada aqui';
COMMENT ON COLUMN moderations.moderator_id  IS 'NULL quando a conta do moderador foi removida; a decisão permanece registrada';
COMMENT ON COLUMN moderations.motivo        IS 'Obrigatório na aplicação quando o status vira rejected';
