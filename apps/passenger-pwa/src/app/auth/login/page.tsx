"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, User } from "lucide-react";

export default function PassengerLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
      if (!companyId) throw new Error("Conta sem empresa associada");
      if (role === "driver") { await supabase.auth.signOut(); throw new Error("Use o app do motorista."); }
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao logar");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 items-center justify-center mb-4"><User className="w-6 h-6 text-white" /></div>
          <h1 className="text-2xl font-bold text-white">App do Passageiro</h1>
          <p className="text-sm text-slate-400 mt-2">Peça sua corrida em segundos</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">E-mail</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-cyan-500" /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Senha</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-cyan-500" /></div>
          {error && <div className="rounded-md bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-300">{error}</div>}
          <button type="submit" disabled={loading} className="w-full h-10 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2">{loading && <Loader2 className="w-4 h-4 animate-spin" />} Entrar</button>
          <div className="text-xs text-slate-500 text-center pt-2">Não tem conta? <a href={(process.env.NEXT_PUBLIC_LANDING_URL || "") + "/signup"} className="text-cyan-400 hover:underline">Criar agora</a></div>
        </form>
      </div>
    </div>
  );
}
