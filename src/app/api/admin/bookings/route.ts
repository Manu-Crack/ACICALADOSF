import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignMultiServiceEmployees } from "@/lib/utils/employee-assignment";

function timeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function hasTimeOverlap(
  startA: string | null | undefined,
  endA: string | null | undefined,
  startB: string | null | undefined,
  endB: string | null | undefined
): boolean {
  if (!startA || !endA || !startB || !endB) return false;
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && eA > sB;
}

async function verifyAdminAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autorizado", status: 401 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "recepcionista"].includes(profile.role)) {
    return { error: "Acceso denegado. Se requiere rol administrativo.", status: 403 };
  }

  return { user, profile };
}

/**
 * DELETE /api/admin/bookings?id=<booking_id>
 * Elimina físicamente y de forma permanente una reserva y sus registros asociados (booking_services y payment_logs)
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Solamente los usuarios con rol 'admin' pueden realizar borrado físico permanente
    if (auth.profile.role !== "admin") {
      return NextResponse.json(
        { error: "Solo los administradores pueden eliminar reservas definitivamente" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "El ID de la reserva es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // 1. Verificar si la reserva existe
    const { data: booking, error: fetchError } = await admin
      .from("bookings")
      .select("id, booking_code")
      .eq("id", id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: "La reserva no existe o ya fue eliminada" },
        { status: 404 }
      );
    }

    // 2. Limpiar registros hijos vinculados (booking_services y payment_logs)
    await admin.from("booking_services").delete().eq("booking_id", id);
    await admin.from("payment_logs").delete().eq("booking_id", id);

    // 3. Eliminar físicamente el registro de la reserva en la tabla bookings
    const { error: deleteError } = await admin
      .from("bookings")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error al eliminar reserva en la BD:", deleteError);
      return NextResponse.json(
        { error: "Error al eliminar la reserva de la base de datos: " + deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id,
      message: `Reserva ${booking.booking_code} eliminada de forma permanente.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Booking DELETE error:", errorMsg);
    return NextResponse.json(
      { error: "Error interno al procesar la eliminación de la reserva: " + errorMsg },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/bookings
 * Permite a admin y recepcionista actualizar el estado de una reserva y reasignar empleado.
 *
 * REGLAS DE CONFIRMACIÓN:
 * - Una reserva solo puede pasar a 'confirmada' si advance_amount_cents >= advance_required.
 * - advance_required = ceil(total_price_cents * advance_percentage / 100).
 * - Los pagos se registran en /api/admin/payments (trigger recalcula automáticamente).
 * - mark_paid fue eliminado; usar el endpoint de pagos en su lugar.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, status, assigned_employee_id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "El ID de la reserva es obligatorio" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Obtener la reserva actual con todos los campos financieros
    const { data: bookingData, error: fetchError } = await admin
      .from("bookings")
      .select(
        "id, booking_code, booking_date, start_time, end_time, total_price_cents, advance_percentage, advance_amount_cents, balance_cents, status, payment_status, confirmed_at"
      )
      .eq("id", id)
      .single();

    if (fetchError || !bookingData) {
      return NextResponse.json(
        { error: "La reserva no existe" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    // 2. Cambio de estado — con validaciones de negocio
    if (status) {
      const validStatuses = ["pendiente", "confirmada", "completada", "cancelada"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Estado inválido. Valores permitidos: ${validStatuses.join(", ")}` },
          { status: 422 }
        );
      }

      // Validar transición de confirmación: requiere adelanto del 25% pagado
      if (status === "confirmada" && bookingData.status === "pendiente") {
        const advanceRequired = Math.ceil(
          bookingData.total_price_cents * (bookingData.advance_percentage || 25) / 100
        );
        const amountPaid = bookingData.advance_amount_cents || 0;

        if (amountPaid < advanceRequired) {
          return NextResponse.json(
            {
              error: `No se puede confirmar la reserva. El adelanto mínimo requerido es S/ ${(advanceRequired / 100).toFixed(2)} (${bookingData.advance_percentage || 25}% de S/ ${(bookingData.total_price_cents / 100).toFixed(2)}). Actualmente pagado: S/ ${(amountPaid / 100).toFixed(2)}. Registra el pago en el módulo de pagos.`,
              advance_required_cents: advanceRequired,
              amount_paid_cents: amountPaid,
            },
            { status: 422 }
          );
        }
      }

      // No permitir volver a pendiente desde confirmada o completada
      if (status === "pendiente" && ["confirmada", "completada"].includes(bookingData.status)) {
        return NextResponse.json(
          { error: "No se puede regresar una reserva confirmada o completada al estado pendiente" },
          { status: 422 }
        );
      }

      // No permitir modificar reservas canceladas excepto para admin
      if (bookingData.status === "cancelada" && auth.profile.role !== "admin") {
        return NextResponse.json(
          { error: "Solo el administrador puede modificar reservas canceladas" },
          { status: 403 }
        );
      }

      updates.status = status;

      if (status === "confirmada" && !bookingData.confirmed_at) {
        updates.confirmed_at = new Date().toISOString();
      }
      if (status === "completada") {
        updates.completed_at = new Date().toISOString();
      }
      if (status === "cancelada") {
        updates.cancelled_at = new Date().toISOString();
      }
    }

    // 3. Reasignación de empleado con validación de conflictos
    if (assigned_employee_id !== undefined) {
      const newEmpId = assigned_employee_id || null;

      if (newEmpId) {
        // Verificar ausencias / permisos del empleado
        const { data: absences } = await admin
          .from("employee_blocks")
          .select("id, start_time, end_time, reason")
          .eq("employee_id", newEmpId)
          .eq("block_date", bookingData.booking_date);

        const hasAbsence = (absences || []).some((b) => {
          if (!b.start_time || !b.end_time) return true;
          return hasTimeOverlap(b.start_time, b.end_time, bookingData.start_time, bookingData.end_time);
        });

        if (hasAbsence) {
          return NextResponse.json(
            { error: "El colaborador seleccionado tiene un permiso o ausencia registrada en ese horario." },
            { status: 409 }
          );
        }

        // Verificar choque con otra reserva activa del mismo empleado
        const { data: conflictingBookings } = await admin
          .from("bookings")
          .select("id, booking_code, start_time, end_time")
          .eq("assigned_employee_id", newEmpId)
          .eq("booking_date", bookingData.booking_date)
          .neq("id", bookingData.id)
          .not("status", "in", '("cancelada","expirada")');

        const conflict = (conflictingBookings || []).find((cb) => {
          return hasTimeOverlap(cb.start_time, cb.end_time, bookingData.start_time, bookingData.end_time);
        });

        if (conflict) {
          return NextResponse.json(
            {
              error: `El colaborador ya cuenta con la cita ${conflict.booking_code} asignada en ese mismo horario (${conflict.start_time?.slice(0, 5)} - ${conflict.end_time?.slice(0, 5)}).`,
            },
            { status: 409 }
          );
        }
      }

      updates.assigned_employee_id = newEmpId;
    }

    // 4. Verificar que hay algo que actualizar
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron campos válidos para actualizar" },
        { status: 422 }
      );
    }

    // 5. Aplicar la actualización
    const { data: updated, error: updateError } = await admin
      .from("bookings")
      .update(updates)
      .eq("id", id)
      .select()
      .single();


    if (updateError) {
      console.error("Error al actualizar reserva:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar reserva: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: updated,
      message: `Reserva ${bookingData.booking_code} actualizada exitosamente.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Booking PATCH error:", errorMsg);
    return NextResponse.json(
      { error: "Error interno al procesar la actualización: " + errorMsg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/bookings
 * Creación manual y rápida de reservas presenciales (Walk-ins) desde el panel administrativo.
 *
 * REGLAS DE NEGOCIO:
 * - Autorizado para roles 'admin' y 'recepcionista'.
 * - Campos mínimos obligatorios: client_first_name, service_ids, booking_date, start_time.
 * - Campos opcionales: client_last_name, assigned_employee_id, client_phone, client_email, client_dni, notes.
 * - Estado inicial: 'confirmada' (ya que se toma presencialmente en el mostrador sin flujo de WhatsApp).
 * - Estado de pago inicial: 'sin_pago' (saldo total pendiente listo para cobrar en caja).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      service_ids,
      service_assignments,
      booking_date,
      start_time,
      client_first_name,
      client_last_name,
      assigned_employee_id,
      client_phone,
      client_email,
      client_dni,
    } = body;

    // 1. Validar campos mínimos obligatorios
    if (!service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
      return NextResponse.json(
        { error: "Debes seleccionar al menos un servicio a realizar" },
        { status: 422 }
      );
    }

    if (!booking_date) {
      return NextResponse.json(
        { error: "La fecha de la reserva es obligatoria" },
        { status: 422 }
      );
    }

    if (!start_time) {
      return NextResponse.json(
        { error: "La hora de inicio de la reserva es obligatoria" },
        { status: 422 }
      );
    }

    if (!client_first_name?.trim()) {
      return NextResponse.json(
        { error: "El nombre del cliente es obligatorio" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 2. Consultar servicios desde la BD
    const { data: services, error: svcError } = await admin
      .from("services")
      .select("id, name, price_cents, duration_minutes, type, is_active")
      .in("id", service_ids);

    if (svcError || !services || services.length === 0) {
      return NextResponse.json(
        { error: "Los servicios seleccionados no existen o no fueron encontrados" },
        { status: 422 }
      );
    }

    // Ordenar los servicios según el orden solicitado
    const orderedServices = service_ids
      .map((id) => services.find((s) => s.id === id))
      .filter(Boolean) as typeof services;

    // 3. Determinar rubro (barbería, spa o mixto) y calcular totales
    const types = new Set(orderedServices.map((s) => s.type));
    const serviceType = types.size > 1 ? "mixto" : orderedServices[0].type;
    const totalPriceCents = orderedServices.reduce((sum, s) => sum + (s.price_cents || 0), 0);

    // 4. Asignación automática inteligente por servicio y validación de horarios
    const assignmentResult = await assignMultiServiceEmployees({
      services: orderedServices.map((s) => ({
        id: s.id,
        name: s.name,
        price_cents: s.price_cents,
        duration_minutes: s.duration_minutes || 30,
        type: s.type,
      })),
      bookingDate: booking_date,
      startTime: start_time,
      manualAssignments: service_assignments || null,
      globalEmployeeId: assigned_employee_id || null,
    });

    // Si hubo conflicto explícito con empleados asignados manualmente
    if (assignmentResult.has_conflicts && (assigned_employee_id || service_assignments)) {
      return NextResponse.json(
        { error: assignmentResult.conflict_messages.join(" ") },
        { status: 409 }
      );
    }

    const formattedStartTime = assignmentResult.formatted_start_time;
    const formattedEndTime = assignmentResult.formatted_end_time;
    const totalDuration = assignmentResult.total_duration_minutes;
    const finalPrimaryEmployeeId = assignmentResult.primary_employee_id;

    // 5. Determinar método de pago inicial si fue cobrado en el mostrador
    const reqMethod = (body.payment_method || "").toLowerCase();
    let normalizedMethod: "cash" | "yape" | "transfer" | "mixed" | null = null;
    let dbPaymentMethodLabel: string | null = null;

    let yapeAmountCents = 0;
    let cashAmountCents = 0;

    if (reqMethod === "efectivo" || reqMethod === "cash") {
      normalizedMethod = "cash";
      dbPaymentMethodLabel = "efectivo";
      cashAmountCents = totalPriceCents;
    } else if (reqMethod === "yape") {
      normalizedMethod = "yape";
      dbPaymentMethodLabel = "yape";
      yapeAmountCents = totalPriceCents;
    } else if (reqMethod === "transferencia" || reqMethod === "transfer") {
      normalizedMethod = "transfer";
      dbPaymentMethodLabel = "transferencia";
    } else if (reqMethod === "mixto" || reqMethod === "mixed") {
      normalizedMethod = "mixed";
      dbPaymentMethodLabel = "mixto";
      // Montos desglosados de Yape y Efectivo
      const rawYape = parseInt(body.yape_amount_cents, 10);
      const rawCash = parseInt(body.cash_amount_cents, 10);

      if (!isNaN(rawYape) && rawYape >= 0 && rawYape <= totalPriceCents) {
        yapeAmountCents = rawYape;
        cashAmountCents = Math.max(0, totalPriceCents - yapeAmountCents);
      } else if (!isNaN(rawCash) && rawCash >= 0 && rawCash <= totalPriceCents) {
        cashAmountCents = rawCash;
        yapeAmountCents = Math.max(0, totalPriceCents - cashAmountCents);
      } else {
        // Por defecto mitades si no se especificaron
        yapeAmountCents = Math.round(totalPriceCents / 2);
        cashAmountCents = totalPriceCents - yapeAmountCents;
      }
    }

    const advancePercentage = 25;
    const finalLastName = client_last_name?.trim() || "Presencial";
    const initialPaymentStatus = normalizedMethod ? "total" : "sin_pago";
    const initialAdvanceAmount = normalizedMethod ? totalPriceCents : 0;
    const initialBalance = normalizedMethod ? 0 : totalPriceCents;

    // 6. Insertar registro principal de reserva en tabla 'bookings'
    const { data: newBooking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        client_first_name: client_first_name.trim(),
        client_last_name: finalLastName,
        client_phone: client_phone?.trim() || null,
        client_email: client_email?.trim() || null,
        client_dni: client_dni?.trim() || null,
        service_type: serviceType,
        assigned_employee_id: finalPrimaryEmployeeId,
        booking_date,
        start_time: formattedStartTime,
        end_time: formattedEndTime,
        total_duration_minutes: totalDuration,
        total_price_cents: totalPriceCents,
        advance_percentage: advancePercentage,
        advance_amount_cents: initialAdvanceAmount,
        balance_cents: initialBalance,
        status: "confirmada",
        payment_status: initialPaymentStatus,
        payment_method: dbPaymentMethodLabel,
        confirmed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (bookingError || !newBooking) {
      console.error("Error al registrar reserva manual:", bookingError);
      return NextResponse.json(
        { error: "Error al registrar la reserva: " + (bookingError?.message || "No se pudo insertar el registro") },
        { status: 500 }
      );
    }

    // 7. Insertar detalle de servicios en 'booking_services' con empleados asignados
    const bookingServices = assignmentResult.items.map((item) => ({
      booking_id: newBooking.id,
      service_id: item.service_id,
      service_name: item.service_name,
      service_price_cents: item.service_price_cents,
      duration_minutes: item.duration_minutes,
      assigned_employee_id: item.assigned_employee_id,
    }));

    const { error: bsError } = await admin.from("booking_services").insert(bookingServices);
    if (bsError) {
      console.error("Error al insertar booking_services:", bsError);
    }
    if (bsError) {
      console.error("Error al insertar booking_services:", bsError);
    }

    // 9. Si se cobró inmediatamente en el mostrador, registrar en 'payment_logs'
    if (normalizedMethod) {
      const nowIso = new Date().toISOString();
      const notesMsg = normalizedMethod === "mixed"
        ? `Cobro total presencial mixto (Yape: S/ ${(yapeAmountCents / 100).toFixed(2)} + Efectivo: S/ ${(cashAmountCents / 100).toFixed(2)})`
        : `Cobro total presencial en mostrador (${dbPaymentMethodLabel})`;

      const { error: payLogErr } = await admin.from("payment_logs").insert({
        booking_id: newBooking.id,
        amount_cents: totalPriceCents,
        payment_method: normalizedMethod,
        payment_type: "full",
        status: "verified",
        yape_amount_cents: yapeAmountCents,
        cash_amount_cents: cashAmountCents,
        notes: notesMsg,
        paid_at: nowIso,
        registered_by: auth.user.id,
        verified_at: nowIso,
        verified_by: auth.user.id,
      });

      if (payLogErr) {
        console.error("Error al registrar payment_log de reserva manual:", payLogErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        booking: newBooking,
        message: normalizedMethod
          ? `Reserva ${newBooking.booking_code} creada y confirmada con cobro (${dbPaymentMethodLabel}) exitosamente.`
          : `Reserva ${newBooking.booking_code} creada exitosamente.`,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Admin booking POST exception:", errorMsg);
    return NextResponse.json(
      { error: "Error interno al registrar la reserva manual: " + errorMsg },
      { status: 500 }
    );
  }
}



