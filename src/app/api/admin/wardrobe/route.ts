import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractStoragePath } from "@/lib/utils/storage";

/**
 * GET    /api/admin/wardrobe — Listar todos los ítems de vestuario
 * POST   /api/admin/wardrobe — Crear un nuevo ítem de vestuario
 * PUT    /api/admin/wardrobe — Actualizar un ítem de vestuario y limpiar imágenes huérfanas
 * DELETE /api/admin/wardrobe — Eliminar físicamente un ítem de vestuario y sus imágenes en Storage
 */

async function verifyAuth(allowedRoles: string[] = ["admin", "recepcionista"]) {
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

  if (!profile || !allowedRoles.includes(profile.role)) {
    return { error: "Acceso denegado", status: 403 };
  }

  return { user, profile };
}

export async function GET() {
  try {
    const auth = await verifyAuth(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("wardrobe_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error("Wardrobe GET error:", err);
    return NextResponse.json({ error: "Error al obtener catálogo de vestuario" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      name,
      description,
      section,
      category,
      price_cents,
      images,
      is_active,
      sort_order,
      availability_status,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "El título o nombre del vestuario es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("wardrobe_items")
      .insert({
        name: name.trim(),
        description: description ? description.trim() : null,
        section: section ? section.trim().toUpperCase() : "A",
        category: category ? category.trim() : "Bodas & Matrimonios",
        price_cents: typeof price_cents === "number" && price_cents >= 0 ? price_cents : 0,
        images: Array.isArray(images) ? images : [],
        is_active: is_active ?? true,
        sort_order: typeof sort_order === "number" ? sort_order : 0,
        availability_status: availability_status || "disponible",
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase Wardrobe POST Error:", error);
      return NextResponse.json(
        { error: "Error al crear el vestuario en la base de datos: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Wardrobe POST Exception:", errorMsg);
    return NextResponse.json({ error: "Error interno al crear el vestuario: " + errorMsg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "El ID del vestuario es obligatorio" }, { status: 422 });
    }

    if (updates.name !== undefined && (!updates.name || !updates.name.trim())) {
      return NextResponse.json({ error: "El título no puede estar vacío" }, { status: 422 });
    }

    const admin = createAdminClient();

    // Obtener ítem anterior para comparar y limpiar imágenes eliminadas en Storage
    const { data: existingItem } = await admin
      .from("wardrobe_items")
      .select("images")
      .eq("id", id)
      .single();

    if (existingItem?.images?.length && Array.isArray(updates.images)) {
      const removedImages = existingItem.images.filter(
        (oldUrl: string) => !updates.images.includes(oldUrl)
      );

      const pathsToRemove = removedImages
        .map((url: string) => extractStoragePath(url, "wardrobe-images"))
        .filter((path: string | null): path is string => !!path);

      if (pathsToRemove.length > 0) {
        await admin.storage.from("wardrobe-images").remove(pathsToRemove);
      }
    }

    const cleanUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) cleanUpdates.name = updates.name.trim();
    if (updates.description !== undefined) cleanUpdates.description = updates.description?.trim() || null;
    if (updates.section !== undefined) cleanUpdates.section = updates.section?.trim().toUpperCase() || "A";
    if (updates.category !== undefined) cleanUpdates.category = updates.category?.trim() || "Bodas & Matrimonios";
    if (updates.price_cents !== undefined) cleanUpdates.price_cents = Math.max(0, updates.price_cents);
    if (updates.images !== undefined) cleanUpdates.images = updates.images;
    if (updates.is_active !== undefined) cleanUpdates.is_active = updates.is_active;
    if (updates.sort_order !== undefined) cleanUpdates.sort_order = updates.sort_order;
    if (updates.availability_status !== undefined) cleanUpdates.availability_status = updates.availability_status;

    const { data, error } = await admin
      .from("wardrobe_items")
      .update(cleanUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase Wardrobe PUT Error:", error);
      return NextResponse.json(
        { error: "Error al actualizar el vestuario en la base de datos: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Wardrobe PUT Exception:", errorMsg);
    return NextResponse.json({ error: "Error interno al actualizar el vestuario: " + errorMsg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "El ID del vestuario es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // 1. Obtener imágenes del ítem antes de borrar
    const { data: item, error: fetchError } = await admin
      .from("wardrobe_items")
      .select("id, name, images")
      .eq("id", id)
      .single();

    if (fetchError || !item) {
      return NextResponse.json(
        { error: "El vestuario no existe o ya fue eliminado" },
        { status: 404 }
      );
    }

    // 2. Eliminar de la base de datos
    const { error: deleteError } = await admin
      .from("wardrobe_items")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error al eliminar vestuario de BD:", deleteError);
      return NextResponse.json(
        { error: "Error al eliminar de la base de datos: " + deleteError.message },
        { status: 500 }
      );
    }

    // 3. Eliminar archivos de imagen en Supabase Storage
    if (item.images?.length) {
      const paths = item.images
        .map((url: string) => extractStoragePath(url, "wardrobe-images"))
        .filter((path: string | null): path is string => !!path);

      if (paths.length > 0) {
        const { error: storageError } = await admin.storage
          .from("wardrobe-images")
          .remove(paths);

        if (storageError) {
          console.warn("Advertencia al eliminar imágenes de vestuario en Storage:", storageError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      id,
      message: `Vestuario '${item.name}' eliminado exitosamente.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Wardrobe DELETE Exception:", errorMsg);
    return NextResponse.json(
      { error: "Error interno al eliminar el vestuario: " + errorMsg },
      { status: 500 }
    );
  }
}
