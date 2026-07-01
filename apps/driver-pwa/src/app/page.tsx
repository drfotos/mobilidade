"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function DriverHome() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user.app_metadata?.role === "driver") router.push("/app");
      else router.push("/auth/login");
    })();
  }, [router]);
  return <div className="min-h-screen bg-slate-950" />;
}
