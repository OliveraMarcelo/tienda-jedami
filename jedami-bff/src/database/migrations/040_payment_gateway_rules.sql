-- Tabla de reglas de gateway de pago por tipo de cliente
-- Permite configurar qué medios de pago están disponibles para retail vs wholesale

CREATE TABLE payment_gateway_rules (
  id            SERIAL PRIMARY KEY,
  customer_type VARCHAR(20) NOT NULL
                  CHECK (customer_type IN ('retail', 'wholesale')),
  gateway       VARCHAR(20) NOT NULL
                  CHECK (gateway IN ('checkout_pro', 'checkout_api', 'bank_transfer', 'mp_point')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_type, gateway)
);

CREATE INDEX idx_pgr_customer_type_active ON payment_gateway_rules(customer_type, active);

-- Seed inicial: el gateway actual de branding se habilita para ambos tipos de cliente
INSERT INTO payment_gateway_rules (customer_type, gateway, active)
SELECT ct.code, b.payment_gateway, TRUE
FROM customer_types ct
CROSS JOIN branding b
WHERE b.id = 1
  AND ct.code IN ('retail', 'wholesale')
ON CONFLICT DO NOTHING;
