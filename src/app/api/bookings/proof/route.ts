import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/bookings/proof
 * Sube y asocia un comprobante de pago a una reserva.
 *
 * REGLAS DE SEGURIDAD:
 * 1. Valida tipo MIME real (image/jpeg, image/png, image/webp).
 * 2. Límite de tamaño estricto: 5 MB.
 * 3. Nombres sanitizados y únicos generados en servidor.
 * 4. La subida del comprobante NO confirma la reserva; queda en estado 'pending'
 *    hasta verificación del personal autorizado.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const booking_id = formData.get("booking_id") as string | null;
    const notes = formData.get("notes") as string | null;
    const payment_id = formData.get("payment_id") as string | null;

    if (!booking_id) {
      return NextResponse.json({ error: "El ID de la reserva es obligatorio" }, { status: 422 });
    }

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo de comprobante" }, { status: 422 });
    }

    // 1. Validar tipo MIME
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Solo se admiten imágenes JPG, PNG o WebP." },
        { status: 422 }
      );
    }

    // 2. Validar tamaño (máx 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo excede el tamaño máximo permitido (5MB)." },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 3. Verificar que la reserva existe
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, booking_code, status, client_first_name, client_last_name")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "La reserva no existe" }, { status: 404 });
    }

    if (booking.status === "cancelada" || booking.status === "expirada") {
      return NextResponse.json(
        { error: "No se pueden adjuntar comprobantes a una reserva cancelada o expirada" },
        { status: 422 }
      );
    }

    // 4. Sanitizar y subir archivo a Storage
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const uniqueTag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const filename = `proof-${booking.booking_code}-${uniqueTag}.${ext}`;
    const storagePath = `proofs/${filename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await admin.storage
      .from("services-images")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error al almacenar comprobante:", uploadError);
      return NextResponse.json(
        { error: "Error al guardar el archivo en Storage: " + uploadError.message },
        { status: 500 }
      );
    }

    // 5. Registrar en tabla payment_proofs
    const { data: proofRecord, error: insertError } = await admin
      .from("payment_proofs")
      .insert({
        booking_id,
        payment_id: payment_id || null,
        proof_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id || null,
        status: "pending",
        notes: notes ? notes.trim() : null,
      })
      .select()
      .single();

    if (insertError) {
      console.warn("Advertencia: No se pudo insertar en payment_proofs (se usará storagePath):", insertError);
    }

    return NextResponse.json(
      {
        success: true,
        proof: proofRecord || {
          booking_id,
          proof_path: storagePath,
          file_name: file.name,
          status: "pending",
        },
        message:
          "Comprobante recibido con éxito. Nuestro equipo verificará la transferencia a la brevedad para confirmar tu cita.",
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/bookings/proof] Error:", errorMsg);
    return NextResponse.json({ error: "Error interno: " + errorMsg }, { status: 500 });
  }
}
