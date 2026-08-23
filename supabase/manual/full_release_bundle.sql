-- =============================================================================
-- MANUAL CONSOLIDATED BUNDLE ONLY (001 to 006)
-- DO NOT RUN AUTOMATICALLY ALONGSIDE INDIVIDUAL MIGRATIONS
-- For automated migration runners, use the sequential files in supabase/migrations/ (001 to 006)
-- =============================================================================
-- ACICALADOS SPA & BARBER SHOP — BUNDLE CONSOLIDADO COMPLETO (001 a 006)
-- Sistema: Acicalados Web Platform (Release Candidate 1)
-- Fecha de Consolidación: 2026-08-22
-- =============================================================================

-- =============================================================================
-- FASE 1: REGISTRO DE PAGOS Y CONTROL DE ADELANTOS (001 + 002)
-- =============================================================================

-- 1.1 Tabla payment_logs (Evolución no destructiva)
CREATE TABLE IF NOT EXISTS payment_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key     UUID UNIQUE,
  booking_id          UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_method      TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('yape', 'cash', 'mixed', 'culqi_legacy')),
  yape_amount_cents   INTEGER NOT NULL DEFAULT 0 CHECK (yape_amount_cents >= 0),
  cash_amount_cents   INTEGER NOT NULL DEFAULT 0 CHECK (cash_amount_cents >= 0),
  payment_type        TEXT NOT NULL DEFAULT 'advance' CHECK (payment_type IN ('advance', 'partial', 'balance', 'total', 'full', 'refund', 'legacy')),
  status              TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('pending', 'verified', 'rejected', 'voided', 'legacy_unclassified')),
  proof_url           TEXT,
  notes               TEXT,
  registered_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at         TIMESTAMPTZ,
  verified_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at           TIMESTAMPTZ,
  voided_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason         TEXT,
  CONSTRAINT chk_mixed_payment_consistency CHECK (
    payment_method != 'mixed' OR (
      (yape_amount_cents + cash_amount_cents) = amount_cents
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_booking     ON payment_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_status      ON payment_logs(status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_paid_at      ON payment_logs(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_logs_idempotency ON payment_logs(idempotency_key);

-- 1.2 Extensión de tabla bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'advance_percentage'
  ) THEN
    ALTER TABLE bookings
      ADD COLUMN advance_percentage INTEGER NOT NULL DEFAULT 25 CHECK (advance_percentage >= 0 AND advance_percentage <= 100),
      ADD COLUMN advance_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (advance_amount_cents >= 0),
      ADD COLUMN balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
      ADD COLUMN confirmed_at TIMESTAMPTZ,
      ADD COLUMN verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 1.3 Función y trigger para recálculo automático de saldos y confirmación de reservas
CREATE OR REPLACE FUNCTION recalculate_booking_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_booking_id          UUID;
  v_total_price_cents   INTEGER;
  v_advance_pct         INTEGER;
  v_min_advance_cents   INTEGER;
  v_total_paid_cents    INTEGER;
  v_new_balance_cents   INTEGER;
  v_new_payment_status  TEXT;
  v_new_booking_status  TEXT;
  v_confirmed_at        TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_booking_id := OLD.booking_id;
  ELSE
    v_booking_id := NEW.booking_id;
  END IF;

  SELECT total_price_cents, advance_percentage, status, confirmed_at
  INTO v_total_price_cents, v_advance_pct, v_new_booking_status, v_confirmed_at
  FROM bookings
  WHERE id = v_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0)
  INTO v_total_paid_cents
  FROM payment_logs
  WHERE booking_id = v_booking_id
    AND status = 'verified';

  v_min_advance_cents := CEIL((v_total_price_cents * COALESCE(v_advance_pct, 25))::NUMERIC / 100.0);
  v_new_balance_cents := GREATEST(0, v_total_price_cents - v_total_paid_cents);

  IF v_total_paid_cents = 0 THEN
    v_new_payment_status := 'sin_pago';
  ELSIF v_total_paid_cents >= v_total_price_cents THEN
    v_new_payment_status := 'pagado_total';
    IF v_new_booking_status = 'pendiente' THEN
      v_new_booking_status := 'confirmada';
      v_confirmed_at := COALESCE(v_confirmed_at, now());
    END IF;
  ELSIF v_total_paid_cents >= v_min_advance_cents THEN
    v_new_payment_status := 'adelanto_pagado';
    IF v_new_booking_status = 'pendiente' THEN
      v_new_booking_status := 'confirmada';
      v_confirmed_at := COALESCE(v_confirmed_at, now());
    END IF;
  ELSE
    v_new_payment_status := 'pago_parcial';
  END IF;

  UPDATE bookings
  SET
    advance_amount_cents = v_total_paid_cents,
    balance_cents        = v_new_balance_cents,
    payment_status       = v_new_payment_status,
    status               = v_new_booking_status,
    confirmed_at         = v_confirmed_at,
    updated_at           = now()
  WHERE id = v_booking_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalculate_booking_payments ON payment_logs;
CREATE TRIGGER trg_recalculate_booking_payments
  AFTER INSERT OR UPDATE OR DELETE ON payment_logs
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_booking_payment_totals();

-- =============================================================================
-- FASE 2: CONFIGURACIÓN DE QR Y COMPROBANTES (003)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_settings (
  id                  SERIAL PRIMARY KEY,
  holder_name         TEXT NOT NULL DEFAULT 'Jorge Luis Rojas',
  yape_phone          TEXT NOT NULL DEFAULT '997766828',
  qr_image_url        TEXT,
  advance_percentage  INTEGER NOT NULL DEFAULT 25 CHECK (advance_percentage >= 0 AND advance_percentage <= 100),
  base_message        TEXT NOT NULL DEFAULT 'Hola Acicalados, adjunto el comprobante de mi reserva.',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO payment_settings (id, holder_name, yape_phone, qr_image_url, advance_percentage, base_message, is_active)
VALUES (
  1,
  'Jorge Luis Rojas',
  '997766828',
  '/LogoAcicalados.svg',
  25,
  'Hola Acicalados, adjunto el comprobante de mi reserva.',
  true
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS booking_payment_proofs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  proof_url       TEXT NOT NULL,
  uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- FASE 3: MÓDULO DE EGRESOS (004)
-- =============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  category        TEXT NOT NULL CHECK (category IN (
                    'Insumos', 'Productos', 'Servicios básicos',
                    'Mantenimiento', 'Personal', 'Transporte', 'Otros'
                  )),
  description     TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cash', 'yape', 'transfer', 'other')),
  receipt_url     TEXT,
  employee_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
  supplier        TEXT,
  notes           TEXT,
  registered_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
  voided_at       TIMESTAMPTZ,
  voided_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_status   ON expenses(status);

-- =============================================================================
-- FASE 4: JUSTIFICACIONES DE ASISTENCIA Y BONIFICACIONES (005)
-- =============================================================================

CREATE TABLE IF NOT EXISTS attendance_justifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id   UUID REFERENCES employee_attendances(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('check_in', 'check_out', 'absence')),
  reason          TEXT NOT NULL,
  observation     TEXT,
  evidence_url    TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  registered_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  audit_history   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bonus_settings (
  id                SERIAL PRIMARY KEY,
  day_of_week       INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  day_name          TEXT NOT NULL,
  bonus_start_time  TIME NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  rounding_method   TEXT NOT NULL DEFAULT 'none' CHECK (rounding_method IN ('none', 'nearest_5', 'floor_5')),
  effective_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to      DATE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_bonus_day_effective UNIQUE (day_of_week, effective_from)
);

INSERT INTO bonus_settings (day_of_week, day_name, bonus_start_time, is_active, effective_from)
VALUES
  (0, 'Domingo', '20:10:00', true, '2026-01-01'),
  (1, 'Lunes', '21:10:00', true, '2026-01-01'),
  (2, 'Martes', '21:10:00', true, '2026-01-01'),
  (3, 'Miércoles', '21:10:00', true, '2026-01-01'),
  (4, 'Jueves', '21:10:00', true, '2026-01-01'),
  (5, 'Viernes', '21:10:00', true, '2026-01-01'),
  (6, 'Sábado', '21:10:00', true, '2026-01-01')
ON CONFLICT (day_of_week, effective_from) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_attendances' AND column_name = 'bonus_minutes'
  ) THEN
    ALTER TABLE employee_attendances
      ADD COLUMN bonus_minutes INTEGER NOT NULL DEFAULT 0 CHECK (bonus_minutes >= 0),
      ADD COLUMN bonus_calculation_type TEXT NOT NULL DEFAULT 'auto' CHECK (bonus_calculation_type IN ('auto', 'manual')),
      ADD COLUMN bonus_adjusted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN bonus_adjusted_at TIMESTAMPTZ,
      ADD COLUMN bonus_adjustment_reason TEXT,
      ADD COLUMN check_in_justified BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN check_out_justified BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- =============================================================================
-- FASE 5: PERMISOS POR RANGO (006)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_blocks' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE employee_blocks
      ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE,
      ADD COLUMN end_date DATE NOT NULL DEFAULT CURRENT_DATE,
      ADD COLUMN is_all_day BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN permission_type TEXT NOT NULL DEFAULT 'personal' CHECK (permission_type IN ('vacaciones', 'medico', 'personal', 'capacitacion', 'maternidad_paternidad', 'otro')),
      ADD COLUMN observation TEXT,
      ADD COLUMN evidence_url TEXT,
      ADD COLUMN status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
      ADD COLUMN registered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN approved_at TIMESTAMPTZ,
      ADD COLUMN audit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

    UPDATE employee_blocks
    SET
      start_date = COALESCE(block_date, CURRENT_DATE),
      end_date = COALESCE(block_date, CURRENT_DATE),
      is_all_day = (start_time IS NULL AND end_time IS NULL);

    ALTER TABLE employee_blocks
      ADD CONSTRAINT chk_employee_blocks_dates CHECK (end_date >= start_date);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_employee_block_legacy_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.block_date := NEW.start_date;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_employee_block_date ON employee_blocks;
CREATE TRIGGER trg_sync_employee_block_date
  BEFORE INSERT OR UPDATE ON employee_blocks
  FOR EACH ROW
  EXECUTE FUNCTION sync_employee_block_legacy_date();

-- =============================================================================
-- POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_blocks ENABLE ROW LEVEL SECURITY;

-- payment_logs
DROP POLICY IF EXISTS "staff_read_payment_logs" ON payment_logs;
CREATE POLICY "staff_read_payment_logs" ON payment_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'recepcionista'))
);

DROP POLICY IF EXISTS "staff_insert_payment_logs" ON payment_logs;
CREATE POLICY "staff_insert_payment_logs" ON payment_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'recepcionista'))
);

DROP POLICY IF EXISTS "admin_update_payment_logs" ON payment_logs;
CREATE POLICY "admin_update_payment_logs" ON payment_logs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- payment_settings
DROP POLICY IF EXISTS "public_read_payment_settings" ON payment_settings;
CREATE POLICY "public_read_payment_settings" ON payment_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_modify_payment_settings" ON payment_settings;
CREATE POLICY "admin_modify_payment_settings" ON payment_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- expenses
DROP POLICY IF EXISTS "staff_read_expenses" ON expenses;
CREATE POLICY "staff_read_expenses" ON expenses FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'recepcionista'))
);

DROP POLICY IF EXISTS "staff_insert_expenses" ON expenses;
CREATE POLICY "staff_insert_expenses" ON expenses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'recepcionista'))
);

DROP POLICY IF EXISTS "admin_update_expenses" ON expenses;
CREATE POLICY "admin_update_expenses" ON expenses FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
