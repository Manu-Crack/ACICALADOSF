import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
      slug,
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

    if (!name || !slug || !type) {
      return NextResponse.json({ error: "name, slug y type son obligatorios" }, { status: 422 });
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
        slug,
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
        return NextResponse.json({ error: "El slug ya está en uso" }, { status: 409 });
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
        return NextResponse.json({ error: "El slug ya está en uso" }, { status: 409 });
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
      return NextResponse.json({ error: "id es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // First get the service to clean up images
    const { data: service } = await admin
      .from("services")
      .select("images")
      .eq("id", id)
      .single();

    // Delete associated images from storage
    if (service?.images?.length) {
      const paths = service.images.map((url: string) => {
        const parts = url.split("/services-images/");
        return parts[1] || "";
      }).filter(Boolean);

      if (paths.length) {
        await admin.storage.from("services-images").remove(paths);
      }
    }

    const { error } = await admin
      .from("services")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Services DELETE error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
