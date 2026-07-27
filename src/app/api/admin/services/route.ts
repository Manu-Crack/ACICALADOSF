import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractStoragePath } from "@/lib/utils/storage";

/**
 * GET  /api/admin/services — list all services (admin view, includes inactive)
 * POST /api/admin/services — create a new service
 * PUT  /api/admin/services — update an existing service
 * DELETE /api/admin/services — delete a service
 */

async function verifyAdmin(requiredRole: string[] = ["admin"]) {
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
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(["admin"]);
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
      return NextResponse.json({ error: "name y type son obligatorios" }, { status: 422 });
    }
    if (!["spa", "barberia"].includes(type)) {
      return NextResponse.json({ error: "type debe ser 'spa' o 'barberia'" }, { status: 422 });
    }
    if (price_cents < 0) {
      return NextResponse.json({ error: "price_cents debe ser >= 0" }, { status: 422 });
    }
    if (!duration_minutes || duration_minutes <= 0) {
      return NextResponse.json({ error: "duration_minutes debe ser > 0" }, { status: 422 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("services")
      .insert({
        name,
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
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un servicio con ese nombre" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Services POST error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdmin(["admin"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id es obligatorio" }, { status: 422 });
    }

    // Validate type if provided
    if (updates.type && !["spa", "barberia"].includes(updates.type)) {
      return NextResponse.json({ error: "type debe ser 'spa' o 'barberia'" }, { status: 422 });
    }

    const admin = createAdminClient();

    // Obtener servicio anterior para limpiar imágenes eliminadas en Storage
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
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un servicio con ese nombre" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Services PUT error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdmin(["admin"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "El ID del servicio es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // 1. Obtener la información del servicio (imágenes) antes de eliminar
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

    // 2. Eliminar referencias en employee_skills si existen
    await admin.from("employee_skills").delete().eq("service_id", id);

    // 3. Ejecutar el borrado en la base de datos PRIMERO
    const { error: deleteError } = await admin
      .from("services")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error al eliminar servicio en la BD:", deleteError);
      if (deleteError.code === "23503") {
        return NextResponse.json(
          {
            error:
              "No se puede eliminar este servicio porque ya cuenta con reservas asociadas en el sistema. Puedes ocultarlo desmarcando la opción 'Activo'.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Error al eliminar el servicio de la base de datos: " + deleteError.message },
        { status: 500 }
      );
    }

    // 4. Si el borrado en BD fue exitoso (200 OK), eliminar imágenes físicamente de Supabase Storage
    if (service.images?.length) {
      const paths = service.images
        .map((url: string) => extractStoragePath(url))
        .filter((path: string | null): path is string => !!path);

      if (paths.length > 0) {
        const { error: storageError } = await admin.storage
          .from("services-images")
          .remove(paths);

        if (storageError) {
          console.warn("Advertencia: No se pudieron borrar algunas imágenes de Storage:", storageError);
        }
      }
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("Services DELETE error:", err);
    return NextResponse.json(
      { error: "Error interno al procesar la eliminación del servicio" },
      { status: 500 }
    );
  }
}
