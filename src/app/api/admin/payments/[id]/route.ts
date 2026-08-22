import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Helper de autorización — solo admin puede anular pagos
// ---------------------------------------------------------------------------

async function verifyAdminOnly() {
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

  if (!profile || profile.role !== "admin") {
    return {
      error: "Acceso denegado: solo los administradores pueden anular movimientos financieros",
      status: 403 as const,
    };
  }

  return { user, profile };
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/payments/[id]
// Anula un pago (soft-delete financiero). Solo admin.
// El trigger de Postgres recalcula automáticamente los totales en bookings.
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminOnly();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "El ID del pago es obligatorio" },
        { status: 422 }
      );
    }

    const body = await request.json() as { action?: string; void_reason?: string };
    const { action, void_reason } = body;

    if (action !== "void") {
      return NextResponse.json(
        { error: "Acción inválida. Usa action='void' para anular un pago" },
        { status: 422 }
      );
    }

    if (!void_reason || void_reason.trim().length < 5) {
      return NextResponse.json(
        { error: "Debe proporcionar un motivo de anulación de al menos 5 caracteres" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Verificar que el pago existe y está en estado que permite anulación
    const { data: payment, error: fetchError } = await admin
      .from("payment_logs")
      .select("id, booking_id, amount_cents, status, payment_method")
      .eq("id", id)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "El pago no existe" }, { status: 404 });
    }

    if (payment.status === "voided") {
      return NextResponse.json(
        { error: "Este pago ya fue anulado anteriormente" },
        { status: 409 }
      );
    }

    if (payment.status === "rejected") {
      return NextResponse.json(
        { error: "No se puede anular un pago que fue rechazado" },
        { status: 409 }
      );
    }

    // 2. Verificar que la reserva asociada existe
    const { data: booking } = await admin
      .from("bookings")
      .select("id, booking_code, status")
      .eq("id", payment.booking_id)
      .single();

    if (!booking) {
      return NextResponse.json(
        { error: "La reserva asociada al pago no existe" },
        { status: 404 }
      );
    }

    // 3. No permitir anular pagos de reservas completadas
    if (booking.status === "completada") {
      return NextResponse.json(
        {
          error: "No se pueden anular pagos de reservas ya completadas. Consulte al administrador del sistema.",
        },
        { status: 409 }
      );
    }

    // 4. Anular el pago (soft delete — el registro permanece)
    // El trigger recalculará automáticamente los totales en bookings
    const { data: voidedPayment, error: voidError } = await admin
      .from("payment_logs")
      .update({
        status: "voided",
        voided_at: new Date().toISOString(),
        voided_by: auth.user.id,
        void_reason: void_reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (voidError || !voidedPayment) {
      throw voidError ?? new Error("No se pudo anular el pago");
    }

    // 5. Leer el estado actualizado de la reserva (el trigger ya recalculó)
    const { data: updatedBooking } = await admin
      .from("bookings")
      .select("id, booking_code, advance_amount_cents, balance_cents, payment_status, status")
      .eq("id", payment.booking_id)
      .single();

    return NextResponse.json({
      success: true,
      payment: voidedPayment,
      booking: updatedBooking,
      message: `Pago de S/ ${(payment.amount_cents / 100).toFixed(2)} anulado exitosamente. Motivo: ${void_reason.trim()}`,
    });
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    console.error("[PATCH /api/admin/payments/[id]] Error:", msg);
    return NextResponse.json(
      { error: "Error al procesar la anulación del pago: " + msg },
      { status: 500 }
    );
  }
}
