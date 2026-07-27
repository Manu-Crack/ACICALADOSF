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
 * POST /api/admin/employees/absences
 * Registrar un permiso / ausencia para un empleado en una fecha específica
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { employee_id, block_date, reason, start_time, end_time } = body;

    if (!employee_id || !block_date) {
      return NextResponse.json(
        { error: "El empleado y la fecha de ausencia son obligatorios" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    const { data: block, error } = await admin
      .from("employee_blocks")
      .insert({
        employee_id,
        block_date,
        reason: reason || "Permiso / Ausencia",
        start_time: start_time || null,
        end_time: end_time || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(block, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST absence error:", msg);
    return NextResponse.json({ error: "Error al registrar ausencia: " + msg }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/employees/absences?id=<block_id>
 * Eliminar una ausencia registrada
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
      return NextResponse.json({ error: "El ID de la ausencia es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("employee_blocks").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("DELETE absence error:", msg);
    return NextResponse.json({ error: "Error al eliminar ausencia: " + msg }, { status: 500 });
  }
}
