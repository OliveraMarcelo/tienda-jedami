BEGIN;

INSERT INTO roles (name)
VALUES
    ('admin'),
    ('wholesale'),
    ('retail')
    ON CONFLICT (name) DO NOTHING;
COMMIT;