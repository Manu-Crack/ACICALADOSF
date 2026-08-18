import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (typeof window === "undefined") {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Sincronizar automáticamente el token JWT con Supabase Realtime
    client.auth.getSession().then((res: { data: { session?: { access_token?: string } | null } }) => {
      const session = res?.data?.session;
      if (session?.access_token && client) {
        client.realtime.setAuth(session.access_token);
      }
    });

    client.auth.onAuthStateChange((_event: unknown, session: { access_token?: string } | null) => {
      if (session?.access_token && client) {
        client.realtime.setAuth(session.access_token);
      }
    });
  }
  return client;
}


