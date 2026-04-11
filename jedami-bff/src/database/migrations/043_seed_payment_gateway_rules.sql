-- Habilitar múltiples medios de pago por tipo de cliente
-- Permite que el cliente elija al momento de pagar (checkout muestra selector cuando hay >1 activo)
-- Idempotente: ON CONFLICT DO NOTHING ignora filas ya existentes

INSERT INTO payment_gateway_rules (customer_type, gateway, active)
VALUES
  ('retail',    'checkout_pro',  TRUE),
  ('retail',    'bank_transfer', TRUE),
  ('wholesale', 'checkout_pro',  TRUE),
  ('wholesale', 'bank_transfer', TRUE)
ON CONFLICT (customer_type, gateway) DO NOTHING;
