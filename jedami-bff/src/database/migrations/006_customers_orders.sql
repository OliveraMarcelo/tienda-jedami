BEGIN;

CREATE TABLE customers (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  customer_type VARCHAR(20) NOT NULL DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale'))
);

CREATE INDEX idx_customers_user_id ON customers(user_id);

CREATE TABLE orders (
  id            SERIAL PRIMARY KEY,
  customer_id   INT NOT NULL REFERENCES customers(id),
  purchase_type VARCHAR(20) NOT NULL CHECK (purchase_type IN ('curva', 'cantidad')),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  total_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);

CREATE TABLE order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id  INT REFERENCES variants(id),
  product_id  INT REFERENCES products(id),
  quantity    INT NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(10, 2) NOT NULL
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

COMMIT;
