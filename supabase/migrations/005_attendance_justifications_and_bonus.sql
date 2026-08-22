-- =============================================================================
-- Migración 005: Justificaciones de Asistencia y Tiempo de Bonificación
-- Sistema: Acicalados Spa & Barber Shop
-- Fecha: 2026-08-22
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla de Justificaciones Independientes (attendance_justifications)
-- -----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_att_just_attendance ON attendance_justifications(attendance_id);
CREATE INDEX IF NOT EXISTS idx_att_just_employee   ON attendance_justifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_just_status     ON attendance_justifications(status);
CREATE INDEX IF NOT EXISTS idx_att_just_type       ON attendance_justifications(type);

-- -----------------------------------------------------------------------------
-- 2. Tabla de Configuración de Bonificaciones (bonus_settings)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bonus_settings (
  id                SERIAL PRIMARY KEY,
  day_of_week       INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 1=Lunes, ..., 6=Sábado
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

-- Seed de reglas oficiales por defecto:
-- Domingo (0): Inicia a las 20:10:00
-- Lunes a Sábado (1 al 6): Inicia a las 21:10:00
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

-- -----------------------------------------------------------------------------
-- 3. Extender Tabla employee_attendances con Campos de Bonificación y Flags
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 4. Habilitar RLS y Políticas de Seguridad
-- -----------------------------------------------------------------------------
ALTER TABLE attendance_justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de Justificaciones:
CREATE POLICY "staff_read_justifications" ON attendance_justifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recepcionista')
    )
  );

CREATE POLICY "staff_insert_justifications" ON attendance_justifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recepcionista')
    )
  );

CREATE POLICY "admin_update_justifications" ON attendance_justifications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Políticas de Bonus Settings:
CREATE POLICY "staff_read_bonus_settings" ON bonus_settings
  FOR SELECT
  USING (true);

CREATE POLICY "admin_modify_bonus_settings" ON bonus_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Comentarios en Tablas
-- -----------------------------------------------------------------------------
COMMENT ON TABLE attendance_justifications IS
  'Registro independiente de justificaciones para entrada, salida y ausencias de personal.';

COMMENT ON TABLE bonus_settings IS
  'Reglas configurables de horario de inicio de bonificación nocturna/extendida por día de la semana.';
