import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildFullReportData } from "@/lib/services/report-service";
import type { ReportFilterParams } from "@/lib/types/reports";

/**
 * GET /api/admin/reports/data
 * Retorna todos los datos detallados del reporte (reservas, pagos, servicios, empleados, egresos y resumen).
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
      .select("role, first_name, last_name")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "recepcionista")) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filters: ReportFilterParams = {
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      bookingStatus: searchParams.get("bookingStatus") || undefined,
      paymentStatus: searchParams.get("paymentStatus") || undefined,
      employeeId: searchParams.get("employeeId") || undefined,
      serviceId: searchParams.get("serviceId") || undefined,
      paymentMethod: searchParams.get("paymentMethod") || undefined,
      searchTerm: searchParams.get("searchTerm") || undefined,
    };

    const userName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || user.email || "Usuario";
    const reportData = await buildFullReportData(supabase, filters, userName);

    return NextResponse.json({ data: reportData });
  } catch (error) {
    console.error("GET /api/admin/reports/data exception:", error);
    return NextResponse.json({ error: "Error interno al obtener los datos del reporte" }, { status: 500 });
  }
}
