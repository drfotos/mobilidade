import { createClient } from "@supabase/supabase-js";
import type { Database } from "@saas/database";

let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars não configuradas");
  client = createClient<Database>(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("sb-vlkrlpcniippudhgggwt-auth-token");
      if (stored) {
        const session = JSON.parse(stored);
        if (session.access_token && session.refresh_token) {
          client.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        }
      }
    } catch {}
  }

  return client;
}
