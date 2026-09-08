-- =============================================================================
-- Migración 012: Indexación y optimización de pagos, adelantos y balances
-- Proyecto: acicaladossiu (ID: flnqzaybqaqwptujtgzl)
-- =============================================================================

-- 1. Índices en payment_logs para consultas contables y auditoría de pagos en tiempo real
CREATE INDEX IF NOT EXISTS idx_payment_logs_paid_at 
  ON payment_logs (paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_logs_status_paid_at 
  ON payment_logs (status, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_logs_booking_status 
  ON payment_logs (booking_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_method 
  ON payment_logs (payment_method);

CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_type 
  ON payment_logs (payment_type);

-- 2. Índices en bookings para filtros de estado de pago y fechas
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status 
  ON bookings (payment_status);

CREATE INDEX IF NOT EXISTS idx_bookings_date_payment_status 
  ON bookings (booking_date, payment_status);

CREATE INDEX IF NOT EXISTS idx_bookings_balance_cents 
  ON bookings (balance_cents) 
  WHERE balance_cents > 0;
