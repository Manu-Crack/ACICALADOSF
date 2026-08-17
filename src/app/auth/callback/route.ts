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

      // If a specific valid internal redirect was requested, use it
      if (next && next.startsWith("/") && !next.startsWith("/auth/")) {
        return NextResponse.redirect(`${baseUrl}${next}`);
      }

      // Check user role and redirect accordingly
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, role")
          .eq("id", user.id)
          .maybeSingle();

        // Sync name from Google metadata into profile if missing
        const metaFullName = (user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
        const metaFirstName = (user.user_metadata?.first_name || metaFullName.split(" ")[0] || "").trim();
        const metaLastName = (user.user_metadata?.last_name || metaFullName.split(" ").slice(1).join(" ") || "").trim();

        if (!profile) {
          await supabase.from("profiles").insert({
            id: user.id,
            first_name: metaFirstName || (user.email ? user.email.split("@")[0] : "Cliente"),
            last_name: metaLastName || "",
            role: "cliente",
          });
        } else if (!profile.first_name && metaFirstName) {
          await supabase
            .from("profiles")
            .update({
              first_name: metaFirstName,
              last_name: profile.last_name || metaLastName || "",
            })
            .eq("id", user.id);
        }

        const currentRole = profile?.role || "cliente";
        const internalRoles = ["admin", "recepcionista", "empleado"];
        if (internalRoles.includes(currentRole)) {
          return NextResponse.redirect(`${baseUrl}/dashboard`);
        }
      }

      return NextResponse.redirect(`${baseUrl}/`);
    }
  }

  // Auth error — redirect to login with error message
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
