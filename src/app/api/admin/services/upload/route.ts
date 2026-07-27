import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";
import { extractStoragePath } from "@/lib/utils/storage";

/**
 * POST /api/admin/services/upload — Subir imagen WebP a Supabase Storage (bucket services-images)
 * DELETE /api/admin/services/upload — Eliminar imagen de Storage por su URL o path
 */
export async function POST(request: NextRequest) {
  try {
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

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Solo el administrador puede subir imágenes" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawServiceName = (formData.get("serviceName") as string | null) || "servicio";

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo de imagen" }, { status: 422 });
    }

    // Validar tipo de imagen
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/bmp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Solo se permiten imágenes (jpg, png, webp, avif, bmp)" },
        { status: 422 }
      );
    }

    // Validar tamaño máximo (8MB)
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "La imagen no debe exceder 8MB" },
        { status: 422 }
      );
    }

    // Formatear nombre sanitizado en formato WebP obligatoriamente
    const cleanSlug = slugify(rawServiceName);
    const uniqueTag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const filename = `${cleanSlug}-${uniqueTag}.webp`;
    const path = `services/${filename}`;

    const admin = createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Subir obligatoriamente como image/webp a Supabase Storage
    const { error: uploadError } = await admin.storage
      .from("services-images")
      .upload(path, buffer, {
        contentType: "image/webp",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error en Supabase Storage:", uploadError);
      return NextResponse.json(
        { error: "Error al almacenar la imagen WebP en Supabase: " + uploadError.message },
        { status: 500 }
      );
    }

    // Obtener URL pública oficial
    const { data: urlData } = admin.storage
      .from("services-images")
      .getPublicUrl(path);

    return NextResponse.json({
      url: urlData.publicUrl,
      path,
      format: "webp",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Services upload error:", errorMsg);
    return NextResponse.json({ error: "Error interno al procesar imagen: " + errorMsg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
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

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Solo el administrador puede eliminar imágenes" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "Se requiere la URL de la imagen a eliminar" }, { status: 422 });
    }

    const storagePath = extractStoragePath(url);
    if (!storagePath) {
      return NextResponse.json({ error: "URL de imagen no válida" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error: removeError } = await admin.storage
      .from("services-images")
      .remove([storagePath]);

    if (removeError) {
      console.error("Error al remover de Storage:", removeError);
      return NextResponse.json({ error: removeError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, path: storagePath });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Error interno: " + errorMsg }, { status: 500 });
  }
}
