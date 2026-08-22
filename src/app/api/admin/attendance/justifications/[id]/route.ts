import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/admin/attendance/justifications/[id]
 * Aprueba o rechaza una justificación de asistencia.
 * Autorizado exclusivamente para el rol 'admin'.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, first_name, last_name")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Solo los administradores pueden aprobar o rechazar justificaciones" }, { status: 403 });
    }

    const body = await request.json();
    const { status, review_notes } = body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "El estado debe ser 'approved' o 'rejected'" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Obtener la justificación existente
    const { data: existing, error: findErr } = await admin
      .from("attendance_justifications")
      .select("*")
      .eq("id", id)
      .single();

    if (findErr || !existing) {
      return NextResponse.json({ error: "Justificación no encontrada" }, { status: 404 });
    }

    const userName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || user.email || "Administrador";
    const history = Array.isArray(existing.audit_history) ? existing.audit_history : [];

    history.push({
      action: status === "approved" ? "approved" : "rejected",
      user_id: user.id,
      user_name: userName,
      timestamp: new Date().toISOString(),
      details: review_notes?.trim() || `Estado cambiado a ${status}`,
    });

    const now = new Date().toISOString();

    // Actualizar registro de justificación
    const { data: updated, error: updateErr } = await admin
      .from("attendance_justifications")
      .update({
        status,
        approved_by: user.id,
        approved_at: now,
        observation: review_notes?.trim() || existing.observation,
        audit_history: history,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      console.error("Error updating justification:", updateErr);
      return NextResponse.json({ error: "No se pudo actualizar la justificación" }, { status: 500 });
    }

    // Si fue aprobada y tiene attendance_id, actualizar la bandera correspondiente en employee_attendances
    if (status === "approved" && existing.attendance_id) {
      if (existing.type === "check_in") {
        await admin
          .from("employee_attendances")
          .update({ check_in_justified: true, updated_at: now })
          .eq("id", existing.attendance_id);
      } else if (existing.type === "check_out") {
        await admin
          .from("employee_attendances")
          .update({ check_out_justified: true, updated_at: now })
          .eq("id", existing.attendance_id);
      }
    } else if (status === "rejected" && existing.attendance_id) {
      // Si fue rechazada, asegurar que la bandera quede en false
      if (existing.type === "check_in") {
        await admin
          .from("employee_attendances")
          .update({ check_in_justified: false, updated_at: now })
          .eq("id", existing.attendance_id);
      } else if (existing.type === "check_out") {
        await admin
          .from("employee_attendances")
          .update({ check_out_justified: false, updated_at: now })
          .eq("id", existing.attendance_id);
      }
    }

    return NextResponse.json({
      message: status === "approved" ? "Justificación aprobada con éxito" : "Justificación rechazada",
      justification: updated,
    });
  } catch (error) {
    console.error("PATCH /api/admin/attendance/justifications/[id] exception:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
