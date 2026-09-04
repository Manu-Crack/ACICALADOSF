-- =============================================================================
-- Migración 010: Persistencia y validación estricta de horarios individuales por colaborador
-- Sistema: Acicalados Spa & Barber Shop
-- Fecha: 2026-09-04
-- =============================================================================

-- 1. Agregar columnas de marcas de tiempo individuales en booking_services
ALTER TABLE public.booking_services
  ADD COLUMN IF NOT EXISTS start_time TIME WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS end_time TIME WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS hora_inicio TIME WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS hora_fin TIME WITHOUT TIME ZONE;

-- 2. Crear índices para acelerar búsquedas de disponibilidad y solapamientos
CREATE INDEX IF NOT EXISTS idx_booking_services_employee_time
  ON public.booking_services (assigned_employee_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_booking_services_booking_id
  ON public.booking_services (booking_id);

-- 3. Función y Trigger para mantener sincronizados hora_inicio/start_time y hora_fin/end_time
CREATE OR REPLACE FUNCTION public.sync_booking_services_time_ranges()
RETURNS TRIGGER AS $$
BEGIN
  -- Sincronizar inicio
  IF NEW.start_time IS NULL AND NEW.hora_inicio IS NOT NULL THEN
    NEW.start_time := NEW.hora_inicio;
  ELSIF NEW.hora_inicio IS NULL AND NEW.start_time IS NOT NULL THEN
    NEW.hora_inicio := NEW.start_time;
  END IF;

  -- Sincronizar fin
  IF NEW.end_time IS NULL AND NEW.hora_fin IS NOT NULL THEN
    NEW.end_time := NEW.hora_fin;
  ELSIF NEW.hora_fin IS NULL AND NEW.end_time IS NOT NULL THEN
    NEW.hora_fin := NEW.end_time;
  END IF;

  -- Si se cuenta con start_time y duration_minutes, pero falta end_time / hora_fin
  IF NEW.start_time IS NOT NULL AND (NEW.end_time IS NULL OR NEW.hora_fin IS NULL) AND NEW.duration_minutes IS NOT NULL THEN
    NEW.end_time := (NEW.start_time + (NEW.duration_minutes || ' minutes')::interval)::time;
    NEW.hora_fin := NEW.end_time;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_booking_services_time_ranges ON public.booking_services;
CREATE TRIGGER trg_sync_booking_services_time_ranges
  BEFORE INSERT OR UPDATE ON public.booking_services
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_booking_services_time_ranges();

-- 4. Backfill retroactivo para registros existentes en booking_services
-- Calcula los rangos horarios individuales:
-- a) Paralelo entre distintos colaboradores (arrancan en bookings.start_time)
-- b) Secuencial para el mismo colaborador en una misma cita
-- c) Servicios sin asignar arrancan en bookings.start_time
WITH computed_schedules AS (
  SELECT
    bs.id,
    b.start_time AS b_start_time,
    bs.duration_minutes,
    COALESCE(
      SUM(COALESCE(bs.duration_minutes, 30)) OVER (
        PARTITION BY bs.booking_id, COALESCE(bs.assigned_employee_id, bs.id)
        ORDER BY bs.created_at, bs.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) AS prev_offset_minutes
  FROM public.booking_services bs
  JOIN public.bookings b ON bs.booking_id = b.id
)
UPDATE public.booking_services bs
SET
  start_time = (cs.b_start_time + (cs.prev_offset_minutes || ' minutes')::interval)::time,
  end_time = (cs.b_start_time + ((cs.prev_offset_minutes + COALESCE(cs.duration_minutes, 30)) || ' minutes')::interval)::time,
  hora_inicio = (cs.b_start_time + (cs.prev_offset_minutes || ' minutes')::interval)::time,
  hora_fin = (cs.b_start_time + ((cs.prev_offset_minutes + COALESCE(cs.duration_minutes, 30)) || ' minutes')::interval)::time
FROM computed_schedules cs
WHERE bs.id = cs.id
  AND (bs.start_time IS NULL OR bs.hora_inicio IS NULL);

-- 5. Comentarios explicativos
COMMENT ON COLUMN public.booking_services.hora_inicio IS 'Hora exacta de inicio de este servicio específico para el colaborador.';
COMMENT ON COLUMN public.booking_services.hora_fin IS 'Hora exacta de finalización según la duración individual del servicio.';
COMMENT ON COLUMN public.booking_services.start_time IS 'Marca horaria técnica de inicio equivalente a hora_inicio.';
COMMENT ON COLUMN public.booking_services.end_time IS 'Marca horaria técnica de finalización equivalente a hora_fin.';
