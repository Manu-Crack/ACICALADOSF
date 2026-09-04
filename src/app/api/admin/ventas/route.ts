import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Helper para validar permisos de administrador o recepcionista.
 */
async function verifyStaffRole() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { error: "No autenticado", status: 401, supabase: null, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "recepcionista")) {
    return { error: "Acceso no autorizado", status: 403, supabase: null, user: null };
  }

  return { error: null, status: 200, supabase, user, profile };
}

/**
 * GET /api/admin/ventas
 * Lista las ventas de mostrador con filtros opcionales de fecha y término de búsqueda.
 */
export async function GET(request: Request) {
  try {
    const auth = await verifyStaffRole();
    if (auth.error || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const searchTerm = searchParams.get("searchTerm");
    const limit = parseInt(searchParams.get("limit") || "300", 10);

    let query = auth.supabase
      .from("ventas_mostrador")
      .select(`
        id,
        cliente_nombre,
        producto_nombre,
        cantidad,
        precio_unitario,
        total,
        metodo_pago,
        fecha,
        registrado_por,
        notas,
        created_at,
        updated_at
      `)
      .order("fecha", { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte("fecha", `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query = query.lte("fecha", `${endDate}T23:59:59.999Z`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[GET /api/admin/ventas] Error consultando ventas:", error);
      return NextResponse.json(
        { error: "Error al consultar ventas de mostrador." },
        { status: 500 }
      );
    }

    let filtered = data || [];
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.cliente_nombre.toLowerCase().includes(term) ||
          v.producto_nombre.toLowerCase().includes(term)
      );
    }

    return NextResponse.json({ data: filtered, count: filtered.length });
  } catch (err) {
    console.error("[GET /api/admin/ventas] Error inesperado:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

/**
 * POST /api/admin/ventas
 * Registra una venta directa en mostrador con cálculo dinámico del total y validación obligatoria.
 */
export async function POST(request: Request) {
  try {
    const auth = await verifyStaffRole();
    if (auth.error || !auth.supabase || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      cliente_nombre,
      producto_nombre,
      cantidad,
      precio_unitario,
      metodo_pago = "Efectivo",
      fecha,
      notas,
    } = body;

    // Validación de campos obligatorios
    if (!cliente_nombre || !String(cliente_nombre).trim()) {
      return NextResponse.json(
        { error: "El nombre del cliente es obligatorio." },
        { status: 400 }
      );
    }

    if (!producto_nombre || !String(producto_nombre).trim()) {
      return NextResponse.json(
        { error: "El nombre o descripción del producto es obligatorio." },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(String(cantidad), 10);
    if (isNaN(parsedQty) || parsedQty < 1) {
      return NextResponse.json(
        { error: "La cantidad ingresada debe ser un número entero mayor o igual a 1." },
        { status: 400 }
      );
    }

    const parsedPrice = parseFloat(String(precio_unitario));
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json(
        { error: "El precio unitario debe ser un valor numérico válido mayor o igual a 0." },
        { status: 400 }
      );
    }

    const validMethods = ["Efectivo", "Yape", "Transferencia", "Mixto"];
    const resolvedMethod = validMethods.includes(metodo_pago) ? metodo_pago : "Efectivo";

    // Cálculo dinámico del total exacto
    const calculatedTotal = Math.round(parsedQty * parsedPrice * 100) / 100;

    const salePayload = {
      cliente_nombre: String(cliente_nombre).trim(),
      producto_nombre: String(producto_nombre).trim(),
      cantidad: parsedQty,
      precio_unitario: parsedPrice,
      total: calculatedTotal,
      metodo_pago: resolvedMethod,
      fecha: fecha ? new Date(fecha).toISOString() : new Date().toISOString(),
      registrado_por: auth.user.id,
      notas: notas ? String(notas).trim() : null,
    };

    const { data: inserted, error } = await auth.supabase
      .from("ventas_mostrador")
      .insert(salePayload)
      .select()
      .single();

    if (error) {
      console.error("[POST /api/admin/ventas] Error insertando venta:", error);
      return NextResponse.json(
        { error: "Error al registrar la venta de mostrador." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: inserted }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/ventas] Error inesperado:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/ventas
 * Edición post-creación rápida de precio, cantidad u otros datos de la venta.
 * Recalcula de inmediato el total en la base de datos.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await verifyStaffRole();
    if (auth.error || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, cliente_nombre, producto_nombre, cantidad, precio_unitario, metodo_pago, notas } = body;

    if (!id) {
      return NextResponse.json({ error: "El ID de la venta es requerido." }, { status: 400 });
    }

    // Consultar venta existente para obtener valores actuales en caso de actualización parcial
    const { data: existing, error: findErr } = await auth.supabase
      .from("ventas_mostrador")
      .select("*")
      .eq("id", id)
      .single();

    if (findErr || !existing) {
      return NextResponse.json(
        { error: "La venta solicitada no existe o fue eliminada." },
        { status: 404 }
      );
    }

    const updatedQty = cantidad !== undefined ? parseInt(String(cantidad), 10) : existing.cantidad;
    if (isNaN(updatedQty) || updatedQty < 1) {
      return NextResponse.json(
        { error: "La cantidad debe ser un entero mayor o igual a 1." },
        { status: 400 }
      );
    }

    const updatedPrice =
      precio_unitario !== undefined ? parseFloat(String(precio_unitario)) : Number(existing.precio_unitario);
    if (isNaN(updatedPrice) || updatedPrice < 0) {
      return NextResponse.json(
        { error: "El precio unitario debe ser un número válido mayor o igual a 0." },
        { status: 400 }
      );
    }

    const newTotal = Math.round(updatedQty * updatedPrice * 100) / 100;

    const updates: Record<string, unknown> = {
      cantidad: updatedQty,
      precio_unitario: updatedPrice,
      total: newTotal,
      updated_at: new Date().toISOString(),
    };

    if (cliente_nombre !== undefined) {
      if (!String(cliente_nombre).trim()) {
        return NextResponse.json({ error: "El nombre del cliente no puede estar vacío." }, { status: 400 });
      }
      updates.cliente_nombre = String(cliente_nombre).trim();
    }

    if (producto_nombre !== undefined) {
      if (!String(producto_nombre).trim()) {
        return NextResponse.json({ error: "El producto no puede estar vacío." }, { status: 400 });
      }
      updates.producto_nombre = String(producto_nombre).trim();
    }

    if (metodo_pago !== undefined) {
      const validMethods = ["Efectivo", "Yape", "Transferencia", "Mixto"];
      if (validMethods.includes(metodo_pago)) {
        updates.metodo_pago = metodo_pago;
      }
    }

    if (notas !== undefined) {
      updates.notas = notas ? String(notas).trim() : null;
    }

    const { data: updated, error: updateErr } = await auth.supabase
      .from("ventas_mostrador")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      console.error("[PATCH /api/admin/ventas] Error actualizando venta:", updateErr);
      return NextResponse.json(
        { error: "Error al actualizar la venta de mostrador." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[PATCH /api/admin/ventas] Error inesperado:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/ventas
 * Anulación o retiro de venta de mostrador (restringido a administradores).
 */
export async function DELETE(request: Request) {
  try {
    const auth = await verifyStaffRole();
    if (auth.error || !auth.supabase || !auth.profile) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (auth.profile.role !== "admin") {
      return NextResponse.json(
        { error: "Solo los administradores pueden anular ventas." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID de venta no proporcionado." }, { status: 400 });
    }

    const { error } = await auth.supabase.from("ventas_mostrador").delete().eq("id", id);

    if (error) {
      console.error("[DELETE /api/admin/ventas] Error eliminando venta:", error);
      return NextResponse.json({ error: "Error al eliminar venta." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/ventas] Error inesperado:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
