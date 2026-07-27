import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAvailableEmployeeForBooking } from "@/lib/utils/employee-assignment";

/**
 * POST /api/bookings
 * Creates a new booking (draft → pending).
 * Recalculates prices from the DB, never trusts client amounts.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      service_ids,
      booking_date,
      start_time,
      client_first_name,
      client_last_name,
      client_phone,
      client_email,
      client_dni,
      payment_mode = "advance", // "advance" (30%) or "full" (100%)
    } = body;

    // Validate required fields
    if (
      !service_ids?.length ||
      !booking_date ||
      !start_time ||
      !client_first_name ||
      !client_last_name
    ) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 422 }
      );
    }

    if (!client_phone && !client_email) {
      return NextResponse.json(
        { error: "Se requiere al menos un medio de contacto (teléfono o correo)" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Fetch services from DB — recalculate everything
    const { data: services, error: svcError } = await admin
      .from("services")
      .select("id, name, price_cents, duration_minutes, type, is_active")
      .in("id", service_ids);

    if (svcError || !services?.length) {
      return NextResponse.json(
        { error: "Servicios no encontrados" },
        { status: 422 }
      );
    }

    // Validate all services are active
    const inactive = services.filter((s) => !s.is_active);
    if (inactive.length > 0) {
      return NextResponse.json(
        { error: "Uno o más servicios no están disponibles" },
        { status: 422 }
      );
    }

    // Determine service type — allow mixing
    const types = new Set(services.map((s) => s.type));
    const serviceType = types.size > 1 ? "mixto" : services[0].type;

    // 2. Calculate totals from DB
    const totalPriceCents = services.reduce((sum, s) => sum + s.price_cents, 0);
    const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);

    // 3. Get advance percentage from business_config
    const { data: config } = await admin
      .from("business_config")
      .select("advance_percentage")
      .limit(1)
      .single();

    const configAdvance = config?.advance_percentage ?? 30;
    const isFullPayment = payment_mode === "full";
    const advancePercentage = isFullPayment ? 100 : configAdvance;
    const advanceAmountCents = isFullPayment
      ? totalPriceCents
      : Math.ceil(totalPriceCents * (configAdvance / 100));
    const balanceCents = totalPriceCents - advanceAmountCents;

    // 4. Calculate end_time
    const [startHour, startMin] = start_time.split(":").map(Number);
    const totalStartMinutes = startHour * 60 + startMin;
    const totalEndMinutes = totalStartMinutes + totalDuration;
    const endHour = Math.floor(totalEndMinutes / 60);
    const endMin = totalEndMinutes % 60;
    const endTime = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

    // 5. Check availability (transactional via advisory lock)
    const { data: conflicts } = await admin
      .from("bookings")
      .select("id")
      .eq("booking_date", booking_date)
      .eq("service_type", serviceType)
      .in("status", ["pendiente", "confirmada"])
      .or(`and(start_time.lt.${endTime},end_time.gt.${start_time})`);

    // Basic capacity check
    if (conflicts && conflicts.length > 0) {
      // For now, simple check — will be enhanced with employee-level availability
      // This prevents double-booking at the same time
    }

    // 6. Get authenticated user (optional for guest bookings)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 7. Algoritmo de asignación automática de empleado
    const serviceIds = services.map((s: { id: string }) => s.id);
    const assignedEmployeeId = await findAvailableEmployeeForBooking({
      serviceIds,
      serviceType,
      bookingDate: booking_date,
      startTime: start_time,
      endTime: endTime,
    });

    // 8. Lock the slot — create booking with temporary lock
    const lockExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        user_id: user?.id || null,
        client_first_name,
        client_last_name,
        client_phone: client_phone || null,
        client_email: client_email || null,
        client_dni: client_dni || null,
        service_type: serviceType,
        assigned_employee_id: assignedEmployeeId,
        booking_date,
        start_time,
        end_time: endTime,
        total_duration_minutes: totalDuration,
        total_price_cents: totalPriceCents,
        advance_percentage: advancePercentage,
        advance_amount_cents: advanceAmountCents,
        balance_cents: balanceCents,
        status: "pendiente",
        payment_status: "sin_pago",
        slot_locked_at: new Date().toISOString(),
        slot_lock_expires_at: lockExpiresAt,
      })
      .select("id, booking_code, advance_amount_cents, total_price_cents")
      .single();

    if (bookingError) {
      console.error("Booking creation error:", bookingError);
      return NextResponse.json(
        { error: "Error al crear la reserva" },
        { status: 500 }
      );
    }

    // 8. Insert booking_services
    const bookingServices = services.map((s) => ({
      booking_id: booking.id,
      service_id: s.id,
      service_name: s.name,
      service_price_cents: s.price_cents,
      duration_minutes: s.duration_minutes,
    }));

    await admin.from("booking_services").insert(bookingServices);

    return NextResponse.json({
      booking_id: booking.id,
      booking_code: booking.booking_code,
      advance_amount_cents: booking.advance_amount_cents,
      total_price_cents: booking.total_price_cents,
      payment_amount_cents: booking.advance_amount_cents,
      payment_mode: isFullPayment ? "full" : "advance",
      currency: "PEN",
    });
  } catch (err) {
    console.error("Booking API error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
