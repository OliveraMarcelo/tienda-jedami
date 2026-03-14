BEGIN;

-- Ampliar el CHECK constraint de purchase_type para incluir 'retail'
ALTER TABLE orders DROP CONSTRAINT orders_purchase_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_purchase_type_check
  CHECK (purchase_type IN ('curva', 'cantidad', 'retail'));

COMMIT;
