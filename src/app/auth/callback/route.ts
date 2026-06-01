import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      const baseUrl = isLocalEnv
        ? origin
        : forwardedHost
          ? `https://${forwardedHost}`
          : origin;

      // If a specific redirect was requested, use it
      if (next) {
        return NextResponse.redirect(`${baseUrl}${next}`);
      }

      // Otherwise, check user role and redirect accordingly
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const internalRoles = ["admin", "recepcionista", "empleado"];
        if (profile && internalRoles.includes(profile.role)) {
          return NextResponse.redirect(`${baseUrl}/dashboard`);
        }
      }

      return NextResponse.redirect(`${baseUrl}/`);
    }
  }

  // Auth error — redirect to login with error message
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
