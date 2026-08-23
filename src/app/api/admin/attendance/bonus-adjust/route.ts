import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/attendance/bonus-adjust
 * Ajusta manualmente los minutos de bonificación de un registro de asistencia con auditoría completa.
 * Exclusivo para el rol 'admin'.
 */
export async function POST(request: Request) {
  try {
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
      return NextResponse.json({ error: "Solo los administradores pueden realizar ajustes manuales de bonificación" }, { status: 403 });
    }

    const body = await request.json();
    const { attendance_id, bonus_minutes, reason } = body;

    if (!attendance_id) {
      return NextResponse.json({ error: "El ID de asistencia es obligatorio" }, { status: 400 });
    }
    if (typeof bonus_minutes !== "number" || bonus_minutes < 0) {
      return NextResponse.json({ error: "Los minutos de bonificación deben ser un número mayor o igual a 0" }, { status: 400 });
    }
    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: "Debe ingresar un motivo de ajuste válido (mínimo 5 caracteres)" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Obtener registro existente para auditoría
    const { data: existing, error: findErr } = await admin
      .from("employee_attendances")
      .select("id, bonus_minutes, bonus_calculation_type")
      .eq("id", attendance_id)
      .single();

    if (findErr || !existing) {
      return NextResponse.json({ error: "Registro de asistencia no encontrado" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await admin
      .from("employee_attendances")
      .update({
        bonus_minutes: Math.round(bonus_minutes),
        bonus_calculation_type: "manual",
        bonus_adjusted_by: user.id,
        bonus_adjusted_at: now,
        bonus_adjustment_reason: reason.trim(),
        updated_at: now,
      })
      .eq("id", attendance_id)
      .select()
      .single();

    if (updateErr) {
      console.error("Error adjusting bonus minutes:", updateErr);
      return NextResponse.json({ error: "No se pudo actualizar la bonificación" }, { status: 500 });
    }

    return NextResponse.json({
      message: `Bonificación ajustada a ${bonus_minutes} minutos (${(bonus_minutes / 60).toFixed(2)} hrs) correctamente`,
      attendance: updated,
    });
  } catch (error) {
    console.error("POST /api/admin/attendance/bonus-adjust exception:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
