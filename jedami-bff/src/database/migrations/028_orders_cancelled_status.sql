-- Ampliar el CHECK constraint de orders.status para incluir 'cancelled'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'rejected', 'cancelled'));
