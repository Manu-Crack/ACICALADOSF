<div align="center">

# ✂️ Acicalados

**Sistema de Gestión Integral: Spa, Barbería y Alquiler de Vestuario**

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Culqi](https://img.shields.io/badge/Culqi-FF4B4B?style=for-the-badge&logo=codeigniter&logoColor=white)](#)
[![PNPM](https://img.shields.io/badge/pnpm-%234a4a4a.svg?style=for-the-badge&logo=pnpm&logoColor=f69220)](https://pnpm.io/)

</div>

---

## 📝 Descripción

**Acicalados** es una plataforma web *Full-Stack* diseñada para gestionar y centralizar las operaciones de un negocio multifacético. El sistema integra de manera fluida la reserva de citas para servicios profesionales (Spa y Barbería), un catálogo para el alquiler de prendas de vestir y una tienda en línea con carrito de compras integrado.

---

## ✨ Características Principales

- **📅 Sistema de Reservas:** Flujo interactivo para agendar servicios de spa y barbería (`/reservar`).
- **👗 Alquiler de Vestuario:** Catálogo digital para explorar y gestionar el alquiler de prendas (`/vestuario`).
- **🛒 Tienda en Línea:** E-commerce integrado con un carrito de compras dinámico (`/tienda`).
- **💳 Pasarela de Pagos (Culqi):** Integración con Culqi para cobros y webhooks para actualizaciones de estado en tiempo real.
- **🔐 Autenticación:** Registro y login manejado por Supabase (`/mi-cuenta`).
- **🛠️ Panel de Administración:** Área protegida por roles para administrar servicios, inventario y citas (`/dashboard`).

---

## 🚀 Stack Tecnológico

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Backend & Base de Datos:** Supabase (PostgreSQL, Auth, Storage), Next.js Route Handlers
- **Pagos:** API REST de Culqi
- **Herramientas de Desarrollo:** PNPM, ESLint

---

## ⚙️ Instalación Local

1. **Clonar e instalar dependencias:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd acicalados-junio
   pnpm install
   pnpm run dev
