"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/supa";

export default function PassengerHome() {
  const router = useRouter();
  useEffect(() => {
    const session = getSession();
    if (session) router.push("/app");
    else router.push("/auth/login");
  }, [router]);
  return <div className="min-h-screen bg-slate-950" />;
}
