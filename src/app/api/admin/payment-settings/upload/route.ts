import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractStoragePath } from "@/lib/utils/storage";

async function verifyAdminAuth() {
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
    return { error: "Acceso denegado: solo el administrador puede subir la imagen del QR", status: 403 as const };
  }

  return { user, profile };
}

/**
 * POST /api/admin/payment-settings/upload
 * Sube una imagen de código QR a Supabase Storage.
 * Acceso: Solo Administrador.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo de imagen" }, { status: 422 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Solo se admiten imágenes JPG, PNG o WebP." },
        { status: 422 }
      );
    }

    // Máximo 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo excede el tamaño máximo permitido (5MB)." },
        { status: 422 }
      );
    }

    const ext = file.type.split("/")[1] || "png";
    const filename = `yape-qr-${Date.now()}.${ext}`;
    const path = `payment-qr/${filename}`;

    const admin = createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Subir a storage (usamos services-images que ya está configurado como bucket público)
    const { error: uploadError } = await admin.storage
      .from("services-images")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Error subiendo QR a Supabase Storage:", uploadError);
      return NextResponse.json(
        { error: "Error al almacenar la imagen en Storage: " + uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = admin.storage
      .from("services-images")
      .getPublicUrl(path);

    // Actualizar automáticamente payment_settings con la nueva URL
    await admin
      .from("payment_settings")
      .upsert({
        id: 1,
        qr_image_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      }, { onConflict: "id" });

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path,
      message: "Código QR subido y actualizado exitosamente.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/admin/payment-settings/upload] Error:", errorMsg);
    return NextResponse.json({ error: "Error interno: " + errorMsg }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/payment-settings/upload
 * Remueve la imagen del QR de Storage y limpia la URL en payment_settings.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (url) {
      const storagePath = extractStoragePath(url, "services-images");
      if (storagePath) {
        const admin = createAdminClient();
        await admin.storage.from("services-images").remove([storagePath]);
      }
    }

    const admin = createAdminClient();
    await admin
      .from("payment_settings")
      .update({
        qr_image_url: null,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      })
      .eq("id", 1);

    return NextResponse.json({ success: true, message: "Imagen QR eliminada correctamente." });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Error interno: " + errorMsg }, { status: 500 });
  }
}
