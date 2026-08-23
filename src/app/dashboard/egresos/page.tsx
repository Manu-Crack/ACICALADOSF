import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
<<<<<<< HEAD
import { EgresosManager } from "./EgresosManager";
import { Egreso } from "@/lib/types/expense";

export const metadata = {
  title: "Egresos — Panel Acicalados",
  description: "Gestión de egresos y gastos operativos de Acicalados Spa & Barber Shop.",
=======
import { ExpensesManager } from "./ExpensesManager";

export const metadata = {
  title: "Control de Egresos — Panel Administrativo | Acicalados",
  description: "Gestión y auditoría de egresos y compras operativas de Acicalados",
>>>>>>> 3e5c1fddca66471c2c80b341c36806741db2e6ba
};

export default async function EgresosPage() {
  const supabase = await createClient();
<<<<<<< HEAD
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
=======
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/egresos");
  }
>>>>>>> 3e5c1fddca66471c2c80b341c36806741db2e6ba

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

<<<<<<< HEAD
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
=======
  if (!profile || (profile.role !== "admin" && profile.role !== "recepcionista")) {
    redirect("/dashboard");
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60, width: "100%" }}>
      <ExpensesManager userRole={profile.role} />
    </div>
>>>>>>> 3e5c1fddca66471c2c80b341c36806741db2e6ba
  );
}
