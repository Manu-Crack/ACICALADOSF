-- =============================================================================
-- MANUAL ROLLBACK ONLY
-- DO NOT EXECUTE AS A FORWARD MIGRATION
-- =============================================================================
-- ACICALADOS SPA & BARBER SHOP — SCRIPT DE ROLLBACK COMPLETO (006 a 001)
-- Sistema: Acicalados Web Platform (Release Candidate 1)
-- ADVERTENCIA: Este script elimina las tablas, columnas, funciones y triggers
-- creados en las migraciones 001 a 006. Ejecute ÚNICAMENTE de forma manual si
-- requiere revertir un despliegue fallido.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Rollback Fase 5 (Permisos por Rango)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_employee_block_date ON employee_blocks;
DROP FUNCTION IF EXISTS sync_employee_block_legacy_date();

ALTER TABLE employee_blocks
  DROP CONSTRAINT IF EXISTS chk_employee_blocks_dates,
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS end_date,
  DROP COLUMN IF EXISTS is_all_day,
  DROP COLUMN IF EXISTS permission_type,
  DROP COLUMN IF EXISTS observation,
  DROP COLUMN IF EXISTS evidence_url,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS registered_by,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS audit_history;

-- -----------------------------------------------------------------------------
-- 2. Rollback Fase 4 (Justificaciones y Bonificaciones)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS attendance_justifications CASCADE;
DROP TABLE IF EXISTS bonus_settings CASCADE;

ALTER TABLE employee_attendances
  DROP COLUMN IF EXISTS bonus_minutes,
  DROP COLUMN IF EXISTS bonus_calculation_type,
  DROP COLUMN IF EXISTS bonus_adjusted_by,
  DROP COLUMN IF EXISTS bonus_adjusted_at,
  DROP COLUMN IF EXISTS bonus_adjustment_reason,
  DROP COLUMN IF EXISTS check_in_justified,
  DROP COLUMN IF EXISTS check_out_justified;

-- -----------------------------------------------------------------------------
-- 3. Rollback Fase 3 (Egresos)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS expenses CASCADE;

-- -----------------------------------------------------------------------------
-- 4. Rollback Fase 2 (Configuración de Pagos y Comprobantes)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS booking_payment_proofs CASCADE;
DROP TABLE IF EXISTS payment_settings CASCADE;

-- -----------------------------------------------------------------------------
-- 5. Rollback Fase 1 (Pagos y Adelantos de Reservas)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_recalculate_booking_payments ON payment_logs;
DROP FUNCTION IF EXISTS recalculate_booking_payment_totals();
DROP TABLE IF EXISTS payment_logs CASCADE;

ALTER TABLE bookings
  DROP COLUMN IF EXISTS advance_percentage,
  DROP COLUMN IF EXISTS advance_amount_cents,
  DROP COLUMN IF EXISTS balance_cents,
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS verified_by;
