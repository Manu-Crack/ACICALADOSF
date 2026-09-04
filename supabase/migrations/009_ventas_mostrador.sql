-- =============================================================================
-- Migración 009: Módulo de Ventas Rápidas / Mostrador (ventas_mostrador)
-- Sistema: Acicalados Spa & Barber Shop
-- Fecha: 2026-09-04
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla de Ventas de Mostrador (ventas_mostrador)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ventas_mostrador (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nombre   TEXT NOT NULL,
  producto_nombre  TEXT NOT NULL,
  cantidad         INTEGER NOT NULL DEFAULT 1 CHECK (cantidad >= 1),
  precio_unitario  NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  total            NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  metodo_pago      TEXT NOT NULL DEFAULT 'Efectivo' CHECK (
                     metodo_pago IN ('Efectivo', 'Yape', 'Transferencia', 'Mixto')
                   ),
  fecha            TIMESTAMPTZ NOT NULL DEFAULT now(),
  registrado_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notas            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para búsquedas y filtros analíticos
CREATE INDEX IF NOT EXISTS idx_ventas_mostrador_fecha ON public.ventas_mostrador(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_mostrador_cliente ON public.ventas_mostrador(cliente_nombre);
CREATE INDEX IF NOT EXISTS idx_ventas_mostrador_created ON public.ventas_mostrador(created_at DESC);

-- Habilitar réplica completa para soporte integral de Supabase Realtime (UPDATE/DELETE payloads)
ALTER TABLE public.ventas_mostrador REPLICA IDENTITY FULL;

-- -----------------------------------------------------------------------------
-- 2. Políticas de Seguridad RLS (Lectura, Inserción y Actualización para Admin y Recepcionista)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_read_ventas_mostrador" ON public.ventas_mostrador;
DROP POLICY IF EXISTS "ventas_mostrador_select" ON public.ventas_mostrador;
CREATE POLICY "ventas_mostrador_select" ON public.ventas_mostrador
  FOR SELECT TO authenticated
  USING ((SELECT private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text]));

DROP POLICY IF EXISTS "staff_insert_ventas_mostrador" ON public.ventas_mostrador;
DROP POLICY IF EXISTS "ventas_mostrador_insert" ON public.ventas_mostrador;
CREATE POLICY "ventas_mostrador_insert" ON public.ventas_mostrador
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text]));

DROP POLICY IF EXISTS "staff_update_ventas_mostrador" ON public.ventas_mostrador;
DROP POLICY IF EXISTS "ventas_mostrador_update" ON public.ventas_mostrador;
CREATE POLICY "ventas_mostrador_update" ON public.ventas_mostrador
  FOR UPDATE TO authenticated
  USING ((SELECT private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text]))
  WITH CHECK ((SELECT private.get_user_role()) = ANY (ARRAY['admin'::text, 'recepcionista'::text]));

DROP POLICY IF EXISTS "admin_delete_ventas_mostrador" ON public.ventas_mostrador;
DROP POLICY IF EXISTS "ventas_mostrador_delete" ON public.ventas_mostrador;
CREATE POLICY "ventas_mostrador_delete" ON public.ventas_mostrador
  FOR DELETE TO authenticated
  USING ((SELECT private.get_user_role()) = 'admin'::text);

-- Habilitar publicación Realtime para ventas_mostrador
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'ventas_mostrador'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ventas_mostrador;
  END IF;
END $$;

COMMENT ON TABLE public.ventas_mostrador IS
  'Registro aditivo de ventas directas de productos en mostrador sin vinculación obligatoria a inventario ni afectación a citas.';
