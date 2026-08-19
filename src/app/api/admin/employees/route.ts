import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function verifyAdmin(allowedRoles: string[] = ["admin"]) {
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
    return { error: "Acceso denegado. Se requieren permisos de administrador.", status: 403 };
  }

  return { user, profile };
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    if ("message" in err && typeof (err as { message: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    if ("error" in err && typeof (err as { error: unknown }).error === "string") {
      return (err as { error: string }).error;
    }
    if ("details" in err && typeof (err as { details: unknown }).details === "string") {
      return (err as { details: string }).details;
    }
    if ("hint" in err && typeof (err as { hint: unknown }).hint === "string") {
      return (err as { hint: string }).hint;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/**
 * GET /api/admin/employees
 * Listar empleados con sus servicios (skills) y sus ausencias
 */
export async function GET() {
  try {
    const auth = await verifyAdmin(["admin", "recepcionista"]);
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
    const msg = getErrorMessage(err);
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
    const { first_name, last_name, type, is_active, service_ids } = body;

    if (!first_name?.trim() || !last_name?.trim() || !type) {
      return NextResponse.json(
        { error: "Nombre, Apellido y Tipo de Empleado son obligatorios" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Crear registro de empleado (solo columnas existentes en la tabla employees)
    const { data: emp, error: createError } = await admin
      .from("employees")
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        type,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (createError) throw createError;

    // 2. Insertar habilidades asignadas (employee_skills) de forma independiente
    if (Array.isArray(service_ids) && service_ids.length > 0) {
      const uniqueServiceIds = Array.from(new Set(service_ids.filter(Boolean)));
      if (uniqueServiceIds.length > 0) {
        const skillRows = uniqueServiceIds.map((service_id: string) => ({
          employee_id: emp.id,
          service_id,
        }));
        const { error: skillError } = await admin.from("employee_skills").insert(skillRows);
        if (skillError) throw skillError;
      }
    }

    return NextResponse.json(emp, { status: 201 });
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
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
    const { id, first_name, last_name, type, is_active, service_ids } = body;

    if (!id) {
      return NextResponse.json({ error: "El ID del empleado es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // 1. Actualizar tabla principal de empleado exclusivamente con columnas válidas
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof first_name === "string" && first_name.trim()) {
      updatePayload.first_name = first_name.trim();
    }
    if (typeof last_name === "string" && last_name.trim()) {
      updatePayload.last_name = last_name.trim();
    }
    if (type === "barberia" || type === "spa") {
      updatePayload.type = type;
    }
    if (typeof is_active === "boolean") {
      updatePayload.is_active = is_active;
    }

    const { data: emp, error: updateError } = await admin
      .from("employees")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Actualizar tabla relacional employee_skills de forma independiente
    if (Array.isArray(service_ids)) {
      const { error: deleteSkillError } = await admin
        .from("employee_skills")
        .delete()
        .eq("employee_id", id);

      if (deleteSkillError) throw deleteSkillError;

      const uniqueServiceIds = Array.from(new Set(service_ids.filter(Boolean)));
      if (uniqueServiceIds.length > 0) {
        const skillRows = uniqueServiceIds.map((service_id: string) => ({
          employee_id: id,
          service_id,
        }));
        const { error: insertSkillError } = await admin
          .from("employee_skills")
          .insert(skillRows);

        if (insertSkillError) throw insertSkillError;
      }
    }

    return NextResponse.json(emp);
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
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
    const msg = getErrorMessage(err);
    console.error("DELETE employee error:", msg);
    return NextResponse.json({ error: "Error al eliminar empleado: " + msg }, { status: 500 });
  }
}
