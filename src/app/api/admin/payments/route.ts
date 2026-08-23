import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PaymentMethod,
  PaymentType,
  CreatePaymentPayload,
} from "@/lib/types/payments";

// ---------------------------------------------------------------------------
// Helpers de autorización
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers de validación de montos
// ---------------------------------------------------------------------------

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

function validatePaymentAmounts(
  payment_method: PaymentMethod,
  amount_cents: number,
  yape_amount_cents: number,
  cash_amount_cents: number
): string | null {
  if (amount_cents <= 0) {
    return "El monto del pago debe ser mayor a cero";
  }
  if (yape_amount_cents < 0 || cash_amount_cents < 0) {
    return "Los montos parciales no pueden ser negativos";
  }

  if (payment_method === "yape") {
    if (cash_amount_cents > 0) {
      return "Para pago por Yape, el monto en efectivo debe ser cero";
    }
  } else if (payment_method === "efectivo" || payment_method === "cash") {
    if (yape_amount_cents > 0) {
      return "Para pago en efectivo, el monto en Yape debe ser cero";
    }
  } else if (payment_method === "transferencia") {
    // Transferencia bancaria directa
  } else if (payment_method === "mixto" || payment_method === "mixed") {
    if (yape_amount_cents + cash_amount_cents !== amount_cents) {
      return `Para pago mixto, la suma de Yape (S/ ${(yape_amount_cents / 100).toFixed(2)}) + Efectivo (S/ ${(cash_amount_cents / 100).toFixed(2)}) debe ser igual al total (S/ ${(amount_cents / 100).toFixed(2)})`;
    }
    if (yape_amount_cents === 0 || cash_amount_cents === 0) {
      return "Para pago mixto, ambos montos (Yape y Efectivo) deben ser mayores a cero";
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// GET /api/admin/payments?booking_id=UUID
// Lista todos los pagos de una reserva con datos del registrador.
// Acceso: admin, recepcionista
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyStaffAuth(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const booking_id = searchParams.get("booking_id");

    if (!booking_id) {
      return NextResponse.json(
        { error: "El parámetro booking_id es obligatorio" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // Verificar que la reserva existe
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, booking_code, total_price_cents, advance_percentage, advance_amount_cents, balance_cents, payment_status, status")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "La reserva no existe" }, { status: 404 });
    }

    // Obtener pagos con datos de usuarios registradores
    const { data: payments, error: paymentsError } = await admin
      .from("payment_logs")
      .select("*")
      .eq("booking_id", booking_id)
      .order("paid_at", { ascending: false });

    if (paymentsError) {
      throw paymentsError;
    }

    // Obtener nombres de usuarios registradores
    const paymentsList = payments || [];
    const userIds = Array.from(
      new Set(
        paymentsList.flatMap((p) =>
          [p.registered_by, p.voided_by].filter(Boolean)
        )
      )
    ) as string[];

    let userNames: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);

      if (profiles) {
        userNames = Object.fromEntries(
          profiles.map((p) => [
            p.id,
            `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Usuario",
          ])
        );
      }
    }

    const paymentsWithUsers = paymentsList.map((p) => ({
      ...p,
      registered_by_name: p.registered_by ? (userNames[p.registered_by] ?? "Usuario") : "Sistema",
      voided_by_name: p.voided_by ? (userNames[p.voided_by] ?? "Usuario") : null,
    }));

    // Calcular resumen financiero
    const advanceRequiredCents = Math.ceil(
      booking.total_price_cents * (booking.advance_percentage || 25) / 100
    );

    return NextResponse.json({
      booking: {
        id: booking.id,
        booking_code: booking.booking_code,
        total_price_cents: booking.total_price_cents,
        advance_percentage: booking.advance_percentage || 25,
        advance_required_cents: advanceRequiredCents,
        amount_paid_cents: booking.advance_amount_cents,
        balance_cents: booking.balance_cents,
        payment_status: booking.payment_status,
        booking_status: booking.status,
        can_confirm: booking.advance_amount_cents >= advanceRequiredCents,
      },
      payments: paymentsWithUsers,
    });
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    console.error("[GET /api/admin/payments] Error:", msg);
    return NextResponse.json(
      { error: "Error al obtener los pagos: " + msg },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/payments
// Registra un nuevo pago para una reserva.
// Acceso: admin, recepcionista
// El trigger de Postgres recalcula automáticamente los totales en bookings.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyStaffAuth(["admin", "recepcionista"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json() as Partial<CreatePaymentPayload> & {
      payment_method?: string;
      payment_type?: string;
    };

    const {
      booking_id,
      payment_method,
      payment_type,
      notes,
      proof_url,
    } = body;

    const amount_cents = Number(body.amount_cents) || 0;
    const yape_amount_cents = Number(body.yape_amount_cents) || 0;
    const cash_amount_cents = Number(body.cash_amount_cents) || 0;
    const idempotency_key = body.idempotency_key || request.headers.get("x-idempotency-key") || null;

    // 1. Validar campos obligatorios
    if (!booking_id) {
      return NextResponse.json({ error: "El ID de la reserva es obligatorio" }, { status: 422 });
    }
    if (!payment_method) {
      return NextResponse.json({ error: "El método de pago es obligatorio" }, { status: 422 });
    }
    if (!payment_type) {
      return NextResponse.json({ error: "El tipo de pago es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // 2. Comprobar idempotencia previa si se suministró idempotency_key
    if (idempotency_key) {
      const { data: existingPayment } = await admin
        .from("payment_logs")
        .select("*")
        .eq("idempotency_key", idempotency_key)
        .maybeSingle();

      if (existingPayment) {
        const { data: currentBooking } = await admin
          .from("bookings")
          .select("id, booking_code, total_price_cents, advance_percentage, advance_amount_cents, balance_cents, payment_status, status, confirmed_at")
          .eq("id", existingPayment.booking_id)
          .single();

        return NextResponse.json({
          success: true,
          payment: existingPayment,
          booking: currentBooking,
          idempotent_replay: true,
        });
      }
    }

    // 3. Validar valores de enumeración
    const validMethods: PaymentMethod[] = [
      "yape",
      "efectivo",
      "cash",
      "transferencia",
      "mixto",
      "mixed",
      "culqi_legacy",
    ];
    const validTypes: PaymentType[] = ["advance", "partial", "balance", "full", "total", "refund", "legacy"];

    if (!validMethods.includes(payment_method as PaymentMethod)) {
      return NextResponse.json(
        { error: `Método de pago inválido. Valores permitidos: ${validMethods.join(", ")}` },
        { status: 422 }
      );
    }
    if (!validTypes.includes(payment_type as PaymentType)) {
      return NextResponse.json(
        { error: `Tipo de pago inválido. Valores permitidos: ${validTypes.join(", ")}` },
        { status: 422 }
      );
    }

    // 4. Validar montos
    const amountError = validatePaymentAmounts(
      payment_method as PaymentMethod,
      amount_cents,
      yape_amount_cents,
      cash_amount_cents
    );
    if (amountError) {
      return NextResponse.json({ error: amountError }, { status: 422 });
    }

    // 5. Verificar que la reserva existe y no está cancelada
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, booking_code, total_price_cents, advance_percentage, advance_amount_cents, status, payment_status")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "La reserva no existe" }, { status: 404 });
    }

    if (["cancelada", "expirada"].includes(booking.status)) {
      return NextResponse.json(
        { error: "No se pueden registrar pagos en una reserva cancelada o expirada" },
        { status: 422 }
      );
    }

    // 6. Verificar que el pago no excede el total pendiente
    const currentPaid = booking.advance_amount_cents || 0;
    const maxAllowed = booking.total_price_cents - currentPaid;

    if (amount_cents > maxAllowed) {
      return NextResponse.json(
        {
          error: `El monto ingresado (S/ ${(amount_cents / 100).toFixed(2)}) supera el saldo pendiente de la reserva (S/ ${(maxAllowed / 100).toFixed(2)}). El total de la reserva es S/ ${(booking.total_price_cents / 100).toFixed(2)}.`,
          max_allowed_cents: maxAllowed,
        },
        { status: 422 }
      );
    }

    // 7. Determinar payment_type automáticamente si no se especifica correctamente
    let resolvedPaymentType: PaymentType = payment_type as PaymentType;
    const advanceRequired = Math.ceil(
      booking.total_price_cents * (booking.advance_percentage || 25) / 100
    );

    if (payment_type === "advance" && amount_cents + currentPaid >= booking.total_price_cents) {
      resolvedPaymentType = "full";
    } else if (payment_type === "balance" && currentPaid + amount_cents >= booking.total_price_cents) {
      resolvedPaymentType = "full";
    }

    // Si es el primer pago y cubre exactamente o más del total
    if (currentPaid === 0 && amount_cents >= booking.total_price_cents) {
      resolvedPaymentType = "full";
    }
    // Si es adelanto mínimo
    if (currentPaid === 0 && amount_cents >= advanceRequired && amount_cents < booking.total_price_cents) {
      resolvedPaymentType = "advance";
    }

    // 8. Insertar el pago — el trigger recalcula bookings automáticamente
    const { data: newPayment, error: insertError } = await admin
      .from("payment_logs")
      .insert({
        idempotency_key: idempotency_key || null,
        booking_id,
        amount_cents,
        payment_method: payment_method as PaymentMethod,
        payment_type: resolvedPaymentType,
        yape_amount_cents,
        cash_amount_cents,
        status: "verified",          // Admin/recepcionista verifican al registrar
        notes: notes || null,
        proof_url: proof_url || null,
        paid_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
        verified_by: auth.user.id,
        registered_by: auth.user.id,
      })
      .select()
      .single();

    if (insertError) {
      // Si ocurrió una colisión de idempotency_key por concurrencia simultánea exacta
      if (insertError.code === "23505" && idempotency_key) {
        const { data: existingPayment } = await admin
          .from("payment_logs")
          .select("*")
          .eq("idempotency_key", idempotency_key)
          .maybeSingle();

        if (existingPayment) {
          const { data: currentBooking } = await admin
            .from("bookings")
            .select("id, booking_code, total_price_cents, advance_percentage, advance_amount_cents, balance_cents, payment_status, status, confirmed_at")
            .eq("id", existingPayment.booking_id)
            .single();

          return NextResponse.json({
            success: true,
            payment: existingPayment,
            booking: currentBooking,
            idempotent_replay: true,
          });
        }
      }
      throw insertError;
    }

    // 9. Actualizar método de pago en booking y leer estado actualizado
    await admin
      .from("bookings")
      .update({
        payment_method: payment_method,
      })
      .eq("id", booking_id);

    const { data: updatedBooking } = await admin
      .from("bookings")
      .select("id, booking_code, advance_amount_cents, balance_cents, payment_status, payment_method, status, confirmed_at")
      .eq("id", booking_id)
      .single();

    return NextResponse.json(
      {
        success: true,
        payment: newPayment,
        booking: updatedBooking,
        message: `Pago de S/ ${(amount_cents / 100).toFixed(2)} registrado exitosamente para la reserva ${booking.booking_code}.${updatedBooking?.status === "confirmada" ? " La reserva ha sido confirmada automáticamente." : ""}`,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    console.error("[POST /api/admin/payments] Error:", msg);
    return NextResponse.json(
      { error: "Error al registrar el pago: " + msg },
      { status: 500 }
    );
  }
}
