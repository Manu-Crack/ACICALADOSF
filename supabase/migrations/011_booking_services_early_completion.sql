-- =============================================================================
-- Migración 011: Acción de finalización anticipada ("Liberar / Culminar") por servicio
-- Sistema: Acicalados Spa & Barber Shop
-- Fecha: 2026-09-07
-- =============================================================================

-- 1. Agregar columnas de estado y auditoría en booking_services
ALTER TABLE public.booking_services
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmada',
  ADD COLUMN IF NOT EXISTS liberado_at TIMESTAMPTZ;

-- 2. Índice para consultas de agenda y disponibilidad filtradas por estado
CREATE INDEX IF NOT EXISTS idx_booking_services_status
  ON public.booking_services (status);

CREATE INDEX IF NOT EXISTS idx_booking_services_employee_status
  ON public.booking_services (assigned_employee_id, status);

-- 3. Backfill retroactivo para sincronizar estados existentes con la cita padre
UPDATE public.booking_services bs
SET status = CASE
  WHEN b.status = 'completada' THEN 'completada'
  WHEN b.status = 'cancelada' THEN 'cancelada'
  WHEN b.status = 'expirada' THEN 'cancelada'
  ELSE 'confirmada'
END
FROM public.bookings b
WHERE bs.booking_id = b.id
  AND (bs.status IS NULL OR bs.status = 'confirmada')
  AND b.status IN ('completada', 'cancelada', 'expirada');

-- 4. Comentarios descriptivos
COMMENT ON COLUMN public.booking_services.status IS 'Estado de atención del servicio individual: confirmada, completada, cancelada.';
COMMENT ON COLUMN public.booking_services.liberado_at IS 'Marca de tiempo en que el servicio fue culminado/liberado anticipadamente.';
