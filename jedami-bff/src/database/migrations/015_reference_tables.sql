BEGIN;

CREATE TABLE price_modes (
  id    SERIAL PRIMARY KEY,
  code  VARCHAR(20) NOT NULL UNIQUE,
  label VARCHAR(50) NOT NULL
);

INSERT INTO price_modes (code, label) VALUES
  ('retail',    'Minorista'),
  ('wholesale', 'Mayorista');

CREATE TABLE sizes (
  id         SERIAL PRIMARY KEY,
  label      VARCHAR(20) NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO sizes (label, sort_order) VALUES
  ('RN', 10),
  ('0',  20),
  ('1',  30),
  ('2',  40),
  ('3',  50),
  ('4',  60),
  ('5',  70),
  ('6',  80),
  ('8',  90),
  ('9',  100),
  ('10', 110),
  ('12', 120),
  ('14', 130),
  ('16', 140),
  ('S',  150),
  ('M',  160),
  ('L',  170),
  ('XL', 180);

CREATE TABLE colors (
  id       SERIAL PRIMARY KEY,
  name     VARCHAR(50) NOT NULL UNIQUE,
  hex_code VARCHAR(7)
);

INSERT INTO colors (name, hex_code) VALUES
  ('Blanco',      '#FFFFFF'),
  ('Negro',       '#000000'),
  ('Gris',        '#9E9E9E'),
  ('Rosa',        '#F48FB1'),
  ('Celeste',     '#81D4FA'),
  ('Amarillo',    '#FFF176'),
  ('Verde',       '#A5D6A7'),
  ('Rojo',        '#EF9A9A'),
  ('Naranja',     '#FFCC80'),
  ('Lila',        '#CE93D8'),
  ('Beige',       '#D7CCC8'),
  ('Azul',        '#1E88E5'),
  ('Azul marino', '#1A237E'),
  ('Coral',       '#FF7043'),
  ('Estampado',   NULL);

COMMIT;
