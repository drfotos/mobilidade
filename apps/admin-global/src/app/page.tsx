"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/supa";

export default function AdminGlobalHome() {
  const router = useRouter();
  useEffect(() => {
    const session = getSession();
    if (session && session.user.app_metadata?.role === "super_admin") {
      router.push("/dashboard");
    } else {
      router.push("/auth/login");
    }
  }, [router]);
  return <div className="min-h-screen bg-slate-950" />;
}
