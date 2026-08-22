-- =============================================================================
-- Migración 001: Definición y actualización no destructiva de payment_logs
-- Sistema: Acicalados Spa & Barber Shop
-- Compatibilidad: Compatible con tablas nuevas y con esquemas legacy (Culqi).
-- REGLA CRÍTICA: NO elimina la tabla, NO borra registros históricos, NO reclasifica Culqi como cash.
-- =============================================================================

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS payment_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key   UUID UNIQUE,
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Añadir columnas requeridas si no existen
DO $$
BEGIN
  -- idempotency_key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN idempotency_key UUID UNIQUE;
  END IF;

  -- payment_method
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN payment_method TEXT;
  END IF;

  -- payment_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN payment_type TEXT DEFAULT 'advance';
  END IF;

  -- yape_amount_cents
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'yape_amount_cents'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN yape_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (yape_amount_cents >= 0);
  END IF;

  -- cash_amount_cents
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'cash_amount_cents'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN cash_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (cash_amount_cents >= 0);
  END IF;

  -- status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN status TEXT NOT NULL DEFAULT 'verified';
  END IF;

  -- proof_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'proof_url'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN proof_url TEXT;
  END IF;

  -- notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'notes'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN notes TEXT;
  END IF;

  -- paid_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN paid_at TIMESTAMPTZ DEFAULT now();
  END IF;

  -- registered_by (nullable para soportar pagos históricos del sistema/Culqi)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'registered_by'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN registered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- verified_at & verified_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'verified_at'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN verified_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'verified_by'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- voided_at, voided_by, void_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'voided_at'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN voided_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'voided_by'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'void_reason'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN void_reason TEXT;
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE payment_logs ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- 3. Backfill seguro y riguroso para filas legacy preexistentes (Culqi)
-- REGLA CRÍTICA: NO reinterpretar pagos Culqi como 'cash'.
-- Se clasifican explícitamente como payment_method = 'culqi_legacy', payment_type = 'legacy'.
-- Solo si processing_result = 'successful' se marcan como 'verified'.
-- En caso contrario ('failed' o sin evidencia de éxito) se marcan como 'rejected' o 'legacy_unclassified'.
DO $$
BEGIN
  -- Comprobar si existen columnas legacy de Culqi (processing_result o event_type)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_logs' AND column_name = 'processing_result'
  ) THEN
    EXECUTE $sql$
      UPDATE payment_logs
      SET
        payment_method = 'culqi_legacy',
        payment_type   = 'legacy',
        paid_at        = COALESCE(paid_at, created_at, now()),
        status         = CASE 
                           WHEN processing_result = 'successful' THEN 'verified'
                           WHEN processing_result = 'failed' THEN 'rejected'
                           WHEN status IS NOT NULL THEN status
                           ELSE 'legacy_unclassified'
                         END,
        yape_amount_cents = 0,
        cash_amount_cents = 0
      WHERE payment_method IS NULL OR payment_method = 'culqi_legacy';
    $sql$;
  ELSE
    -- Si no hay columnas Culqi pero hay filas sin payment_method
    UPDATE payment_logs
    SET
      payment_method = 'culqi_legacy',
      payment_type   = 'legacy',
      paid_at        = COALESCE(paid_at, created_at, now()),
      status         = COALESCE(status, 'legacy_unclassified'),
      yape_amount_cents = 0,
      cash_amount_cents = 0
    WHERE payment_method IS NULL;
  END IF;
END $$;

-- 4. Actualizar constraints de forma segura
ALTER TABLE payment_logs DROP CONSTRAINT IF EXISTS chk_payment_method;
ALTER TABLE payment_logs ADD CONSTRAINT chk_payment_method CHECK (
  payment_method IN ('yape', 'cash', 'mixed', 'culqi_legacy')
);

ALTER TABLE payment_logs DROP CONSTRAINT IF EXISTS chk_payment_type;
ALTER TABLE payment_logs ADD CONSTRAINT chk_payment_type CHECK (
  payment_type IN ('advance', 'partial', 'balance', 'full', 'total', 'refund', 'legacy')
);

ALTER TABLE payment_logs DROP CONSTRAINT IF EXISTS chk_payment_status;
ALTER TABLE payment_logs ADD CONSTRAINT chk_payment_status CHECK (
  status IN ('pending', 'verified', 'rejected', 'voided', 'legacy_unclassified')
);

ALTER TABLE payment_logs DROP CONSTRAINT IF EXISTS chk_mixed_amounts;
ALTER TABLE payment_logs ADD CONSTRAINT chk_mixed_amounts CHECK (
  payment_method != 'mixed' OR
  (COALESCE(yape_amount_cents, 0) + COALESCE(cash_amount_cents, 0) = amount_cents)
);

ALTER TABLE payment_logs DROP CONSTRAINT IF EXISTS chk_method_breakdown_consistency;
ALTER TABLE payment_logs ADD CONSTRAINT chk_method_breakdown_consistency CHECK (
  (payment_method = 'yape' AND yape_amount_cents = amount_cents AND cash_amount_cents = 0) OR
  (payment_method = 'cash' AND cash_amount_cents = amount_cents AND yape_amount_cents = 0) OR
  (payment_method = 'mixed' AND yape_amount_cents > 0 AND cash_amount_cents > 0 AND (yape_amount_cents + cash_amount_cents = amount_cents)) OR
  (payment_method = 'culqi_legacy' AND yape_amount_cents = 0 AND cash_amount_cents = 0)
);

-- 5. Índices de acceso frecuente
CREATE INDEX IF NOT EXISTS idx_payment_logs_booking_id     ON payment_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_status         ON payment_logs(status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_registered_by  ON payment_logs(registered_by);
CREATE INDEX IF NOT EXISTS idx_payment_logs_paid_at        ON payment_logs(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_logs_idempotency    ON payment_logs(idempotency_key);

-- 6. Habilitar Row Level Security
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

-- Lectura: admin y recepcionista
DROP POLICY IF EXISTS "staff_read_payments" ON payment_logs;
CREATE POLICY "staff_read_payments" ON payment_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recepcionista')
    )
  );

-- Inserción: admin y recepcionista
DROP POLICY IF EXISTS "staff_insert_payments" ON payment_logs;
CREATE POLICY "staff_insert_payments" ON payment_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recepcionista')
    )
  );

-- Actualización (anulación): solo admin
DROP POLICY IF EXISTS "admin_update_payments" ON payment_logs;
CREATE POLICY "admin_update_payments" ON payment_logs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
