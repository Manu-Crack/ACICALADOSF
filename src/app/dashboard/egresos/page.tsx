import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EgresosManager } from "./EgresosManager";
import { Egreso } from "@/lib/types/expense";

export const metadata = {
  title: "Egresos — Panel Acicalados",
  description: "Gestión de egresos y gastos operativos de Acicalados Spa & Barber Shop.",
};

export default async function EgresosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "recepcionista"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Load initial egresos (current month by default)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const monthStart = `${year}-${month}-01`;

  const { data: initialEgresos } = await supabase
    .from("egresos")
    .select("*")
    .gte("expense_date", monthStart)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <EgresosManager
      initialEgresos={(initialEgresos as Egreso[]) || []}
      userRole={profile.role}
    />
  );
}
