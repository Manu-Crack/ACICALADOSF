import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTENDANCE_STATUS, AttendanceStatus } from "@/lib/types/attendance";
import { calculateBonusMinutes } from "@/lib/utils/bonus-calculator";
import { type BonusRule, DEFAULT_BONUS_RULES } from "@/lib/types/bonus";
import {
  parseTempLeavesFromNotes,
  serializeTempLeavesToNotes,
  calculateTotalTempLeaveMinutes,
  calculateEffectiveWorkingMinutes,
  type TempLeave,
} from "@/lib/utils/attendance-temp-leaves";

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
 * Endpoint principal de escaneo de código QR para registro de Asistencia:
 * - Caso A: Primer escaneo -> Entrada (PRESENTE)
 * - Caso B: Segundo escaneo -> Diálogo: Salida Temporal (EN PERMISO) o Salida Definitiva
 * - Caso C: Tercer escaneo (en permiso) -> Reingreso automático (PRESENTE)
 * - Caso D: Escaneo post-reingreso -> Diálogo o Salida Definitiva
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const rawCode = body.code || body.employee_id;
    const actionType = body.action_type as "temp_leave" | "final_checkout" | undefined;
    const tempLeaveReason = typeof body.reason === "string" ? body.reason.trim() : "";
    const confirmCheckout = Boolean(body.confirm_checkout);

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

    // Parsear historial de permisos temporales de hoy
    const { tempLeaves, cleanNotes } = parseTempLeavesFromNotes(attendanceRecord?.notes);
    const activeTempLeave = tempLeaves.find((tl) => !tl.return_time);

    // =========================================================================
    // CASO A: Primer escaneo del día (No existe registro previo hoy) -> ENTRADA
    // =========================================================================
    if (!attendanceRecord) {
      // Verificar si tenía un permiso previo de agenda registrado para hoy
      const { data: blockRecord } = await admin
        .from("employee_blocks")
        .select("reason")
        .eq("employee_id", employee.id)
        .eq("block_date", peruDate)
        .maybeSingle();

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
        message: `Entrada registrada: ${employee.first_name} ${employee.last_name} (${punctualityLabel} - ${currentTimeFormatted}) · Estado: PRESENTE`,
        employee,
        attendance: newAttendance,
        timestamp: currentTimeFormatted,
        date: peruDate,
      });
    }

    // =========================================================================
    // CASO C: Empleado está actualmente "EN PERMISO" -> REINGRESO AUTOMÁTICO
    // =========================================================================
    if (activeTempLeave || attendanceRecord.status === "en_permiso") {
      let durationMin = 0;
      if (activeTempLeave) {
        const leaveDate = new Date(activeTempLeave.leave_time);
        durationMin = Math.max(1, Math.round((now.getTime() - leaveDate.getTime()) / 60000));
        activeTempLeave.return_time = now.toISOString();
        activeTempLeave.duration_minutes = durationMin;
      }

      const updatedNotes = serializeTempLeavesToNotes(tempLeaves, cleanNotes);

      const { data: updatedAttendance, error: updateError } = await admin
        .from("employee_attendances")
        .update({
          status: ATTENDANCE_STATUS.PRESENTE,
          notes: updatedNotes,
          updated_at: now.toISOString(),
        })
        .eq("id", attendanceRecord.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: `Error al registrar reingreso: ${getErrorMessage(updateError)}` },
          { status: 500 }
        );
      }

      const reasonMsg = activeTempLeave?.reason ? ` (${activeTempLeave.reason})` : "";

      return NextResponse.json({
        action: "temp_leave_return",
        status: "success",
        message: `Reingreso registrado: ${employee.first_name} ${employee.last_name} a las ${currentTimeFormatted}. Duración del permiso: ${durationMin} min${reasonMsg} · Estado: PRESENTE`,
        employee,
        attendance: updatedAttendance,
        timestamp: currentTimeFormatted,
        duration_minutes: durationMin,
        date: peruDate,
      });
    }

    // =========================================================================
    // CASO B / D: Tiene Entrada activa y NO tiene Salida Definitiva
    // =========================================================================
    if (!attendanceRecord.check_out) {
      const checkInFormatted = timeFormatter.format(new Date(attendanceRecord.check_in));

      // B.1: El usuario seleccionó "Salida Temporal / Emergencia"
      if (actionType === "temp_leave") {
        if (!tempLeaveReason) {
          return NextResponse.json(
            { error: "Debe especificar el motivo de la salida temporal por emergencia." },
            { status: 400 }
          );
        }

        const newLeave: TempLeave = {
          id: crypto.randomUUID(),
          leave_time: now.toISOString(),
          return_time: null,
          reason: tempLeaveReason,
          duration_minutes: 0,
        };

        const updatedLeaves = [...tempLeaves, newLeave];
        const updatedNotes = serializeTempLeavesToNotes(updatedLeaves, cleanNotes);

        const { data: updatedAttendance, error: updateError } = await admin
          .from("employee_attendances")
          .update({
            status: ATTENDANCE_STATUS.EN_PERMISO,
            notes: updatedNotes,
            updated_at: now.toISOString(),
          })
          .eq("id", attendanceRecord.id)
          .select()
          .single();

        if (updateError) {
          return NextResponse.json(
            { error: `Error al registrar salida temporal: ${getErrorMessage(updateError)}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          action: "temp_leave_start",
          status: "success",
          message: `Salida temporal registrada: ${employee.first_name} ${employee.last_name} a las ${currentTimeFormatted} (${tempLeaveReason}) · Estado: EN PERMISO`,
          employee,
          attendance: updatedAttendance,
          timestamp: currentTimeFormatted,
          reason: tempLeaveReason,
          date: peruDate,
        });
      }

      // B.2: El usuario seleccionó "Salida Definitiva" (o confirmó salida)
      if (actionType === "final_checkout" || confirmCheckout) {
        // Cargar reglas de bonificación
        let bonusRules: BonusRule[] = DEFAULT_BONUS_RULES;
        try {
          const { data: dbRules } = await admin.from("bonus_settings").select("*");
          if (dbRules && dbRules.length > 0) bonusRules = dbRules;
        } catch (err) {
          console.error("Error fetching bonus rules in scan:", err);
        }

        // Calcular bonificación con exclusión estricta de la tolerancia
        const bonusResult = calculateBonusMinutes(now.toISOString(), peruDate, bonusRules);

        // Si había un permiso temporal sin cerrar, cerrarlo automáticamente ahora
        const openLeave = tempLeaves.find((tl) => !tl.return_time);
        if (openLeave) {
          const leaveDate = new Date(openLeave.leave_time);
          openLeave.return_time = now.toISOString();
          openLeave.duration_minutes = Math.max(1, Math.round((now.getTime() - leaveDate.getTime()) / 60000));
        }

        const finalNotes = serializeTempLeavesToNotes(tempLeaves, cleanNotes);
        const { grossMinutes, tempLeaveMinutes, netMinutes, formatted: durationFormatted } =
          calculateEffectiveWorkingMinutes(attendanceRecord.check_in, now.toISOString(), finalNotes);

        // Registrar check_out y persistir
        let updatedAttendance: any = null;
        let updateError: any = null;

        const updatePayload = {
          check_out: now.toISOString(),
          bonus_minutes: bonusResult.bonus_minutes,
          bonus_calculation_type: "auto",
          status: attendanceRecord.status === "en_permiso" ? ATTENDANCE_STATUS.PRESENTE : attendanceRecord.status,
          notes: finalNotes,
          updated_at: now.toISOString(),
        };

        const fullUpdateRes = await admin
          .from("employee_attendances")
          .update(updatePayload)
          .eq("id", attendanceRecord.id)
          .select()
          .single();

        if (fullUpdateRes.error) {
          console.warn("Retrying attendance checkout with minimal payload due to:", fullUpdateRes.error);
          const fallbackRes = await admin
            .from("employee_attendances")
            .update({
              check_out: now.toISOString(),
              notes: finalNotes,
              updated_at: now.toISOString(),
            })
            .eq("id", attendanceRecord.id)
            .select()
            .single();

          if (fallbackRes.error) {
            updateError = fallbackRes.error;
          } else {
            updatedAttendance = fallbackRes.data;
          }
        } else {
          updatedAttendance = fullUpdateRes.data;
        }

        if (updateError) {
          return NextResponse.json(
            { error: `Error al registrar salida definitiva: ${getErrorMessage(updateError)}` },
            { status: 500 }
          );
        }

        const bonusMsg = bonusResult.bonus_minutes > 0
          ? ` (+${bonusResult.bonus_minutes} min bonificación)`
          : "";

        return NextResponse.json({
          action: "check_out",
          status: "success",
          message: `Salida definitiva: ${employee.first_name} ${employee.last_name} a las ${currentTimeFormatted}${bonusMsg} · Jornada neta: ${durationFormatted}`,
          employee,
          attendance: updatedAttendance,
          bonus_result: bonusResult,
          check_in_time: checkInFormatted,
          check_out_time: currentTimeFormatted,
          temp_leave_minutes: tempLeaveMinutes,
          net_duration_minutes: netMinutes,
          date: peruDate,
        });
      }

      // B.3: Sin acción especificada -> Solicitar al usuario elegir entre Salida Temporal o Definitiva
      return NextResponse.json({
        action: "requires_scan_action",
        status: "confirmation_needed",
        message: `El empleado ${employee.first_name} ${employee.last_name} tiene entrada activa hoy a las ${checkInFormatted}. Seleccione una opción:`,
        employee,
        attendance: attendanceRecord,
        check_in_time: checkInFormatted,
        current_time: currentTimeFormatted,
        date: peruDate,
        temp_leaves_count: tempLeaves.length,
      });
    }

    // =========================================================================
    // CASO E: Ya tiene ENTRADA y SALIDA DEFINITIVA registradas hoy
    // =========================================================================
    const checkInFormatted = timeFormatter.format(new Date(attendanceRecord.check_in));
    const checkOutFormatted = timeFormatter.format(new Date(attendanceRecord.check_out));

    return NextResponse.json({
      action: "already_completed",
      status: "info",
      message: `El empleado ${employee.first_name} ${employee.last_name} ya completó su jornada de hoy (Entrada: ${checkInFormatted} | Salida: ${checkOutFormatted}).`,
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
