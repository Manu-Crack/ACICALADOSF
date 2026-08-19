import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReservasManager } from "./ReservasManager";

export const metadata = {
  title: "Reservas — Panel Acicalados",
};

export default async function ReservasPage() {
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
        <h1 className="heading-lg">Reservas</h1>
        <p className="text-muted" style={{ marginTop: 4 }}>
          Gestiona todas las reservas confirmadas de los clientes
        </p>
      </div>
      <ReservasManager userRole={profile.role} />
    </div>
  );
}
