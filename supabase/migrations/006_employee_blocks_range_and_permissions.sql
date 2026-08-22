-- =============================================================================
-- Migración 006: Permisos por Rango y Control de Disponibilidad
-- Sistema: Acicalados Spa & Barber Shop
-- Fecha: 2026-08-22
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extender Tabla employee_blocks con Campos de Rango, Tipos y Estados
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Agregar columna start_date
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

    -- Sincronizar registros existentes que tengan block_date
    UPDATE employee_blocks
    SET
      start_date = COALESCE(block_date, CURRENT_DATE),
      end_date = COALESCE(block_date, CURRENT_DATE),
      is_all_day = (start_time IS NULL AND end_time IS NULL);

    -- Añadir constraint de validación de rango de fechas
    ALTER TABLE employee_blocks
      ADD CONSTRAINT chk_employee_blocks_dates CHECK (end_date >= start_date);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Trigger para Sincronización Automática de block_date (Retrocompatibilidad)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_employee_block_legacy_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Mantener block_date igual a start_date para consultas heredadas
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

-- -----------------------------------------------------------------------------
-- 3. Índices de Búsqueda y Desempeño
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_emp_blocks_dates_status
  ON employee_blocks(employee_id, start_date, end_date, status);

CREATE INDEX IF NOT EXISTS idx_emp_blocks_status
  ON employee_blocks(status);

-- -----------------------------------------------------------------------------
-- 4. Actualizar Políticas RLS de employee_blocks
-- -----------------------------------------------------------------------------
ALTER TABLE employee_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_employee_blocks" ON employee_blocks;
CREATE POLICY "staff_read_employee_blocks" ON employee_blocks
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "staff_modify_employee_blocks" ON employee_blocks;
CREATE POLICY "staff_modify_employee_blocks" ON employee_blocks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recepcionista')
    )
  );

COMMENT ON TABLE employee_blocks IS
  'Permisos, ausencias y bloqueos de agenda de personal con soporte de rangos de fechas, horas y estados de aprobación.';
