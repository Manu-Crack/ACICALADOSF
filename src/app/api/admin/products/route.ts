import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";
import { extractStoragePath } from "@/lib/utils/storage";

/**
 * GET  /api/admin/products — Listar todos los productos (vista admin, incluye precios, stock e inactivos)
 * POST /api/admin/products — Crear un nuevo producto
 * PUT  /api/admin/products — Actualizar producto y limpiar imágenes huérfanas de Storage
 * DELETE /api/admin/products — Eliminar producto físicamente y sus fotos en Storage
 */

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado", status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "recepcionista"].includes(profile.role)) {
    return { error: "Acceso denegado: solo personal autorizado", status: 403 };
  }

  return { user, profile };
}

export async function GET() {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("Products GET error:", err);
    return NextResponse.json({ error: "Error interno al obtener productos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      name,
      slug: customSlug,
      description,
      category,
      price_cents,
      stock,
      features,
      images,
      is_active,
      sort_order,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre del producto es obligatorio" }, { status: 422 });
    }

    // Generar slug único sanitizado
    const baseSlug = customSlug?.trim() ? slugify(customSlug) : slugify(name);
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    // Normalizar features a array de strings no vacíos
    const cleanFeatures = Array.isArray(features)
      ? features.map((f: unknown) => String(f).trim()).filter(Boolean)
      : [];

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("products")
      .insert({
        name: name.trim(),
        slug: uniqueSlug,
        description: description?.trim() || null,
        category: category?.trim() || "Cuidado de Barba",
        price_cents: price_cents !== undefined ? Number(price_cents) : 0,
        currency: "PEN",
        stock: stock !== undefined ? Number(stock) : 0,
        features: cleanFeatures,
        images: Array.isArray(images) ? images : [],
        is_active: is_active ?? true,
        sort_order: sort_order ? Number(sort_order) : 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase Products POST Error:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un producto con ese nombre" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Error al crear el producto en la base de datos: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Products POST Exception:", errorMsg);
    return NextResponse.json({ error: "Error interno al crear producto: " + errorMsg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "El ID del producto es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // Obtener producto anterior para comparar y limpiar imágenes removidas de Storage
    const { data: existingProduct } = await admin
      .from("products")
      .select("images")
      .eq("id", id)
      .single();

    if (existingProduct?.images?.length && Array.isArray(updates.images)) {
      const removedImages = existingProduct.images.filter(
        (oldUrl: string) => !updates.images.includes(oldUrl)
      );

      const pathsToRemove = removedImages
        .map((url: string) => extractStoragePath(url, "products-images"))
        .filter((path: string | null): path is string => !!path);

      if (pathsToRemove.length > 0) {
        await admin.storage.from("products-images").remove(pathsToRemove);
      }
    }

    // Normalizar features si vienen en updates
    if (updates.features && Array.isArray(updates.features)) {
      updates.features = updates.features.map((f: unknown) => String(f).trim()).filter(Boolean);
    }

    const { data, error } = await admin
      .from("products")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase Products PUT Error:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ya existe un producto con ese nombre o slug" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Error al actualizar el producto: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Products PUT Exception:", errorMsg);
    return NextResponse.json({ error: "Error interno al actualizar producto: " + errorMsg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "El ID del producto es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();

    // 1. Obtener producto para recuperar sus imágenes antes del borrado
    const { data: product, error: fetchError } = await admin
      .from("products")
      .select("id, name, images")
      .eq("id", id)
      .single();

    if (fetchError || !product) {
      return NextResponse.json(
        { error: "El producto no existe o ya fue eliminado" },
        { status: 404 }
      );
    }

    // 2. Eliminar registro físicamente de la tabla products
    const { error: deleteError } = await admin
      .from("products")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error al eliminar producto:", deleteError);
      return NextResponse.json(
        { error: "Error al eliminar el producto de la base de datos: " + deleteError.message },
        { status: 500 }
      );
    }

    // 3. Eliminar imágenes en Storage si existen
    if (product.images?.length) {
      const paths = product.images
        .map((url: string) => extractStoragePath(url, "products-images"))
        .filter((path: string | null): path is string => !!path);

      if (paths.length > 0) {
        await admin.storage.from("products-images").remove(paths);
      }
    }

    return NextResponse.json({
      success: true,
      id,
      message: `Producto '${product.name}' eliminado exitosamente.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Products DELETE Exception:", errorMsg);
    return NextResponse.json({ error: "Error interno al eliminar producto: " + errorMsg }, { status: 500 });
  }
}
