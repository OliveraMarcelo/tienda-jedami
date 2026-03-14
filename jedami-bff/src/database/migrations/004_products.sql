BEGIN;

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT
);

CREATE TABLE variants (
  id           SERIAL PRIMARY KEY,
  product_id   INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size         VARCHAR(50) NOT NULL,
  color        VARCHAR(50) NOT NULL,
  retail_price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE stock (
  variant_id  INT PRIMARY KEY REFERENCES variants(id) ON DELETE CASCADE,
  quantity    INT NOT NULL DEFAULT 0 CHECK (quantity >= 0)
);

CREATE INDEX idx_variants_product_id ON variants(product_id);

COMMIT;
