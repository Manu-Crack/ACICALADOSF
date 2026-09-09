-- =============================================================================
-- Migración 013: Ampliación de CHECK Constraint para Cobro Mixto en Mostrador
-- Sistema: Acicalados Spa & Barber Shop
-- Fecha: 2026-09-09
-- =============================================================================

-- Permite almacenar métodos de pago compuestos como:
-- "Mixto (Efectivo: S/ 20.00 | Yape: S/ 40.00)"
-- conservando compatibilidad con los métodos simples estándar.

ALTER TABLE public.ventas_mostrador DROP CONSTRAINT IF EXISTS ventas_mostrador_metodo_pago_check;

ALTER TABLE public.ventas_mostrador ADD CONSTRAINT ventas_mostrador_metodo_pago_check CHECK (
  metodo_pago IN ('Efectivo', 'Yape', 'Transferencia', 'Mixto')
  OR metodo_pago LIKE 'Mixto%'
);
