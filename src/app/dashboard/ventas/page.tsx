import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VentasManager } from "./VentasManager";

export const metadata = {
  title: "Ventas Rápidas / Mostrador — Panel Administrativo | Acicalados",
  description: "Registro ágil y gestión de ventas directas de productos físicos en mostrador",
};

export default async function VentasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard/ventas");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "recepcionista")) {
    redirect("/dashboard");
  }

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", paddingBottom: 60, width: "100%" }}>
      <VentasManager userRole={profile.role} />
    </div>
  );
}
