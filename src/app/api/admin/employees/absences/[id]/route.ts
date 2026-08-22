import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/admin/employees/absences/[id]
 * Actualiza el estado o detalle de un permiso (aprobar, rechazar, anular).
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
      return NextResponse.json({ error: "Solo los administradores pueden modificar o aprobar permisos" }, { status: 403 });
    }

    const body = await request.json();
    const { status, observation, reason } = body;

    const admin = createAdminClient();
    const { data: existing, error: findErr } = await admin
      .from("employee_blocks")
      .select("*")
      .eq("id", id)
      .single();

    if (findErr || !existing) {
      return NextResponse.json({ error: "Permiso no encontrado" }, { status: 404 });
    }

    const userName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || user.email || "Administrador";
    const history = Array.isArray(existing.audit_history) ? existing.audit_history : [];
    const now = new Date().toISOString();

    if (status && status !== existing.status) {
      history.push({
        action: `status_change_to_${status}`,
        user_id: user.id,
        user_name: userName,
        timestamp: now,
        details: `Estado cambiado de ${existing.status} a ${status}`,
      });
    }

    const updatePayload: Record<string, unknown> = {
      audit_history: history,
      updated_at: now,
    };

    if (status) {
      updatePayload.status = status;
      if (status === "approved") {
        updatePayload.approved_by = user.id;
        updatePayload.approved_at = now;
      }
    }
    if (observation !== undefined) updatePayload.observation = observation;
    if (reason !== undefined) updatePayload.reason = reason;

    const { data: updated, error: updateErr } = await admin
      .from("employee_blocks")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      console.error("Error updating permission block:", updateErr);
      return NextResponse.json({ error: "No se pudo actualizar el permiso" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Permiso actualizado correctamente",
      permission: updated,
    });
  } catch (error) {
    console.error("PATCH /api/admin/employees/absences/[id] exception:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
