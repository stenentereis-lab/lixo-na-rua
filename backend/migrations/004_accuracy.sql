-- Migration 004 — precisão da coordenada
-- Idempotente: pode rodar mais de uma vez sem quebrar.

-- Raio de incerteza informado pelo GPS do aparelho, em metros.
--
-- Por que guardar: uma denúncia com ±1 m aponta o ponto exato do lixo;
-- uma com ±50 m aponta um quarteirão. Para quem modera, ou para o órgão
-- público que recebe a lista, é a diferença entre "está ali" e "está por
-- aqui em algum lugar".
--
-- NULL é permitido: denúncias criadas antes desta migration não têm o
-- dado, e o app pode não conseguir a leitura em algum caso.
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS accuracy_meters double precision
    CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0);

COMMENT ON COLUMN complaints.accuracy_meters IS
  'Raio de incerteza do GPS em metros, informado pelo aparelho. NULL quando desconhecido.';

-- Filtrar por confiabilidade: "mostre só as denúncias bem localizadas".
CREATE INDEX IF NOT EXISTS idx_complaints_accuracy
  ON complaints (accuracy_meters)
  WHERE accuracy_meters IS NOT NULL;
