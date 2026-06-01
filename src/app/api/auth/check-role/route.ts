import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/check-role
 * Returns the user's role so the client can redirect accordingly after login.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ role: null, redirect: "/" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const internalRoles = ["admin", "recepcionista", "empleado"];
  const redirect = profile && internalRoles.includes(profile.role)
    ? "/dashboard"
    : "/";

  return NextResponse.json({ role: profile?.role || "cliente", redirect });
}
