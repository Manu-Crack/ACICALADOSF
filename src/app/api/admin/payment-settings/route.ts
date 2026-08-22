import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UpdatePaymentSettingsPayload } from "@/lib/types/settings";

async function verifyAdminAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autorizado", status: 401 as const };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Acceso denegado: solo el administrador puede modificar los ajustes de pago", status: 403 as const };
  }

  return { user, profile };
}

/**
 * PUT /api/admin/payment-settings
 * Actualiza la configuración central de pagos.
 * Acceso: Solo Administrador.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as Partial<UpdatePaymentSettingsPayload>;
    const { recipient_name, yape_phone, advance_percentage, base_message, is_active, qr_image_url } = body;

    if (!recipient_name || recipient_name.trim().length < 2) {
      return NextResponse.json({ error: "El nombre del titular es obligatorio (mínimo 2 caracteres)" }, { status: 422 });
    }

    const cleanPhone = (yape_phone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 9) {
      return NextResponse.json({ error: "El número de teléfono debe contener al menos 9 dígitos" }, { status: 422 });
    }

    const advPct = Number(advance_percentage);
    if (isNaN(advPct) || advPct <= 0 || advPct > 100) {
      return NextResponse.json({ error: "El porcentaje de adelanto debe ser un número entre 1 y 100" }, { status: 422 });
    }

    const admin = createAdminClient();

    const payload = {
      id: 1,
      recipient_name: recipient_name.trim(),
      yape_phone: cleanPhone,
      advance_percentage: advPct,
      base_message: base_message?.trim() || "Hola Acicalados, adjunto mi comprobante de pago para mi reserva.",
      is_active: is_active !== undefined ? is_active : true,
      qr_image_url: qr_image_url !== undefined ? qr_image_url : null,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    };

    const { data: updated, error } = await admin
      .from("payment_settings")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("Error al actualizar payment_settings:", error);
      return NextResponse.json({ error: "Error al guardar la configuración: " + error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      settings: updated,
      message: "Configuración de pagos actualizada correctamente.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[PUT /api/admin/payment-settings] Error:", errorMsg);
    return NextResponse.json({ error: "Error interno: " + errorMsg }, { status: 500 });
  }
}
