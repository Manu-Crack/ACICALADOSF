import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/expenses/[id]
 * Anula un egreso registrado (soft-delete). Exclusivo para el rol 'admin'.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Solo los administradores pueden anular egresos" }, { status: 403 });
    }

    const body = await request.json();
    const { void_reason } = body;

    if (!void_reason || void_reason.trim().length < 5) {
      return NextResponse.json(
        { error: "Debe especificar un motivo válido de anulación (mínimo 5 caracteres)" },
        { status: 400 }
      );
    }

    // Verificar si el egreso existe y no está anulado
    const { data: existing, error: findErr } = await supabase
      .from("expenses")
      .select("id, status")
      .eq("id", id)
      .single();

    if (findErr || !existing) {
      return NextResponse.json({ error: "Egreso no encontrado" }, { status: 404 });
    }

    if (existing.status === "voided") {
      return NextResponse.json({ error: "Este egreso ya fue anulado previamente" }, { status: 400 });
    }

    // Proceder con la anulación
    const { error: updateErr } = await supabase
      .from("expenses")
      .update({
        status: "voided",
        voided_at: new Date().toISOString(),
        voided_by: user.id,
        void_reason: void_reason.trim(),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("Error voiding expense:", updateErr);
      return NextResponse.json({ error: "No se pudo anular el egreso" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Egreso anulado correctamente. Ya no afectará los balances financieros.",
    });
  } catch (error) {
    console.error("PATCH /api/admin/expenses/[id] exception:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
