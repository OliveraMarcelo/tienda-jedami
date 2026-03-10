BEGIN;

INSERT INTO roles (name)
VALUES 
    ('admin'),
    ('mayorista'),
    ('minorista')
    ON CONFLICT (name) DO NOTHING;
COMMIT;