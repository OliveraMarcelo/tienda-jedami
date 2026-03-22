-- Columnas de transferencia bancaria en branding
ALTER TABLE branding
  ADD COLUMN IF NOT EXISTS bank_transfer_cvu         VARCHAR(22),
  ADD COLUMN IF NOT EXISTS bank_transfer_alias       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_transfer_holder_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_transfer_bank_name   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_transfer_notes       TEXT;

-- Actualizar CHECK constraint de payment_gateway para incluir bank_transfer
ALTER TABLE branding DROP CONSTRAINT IF EXISTS branding_payment_gateway_check;
ALTER TABLE branding ADD CONSTRAINT branding_payment_gateway_check
  CHECK (payment_gateway IN ('checkout_pro', 'checkout_api', 'bank_transfer'));

-- Agregar payment_method a payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'mercadopago';

ALTER TABLE payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('mercadopago', 'bank_transfer'));
