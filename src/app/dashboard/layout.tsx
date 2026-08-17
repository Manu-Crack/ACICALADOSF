import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "recepcionista", "empleado"].includes(profile.role)) {
    redirect("/");
  }

  // Extract name from user_metadata (Google OAuth) with safe fallbacks
  const metaFullName = (user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
  const profileFullName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "";
  const emailFallback = user.email ? user.email.split("@")[0] : "Administrador";

  const resolvedName = metaFullName || profileFullName || emailFallback || "Administrador";

  return (
    <div className="dashboard-container">
      {/* Responsive Admin Sidebar */}
      <AdminSidebar profile={profile} userName={resolvedName} />

      {/* Main Content */}
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
