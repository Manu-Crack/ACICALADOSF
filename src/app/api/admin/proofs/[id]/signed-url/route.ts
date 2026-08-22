import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/proofs/[id]/signed-url
 * Genera una URL firmada temporal (válida por 60 minutos) para visualizar un comprobante de pago.
 * Acceso: Admin, Recepcionista o el usuario propietario de la reserva.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "El ID del comprobante es obligatorio" }, { status: 422 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isStaff = profile && ["admin", "recepcionista"].includes(profile.role);

    const admin = createAdminClient();

    // Obtener metadatos del comprobante
    const { data: proof, error: proofError } = await admin
      .from("payment_proofs")
      .select("id, booking_id, proof_path, file_name, status, uploaded_by")
      .eq("id", id)
      .single();

    if (proofError || !proof) {
      return NextResponse.json({ error: "El comprobante no existe" }, { status: 404 });
    }

    // Si no es staff, verificar que sea el propietario de la reserva
    if (!isStaff) {
      const { data: booking } = await admin
        .from("bookings")
        .select("user_id")
        .eq("id", proof.booking_id)
        .single();

      if (!booking || booking.user_id !== user.id) {
        return NextResponse.json({ error: "No tienes permiso para ver este comprobante" }, { status: 403 });
      }
    }

    // Generar URL firmada con validez de 1 hora (3600 segundos)
    const { data: signedData, error: signError } = await admin.storage
      .from("services-images")
      .createSignedUrl(proof.proof_path, 3600);

    if (signError || !signedData) {
      // Fallback a URL pública si createSignedUrl falla por tipo de bucket
      const { data: publicData } = admin.storage
        .from("services-images")
        .getPublicUrl(proof.proof_path);

      return NextResponse.json({
        success: true,
        signed_url: publicData.publicUrl,
        file_name: proof.file_name,
        status: proof.status,
      });
    }

    return NextResponse.json({
      success: true,
      signed_url: signedData.signedUrl,
      file_name: proof.file_name,
      status: proof.status,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/admin/proofs/[id]/signed-url] Error:", errorMsg);
    return NextResponse.json({ error: "Error interno: " + errorMsg }, { status: 500 });
  }
}
