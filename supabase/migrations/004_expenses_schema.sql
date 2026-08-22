-- =============================================================================
-- Migración 004: Módulo de Egresos y Gastos Operativos (expenses)
-- Sistema: Acicalados Spa & Barber Shop
-- Fecha: 2026-08-22
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla de Egresos (expenses)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  category        TEXT NOT NULL CHECK (
                    category IN (
                      'Insumos',
                      'Productos',
                      'Servicios básicos',
                      'Mantenimiento',
                      'Personal',
                      'Transporte',
                      'Otros'
                    )
                  ),
  description     TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_method  TEXT NOT NULL DEFAULT 'cash' CHECK (
                    payment_method IN ('yape', 'cash', 'card', 'transfer', 'other')
                  ),
  receipt_url     TEXT,
  employee_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
  supplier        TEXT,
  notes           TEXT,
  registered_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
  voided_at       TIMESTAMPTZ,
  voided_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida y filtros para reportes
CREATE INDEX IF NOT EXISTS idx_expenses_date       ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category   ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_status     ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_employee   ON expenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. Habilitar RLS y Políticas de Seguridad
-- -----------------------------------------------------------------------------
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Lectura de egresos: Personal autorizado (admin y recepcionista)
CREATE POLICY "staff_read_expenses" ON expenses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recepcionista')
    )
  );

-- Inserción de egresos: Personal autorizado (admin y recepcionista)
CREATE POLICY "staff_insert_expenses" ON expenses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'recepcionista')
    )
  );

-- Actualización / Anulación de egresos: Exclusivo para administradores
CREATE POLICY "admin_update_expenses" ON expenses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Comentarios en la Tabla
-- -----------------------------------------------------------------------------
COMMENT ON TABLE expenses IS
  'Registro inmutable y categorizado de gastos y egresos operativos con auditoría de anulación.';
