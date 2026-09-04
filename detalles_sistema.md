# Acicalados — Detalles del Sistema

> Documento de contexto completo sobre todo lo que tiene el sistema hasta la fecha.
> Última actualización: 2026-08-22

---

## 1. Descripción General

**Acicalados Spa & Barber Shop** es una aplicación web fullstack para una barbería/spa premium peruana. Permite a los clientes ver servicios, reservar citas, explorar productos y leer el blog. También cuenta con un panel de administración completo para gestionar reservas, empleados, asistencia, productos, vestuario y contenido del blog.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | **Next.js** (App Router) | 16.2.6 |
| Lenguaje | **TypeScript** | ^5 |
| UI | **React** | 19.2.4 |
| Estilos | **Tailwind CSS v4** | ^4 |
| Backend / DB | **Supabase** (PostgreSQL + Auth + Storage + Realtime) | ^2.106.2 |
| Auth SSR | `@supabase/ssr` | ^0.10.3 |
| QR (scan) | `jsqr` + `html5-qrcode` | ^1.4 / ^2.3 |
| QR (generar) | `qrcode` | ^1.5.4 |
| Package manager | **pnpm** | (workspace) |
| Linter | ESLint + `eslint-config-next` | ^9 |

---

## 3. Variables de Entorno (`.env.local`)

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de rol de servicio (solo servidor) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número de WhatsApp para reservas (`51997766828`) |

---

## 4. Arquitectura General

```
Next.js App Router (src/app/)
├── Rutas públicas       → Layout con Navbar + Footer
├── Rutas de auth        → /auth/login, /auth/register, /auth/callback
├── Rutas privadas       → /dashboard/* (admin/recepcionista/empleado)
├── API Routes           → /api/bookings, /api/admin/*, /api/auth/*, /api/availability
└── Middleware           → src/proxy.ts → src/lib/supabase/middleware.ts
```

### Clientes Supabase

| Archivo | Uso |
|---|---|
| `src/lib/supabase/client.ts` | Cliente en el navegador (componentes client-side) |
| `src/lib/supabase/server.ts` | Cliente en el servidor (Server Components, API Routes) |
| `src/lib/supabase/admin.ts` | Cliente con service role key (operaciones privilegiadas) |
| `src/lib/supabase/middleware.ts` | Gestión de sesión y protección de rutas |

---

## 5. Roles de Usuario

El sistema usa una tabla `profiles` en Supabase con un campo `role`:

| Rol | Acceso |
|---|---|
| `admin` | Acceso total al dashboard. Puede leer, crear, editar y eliminar en todos los módulos. Puede modificar asistencias manualmente. |
| `recepcionista` | Acceso al dashboard. Puede leer y gestionar reservas, ver empleados, ver asistencia. No puede modificar asistencias manualmente ni eliminar empleados. |
| `empleado` | Acceso limitado al dashboard. Puede registrar asistencia via QR. |
| (público) | Clientes: pueden ver servicios, productos, blog, hacer reservas via WhatsApp y acceder a `/mi-cuenta`. |

### Protección de rutas (middleware)
- `/dashboard/*` y `/api/admin/*` → requieren autenticación + rol interno (`admin`, `recepcionista`, `empleado`).
- `/api/admin/*` → requiere además rol `admin` o `recepcionista`.
- Los OAuth callbacks son interceptados y redirigidos a `/auth/callback`.

---

## 6. Rutas de la Aplicación

### Públicas

| Ruta | Descripción |
|---|---|
| `/` | Página de inicio (hero, servicios destacados, CTA) |
| `/servicios` | Catálogo de servicios disponibles |
| `/reservar` | Flujo completo de reserva de cita |
| `/tienda` | Catálogo de productos a la venta |
| `/vestuario` | Galería de vestuario / looks |
| `/ubicacion` | Mapa y datos de ubicación del local |
| `/mi-cuenta` | Perfil del cliente autenticado |

### Autenticación

| Ruta | Descripción |
|---|---|
| `/auth/login` | Formulario de inicio de sesión |
| `/auth/register` | Formulario de registro |
| `/auth/callback` | Callback de OAuth (Google, etc.) |

### Dashboard (Admin/Recepcionista/Empleado)

| Ruta | Descripción |
|---|---|
| `/dashboard` | Inicio del panel — métricas del día y semana |
| `/dashboard/reservas` | Gestión completa de reservas |
| `/dashboard/servicios` | CRUD de servicios ofrecidos |
| `/dashboard/empleados` | CRUD de empleados |
| `/dashboard/asistencia` | Control de asistencia con QR |
| `/dashboard/productos` | CRUD de productos de la tienda |
| `/dashboard/vestuario` | CRUD de vestuario/galería |

---

## 7. API Routes

### Pública

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/bookings` | POST | Crear reserva (cliente) |
| `/api/availability` | GET | Consultar disponibilidad de horarios |

### Auth

| Endpoint | Descripción |
|---|---|
| `GET /api/auth/check-role` | Verifica el rol del usuario autenticado y devuelve redirect |

### Admin (requieren auth + rol)

| Endpoint | Métodos | Descripción |
|---|---|---|
| `/api/admin/bookings` | GET, PATCH, DELETE | Gestión de reservas (cambio de estado con validación 25%, reasignación) |
| `/api/admin/payments` | GET, POST | Listar pagos de una reserva y registrar nuevos pagos (Yape/Efectivo/Mixto) |
| `/api/admin/payments/[id]` | PATCH | Anulación de pagos (soft-delete, solo admin) |
| `/api/payment-settings` | GET | Consulta pública/autenticada de la configuración de pagos activa (titular, teléfono, QR, %) |
| `/api/admin/payment-settings` | PUT | Actualización de la configuración central de pagos (solo admin) |
| `/api/admin/payment-settings/upload` | POST, DELETE | Subida y eliminación de imagen del código QR en Storage (solo admin) |
| `/api/bookings/proof` | POST | Subida de comprobantes de pago por clientes o staff con validación MIME y 5MB |
| `/api/admin/proofs/[id]/signed-url` | GET | Generación de URL firmada temporal (60 min) para visualizar comprobantes |
| `/api/admin/expenses` | GET, POST | Listar egresos con filtros y registrar nuevos gastos operativos |
| `/api/admin/expenses/[id]` | PATCH | Anulación de egresos con motivo de auditoría (solo admin) |
| `/api/admin/reports/summary` | GET | Resumen financiero consolidado (ingresos cobrados, adelantos, saldos, egresos, neto) |
| `/api/admin/reports/data` | GET | Dataset completo estructurado para previsualización en pestañas |
| `/api/admin/reports/export/excel` | GET | Generación y descarga de archivo Excel (.xlsx multi-hoja con ExcelJS) |
| `/api/admin/reports/export/pdf` | GET | Generación y descarga de archivo PDF (con jsPDF y AutoTable) |
| `/api/admin/services` | GET, POST, PUT, DELETE | Gestión de servicios |
| `/api/admin/services/upload` | POST | Subir imagen de servicio a Storage |
| `/api/admin/employees` | GET, POST, PUT, DELETE | Gestión de empleados |
| `/api/admin/employees/absences` | POST | Registrar ausencias |
| `/api/admin/employees/seed` | GET | Seed inicial de empleados |
| `/api/admin/attendance` | GET, POST, PUT, DELETE | Gestión de asistencia |
| `/api/admin/attendance/scan` | POST | Procesar escaneo QR de asistencia |
| `/api/admin/products` | GET, POST, PUT, DELETE | Gestión de productos |
| `/api/admin/products/upload` | POST | Subir imagen de producto a Storage |
| `/api/admin/wardrobe` | GET, POST, PUT, DELETE | Gestión de vestuario |
| `/api/admin/wardrobe/upload` | POST | Subir imagen de vestuario a Storage |

---

## 8. Módulos del Dashboard

### 8.1 Inicio (`DashboardHome`)
- Muestra reservas del día con estado en tiempo real (Supabase Realtime).
- Contador de reservas de la semana actual.
- Badges de estado: `pendiente`, `confirmada`, `completada`, `cancelada`.

### 8.2 Reservas (`ReservasManager`)
- Tabla completa de todas las reservas con filtros (estado, fecha, tipo de servicio, búsqueda textual).
- **Sistema de Pagos y Adelanto del 25%**:
  - `PaymentModal`: Registro de pagos en modalidades Yape, Efectivo o Mixto con validación de montos en tiempo real y vista de datos Yape.
  - `PaymentHistoryModal`: Historial detallado de pagos de cada reserva con desglose, datos de auditoría, comprobantes adjuntos y función de anulación (solo admin).
  - `PaymentQRWidget`: Componente visual del QR de Yape con lightbox ampliable, montos calculados en vivo, WhatsApp contextual y subida de comprobantes.
  - `PaymentSettingsModal`: Modal administrativo para que el `admin` configure titular, teléfono de Yape, QR y porcentaje de adelanto dinámicamente.
  - Regla de confirmación estricta: Una reserva solo puede confirmarse si los pagos verificados cubren al menos el 25% del monto total.
  - Confirmación automática: Al registrar un pago que cumpla con el adelanto requerido, la reserva pasa automáticamente a `confirmada`.
- Cambiar estado de reservas (confirmar, completar, cancelar).
- Integración con WhatsApp para notificar al cliente.
- Código de reserva único (`booking_code`).

### 8.3 Servicios (`ServicesManager` + `ServiceFormModal`)
- CRUD completo de servicios (nombre, descripción, precio, duración, categoría, imagen).
- Subida de imagen a Supabase Storage.

### 8.4 Empleados (`EmployeesManager`)
- CRUD completo de empleados.
- Generación de código QR de badge único por empleado.
- Datos: nombre, apellido, cargo, teléfono, email, estado activo/inactivo.
- Visualización del historial de asistencia por empleado.

### 8.5 Asistencia (`AttendanceManager`)
- Panel completo de control de asistencia.
- **`AttendanceQRScannerModal`**: Escanea QR del empleado con cámara del dispositivo (jsqr), procesa check-in y check-out automáticamente.
- **`EmployeeHistoryModal`**: Historial de asistencia individual por empleado.
- **`EmployeeQRBadgeModal`**: Genera e imprime el badge QR del empleado.
- Estados: `presente`, `tardanza`, `salida_temprana`, `falta_justificada`, `falta_injustificada`.
- Filtros por fecha y empleado.

### 8.6 Productos (`ProductManager` + `ProductFormModal`)
- CRUD de productos de la tienda.
- Campos: nombre, descripción, precio, stock, categoría, imagen.
- Subida de imagen a Supabase Storage.

### 8.7 Vestuario (`WardrobeManager` + `WardrobeFormModal`)
- CRUD de ítems de vestuario/galería de looks.
- Campos: nombre, descripción, categoría, imagen.
- Subida de imagen a Supabase Storage.

### 8.8 Blog (`BlogManager` + `BlogFormModal`)
- CRUD de artículos del blog.
- Campos: título, slug (auto-generado), contenido, imagen de portada, categoría, estado (borrador/publicado).
- Subida de imagen a Supabase Storage.

### 8.9 Reportes Financieros y Operativos (`ReportsManager`)
- Panel interactivo de control financiero con cálculo estricto: *Valor contratado vs Ingresos cobrados vs Adelantos vs Saldos pendientes vs Egresos vs Resultado Neto*.
- Filtros por rangos rápidos (*Hoy, Esta semana, Este mes, Mes anterior, Todo, Personalizado*).
- Filtros por empleado (reporte individual), estado de reserva, estado de pago y canal (Yape, Efectivo, Mixto).
- Exportación en **Excel (.xlsx real multi-hoja)** con 6 hojas completas, formato de moneda, autofiltro y paneles congelados.
- Exportación en **PDF (.pdf)** corporativo con cabecera oficial, resumen ejecutivo, tablas ajustadas y paginación.

### 8.10 Egresos y Gastos Operativos (`ExpensesManager` + `ExpenseFormModal`)
- Registro de gastos categorizados (*Insumos, Productos, Servicios básicos, Mantenimiento, Personal, Transporte, Otros*).
- Vinculación opcional con personal/especialista o proveedor.
- Anulación protegida (*soft-delete*) exclusiva para el rol `admin` con motivo obligatorio.
- Impacto directo e instantáneo en el cálculo del Resultado Neto de la empresa.

---

## 9. Módulos Públicos

### 9.1 Página de Inicio (`/`)
- Hero con carrusel de imágenes (`HeroImageCarousel`).
- Secciones de servicios destacados y llamadas a la acción.

### 9.2 Reservar (`/reservar`)
- Flujo multi-paso: selección de servicio → selección de empleado → selección de fecha y hora → datos del cliente → confirmación.
- Consulta disponibilidad real (`/api/availability`).
- Al confirmar, crea reserva en BD y redirige a WhatsApp con mensaje pre-cargado.
- Código de reserva único generado automáticamente.

### 9.3 Tienda (`/tienda`)
- Catálogo de productos cargado desde Supabase.
- Componente cliente (`ProductCatalogClient`) con filtros por categoría.
- Carrito de compras global (Context API vía `CartProvider`).

### 9.4 Vestuario (`/vestuario`)
- Galería de looks/vestuario con componente cliente (`WardrobeClientGallery`) y filtros.

### 9.6 Servicios (`/servicios`)
- Lista de todos los servicios activos del establecimiento.

### 9.7 Ubicación (`/ubicacion`)
- Mapa embebido y datos de contacto/dirección física.

### 9.8 Mi Cuenta (`/mi-cuenta`)
- Historial de reservas del cliente autenticado.
- Formulario de edición de perfil (`ProfileForm`).

---

## 10. Base de Datos (Supabase / PostgreSQL)

### Tablas conocidas

| Tabla | Descripción |
|---|---|
| `profiles` | Perfiles de usuario; campo `role` (`admin`, `recepcionista`, `empleado`) |
| `bookings` | Reservas de clientes. Campos: `id`, `booking_code`, `client_first_name`, `client_last_name`, `start_time`, `booking_date`, `status`, `payment_status`, `service_type`, `total_price_cents`, `advance_percentage` (25%), `advance_amount_cents`, `balance_cents`, etc. |
| `payment_settings` | Configuración centralizada de cobros Yape. Campos: `id`, `recipient_name`, `yape_phone`, `qr_image_url`, `advance_percentage`, `base_message`, `is_active`, `updated_at`, `updated_by` |
| `payment_logs` | Registro inmutable de pagos. Campos: `id`, `booking_id`, `amount_cents`, `payment_method` (`yape`, `cash`, `mixed`), `payment_type` (`advance`, `partial`, `balance`, `full`, `refund`), `yape_amount_cents`, `cash_amount_cents`, `status` (`verified`, `voided`, `rejected`, `pending`), `registered_by`, `voided_by`, `void_reason`, etc. |
| `payment_proofs` | Comprobantes y vouchers de pago. Campos: `id`, `booking_id`, `payment_id`, `proof_path`, `file_name`, `file_size`, `mime_type`, `uploaded_by`, `status` (`pending`, `verified`, `rejected`), `notes`, `verified_at`, `verified_by` |
| `expenses` | Gastos y egresos operativos. Campos: `id`, `expense_date`, `category`, `description`, `amount_cents`, `payment_method`, `receipt_url`, `employee_id`, `supplier`, `notes`, `registered_by`, `status` (`active`, `voided`), `voided_at`, `voided_by`, `void_reason` |
| `services` | Servicios ofrecidos por el establecimiento |
| `booking_services` | Detalle de servicios asignados a cada reserva |
| `employees` | Empleados; incluye código QR único para asistencia |
| `employee_blocks` | Bloqueos de horario / permisos de empleados |
| `attendance` | Registros de asistencia. Campos: `id`, `employee_id`, `date`, `check_in`, `check_out`, `status`, `notes` |
| `products` | Productos de la tienda |
| `wardrobe` | Ítems de vestuario/galería |

### Estados de Asistencia (check constraint en DB)
```
'presente' | 'tardanza' | 'salida_temprana' | 'falta_justificada' | 'falta_injustificada'
```

### Estados de Reserva
```
'pendiente' | 'confirmada' | 'completada' | 'cancelada' | 'expirada'
```

### Estados de Pago en Reserva (`payment_status`)
```
'sin_pago' | 'parcial' | 'total'
```

### Métodos de Pago (`payment_method`)
```
'yape' | 'cash' | 'mixed'
```

### Tipos de Movimiento de Pago (`payment_type`)
```
'advance' | 'partial' | 'balance' | 'full' | 'refund'
```

### Estados de Movimiento de Pago (`status` en `payment_logs`)
```
'pending' | 'verified' | 'rejected' | 'voided'
```

### Reglas de Negocio Financieras (Trigger PostgreSQL)
- La función `recalculate_booking_payment(booking_id)` es la fuente de verdad del saldo y estado de pago.
- Se ejecuta automáticamente ante cualquier `INSERT`, `UPDATE` o `DELETE` en `payment_logs` mediante el trigger `trg_payment_logs_recalculate`.
- Utiliza `FOR UPDATE` para garantizar atomicidad y prevenir condiciones de carrera.
- Solo los pagos con `status = 'verified'` se suman al total pagado (`advance_amount_cents`).
- Los pagos anulados (`status = 'voided'`) no se suman pero su registro se conserva por auditoría.

### Supabase Storage
Usado para almacenar imágenes de: servicios, productos, vestuario y blog. URLs públicas.

### Supabase Realtime
Habilitado en el dashboard para actualización en tiempo real de reservas del día.

---

## 11. Componentes Compartidos

### Layout (`src/components/layout/`)

| Componente | Descripción |
|---|---|
| `Navbar.tsx` | Barra de navegación principal (logo, links, búsqueda, usuario, carrito) |
| `NavLinks.tsx` | Links de navegación del navbar |
| `NavSearch.tsx` | Buscador en navbar |
| `NavUserButton.tsx` | Botón de usuario (login/perfil/logout) |
| `MobileMenu.tsx` | Menú hamburguesa para móvil |
| `Footer.tsx` | Pie de página con redes sociales |
| `HeroImageCarousel.tsx` | Carrusel de imágenes del hero |
| `AdminSidebar.tsx` | Sidebar del panel de administración con navegación entre módulos |

### Carrito (`src/components/cart/`)

| Componente | Descripción |
|---|---|
| `CartProvider.tsx` | Context global del carrito (estado, agregar, quitar, limpiar) |
| `CartDrawer.tsx` | Panel lateral con ítems del carrito |
| `CartButton.tsx` | Botón flotante del carrito con badge de cantidad |

### Servicios (`src/components/services/`)

| Componente | Descripción |
|---|---|
| `ServiceList.tsx` | Lista de servicios |
| `ServiceCard.tsx` | Tarjeta individual de servicio |

### Íconos (`src/components/icons/`)
SVGs de redes sociales: Facebook, Instagram, TikTok, YouTube, WhatsApp.

---

## 12. Utilidades (`src/lib/utils/`)

| Archivo | Descripción |
|---|---|
| `employee-assignment.ts` | Lógica de asignación de empleados a servicios/horarios |
| `format.ts` | Funciones de formato de fechas, precios, etc. |
| `image-converter.ts` | Conversión/compresión de imágenes antes de subir |
| `slugify.ts` | Genera slugs URL-friendly a partir de texto |
| `storage.ts` | Helpers para Supabase Storage (upload, delete, getPublicUrl) |
| `url.ts` | Helpers para construcción de URLs |
| `whatsapp.ts` | Genera links de WhatsApp con mensaje pre-cargado para reservas |

---

## 13. Tipos TypeScript (`src/lib/types/`)

| Archivo | Descripción |
|---|---|
| `attendance.ts` | `AttendanceStatus`, `ATTENDANCE_STATUS` (constantes), `AttendanceRecord`, `getAttendanceStatusInfo()` |

---

## 14. Assets Públicos (`public/`)

### Imágenes principales

| Asset | Descripción |
|---|---|
| `LogoAcicalados.svg` | Logo principal de la marca |
| `LogoBarberia.svg` | Logo Barbería |
| `LogoSpa.svg` | Logo Spa |
| `LogoTodo.svg` | Logo combinado |
| `IconUser.svg` | Ícono de usuario |
| `barber-hero.webp` | Imagen hero de barbería |
| `fondo1.webp` – `fondo6.webp` | Fondos de secciones (fondo1 = fondo global fijo) |
| `calendario.svg`, `calendarioT.svg` | Íconos de calendario |
| `Reloj.svg`, `tiempo.svg` | Íconos de tiempo |
| `tarjeta.svg` | Ícono de tarjeta |
| `ubicacion.svg` | Ícono de ubicación |
| `Activo.svg` | Ícono de estado activo |

### `/public/icons/` (app pública)
Google, Facebook, Instagram, TikTok, YouTube, WhatsApp, Maps, botella, silla, insignia, calendario.

### `/public/iconsAdmi/` (sidebar del dashboard)
Asistencia, Blog, Empleados, Inicio, Productos, Reservas, Servicios, Vestuario.

---

## 15. Diseño y Estilo (`style-guide.md` + `globals.css`)

### Paleta de Colores

| Token CSS | Hex | Uso |
|---|---|---|
| `--color-primary` | `#D4AF37` | Oro principal — botones, títulos, CTAs |
| `--color-primary-dark` | `#C2872B` | Oro oscuro — hover, acentos |
| `--color-primary-light` | `#F5E6B3` | Oro claro — fondos, bordes |
| `--color-bg` | `#0A0A0A` | Fondo principal (dark) |
| `--color-bg-card` | `#141414` | Superficies de tarjetas |
| `--color-bg-elevated` | `#1A1A1A` | Superficies elevadas |
| `--color-text` | `#F5F5F5` | Texto principal |
| `--color-text-muted` | `#A0A0A0` | Texto secundario |
| `--color-success` | `#22C55E` | Estado éxito |
| `--color-warning` | `#F59E0B` | Estado advertencia |
| `--color-error` | `#EF4444` | Estado error |

### Tipografía
- Fuente: **Inter** (Google Fonts), pesos 400 (body) / 600–700 (headings)

### Radios y Sombras
- Botones: `8px`, Tarjetas: `12px`, Modales: `16px`
- Card shadow: `0 4px 20px rgba(0,0,0,0.3)` / Elevated: `0 8px 40px rgba(0,0,0,0.5)`

### Fondo Global
`fondo1.webp` se aplica como fondo fijo en toda la app (clase `global-fixed-bg`) con overlay de viñeta suave.

---

## 16. Seguridad

- El middleware (`proxy.ts` → `updateSession`) protege todas las rutas excepto assets estáticos.
- Las rutas `/api/admin/*` verifican rol en **dos capas**: middleware + dentro del handler.
- La `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor (API Routes con `createAdminClient`).
- Los callbacks OAuth son interceptados y redirigidos correctamente a `/auth/callback`.

---

## 17. Scripts Disponibles

```bash
pnpm dev        # Servidor de desarrollo (Next.js)
pnpm build      # Build de producción
pnpm start      # Servidor de producción
pnpm lint       # Linter (ESLint)
```

---

## 18. Estructura de Archivos Resumida

```
codigo_acicalados/
├── public/                          # Assets estáticos
│   ├── icons/                       # Íconos públicos (redes sociales, mapas, etc.)
│   ├── iconsAdmi/                   # Íconos del admin sidebar
│   ├── fondo1-6.webp                # Fondos de secciones
│   └── Logo*.svg, *.svg, *.webp    # Logos y demás assets
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout (CartProvider + fondo global)
│   │   ├── page.tsx                 # Página de inicio
│   │   ├── globals.css              # Estilos globales + tokens CSS
│   │   ├── not-found.tsx            # Página 404
│   │   ├── auth/                    # login, register, callback
│   │   ├── blog/                    # Listado + [slug]
│   │   ├── servicios/               # Catálogo de servicios
│   │   ├── reservar/                # Flujo de reserva
│   │   ├── tienda/                  # Tienda de productos
│   │   ├── vestuario/               # Galería de vestuario
│   │   ├── ubicacion/               # Mapa y ubicación
│   │   ├── mi-cuenta/               # Perfil del cliente
│   │   ├── dashboard/               # Panel de administración
│   │   │   ├── layout.tsx           # Layout con AdminSidebar
│   │   │   ├── page.tsx             # Inicio del dashboard (Server Component)
│   │   │   ├── DashboardHome.tsx    # Componente home (Client, Realtime)
│   │   │   ├── reservas/            # ReservasManager
│   │   │   ├── servicios/           # ServicesManager + ServiceFormModal
│   │   │   ├── empleados/           # EmployeesManager
│   │   │   ├── asistencia/          # AttendanceManager + QR modals
│   │   │   ├── productos/           # ProductManager + ProductFormModal
│   │   │   ├── vestuario/           # WardrobeManager + WardrobeFormModal
│   │   │   └── blog/                # BlogManager + BlogFormModal
│   │   └── api/
│   │       ├── bookings/route.ts    # POST crear reserva
│   │       ├── availability/route.ts # GET disponibilidad
│   │       ├── auth/check-role/     # GET verificar rol
│   │       └── admin/
│   │           ├── bookings/route.ts
│   │           ├── services/route.ts + upload/
│   │           ├── employees/route.ts + absences/ + seed/
│   │           ├── attendance/route.ts + scan/
│   │           ├── products/route.ts + upload/
│   │           ├── blog/route.ts + upload/
│   │           └── wardrobe/route.ts + upload/
│   ├── components/
│   │   ├── layout/                  # Navbar, Footer, AdminSidebar, Hero...
│   │   ├── cart/                    # CartProvider, CartDrawer, CartButton
│   │   ├── services/                # ServiceList, ServiceCard
│   │   └── icons/                   # SVGs de redes sociales
│   ├── lib/
│   │   ├── supabase/                # client.ts, server.ts, admin.ts, middleware.ts
│   │   ├── types/                   # attendance.ts
│   │   └── utils/                   # format, slugify, storage, whatsapp, url, image-converter, employee-assignment
│   └── proxy.ts                     # Middleware entry point (next.js)
---

## 19. Justificaciones de Asistencia y Tiempo de Bonificación (Fase 4)

### Reglas de Negocio
- **Justificaciones Independientes**: Se pueden justificar entradas tardías (`check_in`), salidas anticipadas (`check_out`) y ausencias (`absence`) sin que una modifique ni sobreescriba la condición de la otra.
- **Auditoría de Justificaciones**: Cada justificación registra tipo, motivo, detalle opcional, enlace a evidencia adjunta, estado (`pending`, `approved`, `rejected`), usuario creador, usuario aprobador y trazabilidad completa de cambios en JSONB.
- **Cálculo de Bonificación Nocturna/Extendida (`bonus_minutes`)**:
  - Zona horaria estricta: **`America/Lima` (UTC-5)**.
  - Lunes a Sábado: la bonificación inicia a las **21:10**.
  - Domingo: la bonificación inicia a las **20:10**.
  - Fórmula: `bonus_minutes = max(0, check_out_local - bonus_start_local)`.
  - Recalculado automáticamente en escaneos QR de salida o modificaciones de horario.
  - Soporte de ajustes manuales auditados (`bonus_calculation_type: 'manual'`) con protección contra sobreescrituras automáticas.
- **Configuración Centralizada (`bonus_settings`)**: Permite a los administradores ajustar las horas de inicio por día de la semana y métodos de redondeo.

### Nuevas Tablas y Columnas
- `attendance_justifications`: Registro de justificaciones con estados, adjuntos y auditoría.
- `bonus_settings`: Reglas de hora de inicio de bonificación por día de la semana.
- `employee_attendances`: Columnas `bonus_minutes`, `bonus_calculation_type`, `bonus_adjusted_by`, `bonus_adjusted_at`, `bonus_adjustment_reason`, `check_in_justified`, `check_out_justified`.

### Nuevos Endpoints
- `GET, POST /api/admin/attendance/justifications`
- `PATCH /api/admin/attendance/justifications/[id]` (Aprobar/rechazar)
- `GET, PUT /api/admin/attendance/bonus-settings` (Reglas de bonificación)
- `POST /api/admin/attendance/bonus-adjust` (Ajuste manual auditado)

### Nuevos Componentes UI
- `JustificationModal.tsx`: Registro de justificación con subida de comprobantes.
- `JustificationHistoryModal.tsx`: Visualización de justificaciones, evidencias y panel de aprobación.
- `BonusSettingsModal.tsx`: Edición de horarios de inicio de bonificación.
- `BonusAdjustmentModal.tsx`: Corrección manual de minutos de bonificación.

---

## 20. Permisos por Rango y Calendario por Empleado (Fase 5)

### Reglas de Negocio
- **Permisos por Rango de Fechas y Horas**: La tabla `employee_blocks` soporta bloqueos multiespecíficos con `start_date`, `end_date`, `is_all_day`, `start_time` y `end_time`.
- **Tipos de Permiso**: Vacaciones, Médico, Personal, Capacitación, Maternidad/Paternidad y Otro.
- **Estados de Aprobación**: `approved`, `pending`, `rejected`, `cancelled`.
- **Bloqueo Estricto de Disponibilidad**: Solo los permisos con estado **`approved`** bloquean la disponibilidad en `/api/availability` y en la asignación automática (`employee-assignment.ts`).
- **Detección de Conflictos**: Al registrar un permiso que coincida con citas existentes asignadas al colaborador, el sistema genera una advertencia detallada con las reservas afectadas sin cancelarlas automáticamente.
- **Módulo de Calendario por Empleado (`/dashboard/calendario`)**:
  - Vistas: **Día**, **Semana**, **Mes**.
  - Filtro por colaborador individual o general.
  - Toggles por tipo de evento: Reservas (`📅`), Permisos (`🟡`), Asistencia (`🟢`) y Bonificaciones (`⏱️`).
  - Modal interactivo de detalle de eventos con información completa de clientes, servicios, montos y observaciones.

### Nuevos y Modificados Endpoints
- `GET, POST, DELETE /api/admin/employees/absences`: Gestión de permisos por rango y detección de conflictos.
- `PATCH /api/admin/employees/absences/[id]`: Aprobación, rechazo y auditoría de permisos.
- `GET /api/admin/calendar/events`: Consulta consolidada de eventos del calendario.

### Nuevos Componentes UI
- `EmployeeAbsenceRangeModal.tsx`: Modal para registrar permisos por rango con comprobantes y detección de conflictos.
- `CalendarManager.tsx`: Administrador interactivo de calendario con vistas Día/Semana/Mes.
- `CalendarEventModal.tsx`: Modal de detalle de eventos.
- `src/app/dashboard/calendario/page.tsx`: Página del panel de calendario.

---

## 21. Integración, Seguridad, Migraciones y Pruebas Finales (Fase 6)

### Seguridad y Blindaje
- **Sanitización contra Inyección de Fórmulas en Excel (CSV/XLSX Formula Injection)**: En `excel-generator.ts`, todos los campos de texto originados por el usuario que comiencen con `=`, `+`, `-`, `@`, `\t` o `\r` se prefijan automáticamente con comilla simple `'` para neutralizar su ejecución en Excel o LibreOffice.
- **Control Estricto de Roles y Autorización**:
  - `admin`: Control total financiero, anulación de pagos/egresos, configuración de QR, auditoría y bonificaciones.
  - `recepcionista`: Registro de pagos y reservas, subida de comprobantes y consulta de reportes operativos; denegado anular pagos/egresos o modificar configuración del negocio.
  - `empleado`: Acceso restringido únicamente a su perfil y asistencias; denegado acceso a finanzas globales y reportes.
  - `cliente`: Creación de reservas y visualización de instrucciones de pago; denegado confirmar sus propios pagos o alterar montos.
- **Seguridad en Supabase**:
  - Clave `service_role` ejecutada exclusivamente en entornos backend Node.js (`createAdminClient`).
  - Row Level Security (RLS) habilitado y configurado en todas las tablas (`payment_logs`, `expenses`, `attendance_justifications`, `bonus_settings`, `employee_blocks`, `payment_settings`).
  - Verificación de roles en cada transacción de API mediante `verifyAdmin` y `verifyAuth`.

### Integridad Financiera
- **Invariantes Numéricos**:
  - `amount >= 0`, `yape_amount >= 0`, `cash_amount >= 0`.
  - En pagos mixtos: `yape_amount_cents + cash_amount_cents = amount_cents`.
  - Solo pagos verificados (`status = 'verified'`) suman a los ingresos. Pagos anulados (`voided`) se excluyen.
  - Solo egresos activos (`status = 'active'`) se deducen. Egresos anulados (`voided`) se excluyen.
  - Saldo pendiente (`balance_cents`) nunca es negativo ante pagos completos.
  - La confirmación automática de reservas requiere el adelanto del 25% o pago total.

### Bundle de Migraciones y Rollback
- `supabase/migrations/000_full_migration_bundle.sql`: Script consolidado con las fases 001 a 006, triggers, funciones, índices y políticas RLS.
- `supabase/migrations/999_rollback_bundle.sql`: Script documentado de reversión segura.

### Suite de Pruebas Automatizadas
- 27 pruebas automatizadas de invariantes matemáticos, neutralización de fórmulas, bonificaciones de horario (`America/Lima`), solapamiento de permisos y matriz de autorización por rol ejecutadas con 100% de éxito.


