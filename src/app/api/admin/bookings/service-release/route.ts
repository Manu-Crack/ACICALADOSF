import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function timeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function verifyStaffAuth(allowedRoles: string[] = ["admin", "recepcionista"]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autorizado", status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !allowedRoles.includes(profile.role)) {
    return { error: "Acceso denegado. Se requiere rol administrativo.", status: 403 as const };
  }

  return { user, profile };
}

/**
 * PATCH /api/admin/bookings/service-release
 * Culminación anticipada ("Liberar / Culminar") de un servicio individual dentro de una reserva.
 *
 * 1. Recorta hora_fin y end_time del servicio a la hora actual exacta de Perú (America/Lima).
 * 2. Recalcula duration_minutes real sin tocar precio (service_price_cents).
 * 3. Marca el estado del servicio como 'completada'.
 * 4. Si todos los servicios de la cita están completados, ajusta la cita padre a 'completada'.
 * 5. Si aún hay servicios activos de otros colaboradores, la cita padre mantiene la hora fin de los restantes.
 * 6. Libera inmediatamente la agenda del especialista para nuevos turnos sin tiempo muerto.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyStaffAuth(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { booking_service_id, release_time } = body;

    if (!booking_service_id) {
      return NextResponse.json(
        { error: "El parámetro booking_service_id es obligatorio." },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Obtener el servicio y su reserva padre
    const { data: serviceItem, error: svcErr } = await admin
      .from("booking_services")
      .select(`
        id,
        booking_id,
        service_id,
        service_name,
        service_price_cents,
        duration_minutes,
        start_time,
        end_time,
        hora_inicio,
        hora_fin,
        status,
        assigned_employee_id,
        bookings!inner (
          id,
          booking_code,
          booking_date,
          start_time,
          end_time,
          status,
          total_price_cents,
          total_duration_minutes,
          assigned_employee_id
        )
      `)
      .eq("id", booking_service_id)
      .single();

    if (svcErr || !serviceItem) {
      return NextResponse.json(
        { error: "No se encontró el servicio especificado." },
        { status: 404 }
      );
    }

    // Cast seguro para bookings!inner
    const parentBooking = Array.isArray(serviceItem.bookings)
      ? serviceItem.bookings[0]
      : (serviceItem.bookings as unknown as {
          id: string;
          booking_code: string;
          booking_date: string;
          start_time: string;
          end_time: string;
          status: string;
          total_price_cents: number;
          total_duration_minutes: number;
          assigned_employee_id: string | null;
        });

    if (!parentBooking) {
      return NextResponse.json(
        { error: "No se encontró la reserva asociada al servicio." },
        { status: 404 }
      );
    }

    // 2. Validar que la cita no esté cancelada ni expirada
    if (["cancelada", "expirada"].includes(parentBooking.status)) {
      return NextResponse.json(
        { error: `No se puede culminar un servicio de una cita con estado '${parentBooking.status}'.` },
        { status: 422 }
      );
    }

    // 3. Validar que el servicio no esté ya culminado
    if (serviceItem.status === "completada") {
      return NextResponse.json(
        { error: `El servicio '${serviceItem.service_name}' ya ha sido culminado previamente.` },
        { status: 422 }
      );
    }

    // 4. Validar fecha: Solo citas del día en curso (America/Lima)
    const now = new Date();
    const peruDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
    }).format(now); // "YYYY-MM-DD"

    const isTestEnv = process.env.NODE_ENV === "test" || process.env.ALLOW_ANY_DATE_RELEASE === "true";
    if (!isTestEnv && parentBooking.booking_date !== peruDateStr) {
      return NextResponse.json(
        {
          error: `Solo se pueden culminar anticipadamente citas de la fecha en curso (${peruDateStr}). Esta cita es del ${parentBooking.booking_date}.`,
        },
        { status: 422 }
      );
    }

    // 5. Calcular la hora exacta de culminación/liberación
    const peruTimeFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    let exactReleaseTime = release_time && typeof release_time === "string" && release_time.trim().length >= 4
      ? release_time.trim()
      : peruTimeFormatter.format(now);

    if (exactReleaseTime.length === 5) {
      exactReleaseTime = `${exactReleaseTime}:00`;
    }

    const startStr = serviceItem.start_time || serviceItem.hora_inicio || parentBooking.start_time || "09:00:00";
    const startMinutes = timeToMinutes(startStr);
    let releaseMinutes = timeToMinutes(exactReleaseTime);

    const origEndStr = serviceItem.end_time || serviceItem.hora_fin || parentBooking.end_time || "09:30:00";
    const origEndMinutes = timeToMinutes(origEndStr);

    // Si la acción se ejecuta antes o exactamente en el minuto de inicio, garantizar duración mínima de 1 min
    if (releaseMinutes <= startMinutes) {
      releaseMinutes = startMinutes + 1;
      exactReleaseTime = `${minutesToTime(releaseMinutes)}:00`;
    }

    let finalEndTime = exactReleaseTime;
    let finalDurationMinutes: number;

    if (releaseMinutes < origEndMinutes) {
      // Culminación anticipada real: se recorta el horario
      finalDurationMinutes = Math.max(1, releaseMinutes - startMinutes);
      finalEndTime = exactReleaseTime;
    } else {
      // Si la hora actual ya superó el horario programado, se conserva la hora de término programada
      finalEndTime = origEndStr;
      finalDurationMinutes = serviceItem.duration_minutes || Math.max(1, origEndMinutes - startMinutes);
    }

    // 6. Actualizar el servicio individual en booking_services
    const { error: updSvcErr } = await admin
      .from("booking_services")
      .update({
        end_time: finalEndTime,
        hora_fin: finalEndTime,
        duration_minutes: finalDurationMinutes,
        status: "completada",
        liberado_at: now.toISOString(),
      })
      .eq("id", booking_service_id);

    if (updSvcErr) {
      console.error("Error actualizando booking_services en liberación:", updSvcErr);
      return NextResponse.json(
        { error: "Error al actualizar la culminación del servicio: " + updSvcErr.message },
        { status: 500 }
      );
    }

    // 7. Evaluar y sincronizar la cita padre
    const { data: allServices, error: allSvcErr } = await admin
      .from("booking_services")
      .select("id, duration_minutes, start_time, end_time, hora_inicio, hora_fin, status")
      .eq("booking_id", serviceItem.booking_id);

    let allCompleted = false;
    if (!allSvcErr && allServices && allServices.length > 0) {
      allCompleted = allServices.every(
        (s) => (s.id === booking_service_id ? "completada" : s.status) === "completada"
      );

      // Calcular la hora máxima de finalización entre todos los servicios (culminados y activos)
      const allEndMinutes = allServices.map((s) => {
        const t = s.id === booking_service_id ? finalEndTime : (s.end_time || s.hora_fin || parentBooking.end_time);
        return timeToMinutes(t);
      });

      const maxEndMinutes = Math.max(...allEndMinutes, startMinutes + 1);
      const maxEndTimeStr = `${minutesToTime(maxEndMinutes)}:00`;
      const bkgStartMinutes = timeToMinutes(parentBooking.start_time);
      const parentDurationMinutes = Math.max(1, maxEndMinutes - bkgStartMinutes);

      const parentUpdates: Record<string, unknown> = {
        end_time: maxEndTimeStr,
        total_duration_minutes: parentDurationMinutes,
        updated_at: now.toISOString(),
      };

      if (allCompleted) {
        parentUpdates.status = "completada";
        parentUpdates.completed_at = now.toISOString();
      }

      const { error: updBkgErr } = await admin
        .from("bookings")
        .update(parentUpdates)
        .eq("id", serviceItem.booking_id);

      if (updBkgErr) {
        console.warn("Advertencia actualizando duración/estado de cita padre:", updBkgErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `El servicio "${serviceItem.service_name}" ha sido culminado exitosamente a las ${finalEndTime.slice(0, 5)}. El colaborador queda libre de inmediato.`,
      booking_service_id,
      released_at_time: finalEndTime,
      actual_duration_minutes: finalDurationMinutes,
      booking_completed: allCompleted,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("PATCH service-release exception:", errorMsg);
    return NextResponse.json(
      { error: "Error interno al culminar el servicio: " + errorMsg },
      { status: 500 }
    );
  }
}
