# Changelog — Acicalados Spa & Barber Shop

Todas las modificaciones notables y nuevas funcionalidades del proyecto quedan documentadas en este archivo.

## [1.0.0-rc.1] - 2026-08-22

### Añadido (Added)
- **Control de Adelanto y Pagos (Fase 1)**:
  - Exigencia y validación del 25% de adelanto para confirmar reservas.
  - Soporte de pagos por Yape, Efectivo y Mixto con recálculo automático de saldos y confirmación por trigger en PostgreSQL (`recalculate_booking_payment_totals`).
  - Historial de movimientos de pago por reserva y anulación auditada de pagos.
- **QR Dinámico de Pago y WhatsApp (Fase 2)**:
  - Módulo centralizado de configuración de QR y titular de cuenta (`payment_settings`).
  - Widget interactivo `PaymentQRWidget`, modal de vista previa `QRLightboxModal` y subida de comprobantes con Supabase Storage.
  - Generación de mensajes automáticos personalizados para WhatsApp diferenciando adelanto, saldo y pago total.
- **Reportes Multi-Formato y Egresos Operativos (Fase 3)**:
  - Módulo completo de registro, categorización y anulación de egresos operativos (`expenses`).
  - Generador de reportes multi-hoja en Excel (.xlsx) con `ExcelJS` y reportes oficiales en PDF con `jspdf` y `jspdf-autotable`.
  - Diferenciación matemática estricta entre valor pactado, ingresos cobrados, saldos pendientes y resultado neto.
- **Justificaciones de Asistencia y Bonificaciones (Fase 4)**:
  - Justificación independiente de entradas tardías, salidas anticipadas y ausencias con evidencia adjunta (`attendance_justifications`).
  - Motor de cálculo de tiempo de bonificación nocturna en zona horaria `America/Lima` (L-S 21:10, Dom 20:10) y ajustes manuales auditados.
  - Configuración centralizada de reglas de bonificación por día de la semana (`bonus_settings`).
- **Permisos por Rango y Calendario (Fase 5)**:
  - Extensión de `employee_blocks` para soportar rangos de fechas (`start_date` a `end_date`), modalidades de día completo o por horas, categorización y estados de aprobación.
  - Detección en vivo de citas activas en conflicto al registrar permisos.
  - Módulo interactivo de Calendario por Empleado (`/dashboard/calendario`) con vistas Mes, Semana y Día, y filtros por especialista y tipo de evento.
- **Consolidación y Auditoría Pre-Producción (Fase 6)**:
  - Bundle consolidado de migraciones SQL `000_full_migration_bundle.sql` y script de rollback documentado `999_rollback_bundle.sql`.
  - Sanitización contra inyecciones de fórmulas en Excel (`sanitizeForExcel`).
  - Suite de pruebas automatizadas con 29 verificaciones de reglas de negocio e invariantes financieros.

### Seguridad (Security)
- Clave `SUPABASE_SERVICE_ROLE_KEY` restringida estrictamente a entornos backend de servidor (`src/lib/supabase/admin.ts`).
- Políticas Row Level Security (RLS) habilitadas y configuradas para todas las tablas nuevas y modificadas.
- Matriz de autorización por roles (`admin`, `recepcionista`, `empleado`, `cliente`) verificada en cada endpoint de API.
- Neutralización de caracteres de escape y fórmulas ejecutables (`=`, `+`, `-`, `@`, `\t`, `\r`) en exportaciones de hojas de cálculo.
