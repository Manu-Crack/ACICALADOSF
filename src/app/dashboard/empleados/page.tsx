import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EmployeesManager from "./EmployeesManager";

export const metadata = {
  title: "Gestión de Empleados | Panel de Administración",
  description: "Módulo de gestión de personal, especialidades y ausencias por fecha.",
};

export default async function EmployeesPage() {
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

  return <EmployeesManager userRole={profile.role} />;
}
