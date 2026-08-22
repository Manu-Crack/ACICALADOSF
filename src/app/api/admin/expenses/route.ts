import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES } from "@/lib/types/expenses";

/**
 * GET /api/admin/expenses
 * Lista los egresos registrados con filtros opcionales (fecha, categoría, estado, empleado).
 * Autorizado para: admin, recepcionista.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "recepcionista")) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");

    let query = supabase
      .from("expenses")
      .select(`
        id,
        expense_date,
        category,
        description,
        amount_cents,
        payment_method,
        receipt_url,
        employee_id,
        supplier,
        notes,
        registered_by,
        status,
        voided_at,
        voided_by,
        void_reason,
        created_at,
        employees:employee_id (first_name, last_name)
      `)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("expense_date", startDate);
    if (endDate) query = query.lte("expense_date", endDate);
    if (category && category !== "all") query = query.eq("category", category);
    if (status && status !== "all") query = query.eq("status", status);
    if (employeeId && employeeId !== "all") query = query.eq("employee_id", employeeId);

    const { data: expenses, error: dbErr } = await query;

    if (dbErr) {
      console.error("Error fetching expenses:", dbErr);
      return NextResponse.json({ error: "Error al consultar los egresos" }, { status: 500 });
    }

    return NextResponse.json({ expenses: expenses || [] });
  } catch (error) {
    console.error("GET /api/admin/expenses exception:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * POST /api/admin/expenses
 * Registra un nuevo egreso/gasto operativo.
 * Autorizado para: admin, recepcionista.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "recepcionista")) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const body = await request.json();
    const {
      expense_date,
      category,
      description,
      amount_cents,
      payment_method,
      receipt_url,
      employee_id,
      supplier,
      notes,
    } = body;

    if (!expense_date) {
      return NextResponse.json({ error: "La fecha del egreso es requerida" }, { status: 400 });
    }
    if (!category || !EXPENSE_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Categoría de egreso inválida" }, { status: 400 });
    }
    if (!description || description.trim().length < 3) {
      return NextResponse.json({ error: "La descripción debe tener al menos 3 caracteres" }, { status: 400 });
    }
    if (!amount_cents || typeof amount_cents !== "number" || amount_cents <= 0) {
      return NextResponse.json({ error: "El monto debe ser un número positivo en céntimos" }, { status: 400 });
    }

    const { data: newExpense, error: insertErr } = await supabase
      .from("expenses")
      .insert({
        expense_date,
        category,
        description: description.trim(),
        amount_cents,
        payment_method: payment_method || "cash",
        receipt_url: receipt_url || null,
        employee_id: employee_id || null,
        supplier: supplier?.trim() || null,
        notes: notes?.trim() || null,
        registered_by: user.id,
        status: "active",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Error inserting expense:", insertErr);
      return NextResponse.json({ error: "No se pudo guardar el egreso" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Egreso registrado correctamente",
      expense: newExpense,
    });
  } catch (error) {
    console.error("POST /api/admin/expenses exception:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
