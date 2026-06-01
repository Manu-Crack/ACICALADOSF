import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/culqi/webhook
 * Receives Culqi webhook notifications.
 * Implements idempotency via culqi_event_id.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const eventType = body.type || body.event || "unknown";
    const eventId = body.id || body.data?.id || null;

    const admin = createAdminClient();

    // 1. Idempotency check
    if (eventId) {
      const { data: existing } = await admin
        .from("payment_logs")
        .select("id")
        .eq("culqi_event_id", eventId)
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json({ message: "Event already processed" });
      }
    }

    // 2. Extract booking info
    const chargeData = body.data || body;
    const metadata = chargeData.metadata || {};
    const bookingId = metadata.booking_id || null;

    // 3. Process based on event type
    let processingResult = "logged";

    if (
      eventType === "charge.creation.succeeded" ||
      chargeData.outcome?.type === "venta_exitosa"
    ) {
      if (bookingId) {
        // Update booking status
        const { error } = await admin
          .from("bookings")
          .update({
            status: "confirmada",
            payment_status: "parcial",
            culqi_charge_id: chargeData.id || null,
            confirmed_at: new Date().toISOString(),
            slot_lock_expires_at: null,
          })
          .eq("id", bookingId)
          .in("status", ["pendiente", "borrador"]);

        processingResult = error ? `error: ${error.message}` : "confirmed";
      }
    } else if (
      eventType === "charge.creation.failed" ||
      chargeData.outcome?.type === "venta_rechazada"
    ) {
      processingResult = "charge_failed";
    }

    // 4. Log the webhook
    const processingTime = Date.now() - startTime;
    await admin.from("payment_logs").insert({
      booking_id: bookingId,
      event_type: eventType,
      culqi_event_id: eventId,
      amount_cents: chargeData.amount || null,
      payload: body,
      processing_result: processingResult,
      processing_time_ms: processingTime,
    });

    return NextResponse.json({ received: true, result: processingResult });
  } catch (err) {
    console.error("Webhook processing error:", err);

    // Log the error
    try {
      const admin = createAdminClient();
      await admin.from("payment_logs").insert({
        event_type: "webhook_error",
        payload: { error: String(err) },
        processing_result: "error",
        processing_time_ms: Date.now() - startTime,
      });
    } catch {
      // Silently fail logging
    }

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
