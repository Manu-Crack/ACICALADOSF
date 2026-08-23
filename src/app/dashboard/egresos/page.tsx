import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ExpensesManager } from "./ExpensesManager";

export const metadata = {
  title: "Control de Egresos — Panel Administrativo | Acicalados",
  description: "Gestión y auditoría de egresos y compras operativas de Acicalados",
};

export default async function EgresosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/egresos");
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
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60, width: "100%" }}>
      <ExpensesManager userRole={profile.role} />
    </div>
  );
}
