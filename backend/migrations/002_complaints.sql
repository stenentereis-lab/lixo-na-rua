-- Migration 002 — denúncias
-- Idempotente: pode rodar mais de uma vez sem quebrar.

CREATE TABLE IF NOT EXISTS complaints (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title         text        NOT NULL,
  description   text,

  latitude      double precision NOT NULL CHECK (latitude  BETWEEN  -90 AND  90),
  longitude     double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  -- Coluna geográfica derivada de lat/lng. Guardamos as duas formas:
  -- os números crus para devolver na API sem conversão, e a geometria
  -- para as consultas espaciais.
  location_geom geometry(Point, 4326),

  image_url     text,

  status        text        NOT NULL DEFAULT 'reported'
                            CHECK (status IN ('reported', 'validated', 'resolved', 'rejected')),
  category      text        NOT NULL DEFAULT 'trash'
                            CHECK (category IN ('trash', 'debris', 'sewage', 'other')),

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Índice espacial: sem ele, buscar "denúncias num raio de 500m" faria
-- varredura completa da tabela.
CREATE INDEX IF NOT EXISTS idx_complaints_geom
  ON complaints USING GIST (location_geom);

-- Listagem padrão é "mais recentes primeiro".
CREATE INDEX IF NOT EXISTS idx_complaints_created_at
  ON complaints (created_at DESC);

-- "Minhas denúncias".
CREATE INDEX IF NOT EXISTS idx_complaints_user
  ON complaints (user_id, created_at DESC);

-- Filtros da moderação.
CREATE INDEX IF NOT EXISTS idx_complaints_status
  ON complaints (status);

-- ------------------------------------------------------------
-- Mantém location_geom e updated_at coerentes automaticamente,
-- para que a aplicação não precise lembrar de atualizá-los.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION complaints_sync_fields()
RETURNS trigger AS $$
BEGIN
  NEW.location_geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_complaints_sync ON complaints;
CREATE TRIGGER trg_complaints_sync
  BEFORE INSERT OR UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION complaints_sync_fields();

COMMENT ON TABLE  complaints               IS 'Denúncias de lixo enviadas pelos cidadãos';
COMMENT ON COLUMN complaints.location_geom IS 'Ponto WGS84 derivado de latitude/longitude por trigger. Não preencher na aplicação.';
COMMENT ON COLUMN complaints.status        IS 'reported = recém-criada | validated = confirmada por moderador | resolved = lixo recolhido | rejected = improcedente';
