"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/supa";

export default function AdminCompanyHome() {
  const router = useRouter();
  useEffect(() => {
    const session = getSession();
    if (session) {
      const role = session.user.app_metadata?.role;
      if (["company_admin", "operator", "dispatcher", "support"].includes(role)) {
        router.push("/dashboard");
        return;
      }
    }
    router.push("/auth/login");
  }, [router]);
  return <div className="min-h-screen bg-slate-50" />;
}
