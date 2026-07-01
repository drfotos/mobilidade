"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function PassengerHome() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
      if (session) router.push("/app");
      else router.push("/auth/login");
    })();
  }, [router]);
  return <div className="min-h-screen bg-slate-950" />;
}
