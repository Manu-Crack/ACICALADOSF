import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_BONUS_RULES, type BonusRule } from "@/lib/types/bonus";

/**
 * GET /api/admin/attendance/bonus-settings
 * Retorna las reglas de bonificación horaria configuradas por día de la semana.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: rules, error } = await admin
      .from("bonus_settings")
      .select("*")
      .order("day_of_week", { ascending: true });

    if (error || !rules || rules.length === 0) {
      return NextResponse.json({ rules: DEFAULT_BONUS_RULES });
    }

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("GET /api/admin/attendance/bonus-settings exception:", error);
    return NextResponse.json({ rules: DEFAULT_BONUS_RULES });
  }
}

/**
 * PUT /api/admin/attendance/bonus-settings
 * Actualiza las reglas de inicio de bonificación horaria. Exclusivo para 'admin'.
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Solo los administradores pueden modificar las reglas de bonificación" }, { status: 403 });
    }

    const body = await request.json();
    const { rules } = body as { rules: BonusRule[] };

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return NextResponse.json({ error: "Lista de reglas inválida" }, { status: 400 });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    for (const r of rules) {
      if (r.bonus_start_time) {
        await admin
          .from("bonus_settings")
          .upsert(
            {
              day_of_week: r.day_of_week,
              day_name: r.day_name,
              bonus_start_time: r.bonus_start_time.length === 5 ? `${r.bonus_start_time}:00` : r.bonus_start_time,
              is_active: r.is_active ?? true,
              rounding_method: r.rounding_method || "none",
              effective_from: r.effective_from || "2026-01-01",
              updated_at: now,
              updated_by: user.id,
            },
            { onConflict: "day_of_week,effective_from" }
          );
      }
    }

    return NextResponse.json({ message: "Reglas de bonificación actualizadas correctamente" });
  } catch (error) {
    console.error("PUT /api/admin/attendance/bonus-settings exception:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
