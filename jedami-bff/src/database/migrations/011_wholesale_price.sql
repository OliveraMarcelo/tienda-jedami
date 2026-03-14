BEGIN;

ALTER TABLE variants ADD COLUMN wholesale_price NUMERIC(10,2);

COMMIT;
