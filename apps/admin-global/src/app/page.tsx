"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function AdminGlobalHome() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key);
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user.app_metadata?.role === "super_admin") router.push("/dashboard");
      else router.push("/auth/login");
    })();
  }, [router]);
  return <div className="min-h-screen bg-slate-950" />;
}
