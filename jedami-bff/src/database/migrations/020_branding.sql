-- Tabla de configuración de branding de la tienda
-- Una sola fila con id=1 — se actualiza con UPDATE, nunca se inserta otra fila
CREATE TABLE branding (
  id               SERIAL PRIMARY KEY,
  store_name       VARCHAR(100)  NOT NULL,
  primary_color    VARCHAR(7)    NOT NULL,
  secondary_color  VARCHAR(7)    NOT NULL,
  logo_url         TEXT,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
