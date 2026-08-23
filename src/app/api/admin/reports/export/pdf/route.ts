import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildFullReportData } from "@/lib/services/report-service";
import { generatePdfReport } from "@/lib/utils/pdf-generator";
import type { ReportFilterParams } from "@/lib/types/reports";

/**
 * GET /api/admin/reports/export/pdf
 * Genera y descarga un archivo .pdf ejecutivo horizontal con membrete oficial y tablas financieras.
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
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const filters: ReportFilterParams = {
      startDate,
      endDate,
      bookingStatus: searchParams.get("bookingStatus") || undefined,
      paymentStatus: searchParams.get("paymentStatus") || undefined,
      employeeId: searchParams.get("employeeId") || undefined,
      serviceId: searchParams.get("serviceId") || undefined,
      paymentMethod: searchParams.get("paymentMethod") || undefined,
      searchTerm: searchParams.get("searchTerm") || undefined,
    };

    const userName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || user.email || "Usuario";
    const admin = createAdminClient();
    const reportData = await buildFullReportData(admin, filters, userName);

    const pdfBuffer = generatePdfReport(reportData);

    const fileName = `Reporte_Acicalados_${startDate || "inicio"}_al_${endDate || "hoy"}.pdf`;

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/admin/reports/export/pdf exception:", msg);
    return NextResponse.json({ error: "Error al generar el archivo PDF: " + msg }, { status: 500 });
  }
}
