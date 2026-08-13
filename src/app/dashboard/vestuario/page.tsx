import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WardrobeManager } from "./WardrobeManager";

export const metadata = {
  title: "Gestión de Vestuario — Acicalados",
  description: "Administración del catálogo de vestuario y prendas.",
};

export default async function VestuarioDashboardPage() {
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "1.8rem" }}>👔</span>
          <div>
            <h1 className="heading-lg">Gestión de Vestuario</h1>
            <p className="text-muted" style={{ marginTop: 4 }}>
              Crea, edita y organiza las prendas, trajes y vestidos de tu catálogo (dimensiones optimizadas 1080 x 1920 px en WebP).
            </p>
          </div>
        </div>
      </div>
      <WardrobeManager />
    </div>
  );
}
