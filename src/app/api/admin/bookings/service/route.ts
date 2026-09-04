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

function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * DELETE /api/admin/bookings/service
 * Elimina individualmente un servicio contratado específico de una reserva multi-servicio
 * y recalcula de forma automática e íntegra el precio total, duración y horario de fin de la cita.
 *
 * REGLAS:
 * 1. Afecta ÚNICAMENTE a la tabla 'booking_services' y recalcula 'bookings'.
 * 2. NO elimina ni altera registros en la tabla maestra 'services'.
 * 3. Si la reserva solo contiene 1 servicio restante, no permite la eliminación individual
 *    para obligar a usar la anulación o eliminación completa de la reserva.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyStaffAuth(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Obtener parámetros desde query params o body
    let bookingId: string | null = null;
    let bookingServiceId: string | null = null;

    const { searchParams } = new URL(request.url);
    bookingId = searchParams.get("booking_id");
    bookingServiceId = searchParams.get("booking_service_id");

    if (!bookingId || !bookingServiceId) {
      try {
        const body = await request.json();
        bookingId = body.booking_id || bookingId;
        bookingServiceId = body.booking_service_id || bookingServiceId;
      } catch {
        // Ignorar si el body no es JSON válido
      }
    }

    if (!bookingId || !bookingServiceId) {
      return NextResponse.json(
        { error: "Los parámetros booking_id y booking_service_id son obligatorios" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Obtener la reserva actual
    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .select(`
        id,
        booking_code,
        booking_date,
        start_time,
        end_time,
        total_price_cents,
        total_duration_minutes,
        advance_percentage,
        advance_amount_cents,
        balance_cents,
        status,
        payment_status,
        service_type,
        assigned_employee_id
      `)
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json(
        { error: "La reserva especificada no existe" },
        { status: 404 }
      );
    }

    // 2. Obtener los servicios actuales de la reserva
    const { data: currentServices, error: currentServicesErr } = await admin
      .from("booking_services")
      .select("id, service_id, service_name, service_price_cents, duration_minutes, assigned_employee_id")
      .eq("booking_id", bookingId);

    if (currentServicesErr || !currentServices || currentServices.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron servicios asociados a esta reserva" },
        { status: 404 }
      );
    }

    // 3. Validación de servicio único
    if (currentServices.length <= 1) {
      return NextResponse.json(
        {
          error:
            "No es posible retirar el único servicio de la reserva. Si deseas anular toda la cita, utiliza 'Eliminar Definitivamente' o cambia su estado a 'Cancelada'.",
        },
        { status: 400 }
      );
    }

    const serviceToDelete = currentServices.find((s) => s.id === bookingServiceId);
    if (!serviceToDelete) {
      return NextResponse.json(
        { error: "El servicio a eliminar no pertenece a esta reserva o ya fue removido" },
        { status: 404 }
      );
    }

    // 4. Eliminar físicamente el registro hijo en 'booking_services'
    const { error: delErr } = await admin
      .from("booking_services")
      .delete()
      .eq("id", bookingServiceId)
      .eq("booking_id", bookingId);

    if (delErr) {
      console.error("Error al eliminar servicio de booking_services:", delErr);
      return NextResponse.json(
        { error: "Error al eliminar el servicio de la base de datos: " + delErr.message },
        { status: 500 }
      );
    }

    // 5. Recalcular métricas de la reserva con los servicios restantes
    const remainingServices = currentServices.filter((s) => s.id !== bookingServiceId);

    // a) Nuevo precio total
    const newTotalPriceCents = remainingServices.reduce(
      (sum, s) => sum + (Number(s.service_price_cents) || 0),
      0
    );

    // b) Nueva duración total y nuevo horario de finalización con cálculo paralelo
    const scheduleResult = calculateParallelServiceSchedule(
      booking.start_time,
      remainingServices,
      booking.assigned_employee_id
    );
    const newTotalDurationMinutes = scheduleResult.totalDurationMinutes;
    const newEndTime = scheduleResult.endTimeStr;

    // c) Recálculo de pagos y saldos
    const { data: verifiedPayments } = await admin
      .from("payment_logs")
      .select("id, amount_cents, payment_type, payment_method, yape_amount_cents, cash_amount_cents")
      .eq("booking_id", bookingId)
      .eq("status", "verified");

    let amountPaidCents = 0;
    if (verifiedPayments && verifiedPayments.length > 0) {
      const totalVerifiedLogs = verifiedPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);

      // Si la cita estaba liquidada (total) o la suma de pagos supera el nuevo total pactado:
      // Sincronizar los registros en payment_logs para que reflejen el nuevo precio cobrado real
      if (booking.payment_status === "total" || totalVerifiedLogs > newTotalPriceCents) {
        if (verifiedPayments.length === 1) {
          const singleLog = verifiedPayments[0];
          const updLog: Record<string, unknown> = { amount_cents: newTotalPriceCents };
          const pMethod = (singleLog.payment_method || "").toLowerCase();
          if (pMethod === "mixed" || pMethod === "mixto") {
            const half = Math.floor(newTotalPriceCents / 2);
            updLog.yape_amount_cents = half;
            updLog.cash_amount_cents = newTotalPriceCents - half;
          }
          await admin.from("payment_logs").update(updLog).eq("id", singleLog.id);
          amountPaidCents = newTotalPriceCents;
        } else {
          // Ajustar proporcionalmente o recortar los logs excedentes
          let running = 0;
          for (const p of verifiedPayments) {
            const currAmt = p.amount_cents || 0;
            if (running + currAmt > newTotalPriceCents) {
              const allowed = Math.max(0, newTotalPriceCents - running);
              await admin.from("payment_logs").update({ amount_cents: allowed }).eq("id", p.id);
              running += allowed;
            } else {
              running += currAmt;
            }
          }
          amountPaidCents = newTotalPriceCents;
        }
      } else {
        amountPaidCents = Math.min(newTotalPriceCents, totalVerifiedLogs);
      }
    } else {
      // Si no hay registros en payment_logs (ej. reservas presenciales sin logs previos),
      // respetar advance_amount_cents si no excede el total, o mantener pago total si ya estaba liquidada
      if (booking.payment_status === "total") {
        amountPaidCents = newTotalPriceCents;
      } else {
        amountPaidCents = Math.min(newTotalPriceCents, booking.advance_amount_cents || 0);
      }
    }

    const advancePercentage = booking.advance_percentage || 25;
    const advanceRequiredCents = Math.ceil((newTotalPriceCents * advancePercentage) / 100);
    const newBalanceCents = Math.max(0, newTotalPriceCents - amountPaidCents);

    let newPaymentStatus = "sin_pago";
    if (amountPaidCents >= newTotalPriceCents && newTotalPriceCents > 0) {
      newPaymentStatus = "total";
    } else if (amountPaidCents >= advanceRequiredCents && amountPaidCents > 0) {
      newPaymentStatus = "parcial";
    } else if (amountPaidCents > 0) {
      newPaymentStatus = "sin_pago";
    } else {
      newPaymentStatus = "sin_pago";
    }

    // d) Determinar si el empleado principal asignado a la cabecera aún tiene servicios
    let newAssignedEmployeeId = booking.assigned_employee_id;
    const isEmployeeStillAssigned = remainingServices.some(
      (s) => s.assigned_employee_id === booking.assigned_employee_id
    );
    if (!isEmployeeStillAssigned) {
      // Reasignar al primer colaborador que tenga servicios en la cita restante
      newAssignedEmployeeId =
        remainingServices.find((s) => s.assigned_employee_id)?.assigned_employee_id || null;
    }

    // e) Determinar el rubro/tipo de servicio restante
    let newServiceType = booking.service_type;
    const remainingServiceIds = remainingServices.map((s) => s.service_id).filter(Boolean);
    if (remainingServiceIds.length > 0) {
      const { data: catalogSvcs } = await admin
        .from("services")
        .select("id, type")
        .in("id", remainingServiceIds);

      if (catalogSvcs && catalogSvcs.length > 0) {
        const types = new Set(catalogSvcs.map((s) => s.type));
        if (types.size === 1) {
          const onlyType = types.values().next().value;
          newServiceType = onlyType === "barberia" ? "barberia" : onlyType === "spa" ? "spa" : "mixto";
        } else if (types.size > 1) {
          newServiceType = "mixto";
        }
      }
    }

    // 6. Actualizar la reserva en la tabla 'bookings'
    const { error: updateBookingErr } = await admin
      .from("bookings")
      .update({
        total_price_cents: newTotalPriceCents,
        total_duration_minutes: newTotalDurationMinutes,
        end_time: newEndTime,
        advance_amount_cents: amountPaidCents,
        balance_cents: newBalanceCents,
        payment_status: newPaymentStatus,
        service_type: newServiceType,
        assigned_employee_id: newAssignedEmployeeId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateBookingErr) {
      console.error("Error al actualizar reserva tras eliminar servicio:", updateBookingErr);
      return NextResponse.json(
        { error: "Error al recalcular la reserva: " + updateBookingErr.message },
        { status: 500 }
      );
    }

    // 7. Sincronizar trigger en Postgres si hay payment_logs verificados
    if (verifiedPayments && verifiedPayments.length > 0) {
      try {
        await admin.rpc("recalculate_booking_payment", { p_booking_id: bookingId });
      } catch (rpcErr) {
        console.warn("recalculate_booking_payment RPC warning (non-fatal):", rpcErr);
      }
    }

    // 8. Obtener la reserva final completamente recalculada con sus servicios restantes
    const { data: updatedBooking, error: fetchFinalErr } = await admin
      .from("bookings")
      .select(`
        id,
        booking_code,
        booking_date,
        start_time,
        end_time,
        status,
        payment_status,
        payment_method,
        total_price_cents,
        advance_percentage,
        advance_amount_cents,
        balance_cents,
        service_type,
        client_first_name,
        client_last_name,
        client_phone,
        client_email,
        client_dni,
        total_duration_minutes,
        confirmed_at,
        assigned_employee_id,
        created_at,
        booking_services (
          id,
          service_id,
          service_name,
          service_price_cents,
          duration_minutes,
          assigned_employee_id
        )
      `)
      .eq("id", bookingId)
      .single();

    if (fetchFinalErr || !updatedBooking) {
      console.error("Error al consultar reserva final tras eliminar servicio:", fetchFinalErr);
      return NextResponse.json(
        { error: "Error al recuperar datos finales de la reserva: " + (fetchFinalErr?.message || "") },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `El servicio "${serviceToDelete.service_name}" fue eliminado de la reserva. Nuevo total: S/ ${(updatedBooking.total_price_cents / 100).toFixed(2)}.`,
      booking: updatedBooking,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Service removal DELETE exception:", errorMsg);
    return NextResponse.json(
      { error: "Error interno al procesar la eliminación del servicio: " + errorMsg },
      { status: 500 }
    );
  }
}
