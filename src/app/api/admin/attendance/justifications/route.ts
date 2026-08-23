import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/attendance/justifications
 * Consulta las justificaciones registradas con filtros opcionales.
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
    const employeeId = searchParams.get("employee_id");
    const attendanceId = searchParams.get("attendance_id");
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const admin = createAdminClient();
    let query = admin
      .from("attendance_justifications")
      .select(`
        id,
        attendance_id,
        employee_id,
        type,
        reason,
        observation,
        evidence_url,
        status,
        registered_by,
        approved_by,
        approved_at,
        audit_history,
        created_at,
        updated_at,
        employees:employee_id (first_name, last_name, position)
      `)
      .order("created_at", { ascending: false });

    if (employeeId) query = query.eq("employee_id", employeeId);
    if (attendanceId) query = query.eq("attendance_id", attendanceId);
    if (type && type !== "all") query = query.eq("type", type);
    if (status && status !== "all") query = query.eq("status", status);

    const { data: justifications, error: dbErr } = await query;

    if (dbErr) {
      console.error("Error fetching justifications:", dbErr);
      return NextResponse.json({ error: "Error al consultar justificaciones" }, { status: 500 });
    }

    interface RawJustificationRow {
      id: string;
      attendance_id: string | null;
      employee_id: string;
      type: string;
      reason: string;
      observation: string | null;
      evidence_url: string | null;
      status: string;
      registered_by: string | null;
      approved_by: string | null;
      approved_at: string | null;
      audit_history: unknown[];
      created_at: string;
      updated_at: string;
      employees: {
        first_name: string | null;
        last_name: string | null;
        position: string | null;
      } | null;
    }

    // Mapear nombres de empleados
    const formatted = ((justifications || []) as unknown as RawJustificationRow[]).map((j) => ({
      ...j,
      employee_name: j.employees ? `${j.employees.first_name || ""} ${j.employees.last_name || ""}`.trim() : undefined,
    }));

    return NextResponse.json({ justifications: formatted });
  } catch (error) {
    console.error("GET /api/admin/attendance/justifications exception:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * POST /api/admin/attendance/justifications
 * Registra una nueva justificación para entrada, salida o ausencia.
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
      .select("role, first_name, last_name")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "recepcionista")) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const body = await request.json();
    const { attendance_id, employee_id, type, reason, observation, evidence_url } = body;

    if (!employee_id) {
      return NextResponse.json({ error: "El trabajador es obligatorio" }, { status: 400 });
    }
    if (!type || !["check_in", "check_out", "absence"].includes(type)) {
      return NextResponse.json({ error: "Tipo de justificación inválido (check_in, check_out, absence)" }, { status: 400 });
    }
    if (!reason || reason.trim().length < 3) {
      return NextResponse.json({ error: "El motivo de la justificación es obligatorio (mínimo 3 caracteres)" }, { status: 400 });
    }

    const userName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || user.email || "Usuario";
    const initialAudit = [
      {
        action: "created",
        user_id: user.id,
        user_name: userName,
        timestamp: new Date().toISOString(),
        details: `Justificación creada: ${reason.trim()}`,
      },
    ];

    const admin = createAdminClient();
    const { data: newJustification, error: insertErr } = await admin
      .from("attendance_justifications")
      .insert({
        attendance_id: attendance_id || null,
        employee_id,
        type,
        reason: reason.trim(),
        observation: observation?.trim() || null,
        evidence_url: evidence_url?.trim() || null,
        status: "pending",
        registered_by: user.id,
        audit_history: initialAudit,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Error creating justification:", insertErr);
      return NextResponse.json({ error: "No se pudo registrar la justificación" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Justificación registrada exitosamente (pendiente de revisión)",
      justification: newJustification,
    });
  } catch (error) {
    console.error("POST /api/admin/attendance/justifications exception:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
