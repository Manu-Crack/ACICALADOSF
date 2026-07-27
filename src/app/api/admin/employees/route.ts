import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    return { error: "Acceso denegado", status: 403 };
  }

  return { user, profile };
}

/**
 * GET /api/admin/employees
 * Listar empleados con sus servicios (skills) y sus ausencias
 */
export async function GET() {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = createAdminClient();

    const { data: employees, error: empError } = await admin
      .from("employees")
      .select("*, employee_skills(service_id), employee_blocks(*)")
      .order("first_name");

    if (empError) throw empError;

    return NextResponse.json(employees);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET employees error:", msg);
    return NextResponse.json({ error: "Error al obtener empleados: " + msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/employees
 * Crear un nuevo empleado con sus habilidades asignadas
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { first_name, last_name, email, phone, type, service_ids } = body;

    if (!first_name || !last_name || !type) {
      return NextResponse.json(
        { error: "Nombre, Apellido y Tipo de Empleado son obligatorios" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Crear registro de empleado
    const { data: emp, error: createError } = await admin
      .from("employees")
      .insert({
        first_name,
        last_name,
        email: email || null,
        phone: phone || null,
        type,
        is_active: true,
      })
      .select()
      .single();

    if (createError) throw createError;

    // 2. Insertar habilidades asignadas (employee_skills)
    if (service_ids?.length && Array.isArray(service_ids)) {
      const skillRows = service_ids.map((service_id: string) => ({
        employee_id: emp.id,
        service_id,
      }));
      await admin.from("employee_skills").insert(skillRows);
    }

    return NextResponse.json(emp, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST employee error:", msg);
    return NextResponse.json({ error: "Error al crear empleado: " + msg }, { status: 500 });
  }
}

/**
 * PUT /api/admin/employees
 * Actualizar datos del empleado y sus servicios capacitados
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, first_name, last_name, email, phone, type, is_active, service_ids } = body;

    if (!id) {
      return NextResponse.json({ error: "El ID del empleado es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // 1. Actualizar empleado
    const { data: emp, error: updateError } = await admin
      .from("employees")
      .update({
        first_name,
        last_name,
        email: email || null,
        phone: phone || null,
        type,
        is_active: is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Actualizar employee_skills (reemplazar)
    if (Array.isArray(service_ids)) {
      await admin.from("employee_skills").delete().eq("employee_id", id);
      if (service_ids.length > 0) {
        const skillRows = service_ids.map((service_id: string) => ({
          employee_id: id,
          service_id,
        }));
        await admin.from("employee_skills").insert(skillRows);
      }
    }

    return NextResponse.json(emp);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PUT employee error:", msg);
    return NextResponse.json({ error: "Error al actualizar empleado: " + msg }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/employees?id=<id>
 * Eliminar físicamente un empleado de la base de datos
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "El ID del empleado es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // Eliminar ausencias y habilidades asociadas
    await admin.from("employee_blocks").delete().eq("employee_id", id);
    await admin.from("employee_skills").delete().eq("employee_id", id);

    // Desvincular de reservas pasadas
    await admin.from("bookings").update({ assigned_employee_id: null }).eq("assigned_employee_id", id);

    const { error: deleteError } = await admin.from("employees").delete().eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("DELETE employee error:", msg);
    return NextResponse.json({ error: "Error al eliminar empleado: " + msg }, { status: 500 });
  }
}
