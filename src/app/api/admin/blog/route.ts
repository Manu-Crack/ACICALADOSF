import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";
import { extractStoragePath } from "@/lib/utils/storage";

/**
 * GET  /api/admin/blog — Listar todos los artículos (vista admin, incluye borradores)
 * POST /api/admin/blog — Crear un nuevo artículo de blog
 * PUT  /api/admin/blog — Actualizar artículo y limpiar imagen de portada anterior si fue modificada
 * DELETE /api/admin/blog — Eliminar físicamente un artículo y su imagen de Storage
 */

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado", status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "recepcionista"].includes(profile.role)) {
    return { error: "Acceso denegado: solo personal autorizado", status: 403 };
  }

  return { user, profile };
}

export async function GET() {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blog_posts")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("Blog GET error:", err);
    return NextResponse.json({ error: "Error interno al obtener artículos de blog" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      title,
      slug: customSlug,
      excerpt,
      content,
      cover_image,
      category,
      reading_time,
      is_published,
      published_at,
      sort_order,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "El título del artículo es obligatorio" }, { status: 422 });
    }

    // Generar slug único sanitizado
    const baseSlug = customSlug?.trim() ? slugify(customSlug) : slugify(title);
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    // Si se publica y no tiene fecha de publicación, asignamos la fecha actual
    const finalPublishedAt = is_published ? (published_at || new Date().toISOString()) : (published_at || null);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blog_posts")
      .insert({
        title: title.trim(),
        slug: uniqueSlug,
        excerpt: excerpt?.trim() || null,
        content: content?.trim() || "",
        cover_image: cover_image?.trim() || null,
        category: category?.trim() || "Cuidado Masculino",
        reading_time: reading_time ? Number(reading_time) : 5,
        is_published: !!is_published,
        published_at: finalPublishedAt,
        author_id: auth.user.id,
        sort_order: sort_order ? Number(sort_order) : 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase Blog POST Error:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un artículo con ese título o enlace" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Error al crear el artículo en la base de datos: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Blog POST Exception:", errorMsg);
    return NextResponse.json({ error: "Error interno al crear artículo: " + errorMsg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "El ID del artículo es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // Obtener artículo anterior para comparar y limpiar imagen removida de Storage
    const { data: existingPost } = await admin
      .from("blog_posts")
      .select("cover_image")
      .eq("id", id)
      .single();

    if (
      existingPost?.cover_image &&
      updates.cover_image !== undefined &&
      existingPost.cover_image !== updates.cover_image
    ) {
      const pathToRemove = extractStoragePath(existingPost.cover_image, "blog-images");
      if (pathToRemove) {
        await admin.storage.from("blog-images").remove([pathToRemove]);
      }
    }

    // Manejo de fecha de publicación al alternar is_published
    if (updates.is_published && !updates.published_at) {
      updates.published_at = new Date().toISOString();
    }

    const { data, error } = await admin
      .from("blog_posts")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase Blog PUT Error:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un artículo con ese enlace o título" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Error al actualizar el artículo: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Blog PUT Exception:", errorMsg);
    return NextResponse.json({ error: "Error interno al actualizar el artículo: " + errorMsg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "El ID del artículo es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // 1. Obtener artículo para recuperar su cover_image antes de borrar
    const { data: post, error: fetchError } = await admin
      .from("blog_posts")
      .select("id, title, cover_image")
      .eq("id", id)
      .single();

    if (fetchError || !post) {
      return NextResponse.json(
        { error: "El artículo no existe o ya fue eliminado" },
        { status: 404 }
      );
    }

    // 2. Eliminar físicamente el registro de la tabla blog_posts
    const { error: deleteError } = await admin
      .from("blog_posts")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error al eliminar artículo:", deleteError);
      return NextResponse.json(
        { error: "Error al eliminar el artículo de la base de datos: " + deleteError.message },
        { status: 500 }
      );
    }

    // 3. Eliminar imagen en Storage si existe
    if (post.cover_image) {
      const storagePath = extractStoragePath(post.cover_image, "blog-images");
      if (storagePath) {
        await admin.storage.from("blog-images").remove([storagePath]);
      }
    }

    return NextResponse.json({
      success: true,
      id,
      message: `Artículo '${post.title}' eliminado exitosamente.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Blog DELETE Exception:", errorMsg);
    return NextResponse.json({ error: "Error interno al eliminar artículo: " + errorMsg }, { status: 500 });
  }
}
