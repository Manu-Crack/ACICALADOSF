import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CALENDAR_EVENT_CONFIG,
  type CalendarEvent,
} from "@/lib/types/calendar";
import {
  PERMISSION_TYPE_LABELS,
  PERMISSION_STATUS_LABELS,
  type PermissionType,
  type PermissionStatus,
} from "@/lib/types/permissions";

/**
 * GET /api/admin/calendar/events
 * Retorna los eventos consolidados para el calendario por especialista:
 * - Reservas de clientes (bookings)
 * - Permisos y Ausencias (employee_blocks)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "recepcionista"].includes(profile.role)) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date") || new Date().toISOString().slice(0, 10);
    const endDate = searchParams.get("end_date") || startDate;
    const employeeId = searchParams.get("employee_id");
    const typesFilter = searchParams.get("types")?.split(",") || ["booking", "permission"];

    const admin = createAdminClient();

    // 1. Obtener lista completa de empleados para mapas y selector
    const { data: allEmployees, error: empErr } = await admin
      .from("employees")
      .select("id, first_name, last_name, type, is_active, position")
      .order("first_name");

    if (empErr) {
      console.error("[GET /api/admin/calendar/events] Error consultando empleados:", empErr);
    }

    const employeesList = allEmployees || [];
    const empMap = new Map(
      employeesList.map((e) => [e.id, `${e.first_name || ""} ${e.last_name || ""}`.trim()])
    );
    const empSpecialtyMap = new Map(
      employeesList.map((e) => [e.id, e.type === "spa" ? "Spa" : e.type === "recepcionista" ? "Recepción" : "Barbería"])
    );

    const events: CalendarEvent[] = [];

    // 2. Cargar Reservas de Clientes (bookings)
    if (typesFilter.includes("booking")) {
      let bQuery = admin
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
          payment_status,
          total_price_cents,
          assigned_employee_id,
          service_type,
          employees:assigned_employee_id (
            id,
            first_name,
            last_name,
            type
          ),
          booking_services (
            service_name,
            duration_minutes,
            service_price_cents
          )
        `)
        .in("status", ["pendiente", "confirmada", "completada", "cancelada"])
        .gte("booking_date", startDate)
        .lte("booking_date", endDate);

      if (employeeId && employeeId !== "all") {
        bQuery = bQuery.eq("assigned_employee_id", employeeId);
      }

      const { data: bookings, error: bError } = await bQuery;
      if (bError) {
        console.error("[GET /api/admin/calendar/events] Error consultando reservas:", bError);
      }

      interface RawBookingEvent {
        id: string;
        booking_code: string;
        client_first_name: string | null;
        client_last_name: string | null;
        client_phone: string | null;
        booking_date: string;
        start_time: string;
        end_time: string;
        status: string;
        payment_status: string;
        total_price_cents: number;
        assigned_employee_id: string | null;
        service_type: string;
        employees: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          type: string | null;
        } | null;
        booking_services: Array<{
          service_name: string;
          duration_minutes?: number;
          service_price_cents?: number;
        }> | null;
      }

      const bookingStatusLabels: Record<string, string> = {
        confirmada: "CONFIRMADA",
        pendiente: "PENDIENTE",
        completada: "COMPLETADA",
        cancelada: "CANCELADA",
        expirada: "EXPIRADA",
      };

      const bookingStatusBadges: Record<string, string> = {
        confirmada: "badge-success",
        pendiente: "badge-warning",
        completada: "badge-gold",
        cancelada: "badge-error",
        expirada: "badge-neutral",
      };

      ((bookings || []) as unknown as RawBookingEvent[]).forEach((b) => {
        const assignedEmp = b.employees;
        const empName = assignedEmp
          ? `${assignedEmp.first_name || ""} ${assignedEmp.last_name || ""}`.trim()
          : b.assigned_employee_id
          ? empMap.get(b.assigned_employee_id) || "Sin Asignar"
          : "Sin Asignar";

        const empSpecialty = assignedEmp?.type
          ? (assignedEmp.type === "spa" ? "Spa" : assignedEmp.type === "recepcionista" ? "Recepción" : "Barbería")
          : b.assigned_employee_id
          ? empSpecialtyMap.get(b.assigned_employee_id)
          : undefined;

        const clientName = `${b.client_first_name || ""} ${b.client_last_name || ""}`.trim() || "Cliente";
        const serviceNames = (b.booking_services || [])
          .map((bs) => bs.service_name || "Servicio")
          .filter(Boolean);
        const cfg = CALENDAR_EVENT_CONFIG.booking;

        const displayServices = serviceNames.length > 0 ? serviceNames : [b.service_type === "spa" ? "Spa" : "Barbería"];

        events.push({
          id: `booking-${b.id}`,
          type: "booking",
          title: `Cita: ${clientName} (${displayServices.slice(0, 2).join(", ")})`,
          employee_id: b.assigned_employee_id || "unassigned",
          employee_name: empName,
          employee_specialty: empSpecialty,
          date: b.booking_date,
          start_time: b.start_time,
          end_time: b.end_time,
          status: b.status,
          status_label: bookingStatusLabels[b.status] || (b.status ? b.status.toUpperCase() : "RESERVA"),
          badge_class: bookingStatusBadges[b.status] || "badge-neutral",
          icon: cfg.icon,
          color: cfg.color,
          bg_color: cfg.bgColor,
          border_color: cfg.borderColor,
          description: `Servicios: ${displayServices.join(", ")} | Total: S/ ${(b.total_price_cents / 100).toFixed(2)}`,
          details: {
            booking_code: b.booking_code,
            client_name: clientName,
            client_phone: b.client_phone || undefined,
            services: displayServices,
            price_cents: b.total_price_cents,
            payment_status: b.payment_status,
          },
        });
      });
    }

    // 3. Cargar Permisos / Ausencias (employee_blocks)
    if (typesFilter.includes("permission")) {
      let pQuery = admin
        .from("employee_blocks")
        .select(`
          id,
          employee_id,
          start_date,
          end_date,
          is_all_day,
          start_time,
          end_time,
          permission_type,
          reason,
          observation,
          evidence_url,
          status
        `)
        .lte("start_date", endDate)
        .gte("end_date", startDate);

      if (employeeId && employeeId !== "all") {
        pQuery = pQuery.eq("employee_id", employeeId);
      }

      const { data: blocks, error: pError } = await pQuery;
      if (pError) {
        console.error("[GET /api/admin/calendar/events] Error consultando permisos:", pError);
      }

      interface RawBlockEvent {
        id: string;
        employee_id: string;
        start_date: string;
        end_date: string;
        is_all_day: boolean;
        start_time: string | null;
        end_time: string | null;
        permission_type: PermissionType;
        reason: string;
        observation: string | null;
        evidence_url: string | null;
        status: PermissionStatus;
      }

      ((blocks || []) as unknown as RawBlockEvent[]).forEach((p) => {
        const empName = empMap.get(p.employee_id) || "Personal";
        const permTypeInfo = PERMISSION_TYPE_LABELS[p.permission_type] || { label: "Permiso", icon: "🟡" };
        const statusInfo = PERMISSION_STATUS_LABELS[p.status] || { label: p.status, badgeClass: "badge-neutral", icon: "⚪" };
        const cfg = CALENDAR_EVENT_CONFIG.permission;

        events.push({
          id: `permission-${p.id}`,
          type: "permission",
          title: `${permTypeInfo.icon} Permiso: ${p.reason}`,
          employee_id: p.employee_id,
          employee_name: empName,
          employee_specialty: empSpecialtyMap.get(p.employee_id),
          date: p.start_date,
          end_date: p.end_date,
          start_time: p.is_all_day ? "00:00" : p.start_time,
          end_time: p.is_all_day ? "23:59" : p.end_time,
          status: p.status,
          status_label: statusInfo.label,
          badge_class: statusInfo.badgeClass,
          icon: permTypeInfo.icon,
          color: cfg.color,
          bg_color: cfg.bgColor,
          border_color: cfg.borderColor,
          description: `Tipo: ${permTypeInfo.label} | Motivo: ${p.reason}`,
          details: {
            permission_type: permTypeInfo.label,
            reason: p.reason,
            observation: p.observation || undefined,
            evidence_url: p.evidence_url,
          },
        });
      });
    }

    return NextResponse.json({
      events,
      employees: employeesList,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error("GET /api/admin/calendar/events error:", error);
    return NextResponse.json({ error: "Error al consultar eventos del calendario" }, { status: 500 });
  }
}
