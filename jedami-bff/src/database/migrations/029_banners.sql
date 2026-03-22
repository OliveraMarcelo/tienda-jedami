CREATE TABLE banners (
  id         SERIAL PRIMARY KEY,
  image_url  TEXT        NOT NULL,
  link_url   TEXT        DEFAULT NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
