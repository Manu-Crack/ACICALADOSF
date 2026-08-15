import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
      .select("id, booking_code, total_price_cents, status, payment_status, confirmed_at")
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
      updates.assigned_employee_id = assigned_employee_id || null;
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

