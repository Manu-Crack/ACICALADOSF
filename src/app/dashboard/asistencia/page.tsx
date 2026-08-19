import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AttendanceManager } from "./AttendanceManager";

export const metadata = {
  title: "Control de Asistencia y QR | Panel de Administración",
  description: "Módulo de gestión de asistencias, marcación por código QR, permisos y reportes de personal.",
};

export default async function AttendancePage() {
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

  return <AttendanceManager userRole={profile.role} />;
}
