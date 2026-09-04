-- ==============================================================================
-- MIGRACIÓN 008: DEPRECIACIÓN Y ELIMINACIÓN TOTAL DEL MÓDULO BLOG
-- Sistema: Acicalados Spa & Barber Shop
-- ==============================================================================
-- Descripción:
-- Elimina de forma definitiva y limpia la tabla dedicada `public.blog_posts`,
-- sus políticas de seguridad RLS, índices asociados, y documenta el retiro
-- del bucket dedicado `blog-images` de Supabase Storage.
--
-- Salvaguarda:
-- NO altera bajo ninguna circunstancia las tablas de reservas, servicios,
-- productos, vestuario, clientes, empleados, egresos ni comprobantes de pago.
-- ==============================================================================

-- 1. Eliminar políticas RLS asociadas a blog_posts
DROP POLICY IF EXISTS "blog_posts_all_admin_recep" ON public.blog_posts;
DROP POLICY IF EXISTS "blog_posts_select_admin" ON public.blog_posts;
DROP POLICY IF EXISTS "blog_posts_select_public" ON public.blog_posts;

-- 2. Eliminar la tabla blog_posts de forma definitiva en cascada
DROP TABLE IF EXISTS public.blog_posts CASCADE;

-- 3. Nota de Storage:
-- El bucket 'blog-images' y sus objetos WebP internos han sido purgados
-- y eliminados a través de la Storage API de Supabase.
