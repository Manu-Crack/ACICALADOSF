import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarManager } from "./CalendarManager";

export const metadata = {
  title: "Calendario por Empleado | Panel Acicalados",
  description: "Cronograma interactivo de reservas y citas por especialista",
};

export default async function CalendarioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "recepcionista", "empleado"].includes(profile.role)) {
    redirect("/");
  }

  return (
    <div style={{ width: "100%", padding: "12px 0" }}>
      <CalendarManager userRole={profile.role} />
    </div>
  );
}
