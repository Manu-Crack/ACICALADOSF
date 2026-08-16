import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/availability — check available time slots
 * Query params: date (YYYY-MM-DD), service_type (barberia|spa), service_ids (comma-separated)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const serviceType = searchParams.get("service_type");
    const serviceIdsStr = searchParams.get("service_ids");

    if (!date || !serviceType) {
      return NextResponse.json(
        { error: "date y service_type son obligatorios" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // Calculate total duration
    let totalDuration = 60; // default
    if (serviceIdsStr) {
      const serviceIds = serviceIdsStr.split(",");
      const { data: services } = await admin
        .from("services")
        .select("duration_minutes")
        .in("id", serviceIds);
      if (services) {
        totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);
      }
    }

    // Get existing confirmed/pending bookings for that date
    const { data: existingBookings } = await admin
      .from("bookings")
      .select("start_time, end_time, assigned_employee_id")
      .eq("booking_date", date)
      .eq("service_type", serviceType)
      .in("status", ["pendiente", "confirmada"]);

    // Get active employees count
    const { count: employeeCount } = await admin
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("type", serviceType)
      .eq("is_active", true);

    const maxConcurrent = employeeCount || 1;

    // Determine business hours based on day of week:
    // Lunes a Sábado: 9:00 - 21:00
    // Domingo: 10:00 - 20:00
    const [year, month, day] = date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const isSunday = dateObj.getDay() === 0;

    const startHour = isSunday ? 10 : 9;
    const endHour = isSunday ? 20 : 21;
    const maxEndMinutes = endHour * 60;

    // Generate all possible time slots
    const availableSlots: string[] = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      for (const min of [0, 30]) {
        if (hour === endHour && min > 0) continue;

        const slotStart = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        const endMinutes = hour * 60 + min + totalDuration;
        
        // Don't start a slot that goes past closing time
        if (endMinutes > maxEndMinutes + 30) continue;

        const slotEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

        // Count concurrent bookings in this slot
        const concurrent =
          existingBookings?.filter(
            (b) => b.start_time < slotEnd && b.end_time > slotStart
          ).length ?? 0;

        if (concurrent < maxConcurrent) {
          availableSlots.push(slotStart);
        }
      }
    }

    return NextResponse.json({
      date,
      service_type: serviceType,
      total_duration_minutes: totalDuration,
      available_slots: availableSlots,
    });
  } catch (err) {
    console.error("Availability error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
