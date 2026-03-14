BEGIN;

CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  slug       VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN category_id INT REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX idx_products_category_id ON products(category_id);

COMMIT;
