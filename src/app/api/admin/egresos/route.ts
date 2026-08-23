import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET    /api/admin/egresos — Listar egresos con filtros por rango de fechas, categoría y búsqueda
 * POST   /api/admin/egresos — Registrar nuevo egreso
 * PUT    /api/admin/egresos — Actualizar egreso existente
 * DELETE /api/admin/egresos — Eliminar egreso
 */

async function verifyAdminOrRecep() {
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

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminOrRecep();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const admin = createAdminClient();
    let query = admin
      .from("egresos")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (startDate) {
      query = query.gte("expense_date", startDate);
    }
    if (endDate) {
      query = query.lte("expense_date", endDate);
    }
    if (category && category !== "all") {
      query = query.eq("category", category);
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `description.ilike.${term},supplier.ilike.${term},receipt_number.ilike.${term},notes.ilike.${term}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Egresos GET error:", msg);
    return NextResponse.json(
      { error: "Error interno al obtener egresos: " + msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminOrRecep();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      description,
      category,
      amount_cents,
      expense_date,
      payment_method,
      receipt_type,
      receipt_number,
      supplier,
      notes,
    } = body;

    if (!description?.trim()) {
      return NextResponse.json(
        { error: "La descripción del egreso es obligatoria" },
        { status: 422 }
      );
    }

    const parsedAmount = Number(amount_cents);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "El monto debe ser un valor numérico positivo mayor a 0" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("egresos")
      .insert({
        description: description.trim(),
        category: category?.trim() || "otros",
        amount_cents: Math.round(parsedAmount),
        currency: "PEN",
        expense_date: expense_date || new Date().toISOString().split("T")[0],
        payment_method: payment_method || "efectivo",
        receipt_type: receipt_type || "ninguno",
        receipt_number: receipt_number?.trim() || null,
        supplier: supplier?.trim() || null,
        notes: notes?.trim() || null,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase Egresos POST Error:", error);
      return NextResponse.json(
        { error: "Error al registrar el egreso: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Egresos POST Exception:", msg);
    return NextResponse.json(
      { error: "Error interno al crear egreso: " + msg },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdminOrRecep();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      id,
      description,
      category,
      amount_cents,
      expense_date,
      payment_method,
      receipt_type,
      receipt_number,
      supplier,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "El ID del egreso es obligatorio" },
        { status: 422 }
      );
    }

    if (description !== undefined && !description.trim()) {
      return NextResponse.json(
        { error: "La descripción no puede estar vacía" },
        { status: 422 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (description !== undefined) updatePayload.description = description.trim();
    if (category !== undefined) updatePayload.category = category.trim();
    if (amount_cents !== undefined) {
      const parsedAmount = Number(amount_cents);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { error: "El monto debe ser un valor positivo" },
          { status: 422 }
        );
      }
      updatePayload.amount_cents = Math.round(parsedAmount);
    }
    if (expense_date !== undefined) updatePayload.expense_date = expense_date;
    if (payment_method !== undefined) updatePayload.payment_method = payment_method;
    if (receipt_type !== undefined) updatePayload.receipt_type = receipt_type;
    if (receipt_number !== undefined) updatePayload.receipt_number = receipt_number?.trim() || null;
    if (supplier !== undefined) updatePayload.supplier = supplier?.trim() || null;
    if (notes !== undefined) updatePayload.notes = notes?.trim() || null;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("egresos")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase Egresos PUT Error:", error);
      return NextResponse.json(
        { error: "Error al actualizar el egreso: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Egresos PUT Exception:", msg);
    return NextResponse.json(
      { error: "Error interno al actualizar egreso: " + msg },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminOrRecep();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "El ID del egreso es obligatorio" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("egresos")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase Egresos DELETE Error:", error);
      return NextResponse.json(
        { error: "Error al eliminar el egreso: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Egresos DELETE Exception:", msg);
    return NextResponse.json(
      { error: "Error interno al eliminar egreso: " + msg },
      { status: 500 }
    );
  }
}
