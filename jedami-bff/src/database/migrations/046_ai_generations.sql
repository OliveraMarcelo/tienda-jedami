-- Generaciones de IA: historial de lo que propuso el modelo y lo que decidió el admin.
-- Las aceptadas o editadas son el dataset para ajustar (fine-tuning) el modelo más adelante.
BEGIN;

CREATE TABLE IF NOT EXISTS ai_generations (
  id          SERIAL PRIMARY KEY,
  task        VARCHAR(50)  NOT NULL,
  product_id  INT          REFERENCES products(id) ON DELETE SET NULL,
  model       VARCHAR(120) NOT NULL,
  input       JSONB        NOT NULL,
  output      JSONB        NOT NULL,
  final_text  TEXT,
  status      VARCHAR(20)  NOT NULL DEFAULT 'generated'
              CHECK (status IN ('generated', 'accepted', 'edited', 'discarded')),
  duration_ms INT,
  created_by  INT          REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_task_status ON ai_generations(task, status);
CREATE INDEX IF NOT EXISTS idx_ai_generations_product ON ai_generations(product_id);

COMMIT;
