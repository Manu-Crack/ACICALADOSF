import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
 * Permite al administrador actualizar estado (pendiente -> confirmada -> completada -> cancelada),
 * registrar cobro presencial (payment_status = total) y reasignar empleado.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, status, payment_status, assigned_employee_id, mark_paid } = body;

    if (!id) {
      return NextResponse.json(
        { error: "El ID de la reserva es obligatorio" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Obtener la reserva actual
    const { data: booking, error: fetchError } = await admin
      .from("bookings")
      .select("id, booking_code, booking_date, start_time, end_time, total_price_cents, status, payment_status, confirmed_at")
      .eq("id", id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: "La reserva no existe" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (status) {
      updates.status = status;
      if (status === "confirmada" && !booking.confirmed_at) {
        updates.confirmed_at = new Date().toISOString();
      }
      if (status === "completada") {
        updates.completed_at = new Date().toISOString();
        updates.payment_status = "total";
        updates.advance_percentage = 100;
        updates.advance_amount_cents = booking.total_price_cents;
        updates.balance_cents = 0;
      }
      if (status === "cancelada") {
        updates.cancelled_at = new Date().toISOString();
      }
    }

    if (payment_status) {
      updates.payment_status = payment_status;
      if (payment_status === "total") {
        updates.advance_percentage = 100;
        updates.advance_amount_cents = booking.total_price_cents;
        updates.balance_cents = 0;
      }
    }

    if (mark_paid) {
      updates.payment_status = "total";
      updates.advance_percentage = 100;
      updates.advance_amount_cents = booking.total_price_cents;
      updates.balance_cents = 0;
      if (booking.status === "pendiente") {
        updates.status = "confirmada";
        updates.confirmed_at = booking.confirmed_at || new Date().toISOString();
      }
    }

    if (assigned_employee_id !== undefined) {
      const newEmpId = assigned_employee_id || null;

      // Si se asigna un colaborador, verificar si ya tiene colisión con otra cita o permiso
      if (newEmpId) {
        // Verificar ausencias / permisos
        const { data: absences } = await admin
          .from("employee_blocks")
          .select("id, start_time, end_time, reason")
          .eq("employee_id", newEmpId)
          .eq("block_date", booking.booking_date);

        const hasAbsence = (absences || []).some((b) => {
          if (!b.start_time || !b.end_time) return true;
          return hasTimeOverlap(b.start_time, b.end_time, booking.start_time, booking.end_time);
        });

        if (hasAbsence) {
          return NextResponse.json(
            { error: "El colaborador seleccionado tiene un permiso o ausencia registrada en ese horario." },
            { status: 409 }
          );
        }

        // Verificar choque con otra reserva activa
        const { data: conflictingBookings } = await admin
          .from("bookings")
          .select("id, booking_code, start_time, end_time")
          .eq("assigned_employee_id", newEmpId)
          .eq("booking_date", booking.booking_date)
          .neq("id", booking.id)
          .not("status", "in", '("cancelada","expirada")');

        const conflict = (conflictingBookings || []).find((cb) => {
          return hasTimeOverlap(cb.start_time, cb.end_time, booking.start_time, booking.end_time);
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
      message: `Reserva ${booking.booking_code} actualizada exitosamente.`,
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

