import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ServicesManager } from "./ServicesManager";

export const metadata = {
  title: "Gestión de Servicios — Acicalados",
};

export default async function ServiciosPage() {
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

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 className="heading-lg">Gestión de Servicios</h1>
        <p className="text-muted" style={{ marginTop: 4 }}>
          Crea, edita y administra los servicios de barbería y spa
        </p>
      </div>
      <ServicesManager />
    </div>
  );
}
