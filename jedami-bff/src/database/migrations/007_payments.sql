BEGIN;

CREATE TABLE payments (
  id               SERIAL PRIMARY KEY,
  order_id         INT NOT NULL REFERENCES orders(id),
  mp_preference_id VARCHAR(200),
  mp_payment_id    VARCHAR(100),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  amount           NUMERIC(10, 2),
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_mp_payment_id ON payments(mp_payment_id);

COMMIT;
