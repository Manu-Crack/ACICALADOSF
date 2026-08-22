-- =============================================================================
-- Migración 002: Función de recálculo, trigger de sincronización y corrección
--               de reservas existentes para el sistema de adelanto del 25%.
-- Sistema: Acicalados Spa & Barber Shop
-- Fecha: 2026-08-22
-- PREREQUISITO: Ejecutar 001_payment_logs_schema.sql primero.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PARTE A: Función PostgreSQL que recalcula los totales financieros de una
--          reserva basándose ÚNICAMENTE en pagos con status = 'verified'.
--          Usa FOR UPDATE para prevenir race conditions.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_booking_payment(p_booking_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_price      INTEGER;
  v_advance_pct      INTEGER;
  v_advance_required INTEGER;
  v_amount_paid      INTEGER;
  v_balance          INTEGER;
  v_new_pay_status   TEXT;
  v_current_status   TEXT;
  v_new_book_status  TEXT;
  v_confirmed_at     TIMESTAMPTZ;
BEGIN
  -- Leer datos actuales de la reserva con lock de fila (previene concurrencia)
  SELECT total_price_cents, advance_percentage, status, confirmed_at
  INTO   v_total_price, v_advance_pct, v_current_status, v_confirmed_at
  FROM   bookings
  WHERE  id = p_booking_id
  FOR UPDATE;

  -- Si la reserva no existe, salir silenciosamente
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- No recalcular reservas canceladas o expiradas
  IF v_current_status IN ('cancelada', 'expirada') THEN
    RETURN;
  END IF;

  -- Calcular adelanto requerido (redondeo hacia arriba para no perjudicar al negocio)
  v_advance_required := CEIL(v_total_price * v_advance_pct::NUMERIC / 100.0)::INTEGER;

  -- Sumar SOLO pagos verificados y no anulados (fuente de verdad)
  SELECT COALESCE(SUM(amount_cents), 0)
  INTO   v_amount_paid
  FROM   payment_logs
  WHERE  booking_id = p_booking_id
    AND  status = 'verified';

  -- Calcular saldo (nunca puede ser negativo)
  v_balance := GREATEST(0, v_total_price - v_amount_paid);

  -- Determinar payment_status según reglas de negocio
  IF v_amount_paid = 0 THEN
    v_new_pay_status := 'sin_pago';
  ELSIF v_amount_paid < v_advance_required THEN
    -- Hay algún pago pero no alcanza el adelanto mínimo
    v_new_pay_status := 'sin_pago';
  ELSIF v_amount_paid >= v_advance_required AND v_amount_paid < v_total_price THEN
    v_new_pay_status := 'parcial';
  ELSIF v_amount_paid >= v_total_price THEN
    v_new_pay_status := 'total';
  ELSE
    v_new_pay_status := 'sin_pago';
  END IF;

  -- Determinar si la reserva debe confirmarse automáticamente
  -- Regla: si amount_paid >= advance_required Y la reserva está pendiente → confirmar
  v_new_book_status := v_current_status;
  IF v_amount_paid >= v_advance_required AND v_current_status = 'pendiente' THEN
    v_new_book_status := 'confirmada';
  END IF;

  -- Si se anula el último pago y cae por debajo del adelanto, NO des-confirmar
  -- (una reserva confirmada mantenida aunque el saldo quede pendiente)
  -- Solo cambiar a confirmada, nunca regresar a pendiente desde confirmada.

  -- Actualizar bookings de forma atómica
  UPDATE bookings SET
    advance_amount_cents = v_amount_paid,
    balance_cents        = v_balance,
    payment_status       = v_new_pay_status,
    status               = v_new_book_status,
    confirmed_at         = CASE
                             WHEN v_new_book_status = 'confirmada' AND v_confirmed_at IS NULL
                             THEN now()
                             ELSE v_confirmed_at
                           END,
    updated_at           = now()
  WHERE id = p_booking_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- PARTE B: Función de trigger que llama al recálculo tras cada movimiento
--          de pago (INSERT, UPDATE, DELETE).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_recalculate_booking_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_booking_payment(OLD.booking_id);
  ELSE
    PERFORM recalculate_booking_payment(NEW.booking_id);
  END IF;
  RETURN NULL;
END;
$$;

-- Eliminar trigger previo si existía
DROP TRIGGER IF EXISTS trg_payment_logs_recalculate ON payment_logs;

-- Crear trigger: se ejecuta DESPUÉS de cada cambio en payment_logs
CREATE TRIGGER trg_payment_logs_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON payment_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_booking_payment();

-- -----------------------------------------------------------------------------
-- PARTE C: Corrección de reservas existentes.
--   - Pendientes: corregir advance_percentage a 25, limpiar campos de pago.
--   - Confirmadas/Completadas con payment_status=total: mantener como están
--     pero actualizar advance_percentage a 25.
-- -----------------------------------------------------------------------------

-- Reservas pendientes sin pago real: resetear correctamente
UPDATE bookings SET
  advance_percentage   = 25,
  advance_amount_cents = 0,
  balance_cents        = total_price_cents,
  payment_status       = 'sin_pago'
WHERE status = 'pendiente';

-- Reservas confirmadas/completadas que ya estaban marcadas como pagadas:
-- Mantener payment_status=total pero corregir advance_percentage.
-- No insertar payment_logs retroactivos (datos históricos inciertos).
UPDATE bookings SET
  advance_percentage   = 25,
  advance_amount_cents = total_price_cents,
  balance_cents        = 0
WHERE status IN ('confirmada', 'completada')
  AND payment_status = 'total';

-- Reservas confirmadas sin pago total (estado inconsistente previo):
UPDATE bookings SET
  advance_percentage   = 25,
  advance_amount_cents = 0,
  balance_cents        = total_price_cents,
  payment_status       = 'sin_pago'
WHERE status = 'confirmada'
  AND payment_status IN ('sin_pago', 'pendiente');

-- Reservas canceladas: limpiar y marcar
UPDATE bookings SET
  advance_percentage   = 25
WHERE status = 'cancelada';

-- -----------------------------------------------------------------------------
-- PARTE D: Agregar campo advance_percentage si no existía como NOT NULL
--          (por seguridad, en caso de reservas legacy con NULL)
-- -----------------------------------------------------------------------------
UPDATE bookings
SET advance_percentage = 25
WHERE advance_percentage IS NULL;

-- -----------------------------------------------------------------------------
-- PARTE E: Comentarios en campos de bookings para documentar fuente de verdad
-- -----------------------------------------------------------------------------
COMMENT ON COLUMN bookings.advance_percentage IS
  'Porcentaje de adelanto requerido al crear la reserva. Preparado para ser configurable.';
COMMENT ON COLUMN bookings.advance_amount_cents IS
  'Total pagado en centavos. Sincronizado automáticamente desde payment_logs via trigger. NO modificar manualmente.';
COMMENT ON COLUMN bookings.balance_cents IS
  'Saldo pendiente en centavos = total_price_cents - advance_amount_cents. Sincronizado via trigger.';
COMMENT ON COLUMN bookings.payment_status IS
  'Estado de pago calculado automáticamente via trigger desde payment_logs. Valores: sin_pago, parcial, total.';
