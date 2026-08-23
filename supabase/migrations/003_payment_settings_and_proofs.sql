-- =============================================================================
-- Migración 003: Configuración centralizada de pagos (payment_settings)
--                y registro seguro de comprobantes de pago (payment_proofs).
-- Sistema: Acicalados Spa & Barber Shop
-- Fecha: 2026-08-22
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla de Configuración Centralizada de Pagos (payment_settings)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_settings (
  id                  INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  recipient_name      TEXT NOT NULL DEFAULT 'Jorjito',
  yape_phone          TEXT NOT NULL DEFAULT '51997766828',
  qr_image_url        TEXT,
  advance_percentage  INTEGER NOT NULL DEFAULT 25 CHECK (advance_percentage > 0 AND advance_percentage <= 100),
  base_message        TEXT NOT NULL DEFAULT 'Hola Acicalados, adjunto mi comprobante de pago para mi reserva.',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Insertar registro único por defecto si no existe
INSERT INTO payment_settings (id, recipient_name, yape_phone, advance_percentage, base_message, is_active)
VALUES (1, 'Jorjito', '51997766828', 25, 'Hola Acicalados, adjunto mi comprobante de pago para mi reserva.', true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Tabla de Comprobantes de Pago (payment_proofs)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_proofs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_id    UUID REFERENCES payment_logs(id) ON DELETE SET NULL,
  proof_path    TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size     INTEGER NOT NULL CHECK (file_size > 0),
  mime_type     TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  uploaded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'verified', 'rejected')),
  notes         TEXT,
  verified_at   TIMESTAMPTZ,
  verified_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_payment_proofs_booking_id ON payment_proofs(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_payment_id ON payment_proofs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status     ON payment_proofs(status);

-- -----------------------------------------------------------------------------
-- 3. Habilitar RLS y Políticas de Seguridad
-- -----------------------------------------------------------------------------

-- RLS para payment_settings
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

-- Lectura pública para payment_settings (para que clientes y staff vean titular y teléfono de pago)
CREATE POLICY "public_read_payment_settings" ON payment_settings
  FOR SELECT
  USING (true);

-- Solo administradores pueden modificar payment_settings
CREATE POLICY "admin_update_payment_settings" ON payment_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- RLS para payment_proofs
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;

-- Lectura de comprobantes: staff (admin y recepcionista) o el usuario dueño de la reserva
CREATE POLICY "staff_read_payment_proofs" ON payment_proofs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recepcionista')
    )
    OR
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = payment_proofs.booking_id
        AND bookings.user_id = auth.uid()
    )
  );

-- Inserción de comprobantes: cualquier usuario autenticado o cliente para su propia reserva
CREATE POLICY "anyone_insert_payment_proofs" ON payment_proofs
  FOR INSERT
  WITH CHECK (true);

-- Actualización de comprobantes (aprobar/rechazar): solo admin o recepcionista
CREATE POLICY "staff_update_payment_proofs" ON payment_proofs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recepcionista')
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Comentarios en Tablas y Columnas
-- -----------------------------------------------------------------------------
COMMENT ON TABLE payment_settings IS
  'Configuración centralizada para cobros por Yape, QR, titular, teléfono y porcentaje de adelanto.';
COMMENT ON TABLE payment_proofs IS
  'Auditoría y metadatos de comprobantes de pago subidos por clientes o personal.';
