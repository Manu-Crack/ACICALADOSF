import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTENDANCE_STATUS, AttendanceStatus } from "@/lib/types/attendance";
import { calculateBonusMinutes } from "@/lib/utils/bonus-calculator";
import { type BonusRule, DEFAULT_BONUS_RULES } from "@/lib/types/bonus";

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    if ("message" in err && typeof (err as { message: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    if ("error" in err && typeof (err as { error: unknown }).error === "string") {
      return (err as { error: string }).error;
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
 * Normaliza y extrae el UUID del empleado desde diferentes formatos de QR:
 * - "acicalados:emp:550e8400-e29b-41d4-a716-446655440000"
 * - '{"employee_id":"550e8400-e29b-41d4-a716-446655440000"}'
 * - "550e8400-e29b-41d4-a716-446655440000"
 */
function extractEmployeeId(code: string): string | null {
  if (!code || typeof code !== "string") return null;

  const trimmed = code.trim();

  // Intento 1: Si viene en formato JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.employee_id) return String(parsed.employee_id).trim();
      if (parsed.id) return String(parsed.id).trim();
    } catch {
      // Continuar con regex
    }
  }

  // Intento 2: Prefijo con formato acicalados:emp:...
  if (trimmed.startsWith("acicalados:emp:")) {
    return trimmed.replace("acicalados:emp:", "").trim();
  }

  // Intento 3: UUID estándar de 36 caracteres con regex
  const uuidMatch = trimmed.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
  );
  if (uuidMatch) {
    return uuidMatch[0];
  }

  return trimmed;
}

/**
 * POST /api/admin/attendance/scan
 * Endpoint principal de escaneo de código QR para registro de Asistencia (Entrada / Salida)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const rawCode = body.code || body.employee_id;

    if (!rawCode) {
      return NextResponse.json(
        { error: "No se proporcionó ningún código QR para escanear." },
        { status: 400 }
      );
    }

    const employeeId = extractEmployeeId(rawCode);
    if (!employeeId || !UUID_REGEX.test(employeeId)) {
      return NextResponse.json(
        { error: "El código escaneado no es un identificador de empleado válido de Acicalados." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Buscar el empleado en la base de datos
    const { data: employee, error: empError } = await admin
      .from("employees")
      .select("id, first_name, last_name, type, is_active")
      .eq("id", employeeId)
      .maybeSingle();

    if (empError) {
      const dbMsg = getErrorMessage(empError);
      return NextResponse.json(
        { error: `Error al consultar empleado: ${dbMsg}` },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        { error: "El trabajador no existe en el sistema de Acicalados." },
        { status: 404 }
      );
    }

    // Validar si el trabajador está activo
    if (!employee.is_active) {
      return NextResponse.json(
        {
          error: `El trabajador ${employee.first_name} ${employee.last_name} está marcado como INACTIVO.`,
          employee,
        },
        { status: 400 }
      );
    }

    // 2. Determinar la fecha, hora y día actual en Zona Horaria de Perú (America/Lima, UTC-5)
    const now = new Date();
    const peruDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(now);
    const timeFormatter = new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const currentTimeFormatted = timeFormatter.format(now);

    const peruParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Lima",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);

    const getPart = (type: string) => peruParts.find((p) => p.type === type)?.value || "";
    const weekdayStr = getPart("weekday"); // "Sun", "Mon", "Tue", etc.
    const hourNum = parseInt(getPart("hour"), 10) || 0;
    const minNum = parseInt(getPart("minute"), 10) || 0;
    const currentMinutesOfDay = hourNum * 60 + minNum;

    // Reglas de horario y tolerancia de entrada:
    // De Lunes a Sábado: Entrada 09:00 AM (540 min) -> Tolerancia 15 min hasta 09:15 AM (555 min)
    // Domingos: Entrada 10:00 AM (600 min) -> Tolerancia 15 min hasta 10:15 AM (615 min)
    const isSunday = weekdayStr === "Sun";
    const expectedEntryMinutes = isSunday ? 10 * 60 : 9 * 60;
    const entryToleranceLimit = expectedEntryMinutes + 15;

    const isPunctual = currentMinutesOfDay <= entryToleranceLimit;
    const dbStatus: AttendanceStatus = isPunctual ? ATTENDANCE_STATUS.PRESENTE : ATTENDANCE_STATUS.TARDANZA;
    const punctualityLabel = isPunctual ? "A tiempo" : "Tardanza";

    // 3. Consultar si ya tiene marcación hoy
    const { data: attendanceRecord, error: attError } = await admin
      .from("employee_attendances")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("date", peruDate)
      .maybeSingle();

    if (attError) {
      const dbMsg = getErrorMessage(attError);
      return NextResponse.json(
        { error: `Error al consultar asistencia: ${dbMsg}` },
        { status: 500 }
      );
    }

    // Verificar si tenía un permiso registrado para hoy
    const { data: blockRecord } = await admin
      .from("employee_blocks")
      .select("reason")
      .eq("employee_id", employee.id)
      .eq("block_date", peruDate)
      .maybeSingle();

    // CASO A: No tiene registro hoy -> Marcar ENTRADA (Check-in) con estado de puntualidad
    if (!attendanceRecord) {
      const { data: newAttendance, error: insertError } = await admin
        .from("employee_attendances")
        .insert({
          employee_id: employee.id,
          date: peruDate,
          check_in: now.toISOString(),
          check_out: null,
          status: dbStatus,
          notes: blockRecord ? `Permiso previo: ${blockRecord.reason}` : null,
        })
        .select()
        .single();

      if (insertError) {
        const dbMsg = getErrorMessage(insertError);
        return NextResponse.json(
          { error: `Error al registrar entrada: ${dbMsg}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        action: "check_in",
        status: "success",
        punctuality: punctualityLabel,
        attendance_status: dbStatus,
        message: `Entrada registrada: ${employee.first_name} ${employee.last_name} (${punctualityLabel} - ${currentTimeFormatted})`,
        employee,
        attendance: newAttendance,
        timestamp: currentTimeFormatted,
        date: peruDate,
      });
    }

    // CASO B: Ya tiene ENTRADA pero NO tiene SALIDA -> Flujo de Confirmación de Salida
    if (!attendanceRecord.check_out) {
      const confirmCheckout = Boolean(body.confirm_checkout);
      const checkInFormatted = timeFormatter.format(new Date(attendanceRecord.check_in));

      // Si no ha confirmado la salida, solicitar confirmación modal
      if (!confirmCheckout) {
        return NextResponse.json({
          action: "requires_checkout_confirmation",
          status: "confirmation_needed",
          message: `El empleado ${employee.first_name} ${employee.last_name} ya registró su entrada hoy a las ${checkInFormatted}. ¿Desea registrar su salida ahora?`,
          employee,
          attendance: attendanceRecord,
          check_in_time: checkInFormatted,
          current_time: currentTimeFormatted,
          date: peruDate,
        });
      }

      // Si confirmó la salida, calcular bonificación según reglas de día de semana
      let bonusRules: BonusRule[] = DEFAULT_BONUS_RULES;
      try {
        const { data: dbRules } = await admin.from("bonus_settings").select("*");
        if (dbRules && dbRules.length > 0) bonusRules = dbRules;
      } catch (err) {
        console.error("Error fetching bonus rules in scan:", err);
      }

      const bonusResult = calculateBonusMinutes(now.toISOString(), peruDate, bonusRules);

      // Registrar check_out y bonus_minutes
      const { data: updatedAttendance, error: updateError } = await admin
        .from("employee_attendances")
        .update({
          check_out: now.toISOString(),
          bonus_minutes: bonusResult.bonus_minutes,
          bonus_calculation_type: "auto",
          updated_at: now.toISOString(),
        })
        .eq("id", attendanceRecord.id)
        .select()
        .single();

      if (updateError) {
        const dbMsg = getErrorMessage(updateError);
        return NextResponse.json(
          { error: `Error al registrar salida: ${dbMsg}` },
          { status: 500 }
        );
      }

      const bonusMessage = bonusResult.bonus_minutes > 0
        ? ` (+${bonusResult.bonus_minutes} min bonificación)`
        : "";

      return NextResponse.json({
        action: "check_out",
        status: "success",
        message: `Salida registrada: ${employee.first_name} ${employee.last_name} a las ${currentTimeFormatted}${bonusMessage}`,
        employee,
        attendance: updatedAttendance,
        bonus_result: bonusResult,
        check_in_time: checkInFormatted,
        check_out_time: currentTimeFormatted,
        date: peruDate,
      });
    }

    // CASO C: Ya tiene ENTRADA y SALIDA registradas hoy -> Notificar turno completado
    const checkInFormatted = timeFormatter.format(new Date(attendanceRecord.check_in));
    const checkOutFormatted = timeFormatter.format(new Date(attendanceRecord.check_out));

    return NextResponse.json({
      action: "already_completed",
      status: "info",
      message: `El empleado ${employee.first_name} ${employee.last_name} ya completó su turno de hoy (Entrada: ${checkInFormatted} | Salida: ${checkOutFormatted}).`,
      employee,
      attendance: attendanceRecord,
      check_in_time: checkInFormatted,
      check_out_time: checkOutFormatted,
      date: peruDate,
    });
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    console.error("POST attendance/scan error:", msg);
    return NextResponse.json(
      { error: "Error al procesar el escaneo QR: " + msg },
      { status: 500 }
    );
  }
}
