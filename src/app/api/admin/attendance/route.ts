import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTENDANCE_STATUS, AttendanceStatus } from "@/lib/types/attendance";
import { calculateBonusMinutes } from "@/lib/utils/bonus-calculator";
import { DEFAULT_BONUS_RULES, type BonusRule } from "@/lib/types/bonus";

/**
 * Verificar autenticación y rol admin o recepcionista (lectura).
 */
async function verifyAuth() {
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
 * Verificar autenticación y rol exclusivamente admin (escritura/eliminación).
 */
async function verifyAdminOnly() {
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

  if (!profile || profile.role !== "admin") {
    return { error: "Acceso denegado: solo administradores pueden modificar asistencias manualmente", status: 403 };
  }

  return { user, profile };
}

/**
 * GET /api/admin/attendance
 * Consulta asistencias consolidadas cruzadas con empleados y permisos (employee_blocks).
 * Parámetros de consulta:
 * - date: YYYY-MM-DD (para vista de un día específico)
 * - start_date y end_date: YYYY-MM-DD (para rangos: semana, mes, año)
 * - type: "all" | "spa" | "barberia"
 * - employee_id: UUID (para historial de un trabajador específico)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("start_date");
    const endDateParam = searchParams.get("end_date");
    const typeParam = searchParams.get("type") || "all";
    const employeeIdParam = searchParams.get("employee_id");

    const admin = createAdminClient();

    // 1. Obtener empleados según filtro de tipo y/o ID
    let empQuery = admin
      .from("employees")
      .select("id, first_name, last_name, type, is_active")
      .order("first_name");

    if (typeParam !== "all") {
      empQuery = empQuery.eq("type", typeParam);
    }
    if (employeeIdParam) {
      empQuery = empQuery.eq("id", employeeIdParam);
    }

    const { data: employees, error: empError } = await empQuery;
    if (empError) throw empError;

    // Determinar rango de fechas
    let startDate: string;
    let endDate: string;

    if (dateParam) {
      startDate = dateParam;
      endDate = dateParam;
    } else if (startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
    } else {
      // Default: Hoy en hora Perú (UTC-5)
      const now = new Date();
      const peruDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(now);
      startDate = peruDate;
      endDate = peruDate;
    }

    // 2. Obtener asistencias registradas en el rango
    let attQuery = admin
      .from("employee_attendances")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (employeeIdParam) {
      attQuery = attQuery.eq("employee_id", employeeIdParam);
    }

    const { data: attendances, error: attError } = await attQuery;
    if (attError) throw attError;

    // 3. Obtener permisos / ausencias justificadas (employee_blocks) en el rango
    let blockQuery = admin
      .from("employee_blocks")
      .select("*")
      .gte("block_date", startDate)
      .lte("block_date", endDate);

    if (employeeIdParam) {
      blockQuery = blockQuery.eq("employee_id", employeeIdParam);
    }

    const { data: blocks, error: blockError } = await blockQuery;
    if (blockError) throw blockError;

    // 4. Obtener justificaciones registradas en el rango
    let justQuery = admin
      .from("attendance_justifications")
      .select(`
        id,
        attendance_id,
        employee_id,
        type,
        reason,
        observation,
        evidence_url,
        status,
        registered_by,
        approved_by,
        approved_at,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (employeeIdParam) {
      justQuery = justQuery.eq("employee_id", employeeIdParam);
    }

    const { data: justifications } = await justQuery;

    return NextResponse.json({
      startDate,
      endDate,
      employees: employees || [],
      attendances: attendances || [],
      blocks: blocks || [],
      justifications: justifications || [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET attendance error:", msg);
    return NextResponse.json(
      { error: "Error al obtener datos de asistencia: " + msg },
      { status: 500 }
    );
  }
}

function normalizeAttendanceStatus(status: unknown): AttendanceStatus {
  if (typeof status !== "string") return ATTENDANCE_STATUS.PRESENTE;
  const s = status.toLowerCase().trim();
  if (s === "puntual" || s === "presente") return ATTENDANCE_STATUS.PRESENTE;
  if (s === "tardanza") return ATTENDANCE_STATUS.TARDANZA;
  if (s === "salida_temprana") return ATTENDANCE_STATUS.SALIDA_TEMPRANA;
  if (s === "falta_justificada") return ATTENDANCE_STATUS.FALTA_JUSTIFICADA;
  if (s === "falta_injustificada") return ATTENDANCE_STATUS.FALTA_INJUSTIFICADA;
  return ATTENDANCE_STATUS.PRESENTE;
}

/**
 * POST /api/admin/attendance
 * Crear o registrar manualmente una asistencia (ajuste administrativo)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminOnly();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { employee_id, date, check_in, check_out, status, notes, entry_justification, exit_justification } = body;

    if (!employee_id || !date || !check_in) {
      return NextResponse.json(
        { error: "El trabajador, la fecha y la hora de entrada son obligatorios" },
        { status: 422 }
      );
    }

    const validStatus = normalizeAttendanceStatus(status);
    const admin = createAdminClient();

    // Calcular bonificación si hay salida
    let bonusMinutes = 0;
    if (check_out) {
      let bonusRules: BonusRule[] = DEFAULT_BONUS_RULES;
      try {
        const { data: dbRules } = await admin.from("bonus_settings").select("*");
        if (dbRules && dbRules.length > 0) bonusRules = dbRules;
      } catch (err) {
        console.error("Error loading bonus rules:", err);
      }
      bonusMinutes = calculateBonusMinutes(check_out, date, bonusRules).bonus_minutes;
    }

    // Upsert asistencia para ese empleado y fecha
    const { data, error } = await admin
      .from("employee_attendances")
      .upsert(
        {
          employee_id,
          date,
          check_in,
          check_out: check_out || null,
          status: validStatus,
          bonus_minutes: bonusMinutes,
          bonus_calculation_type: "auto",
          notes: notes || null,
          entry_justification: entry_justification ? String(entry_justification).trim() || null : null,
          exit_justification: exit_justification ? String(exit_justification).trim() || null : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "employee_id,date" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST attendance error:", msg);
    return NextResponse.json(
      { error: "Error al registrar asistencia manual: " + msg },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/attendance
 * Actualizar una asistencia existente (hora de salida, estado o notas)
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdminOnly();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, check_in, check_out, status, notes, entry_justification, exit_justification } = body;

    if (!id) {
      return NextResponse.json(
        { error: "El ID del registro de asistencia es obligatorio" },
        { status: 422 }
      );
    }

    const validStatus = normalizeAttendanceStatus(status);
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("employee_attendances")
      .select("date, bonus_calculation_type, bonus_minutes")
      .eq("id", id)
      .single();

    const updatePayload: Record<string, unknown> = {
      check_in,
      check_out: check_out || null,
      status: validStatus,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    // Si la salida cambió y el cálculo es automático, recalcular bonificación
    if (check_out && existing && existing.bonus_calculation_type !== "manual") {
      let bonusRules: BonusRule[] = DEFAULT_BONUS_RULES;
      try {
        const { data: dbRules } = await admin.from("bonus_settings").select("*");
        if (dbRules && dbRules.length > 0) bonusRules = dbRules;
      } catch (err) {
        console.error("Error loading bonus rules:", err);
      }
      updatePayload.bonus_minutes = calculateBonusMinutes(check_out, existing.date, bonusRules).bonus_minutes;
    } else if (!check_out) {
      updatePayload.bonus_minutes = 0;
    }

    if (entry_justification !== undefined) {
      updatePayload.entry_justification = entry_justification ? String(entry_justification).trim() || null : null;
    }
    if (exit_justification !== undefined) {
      updatePayload.exit_justification = exit_justification ? String(exit_justification).trim() || null : null;
    }

    const { data, error } = await admin
      .from("employee_attendances")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PUT attendance error:", msg);
    return NextResponse.json(
      { error: "Error al actualizar asistencia: " + msg },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/attendance?id=<id>
 * Eliminar un registro de asistencia
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminOnly();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "El ID del registro es obligatorio" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("employee_attendances")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("DELETE attendance error:", msg);
    return NextResponse.json(
      { error: "Error al eliminar registro de asistencia: " + msg },
      { status: 500 }
    );
  }
}
