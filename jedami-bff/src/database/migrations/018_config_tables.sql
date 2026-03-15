BEGIN;

CREATE TABLE purchase_types (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(20)  NOT NULL UNIQUE,
  label      VARCHAR(50)  NOT NULL,
  active     BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO purchase_types (code, label) VALUES
  ('curva',    'Por curva'),
  ('cantidad', 'Por cantidad'),
  ('retail',   'Minorista');

CREATE TABLE customer_types (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(20)  NOT NULL UNIQUE,
  label      VARCHAR(50)  NOT NULL,
  active     BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO customer_types (code, label) VALUES
  ('retail',    'Minorista'),
  ('wholesale', 'Mayorista');

COMMIT;
