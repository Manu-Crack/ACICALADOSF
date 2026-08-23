import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PAYMENT_SETTINGS, type PaymentSettings } from "@/lib/types/settings";

/**
 * GET /api/payment-settings
 * Retorna la configuración de pagos activa.
 * Acceso: Público / Autenticado (clientes y staff para ver QR, titular y teléfono).
 */
export async function GET() {
  try {
    const admin = createAdminClient();

    const { data: settings, error } = await admin
      .from("payment_settings")
      .select("holder_name, yape_phone, qr_image_url, advance_percentage, base_message, is_active")
      .eq("id", 1)
      .single();

    if (error || !settings) {
      // Fallback seguro si la tabla aún no se ha inicializado
      return NextResponse.json({
        success: true,
        settings: {
          ...DEFAULT_PAYMENT_SETTINGS,
          qr_image_url: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/payment-settings] Error:", errorMsg);
    return NextResponse.json({
      success: true,
      settings: {
        id: 1,
        ...DEFAULT_PAYMENT_SETTINGS,
        qr_image_url: null,
        updated_at: new Date().toISOString(),
        updated_by: null,
      } as PaymentSettings,
    });
  }
}
