-- Idempotencia en webhook de Mercado Pago
-- Índice único parcial en mp_payment_id para evitar procesar el mismo pago dos veces
CREATE UNIQUE INDEX IF NOT EXISTS payments_mp_payment_id_unique
  ON payments (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;
