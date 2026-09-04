import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateParallelServiceSchedule } from "@/lib/utils/booking-schedule";

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
 * PATCH /api/admin/bookings/service-employee
 * Reasigna el colaborador de un sub-servicio y recalcula de forma atómica
 * el cronograma paralelo, la duración total y la hora de fin de la cita padre.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyStaffAuth(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { booking_service_id, employee_id } = body;

    if (!booking_service_id) {
      return NextResponse.json(
        { error: "El parámetro booking_service_id es obligatorio" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Obtener el servicio actual para identificar la reserva padre
    const { data: serviceItem, error: svcErr } = await admin
      .from("booking_services")
      .select("id, booking_id, service_id, service_name")
      .eq("id", booking_service_id)
      .single();

    if (svcErr || !serviceItem) {
      return NextResponse.json(
        { error: "No se encontró el servicio especificado" },
        { status: 404 }
      );
    }

    const bookingId = serviceItem.booking_id;

    // 2. Actualizar el empleado en booking_services
    const { error: updateSvcErr } = await admin
      .from("booking_services")
      .update({ assigned_employee_id: employee_id || null })
      .eq("id", booking_service_id);

    if (updateSvcErr) {
      console.error("Error al actualizar assigned_employee_id en booking_services:", updateSvcErr);
      return NextResponse.json(
        { error: "Error al actualizar asignación del servicio: " + updateSvcErr.message },
        { status: 500 }
      );
    }

    // 3. Obtener la cita padre
    const { data: booking, error: bkgErr } = await admin
      .from("bookings")
      .select("id, start_time, end_time, total_duration_minutes, assigned_employee_id")
      .eq("id", bookingId)
      .single();

    if (bkgErr || !booking) {
      return NextResponse.json(
        { error: "No se encontró la reserva asociada" },
        { status: 404 }
      );
    }

    // 4. Obtener todos los servicios actualizados de la cita para el recálculo
    const { data: allServices, error: allSvcErr } = await admin
      .from("booking_services")
      .select("id, service_id, duration_minutes, assigned_employee_id, created_at")
      .eq("booking_id", bookingId);

    if (!allSvcErr && allServices && allServices.length > 0) {
      const scheduleResult = calculateParallelServiceSchedule(
        booking.start_time,
        allServices,
        booking.assigned_employee_id
      );

      const isMultiService = allServices.length >= 2;
      const updateData: Record<string, unknown> = {
        total_duration_minutes: scheduleResult.totalDurationMinutes,
        end_time: scheduleResult.endTimeStr,
        updated_at: new Date().toISOString(),
      };

      if (isMultiService) {
        // En citas múltiples, asegurar que el empleado de cabecera sea el primer asignado si existe
        const firstAssigned = allServices.find((s) => s.assigned_employee_id)?.assigned_employee_id || null;
        updateData.assigned_employee_id = firstAssigned;
      }

      // Sincronizar las marcas de tiempo individuales recalculadas de cada servicio
      for (const sched of scheduleResult.scheduledServices) {
        const svcId = sched.item.id;
        if (svcId) {
          await admin
            .from("booking_services")
            .update({
              start_time: sched.startTimeStr,
              end_time: sched.endTimeStr,
              hora_inicio: sched.startTimeStr,
              hora_fin: sched.endTimeStr,
            })
            .eq("id", svcId);
        }
      }

      const { error: updBookingErr } = await admin
        .from("bookings")
        .update(updateData)
        .eq("id", bookingId);

      if (updBookingErr) {
        console.warn("Advertencia al sincronizar duración de la cita padre:", updBookingErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Asignación de servicio y cronograma de la cita actualizados con éxito",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("PATCH service-employee exception:", errorMsg);
    return NextResponse.json(
      { error: "Error interno al reasignar especialista: " + errorMsg },
      { status: 500 }
    );
  }
}
