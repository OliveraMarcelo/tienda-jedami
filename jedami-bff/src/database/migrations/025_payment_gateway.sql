-- Columna para elegir el gateway de pago activo
-- Valores válidos: 'checkout_pro' | 'checkout_api'
ALTER TABLE branding
  ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(20) NOT NULL DEFAULT 'checkout_pro';
