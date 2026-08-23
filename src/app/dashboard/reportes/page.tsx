import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportsManager } from "./ReportsManager";

export const metadata = {
  title: "Reportes Financieros y Operativos — Panel Administrativo | Acicalados",
  description: "Reportes exportables en Excel y PDF de ingresos, pagos, servicios, reservas y egresos",
};

export default async function ReportesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/reportes");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "recepcionista")) {
    redirect("/dashboard");
  }

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", paddingBottom: 60, width: "100%" }}>
      <ReportsManager />
    </div>
  );
}
