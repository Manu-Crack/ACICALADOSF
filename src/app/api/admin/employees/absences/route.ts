import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConflictingBooking } from "@/lib/types/permissions";

async function verifyAuth(allowedRoles: string[] = ["admin", "recepcionista"]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado", status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (!profile || !allowedRoles.includes(profile.role)) {
    return { error: "Acceso denegado. Se requieren permisos de administrador o recepción.", status: 403 };
  }

  return { user, profile };
}

/**
 * GET /api/admin/employees/absences
 * Consulta los permisos y ausencias de empleados con filtros por rango de fechas o empleado.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employee_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const status = searchParams.get("status");

    const admin = createAdminClient();
    let query = admin
      .from("employee_blocks")
      .select(`
        id,
        employee_id,
        start_date,
        end_date,
        block_date,
        is_all_day,
        start_time,
        end_time,
        permission_type,
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
        employees:employee_id (first_name, last_name, position, type)
      `)
      .order("start_date", { ascending: false });

    if (employeeId) query = query.eq("employee_id", employeeId);
    if (status && status !== "all") query = query.eq("status", status);
    if (startDate) query = query.gte("end_date", startDate);
    if (endDate) query = query.lte("start_date", endDate);

    const { data: blocks, error } = await query;
    if (error) throw error;

    interface RawBlockRow {
      id: string;
      employee_id: string;
      start_date: string;
      end_date: string;
      block_date: string;
      is_all_day: boolean;
      start_time: string | null;
      end_time: string | null;
      permission_type: string;
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
        type: string | null;
      } | null;
    }

    const formatted = ((blocks || []) as unknown as RawBlockRow[]).map((b) => ({
      ...b,
      employee_name: b.employees ? `${b.employees.first_name || ""} ${b.employees.last_name || ""}`.trim() : undefined,
    }));

    return NextResponse.json({ absences: formatted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET absences error:", msg);
    return NextResponse.json({ error: "Error al consultar permisos: " + msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/employees/absences
 * Registrar un nuevo permiso por rango de fechas/horas con detección de solapamientos y reservas en conflicto.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      employee_id,
      start_date,
      end_date,
      block_date,
      is_all_day = true,
      start_time,
      end_time,
      permission_type = "personal",
      reason,
      observation,
      evidence_url,
      status = "approved",
      check_conflicts_only = false,
    } = body;

    const actualStartDate = start_date || block_date;
    const actualEndDate = end_date || actualStartDate;

    if (!employee_id || !actualStartDate) {
      return NextResponse.json(
        { error: "El trabajador y la fecha inicial son obligatorios" },
        { status: 422 }
      );
    }

    if (actualEndDate < actualStartDate) {
      return NextResponse.json(
        { error: "La fecha final no puede ser anterior a la fecha inicial" },
        { status: 422 }
      );
    }

    if (!is_all_day && actualStartDate === actualEndDate && start_time && end_time) {
      if (start_time >= end_time) {
        return NextResponse.json(
          { error: "La hora final debe ser posterior a la hora inicial" },
          { status: 422 }
        );
      }
    }

    const admin = createAdminClient();

    // 1. Detectar servicios y reservas existentes asignadas al empleado en ese rango de fechas
    const { data: rawServices } = await admin
      .from("booking_services")
      .select(`
        id,
        booking_id,
        service_name,
        start_time,
        end_time,
        hora_inicio,
        hora_fin,
        assigned_employee_id,
        bookings!inner (
          id,
          booking_code,
          client_first_name,
          client_last_name,
          client_phone,
          booking_date,
          start_time,
          end_time,
          status,
          total_price_cents
        )
      `)
      .eq("assigned_employee_id", employee_id)
      .gte("bookings.booking_date", actualStartDate)
      .lte("bookings.booking_date", actualEndDate)
      .not("bookings.status", "in", '("cancelada","expirada")');

    const { data: rawBookings } = await admin
      .from("bookings")
      .select(`
        id,
        booking_code,
        client_first_name,
        client_last_name,
        client_phone,
        booking_date,
        start_time,
        end_time,
        status,
        total_price_cents,
        booking_services (
          service_name
        )
      `)
      .eq("assigned_employee_id", employee_id)
      .gte("booking_date", actualStartDate)
      .lte("booking_date", actualEndDate)
      .not("status", "in", '("cancelada","expirada")');

    const conflicts: ConflictingBooking[] = [];
    const processedBookingIds = new Set<string>();

    // A) Evaluar colisiones usando las horas exactas de los servicios a cargo del colaborador
    const servicesByBooking = new Map<string, any[]>();
    (rawServices || []).forEach((s: any) => {
      const bId = s.booking_id;
      if (!servicesByBooking.has(bId)) {
        servicesByBooking.set(bId, []);
      }
      servicesByBooking.get(bId)!.push(s);
    });

    servicesByBooking.forEach((svcs, bId) => {
      processedBookingIds.add(bId);
      const b = svcs[0].bookings;
      const empStartTime = svcs.reduce((earliest: string, s: any) => {
        const t = s.start_time || s.hora_inicio;
        return t && t < earliest ? t : earliest;
      }, svcs[0]?.start_time || svcs[0]?.hora_inicio || b.start_time);

      const empEndTime = svcs.reduce((latest: string, s: any) => {
        const t = s.end_time || s.hora_fin;
        return t && t > latest ? t : latest;
      }, svcs[0]?.end_time || svcs[0]?.hora_fin || b.end_time);

      const serviceNames = svcs.map((s: any) => s.service_name || "Servicio");

      if (!is_all_day && b.booking_date === actualStartDate && start_time && end_time) {
        if (empStartTime < end_time && empEndTime > start_time) {
          conflicts.push({
            id: b.id,
            booking_code: b.booking_code,
            client_name: `${b.client_first_name || ""} ${b.client_last_name || ""}`.trim(),
            client_phone: b.client_phone,
            booking_date: b.booking_date,
            start_time: empStartTime,
            end_time: empEndTime,
            status: b.status,
            total_price_cents: b.total_price_cents,
            services: serviceNames,
          });
        }
      } else {
        conflicts.push({
          id: b.id,
          booking_code: b.booking_code,
          client_name: `${b.client_first_name || ""} ${b.client_last_name || ""}`.trim(),
          client_phone: b.client_phone,
          booking_date: b.booking_date,
          start_time: empStartTime,
          end_time: empEndTime,
          status: b.status,
          total_price_cents: b.total_price_cents,
          services: serviceNames,
        });
      }
    });

    // B) Fallback para citas heredadas sin detalle en booking_services
    (rawBookings || []).forEach((b: any) => {
      if (processedBookingIds.has(b.id)) return;
      if (!is_all_day && b.booking_date === actualStartDate && start_time && end_time) {
        if (b.start_time < end_time && b.end_time > start_time) {
          conflicts.push({
            id: b.id,
            booking_code: b.booking_code,
            client_name: `${b.client_first_name || ""} ${b.client_last_name || ""}`.trim(),
            client_phone: b.client_phone,
            booking_date: b.booking_date,
            start_time: b.start_time,
            end_time: b.end_time,
            status: b.status,
            total_price_cents: b.total_price_cents,
            services: (b.booking_services || []).map((bs: any) => bs.service_name || "Servicio"),
          });
        }
      } else {
        conflicts.push({
          id: b.id,
          booking_code: b.booking_code,
          client_name: `${b.client_first_name || ""} ${b.client_last_name || ""}`.trim(),
          client_phone: b.client_phone,
          booking_date: b.booking_date,
          start_time: b.start_time,
          end_time: b.end_time,
          status: b.status,
          total_price_cents: b.total_price_cents,
          services: (b.booking_services || []).map((bs: any) => bs.service_name || "Servicio"),
        });
      }
    });

    // Si solo se solicitó verificación de conflictos (pre-confirmación modal)
    if (check_conflicts_only) {
      return NextResponse.json({
        has_conflicts: conflicts.length > 0,
        conflicts,
      });
    }

    const userName = `${auth.profile.first_name || ""} ${auth.profile.last_name || ""}`.trim() || auth.user.email || "Usuario";
    const now = new Date().toISOString();
    const initialAudit = [
      {
        action: "created",
        user_id: auth.user.id,
        user_name: userName,
        timestamp: now,
        details: `Permiso registrado (${permission_type}): ${actualStartDate} a ${actualEndDate}`,
      },
    ];

    // Insertar registro de permiso
    const { data: newBlock, error: insertError } = await admin
      .from("employee_blocks")
      .insert({
        employee_id,
        start_date: actualStartDate,
        end_date: actualEndDate,
        block_date: actualStartDate,
        is_all_day: Boolean(is_all_day),
        start_time: is_all_day ? null : start_time || null,
        end_time: is_all_day ? null : end_time || null,
        permission_type,
        reason: reason?.trim() || "Permiso / Ausencia",
        observation: observation?.trim() || null,
        evidence_url: evidence_url?.trim() || null,
        status: status || "approved",
        registered_by: auth.user.id,
        approved_by: status === "approved" ? auth.user.id : null,
        approved_at: status === "approved" ? now : null,
        audit_history: initialAudit,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json(
      {
        block: newBlock,
        has_conflicts: conflicts.length > 0,
        conflicts,
        warning: conflicts.length > 0
          ? `Se registraron ${conflicts.length} reserva(s) en conflicto con este permiso. Revise la agenda para reasignarlas.`
          : undefined,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST absence error:", msg);
    return NextResponse.json({ error: "Error al registrar permiso: " + msg }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/employees/absences?id=<block_id>
 * Eliminar o cancelar un permiso
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(["admin"]);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "El ID del permiso es obligatorio" }, { status: 422 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("employee_blocks").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("DELETE absence error:", msg);
    return NextResponse.json({ error: "Error al eliminar permiso: " + msg }, { status: 500 });
  }
}
