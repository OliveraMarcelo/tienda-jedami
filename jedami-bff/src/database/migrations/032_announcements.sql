CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  link_url TEXT,
  link_label VARCHAR(60) DEFAULT 'Ver más',
  target_audience VARCHAR(20) NOT NULL DEFAULT 'all'
    CHECK (target_audience IN ('all', 'authenticated', 'wholesale', 'retail')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
