"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Building2 } from "lucide-react";

export default function AdminCompanyLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [slug, setSlug] = useState("");

  // Lê slug da URL client-side (sem useSearchParams para evitar BAILOUT_TO_CLIENT_SIDE_RENDERING)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setSlug(params.get("slug") || "");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const role = data.user?.app_metadata?.role;
      const companyId = data.user?.app_metadata?.company_id;
      if (!companyId || !["company_admin", "operator", "dispatcher", "support"].includes(role || "")) {
        await supabase.auth.signOut();
        throw new Error("Esta conta não é administradora de empresa.");
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao logar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 items-center justify-center mb-4"><Building2 className="w-6 h-6 text-white" /></div>
          <h1 className="text-2xl font-bold text-slate-900">Painel da Empresa</h1>
          <p className="text-sm text-slate-600 mt-2">Acesso para administradores de operação{slug && ` · ${slug}`}</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-10 px-3 rounded-md border border-slate-300 focus:ring-2 focus:ring-cyan-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-10 px-3 rounded-md border border-slate-300 focus:ring-2 focus:ring-cyan-500" />
          </div>
          {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}
          <button type="submit" disabled={loading} className="w-full h-10 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
          </button>
        </form>
        <p className="text-xs text-slate-500 text-center mt-6">Não tem conta? <a href={(process.env.NEXT_PUBLIC_LANDING_URL || "") + "/signup"} className="text-cyan-600 hover:underline">Criar operação</a></p>
      </div>
    </div>
  );
}
