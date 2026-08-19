import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";
import { extractStoragePath } from "@/lib/utils/storage";

/**
 * GET  /api/admin/services — Listar todos los servicios (vista admin, incluye inactivos)
 * POST /api/admin/services — Crear un nuevo servicio
 * PUT  /api/admin/services — Actualizar servicio y limpiar imágenes removidas de Storage
 * DELETE /api/admin/services — Eliminar físicamente (HARD DELETE) un servicio de la base de datos y Storage
 */

async function verifyAdmin(requiredRole: string[] = ["admin", "recepcionista"]) {
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

  if (!profile || !requiredRole.includes(profile.role)) {
    return { error: "Acceso denegado", status: 403 };
  }

  return { user, profile };
}

export async function GET() {
  try {
    const auth = await verifyAdmin(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("services")
      .select("*")
      .order("sort_order");

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("Services GET error:", err);
    return NextResponse.json({ error: "Error interno al obtener servicios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      name,
      description,
      type,
      price_cents,
      duration_minutes,
      capacity,
      staff_required,
      is_public,
      is_active,
      images,
      attributes,
      sort_order,
    } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "El nombre y el tipo son obligatorios" }, { status: 422 });
    }
    if (!["spa", "barberia"].includes(type)) {
      return NextResponse.json({ error: "El tipo debe ser 'spa' o 'barberia'" }, { status: 422 });
    }
    if (price_cents === undefined || price_cents < 0) {
      return NextResponse.json({ error: "El precio debe ser mayor o igual a 0" }, { status: 422 });
    }
    if (!duration_minutes || duration_minutes <= 0) {
      return NextResponse.json({ error: "La duración debe ser mayor a 0 minutos" }, { status: 422 });
    }

    // Generar slug obligatorio no nulo para la tabla services
    const baseSlug = slugify(name);
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("services")
      .insert({
        name,
        slug: uniqueSlug,
        description: description || null,
        type,
        price_cents: price_cents || 0,
        duration_minutes,
        capacity: capacity || 1,
        staff_required: staff_required || 1,
        is_public: is_public ?? true,
        is_active: is_active ?? true,
        images: images || [],
        attributes: attributes || {},
        sort_order: sort_order || 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase Services POST Error:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un servicio con ese nombre" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Error al crear el servicio en la base de datos: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Services POST Exception:", errorMsg);
    return NextResponse.json({ error: "Error interno al crear el servicio: " + errorMsg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdmin(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "El ID del servicio es obligatorio" }, { status: 422 });
    }

    if (updates.type && !["spa", "barberia"].includes(updates.type)) {
      return NextResponse.json({ error: "El tipo debe ser 'spa' o 'barberia'" }, { status: 422 });
    }

    const admin = createAdminClient();

    // Obtener servicio anterior para comparar y limpiar imágenes removidas de Storage
    const { data: existingService } = await admin
      .from("services")
      .select("images")
      .eq("id", id)
      .single();

    if (existingService?.images?.length && Array.isArray(updates.images)) {
      const removedImages = existingService.images.filter(
        (oldUrl: string) => !updates.images.includes(oldUrl)
      );

      const pathsToRemove = removedImages
        .map((url: string) => extractStoragePath(url))
        .filter((path: string | null): path is string => !!path);

      if (pathsToRemove.length > 0) {
        await admin.storage.from("services-images").remove(pathsToRemove);
      }
    }

    const { data, error } = await admin
      .from("services")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase Services PUT Error:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un servicio con ese nombre" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Error al actualizar el servicio en la base de datos: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Services PUT Exception:", errorMsg);
    return NextResponse.json({ error: "Error interno al actualizar el servicio: " + errorMsg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdmin(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "El ID del servicio es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // 1. Obtener la información del servicio (imágenes) antes de la eliminación definitiva
    const { data: service, error: fetchError } = await admin
      .from("services")
      .select("id, name, images")
      .eq("id", id)
      .single();

    if (fetchError || !service) {
      return NextResponse.json(
        { error: "El servicio no existe o ya fue eliminado anteriormente" },
        { status: 404 }
      );
    }

    // 2. Limpiar asociaciones explícitamente en employee_skills y booking_services
    await admin.from("employee_skills").delete().eq("service_id", id);
    await admin.from("booking_services").delete().eq("service_id", id);

    // 3. Ejecutar ELIMINACIÓN FÍSICA DEFINITIVA (Hard Delete) en la tabla services
    const { error: deleteError } = await admin
      .from("services")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error al eliminar servicio definitivamente en la BD:", deleteError);
      return NextResponse.json(
        { error: "Error al eliminar el servicio de la base de datos: " + deleteError.message },
        { status: 500 }
      );
    }

    // 4. Eliminar físicamente los archivos de imágenes alojados en Supabase Storage
    if (service.images?.length) {
      const paths = service.images
        .map((url: string) => extractStoragePath(url))
        .filter((path: string | null): path is string => !!path);

      if (paths.length > 0) {
        const { error: storageError } = await admin.storage
          .from("services-images")
          .remove(paths);

        if (storageError) {
          console.warn("Advertencia al eliminar imágenes del servicio en Storage:", storageError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      id,
      hardDeleted: true,
      message: `Servicio '${service.name}' eliminado físicamente de la base de datos y de Storage.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Services DELETE Exception:", errorMsg);
    return NextResponse.json(
      { error: "Error interno al procesar la eliminación del servicio: " + errorMsg },
      { status: 500 }
    );
  }
}
