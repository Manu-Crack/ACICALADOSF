import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatSpanishDate(dateStr: string): string {
  try {
    const parts = dateStr.split("-");
    const day = parseInt(parts[2], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const monthName = MONTH_NAMES[monthIndex] || "este mes";
    return `${day} de ${monthName}`;
  } catch {
    return dateStr;
  }
}

/**
 * GET /api/admin/reports/daily-closing?date=YYYY-MM-DD
 * Genera el reporte diario de cierre de caja en formato de texto estándar para WhatsApp.
 * Autorizado para: admin, recepcionista.
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

    const isRecepcionista = profile.role === "recepcionista";
    let todayPeru: string;
    try {
      todayPeru = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Lima",
      }).format(new Date());
    } catch {
      todayPeru = new Date().toISOString().split("T")[0];
    }

    const { searchParams } = new URL(request.url);
    let targetDate = searchParams.get("date");
    if (isRecepcionista || !targetDate) {
      targetDate = todayPeru;
    }

    const admin = createAdminClient();

    // 1. Obtener colaboradores activos
    const { data: employees, error: empErr } = await admin
      .from("employees")
      .select("id, first_name, last_name, is_active, type")
      .eq("is_active", true)
      .order("first_name", { ascending: true });

    if (empErr) {
      console.error("Error fetching employees for daily closing:", empErr);
      throw empErr;
    }

    // 2. Obtener reservas confirmadas/completadas del día
    const { data: bookings, error: bookErr } = await admin
      .from("bookings")
      .select("id, assigned_employee_id, advance_amount_cents, total_price_cents, status, payment_status")
      .eq("booking_date", targetDate)
      .not("status", "in", '("cancelada","expirada")');

    if (bookErr) {
      console.error("Error fetching bookings for daily closing:", bookErr);
    }

    // 3. Obtener permisos y ausencias en employee_blocks para la fecha
    const { data: blocks, error: blockErr } = await admin
      .from("employee_blocks")
      .select("id, employee_id, reason")
      .eq("block_date", targetDate);

    if (blockErr) {
      console.error("Error fetching employee blocks for daily closing:", blockErr);
    }

    // 4. Obtener asistencias registradas en employee_attendances para la fecha
    const { data: attendances, error: attErr } = await admin
      .from("employee_attendances")
      .select("id, employee_id, status")
      .eq("date", targetDate);

    if (attErr) {
      console.error("Error fetching employee attendances for daily closing:", attErr);
    }

    // 5. Obtener movimientos de vestuario del día
    const { data: wardrobeMovs, error: wardErr } = await admin
      .from("wardrobe_movements")
      .select("price_cents, advance_cents, created_at, status")
      .gte("created_at", `${targetDate}T00:00:00.000Z`)
      .lte("created_at", `${targetDate}T23:59:59.999Z`);

    if (wardErr) {
      console.error("Error fetching wardrobe movements for daily closing:", wardErr);
    }

    // 6. Mapear cobros acumulados por colaborador
    const employeeEarningsMap: Record<string, number> = {};
    (bookings || []).forEach((b) => {
      if (b.assigned_employee_id) {
        const collectedCents = b.advance_amount_cents || 0;
        employeeEarningsMap[b.assigned_employee_id] =
          (employeeEarningsMap[b.assigned_employee_id] || 0) + collectedCents;
      }
    });

    const blockEmpIds = new Set((blocks || []).map((b) => b.employee_id));
    const permissionEmpIds = new Set(
      (attendances || [])
        .filter((a) => a.status === "permiso" || a.status === "justificado" || a.status === "falta")
        .map((a) => a.employee_id)
    );

    const employeeRows: Array<{
      id: string;
      fullName: string;
      name: string;
      value: string;
      isPermission: boolean;
      amountCents: number;
    }> = [];

    (employees || []).forEach((emp) => {
      const displayName = emp.first_name.trim().split(/\s+/)[0];
      const hasPermission = blockEmpIds.has(emp.id) || permissionEmpIds.has(emp.id);
      const amountCents = employeeEarningsMap[emp.id] || 0;
      const amountSoles = (amountCents / 100).toFixed(0);

      const displayValue = hasPermission ? "permiso" : `${amountSoles}`;
      employeeRows.push({
        id: emp.id,
        fullName: `${emp.first_name} ${emp.last_name}`.trim(),
        name: displayName,
        value: displayValue,
        isPermission: hasPermission,
        amountCents: hasPermission ? 0 : amountCents,
      });
    });

    // 7. Totales de Productos (Venta) y Vestuario (Traje)
    let totalWardrobeCents = 0;
    (wardrobeMovs || []).forEach((w) => {
      totalWardrobeCents += w.price_cents || w.advance_cents || 0;
    });
    const totalWardrobeSoles = (totalWardrobeCents / 100).toFixed(0);

    const totalProductCents = 0;
    const totalProductSoles = (totalProductCents / 100).toFixed(0);

    const formattedDate = formatSpanishDate(targetDate);

    // 8. Construcción con la estructura exacta solicitada para WhatsApp
    const headerBannerTop = "▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄";
    const headerTitle = "            REPORTE ACICALADOS ";
    const headerDate = `            ${formattedDate}`;
    const headerBannerBottom = "▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀";

    const textLines: string[] = [
      headerBannerTop,
      headerTitle,
      headerDate,
      headerBannerBottom,
      "",
      " *Equipo:*",
      ...employeeRows.map((emp) => `${emp.name}: ${emp.value}`),
      "",
      ` *Venta:* ${totalProductSoles}`,
      ` *Traje:* ${totalWardrobeSoles}`,
      "",
      ` _Verifiquen del ${formattedDate}_`,
    ];

    const finalReportText = textLines.join("\n");
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(finalReportText)}`;

    return NextResponse.json({
      success: true,
      date: targetDate,
      formatted_date: formattedDate,
      report_text: finalReportText,
      whatsapp_url: whatsappUrl,
      items: employeeRows,
      products_total: totalProductSoles,
      wardrobe_total: totalWardrobeSoles,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/admin/reports/daily-closing error:", msg);
    return NextResponse.json(
      { error: "Error al generar el reporte de cierre diario: " + msg },
      { status: 500 }
    );
  }
}
