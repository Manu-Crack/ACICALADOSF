import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitirComprobanteKeyfacil } from "@/lib/services/keyfacil";

/**
 * POST /api/culqi/charge
 * Creates a charge in Culqi using a token from the frontend checkout.
 * All amounts are recalculated from the booking in DB.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token_id, booking_id, client_email } = body;

    if (!token_id || !booking_id) {
      return NextResponse.json(
        { error: "token_id y booking_id son obligatorios" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Fetch booking from DB — NEVER trust client amounts
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .eq("status", "pendiente")
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Reserva no encontrada o en estado incorrecto" },
        { status: 404 }
      );
    }

    // Check lock hasn't expired
    if (
      booking.slot_lock_expires_at &&
      new Date(booking.slot_lock_expires_at) < new Date()
    ) {
      // Expire the booking
      await admin
        .from("bookings")
        .update({
          status: "expirada",
          expired_at: new Date().toISOString(),
        })
        .eq("id", booking_id);

      return NextResponse.json(
        { error: "La reserva ha expirado. Por favor, crea una nueva." },
        { status: 410 }
      );
    }

    // 2. Create charge in Culqi
    const culqiSecretKey = process.env.CULQI_SECRET_KEY;
    if (!culqiSecretKey) {
      console.error("CULQI_SECRET_KEY not configured");
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 }
      );
    }

    const startTime = Date.now();

    const chargeResponse = await fetch("https://api.culqi.com/v2/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${culqiSecretKey}`,
      },
      body: JSON.stringify({
        amount: booking.advance_amount_cents,
        currency_code: "PEN",
        email: client_email || booking.client_email || "cliente@acicalados.pe",
        source_id: token_id,
        description: `Adelanto reserva ${booking.booking_code}`,
        antifraud_details: {
          first_name: booking.client_first_name,
          last_name: booking.client_last_name,
          phone_number: booking.client_phone || "999999999",
          address: booking.billing_address || "Av. Principal 123",
          address_city: "Iquitos",
          country_code: "PE",
        },
        metadata: {
          booking_id: booking.id,
          booking_code: booking.booking_code,
          comprobante_tipo: booking.comprobante_tipo || "03",
          tipo_doc: booking.billing_doc_type || "1",
          num_doc: booking.billing_doc_number || booking.client_dni || "",
          cliente_nombre:
            booking.billing_name ||
            `${booking.client_first_name} ${booking.client_last_name}`,
          cliente_direccion: booking.billing_address || "",
        },
      }),
    });

    const processingTime = Date.now() - startTime;
    const chargeData = await chargeResponse.json();

    // 3. Log the charge attempt
    await admin.from("payment_logs").insert({
      booking_id: booking.id,
      event_type: "charge_attempt",
      culqi_event_id: chargeData.id || null,
      amount_cents: booking.advance_amount_cents,
      payload: chargeData,
      processing_result: chargeResponse.ok ? "success" : "failed",
      processing_time_ms: processingTime,
    });

    if (!chargeResponse.ok) {
      console.error("Culqi charge failed:", chargeData);
      return NextResponse.json(
        {
          error:
            chargeData.user_message ||
            chargeData.merchant_message ||
            "Error al procesar el pago",
        },
        { status: 400 }
      );
    }

    // 4. Obtener servicios para la emisión del comprobante Keyfácil
    const { data: bookingServices } = await admin
      .from("booking_services")
      .select("service_name, service_price_cents, duration_minutes")
      .eq("booking_id", booking.id);

    // 5. Emitir comprobante electrónico en Keyfácil (estrictamente después del éxito del cobro)
    const isFullPay = booking.advance_percentage === 100;
    const keyfacilResult = await emitirComprobanteKeyfacil(
      booking,
      bookingServices || [],
      chargeData.id
    );

    let comprobanteInfo = null;

    if (keyfacilResult.success && keyfacilResult.comprobante) {
      comprobanteInfo = keyfacilResult.comprobante;

      await admin
        .from("bookings")
        .update({
          status: "confirmada",
          payment_status: isFullPay ? "total" : "parcial",
          culqi_charge_id: chargeData.id,
          confirmed_at: new Date().toISOString(),
          slot_lock_expires_at: null, // Permanent lock
          comprobante_tipo: keyfacilResult.comprobante.tipo,
          comprobante_serie: keyfacilResult.comprobante.serie,
          comprobante_numero: keyfacilResult.comprobante.numero,
          pdf_url: keyfacilResult.comprobante.pdf_url || null,
        })
        .eq("id", booking_id);
    } else {
      console.warn(
        "[Keyfácil] Advertencia: El pago fue exitoso pero hubo un detalle en la emisión:",
        keyfacilResult.error
      );

      // Confirmar reserva en BD
      await admin
        .from("bookings")
        .update({
          status: "confirmada",
          payment_status: isFullPay ? "total" : "parcial",
          culqi_charge_id: chargeData.id,
          confirmed_at: new Date().toISOString(),
          slot_lock_expires_at: null,
        })
        .eq("id", booking_id);
    }

    // 6. Auto-assign employee
    await assignEmployee(admin, booking);

    return NextResponse.json({
      success: true,
      charge_id: chargeData.id,
      booking_code: booking.booking_code,
      comprobante: comprobanteInfo,
      pdf_url: comprobanteInfo?.pdf_url || null,
      comprobante_tipo: comprobanteInfo?.tipo || booking.comprobante_tipo || "03",
      comprobante_serie: comprobanteInfo?.serie || null,
      comprobante_numero: comprobanteInfo?.numero || null,
      message: "Pago procesado correctamente. Tu cita está confirmada.",
    });
  } catch (err) {
    console.error("Culqi charge error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Auto-assign an employee to the booking based on:
 * 1. Spa: filter by skills
 * 2. Check schedule for the day
 * 3. Exclude blocked employees
 * 4. Exclude employees with conflicting bookings
 * 5. Pick employee with fewest bookings that day
 */
async function assignEmployee(
  admin: ReturnType<typeof createAdminClient>,
  booking: Record<string, unknown>
) {
  try {
    const bookingDate = booking.booking_date as string;
    const startTime = booking.start_time as string;
    const endTime = booking.end_time as string;
    const serviceType = booking.service_type as string;
    const bookingId = booking.id as string;

    // Get day of week (0=Sunday)
    const date = new Date(bookingDate + "T00:00:00");
    const dayOfWeek = date.getDay();

    // 1. Get active employees of the right type
    const { data: employees } = await admin
      .from("employees")
      .select("id, rotation_order")
      .eq("type", serviceType)
      .eq("is_active", true);

    if (!employees?.length) return;

    let candidateIds = employees.map((e) => e.id);

    // 2. For spa, filter by skills
    if (serviceType === "spa") {
      const { data: bookingServices } = await admin
        .from("booking_services")
        .select("service_id")
        .eq("booking_id", bookingId);

      if (bookingServices?.length) {
        const serviceIds = bookingServices.map((bs) => bs.service_id);

        // Get employees who have ALL required skills
        const { data: skills } = await admin
          .from("employee_skills")
          .select("employee_id, service_id")
          .in("employee_id", candidateIds)
          .in("service_id", serviceIds);

        if (skills) {
          const skillMap = new Map<string, Set<string>>();
          for (const s of skills) {
            if (!skillMap.has(s.employee_id)) {
              skillMap.set(s.employee_id, new Set());
            }
            skillMap.get(s.employee_id)!.add(s.service_id);
          }

          candidateIds = candidateIds.filter((id) => {
            const empSkills = skillMap.get(id);
            return empSkills && serviceIds.every((sid) => empSkills.has(sid));
          });
        }
      }
    }

    if (!candidateIds.length) return;

    // 3. Filter by schedule
    const { data: schedules } = await admin
      .from("employee_schedules")
      .select("employee_id, start_time, end_time")
      .in("employee_id", candidateIds)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true);

    if (schedules) {
      const scheduledIds = new Set(
        schedules
          .filter(
            (s) => s.start_time <= startTime && s.end_time >= endTime
          )
          .map((s) => s.employee_id)
      );
      candidateIds = candidateIds.filter((id) => scheduledIds.has(id));
    }

    if (!candidateIds.length) return;

    // 4. Exclude blocked employees
    const { data: blocks } = await admin
      .from("employee_blocks")
      .select("employee_id, start_time, end_time")
      .in("employee_id", candidateIds)
      .eq("block_date", bookingDate);

    if (blocks?.length) {
      const blockedIds = new Set(
        blocks
          .filter((b) => {
            // Whole day block
            if (!b.start_time || !b.end_time) return true;
            // Time overlap
            return b.start_time < endTime && b.end_time > startTime;
          })
          .map((b) => b.employee_id)
      );
      candidateIds = candidateIds.filter((id) => !blockedIds.has(id));
    }

    if (!candidateIds.length) return;

    // 5. Exclude employees with conflicting bookings
    const { data: existingBookings } = await admin
      .from("bookings")
      .select("assigned_employee_id")
      .eq("booking_date", bookingDate)
      .in("status", ["confirmada", "completada"])
      .in("assigned_employee_id", candidateIds)
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (existingBookings?.length) {
      const busyIds = new Set(
        existingBookings.map((b) => b.assigned_employee_id).filter(Boolean)
      );
      candidateIds = candidateIds.filter((id) => !busyIds.has(id));
    }

    if (!candidateIds.length) return;

    // 6. Pick by least bookings that day
    const { data: dayCounts } = await admin
      .from("bookings")
      .select("assigned_employee_id")
      .eq("booking_date", bookingDate)
      .in("status", ["confirmada", "completada"])
      .in("assigned_employee_id", candidateIds);

    const countMap = new Map<string, number>();
    candidateIds.forEach((id) => countMap.set(id, 0));
    dayCounts?.forEach((b) => {
      if (b.assigned_employee_id) {
        countMap.set(
          b.assigned_employee_id,
          (countMap.get(b.assigned_employee_id) || 0) + 1
        );
      }
    });

    // Sort by count, then by rotation_order for tie-breaking
    const rotationMap = new Map(
      employees.map((e) => [e.id, e.rotation_order])
    );

    candidateIds.sort((a, b) => {
      const countDiff = (countMap.get(a) || 0) - (countMap.get(b) || 0);
      if (countDiff !== 0) return countDiff;
      return (rotationMap.get(a) || 0) - (rotationMap.get(b) || 0);
    });

    const assignedId = candidateIds[0];

    // Assign
    await admin
      .from("bookings")
      .update({ assigned_employee_id: assignedId })
      .eq("id", bookingId);
  } catch (err) {
    console.error("Employee assignment error:", err);
    // Non-fatal — booking proceeds without assignment
  }
}
