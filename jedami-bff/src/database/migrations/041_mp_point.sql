-- Epic 11: MercadoPago Point POS
-- Tablas para gestión de dispositivos y payment intents POS

BEGIN;

-- 1. Actualizar CHECK de branding.payment_gateway para incluir mp_point
ALTER TABLE branding DROP CONSTRAINT IF EXISTS branding_payment_gateway_check;
ALTER TABLE branding ADD CONSTRAINT branding_payment_gateway_check
  CHECK (payment_gateway IN ('checkout_pro', 'checkout_api', 'bank_transfer', 'mp_point'));

-- 2. Actualizar CHECK de payments.payment_method para incluir mp_point
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('mercadopago', 'bank_transfer', 'mp_point'));

-- 3. Dispositivos POS registrados en la cuenta MP
CREATE TABLE pos_devices (
  id               SERIAL PRIMARY KEY,
  mp_device_id     VARCHAR(100) NOT NULL UNIQUE,
  name             VARCHAR(100) NOT NULL DEFAULT '',
  operating_mode   VARCHAR(20)  NOT NULL DEFAULT 'PDV'
                     CHECK (operating_mode IN ('PDV', 'STANDALONE')),
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pos_devices_active ON pos_devices(active);

-- 4. Intents de pago POS (una por pedido activo)
CREATE TABLE pos_payment_intents (
  id              SERIAL PRIMARY KEY,
  device_id       INT NOT NULL REFERENCES pos_devices(id),
  order_id        INT NOT NULL REFERENCES orders(id),
  mp_intent_id    VARCHAR(200) NOT NULL UNIQUE,
  status          VARCHAR(20)  NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','on_terminal','processing','processed','abandoned','cancelled','error')),
  mp_payment_id   VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pos_intents_order_id  ON pos_payment_intents(order_id);
CREATE INDEX idx_pos_intents_mp_intent ON pos_payment_intents(mp_intent_id);
CREATE INDEX idx_pos_intents_status    ON pos_payment_intents(status);

COMMIT;
