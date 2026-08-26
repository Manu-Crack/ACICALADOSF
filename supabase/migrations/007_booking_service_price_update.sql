-- =============================================================================
-- Migración 007: Políticas y funciones para edición de precio por servicio en reserva
-- Sistema: Acicalados Spa & Barber Shop
-- Fecha: 2026-08-26
-- =============================================================================

-- 1. Asegurar política RLS de UPDATE para booking_services por roles administrativos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'booking_services' AND policyname = 'booking_services_update_admin'
  ) THEN
    CREATE POLICY booking_services_update_admin ON booking_services
      FOR UPDATE
      TO authenticated
      USING (
        (SELECT private.get_user_role()) IN ('admin', 'recepcionista')
      )
      WITH CHECK (
        (SELECT private.get_user_role()) IN ('admin', 'recepcionista')
      );
  END IF;
END $$;

-- 2. Comentario de integridad y fuente de verdad
COMMENT ON COLUMN booking_services.service_price_cents IS
  'Precio en centavos cobrado por este servicio específico en esta reserva. Permite ajustes manuales/descuentos/recargos sin alterar el catálogo maestro de services.';
