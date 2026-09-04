import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignMultiServiceEmployees } from "@/lib/utils/employee-assignment";
import { generateWhatsAppBookingUrl } from "@/lib/utils/whatsapp";

/**
 * POST /api/bookings
 * Creates a new booking for Acicalados.
 * Status: "pendiente" (Payment in local physically).
 * Generates and returns a pre-filled WhatsApp confirmation URL.
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
      notes,
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
        { error: "Faltan campos obligatorios para la reserva" },
        { status: 422 }
      );
    }

    if (!client_phone && !client_email) {
      return NextResponse.json(
        { error: "Se requiere al menos un número de teléfono o correo de contacto" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Fetch services from DB — recalculate prices
    const { data: services, error: svcError } = await admin
      .from("services")
      .select("id, name, price_cents, duration_minutes, type, is_active")
      .in("id", service_ids);

    if (svcError || !services?.length) {
      return NextResponse.json(
        { error: "Servicios seleccionados no encontrados" },
        { status: 422 }
      );
    }

    // Validate all services are active
    const inactive = services.filter((s) => !s.is_active);
    if (inactive.length > 0) {
      return NextResponse.json(
        { error: "Uno o más servicios seleccionados no están disponibles actualmente" },
        { status: 422 }
      );
    }

    // Determine service type
    const types = new Set(services.map((s) => s.type));
    const serviceType = types.size > 1 ? "mixto" : services[0].type;

    // 2. Calculate totals from DB
    const totalPriceCents = services.reduce((sum, s) => sum + s.price_cents, 0);
    const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);

    // 3. Calculate end_time
    const [startHour, startMin] = start_time.split(":").map(Number);
    const totalStartMinutes = startHour * 60 + startMin;
    const totalEndMinutes = totalStartMinutes + totalDuration;
    const endHour = Math.floor(totalEndMinutes / 60);
    const endMin = totalEndMinutes % 60;
    const endTime = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

    // 4. Validación cronológica estricta en tiempo real (Zona Horaria Perú: America/Lima)
    const now = new Date();
    const peruDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
    }).format(now);
    const peruCurrentTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);

    if (booking_date < peruDateStr) {
      return NextResponse.json(
        { error: "No es posible reservar en fechas pasadas" },
        { status: 422 }
      );
    }

    if (booking_date === peruDateStr && start_time <= peruCurrentTime) {
      return NextResponse.json(
        { error: "El horario seleccionado ya ha transcurrido. Por favor elige una hora posterior." },
        { status: 422 }
      );
    }

    // 5. Get authenticated user if logged in
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 6. Algoritmo de asignación automática de colaboradores y cronograma individual por servicio
    const assignmentResult = await assignMultiServiceEmployees({
      services: services.map((s: { id: string; name: string; price_cents: number; duration_minutes?: number; type: "barberia" | "spa" }) => ({
        id: s.id,
        name: s.name,
        price_cents: s.price_cents,
        duration_minutes: s.duration_minutes || 30,
        type: s.type,
      })),
      bookingDate: booking_date,
      startTime: start_time,
    });

    if (assignmentResult.items.some((i) => !i.assigned_employee_id)) {
      return NextResponse.json(
        {
          error:
            "El horario seleccionado ya no cuenta con personal disponible debido a la capacidad máxima. Por favor, elige otro horario.",
        },
        { status: 409 }
      );
    }

    const assignedEmployeeId = assignmentResult.primary_employee_id;
    const finalStartTime = assignmentResult.formatted_start_time;
    const finalEndTime = assignmentResult.formatted_end_time;
    const finalTotalDuration = assignmentResult.total_duration_minutes;

    const clientFullName = `${client_first_name} ${client_last_name}`.trim();

    // 7. Insert booking with status 'pendiente' y adelanto del 25%
    // El cliente deberá pagar mínimo el 25% para confirmar la reserva.
    // advance_amount_cents y balance_cents son recalculados por trigger
    // al registrar pagos en payment_logs.
    const advancePercentage = 25;
    const advanceAmountCents = Math.ceil(totalPriceCents * advancePercentage / 100);

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
        start_time: finalStartTime,
        end_time: finalEndTime,
        total_duration_minutes: finalTotalDuration,
        total_price_cents: totalPriceCents,
        advance_percentage: advancePercentage,  // 25% — adelanto requerido
        advance_amount_cents: 0,                // Sin pago inicial aún
        balance_cents: totalPriceCents,         // Saldo total pendiente
        status: "pendiente",
        payment_status: "sin_pago",
        slot_locked_at: new Date().toISOString(),
        slot_lock_expires_at: null,
      })
      .select("id, booking_code, total_price_cents, booking_date, start_time")
      .single();

    if (bookingError || !booking) {
      console.error("Booking creation error:", bookingError);
      return NextResponse.json(
        { error: "Error al registrar la reserva en el sistema" },
        { status: 500 }
      );
    }

    // 7. Insert booking_services con marcas horarias individuales y colaboradores asignados
    const bookingServices = assignmentResult.items.map((item) => ({
      booking_id: booking.id,
      service_id: item.service_id,
      service_name: item.service_name,
      service_price_cents: item.service_price_cents,
      duration_minutes: item.duration_minutes,
      assigned_employee_id: item.assigned_employee_id,
      start_time: item.start_time,
      end_time: item.end_time,
      hora_inicio: item.hora_inicio || item.start_time,
      hora_fin: item.hora_fin || item.end_time,
    }));

    await admin.from("booking_services").insert(bookingServices);

    // 8. Generar URL de confirmación en WhatsApp
    const serviceNames = services.map((s) => s.name);
    const totalPriceSoles = (totalPriceCents / 100).toFixed(2);

    const whatsappUrl = generateWhatsAppBookingUrl({
      bookingCode: booking.booking_code,
      clientName: clientFullName,
      services: serviceNames,
      bookingDate: booking_date,
      startTime: start_time,
      totalPriceSoles: totalPriceSoles,
    });

    return NextResponse.json({
      success: true,
      booking_id: booking.id,
      booking_code: booking.booking_code,
      client_name: clientFullName,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      total_price_cents: booking.total_price_cents,
      total_price_soles: totalPriceSoles,
      advance_percentage: advancePercentage,
      advance_required_cents: advanceAmountCents,
      advance_required_soles: (advanceAmountCents / 100).toFixed(2),
      balance_soles: totalPriceSoles, // saldo = total ya que aún no hay pago
      services: serviceNames,
      whatsapp_url: whatsappUrl,
      message: `Reserva registrada exitosamente. Para confirmarla, realiza un adelanto mínimo del ${advancePercentage}% (S/ ${(advanceAmountCents / 100).toFixed(2)}) y confírmala por WhatsApp.`,
    });
  } catch (err) {
    console.error("Booking API error:", err);
    return NextResponse.json(
      { error: "Error interno al procesar la reserva" },
      { status: 500 }
    );
  }
}
