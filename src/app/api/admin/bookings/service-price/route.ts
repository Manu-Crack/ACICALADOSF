import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
 * PATCH /api/admin/bookings/service-price
 * Permite a administradores y recepcionistas editar el precio de un servicio individual contratado
 * dentro de una reserva específica.
 *
 * REGLA ESTRICTA:
 * - Esta modificación afecta ÚNICAMENTE a la tabla 'booking_services' y recalcula 'bookings'.
 * - NO MODIFICA BAJO NINGUNA CIRCUNSTANCIA la tabla maestra 'services'.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyStaffAuth(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { booking_id, booking_service_id, service_price_cents, price_soles, updates } = body;

    if (!booking_id) {
      return NextResponse.json(
        { error: "El parámetro booking_id es obligatorio" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Obtener la reserva actual
    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .select("id, booking_code, total_price_cents, advance_percentage, advance_amount_cents, balance_cents, status, payment_status")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json(
        { error: "La reserva indicada no existe" },
        { status: 404 }
      );
    }

    // 2. Procesar actualizaciones de precio
    // Caso A: Lote de actualizaciones
    if (Array.isArray(updates) && updates.length > 0) {
      for (const item of updates) {
        const itemCents = item.service_price_cents !== undefined
          ? Math.round(Number(item.service_price_cents))
          : Math.round(Number(item.price_soles) * 100);

        if (isNaN(itemCents) || itemCents < 0) {
          return NextResponse.json(
            { error: `El monto ingresado para el servicio no es válido (debe ser mayor o igual a 0).` },
            { status: 422 }
          );
        }

        const { error: updErr } = await admin
          .from("booking_services")
          .update({ service_price_cents: itemCents })
          .eq("id", item.id)
          .eq("booking_id", booking_id);

        if (updErr) {
          console.error("Error actualizando precio en booking_services:", updErr);
          return NextResponse.json(
            { error: "Error al actualizar precio del servicio: " + updErr.message },
            { status: 500 }
          );
        }
      }
    } else {
      // Caso B: Actualización individual
      if (!booking_service_id) {
        return NextResponse.json(
          { error: "Se requiere booking_service_id para modificar el precio del servicio" },
          { status: 422 }
        );
      }

      let parsedCents: number;
      if (service_price_cents !== undefined) {
        parsedCents = Math.round(Number(service_price_cents));
      } else if (price_soles !== undefined) {
        parsedCents = Math.round(Number(price_soles) * 100);
      } else {
        return NextResponse.json(
          { error: "Debe especificar service_price_cents o price_soles" },
          { status: 422 }
        );
      }

      if (isNaN(parsedCents) || parsedCents < 0) {
        return NextResponse.json(
          { error: "El precio del servicio debe ser un número válido mayor o igual a cero." },
          { status: 422 }
        );
      }

      // Validar que el booking_service existe y pertenece a la reserva
      const { data: currentBs, error: bsCheckErr } = await admin
        .from("booking_services")
        .select("id, booking_id, service_name, service_price_cents")
        .eq("id", booking_service_id)
        .eq("booking_id", booking_id)
        .single();

      if (bsCheckErr || !currentBs) {
        return NextResponse.json(
          { error: "El servicio especificado no pertenece a esta reserva" },
          { status: 404 }
        );
      }

      // Actualizar el precio SOLO en la tabla booking_services
      const { error: bsUpdateErr } = await admin
        .from("booking_services")
        .update({ service_price_cents: parsedCents })
        .eq("id", booking_service_id)
        .eq("booking_id", booking_id);

      if (bsUpdateErr) {
        console.error("Error al actualizar precio de booking_service:", bsUpdateErr);
        return NextResponse.json(
          { error: "Error al guardar el nuevo precio: " + bsUpdateErr.message },
          { status: 500 }
        );
      }
    }

    // 3. Recalcular la sumatoria total de los servicios de esta cita
    const { data: allServices, error: sumErr } = await admin
      .from("booking_services")
      .select("id, service_id, service_name, service_price_cents, duration_minutes, assigned_employee_id")
      .eq("booking_id", booking_id);

    if (sumErr || !allServices) {
      console.error("Error consultando servicios tras actualización:", sumErr);
      return NextResponse.json(
        { error: "Error al recalcular los servicios de la cita" },
        { status: 500 }
      );
    }

    const newTotalPriceCents = allServices.reduce(
      (sum, s) => sum + (s.service_price_cents || 0),
      0
    );

    // 4. Determinar pagos verificados reales (payment_logs)
    const { data: verifiedPayments } = await admin
      .from("payment_logs")
      .select("amount_cents")
      .eq("booking_id", booking_id)
      .eq("status", "verified");

    let amountPaidCents = 0;
    if (verifiedPayments && verifiedPayments.length > 0) {
      amountPaidCents = verifiedPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    } else {
      // Si no hay registros en payment_logs (ej. reservas presenciales sin logs previos),
      // respetar advance_amount_cents si no excede el total
      amountPaidCents = Math.min(newTotalPriceCents, booking.advance_amount_cents || 0);
    }

    const advancePercentage = booking.advance_percentage || 25;
    const advanceRequiredCents = Math.ceil((newTotalPriceCents * advancePercentage) / 100);
    const newBalanceCents = Math.max(0, newTotalPriceCents - amountPaidCents);

    // Determinar nuevo estado de pago
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

    // 5. Actualizar la reserva en la tabla 'bookings'
    const { data: updatedBooking, error: updateBookingErr } = await admin
      .from("bookings")
      .update({
        total_price_cents: newTotalPriceCents,
        advance_amount_cents: amountPaidCents,
        balance_cents: newBalanceCents,
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking_id)
      .select(`
        id, booking_code, booking_date, start_time, end_time, status, payment_status, payment_method,
        total_price_cents, advance_percentage, advance_amount_cents, balance_cents, service_type,
        client_first_name, client_last_name, client_phone, client_email, client_dni,
        total_duration_minutes, confirmed_at, assigned_employee_id, created_at,
        booking_services (
          id, service_id, service_name, service_price_cents, duration_minutes, assigned_employee_id
        )
      `)
      .single();

    if (updateBookingErr || !updatedBooking) {
      console.error("Error al actualizar total en bookings:", updateBookingErr);
      return NextResponse.json(
        { error: "Error al actualizar los totales de la reserva: " + (updateBookingErr?.message || "") },
        { status: 500 }
      );
    }

    // Sincronizar trigger en postgres si hay payment_logs
    if (verifiedPayments && verifiedPayments.length > 0) {
      try {
        await admin.rpc("recalculate_booking_payment", { p_booking_id: booking_id });
      } catch (rpcErr) {
        console.warn("recalculate_booking_payment RPC warning (non-fatal):", rpcErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Precio actualizado exitosamente. Nuevo total de la reserva: S/ ${(newTotalPriceCents / 100).toFixed(2)}`,
      booking: updatedBooking,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Service price PATCH exception:", errorMsg);
    return NextResponse.json(
      { error: "Error interno al procesar el cambio de precio: " + errorMsg },
      { status: 500 }
    );
  }
}

// Permitir eliminación de servicio también desde este endpoint
export { DELETE } from "../service/route";
