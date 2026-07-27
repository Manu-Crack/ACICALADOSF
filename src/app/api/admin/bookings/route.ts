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
