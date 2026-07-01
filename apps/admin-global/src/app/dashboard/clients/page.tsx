"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, Ban, Check, AlertTriangle } from "lucide-react";

export default function ClientsPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  async function load() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data: { session } } = await supabase.auth.getSession();
      if (session) { await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
    if (!session) return router.push("/auth/login");
    let query = supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("payment_status", filter);
    const { data } = await query;
    setCompanies(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function suspendClient(companyId: string) {
    const reason = prompt("Motivo da suspensão:");
    if (!reason) return;
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
      const res = await fetch(`${url}/functions/v1/suspend-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}`, apikey: key },
        body: JSON.stringify({ company_id: companyId, action: "suspend", reason }),
      });
      if (!res.ok) throw new Error("Erro ao suspender");
      load();
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function reactivateClient(companyId: string) {
    if (!confirm("Reativar este cliente?")) return;
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
      await fetch(`${url}/functions/v1/suspend-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}`, apikey: key },
        body: JSON.stringify({ company_id: companyId, action: "reactivate" }),
      });
      load();
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function changePlan(companyId: string, plan: string) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    await supabase.from("companies").update({ plan }).eq("id", companyId);
    load();
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> Dashboard</Link>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-sm text-white">
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="suspended">Suspensos</option>
            <option value="canceled">Cancelados</option>
          </select>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Gestão de clientes</h1>

        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-slate-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Empresa</th>
                <th className="text-left px-4 py-2 font-medium">Proprietário</th>
                <th className="text-left px-4 py-2 font-medium">Plano</th>
                <th className="text-left px-4 py-2 font-medium">Status pagamento</th>
                <th className="text-left px-4 py-2 font-medium">Criada</th>
                <th className="text-left px-4 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="px-4 py-3"><div className="font-medium text-white">{c.name}</div><div className="text-xs text-slate-400 font-mono">{c.slug}</div></td>
                  <td className="px-4 py-3 text-xs"><div>{c.owner_name || "—"}</div><div className="text-slate-500">{c.owner_email || c.owner_phone || ""}</div></td>
                  <td className="px-4 py-3">
                    <select value={c.plan} onChange={(e) => changePlan(c.id, e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white">
                      <option value="free">Free</option>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.payment_status === "active" ? "bg-emerald-500/20 text-emerald-300" : c.payment_status === "suspended" ? "bg-red-500/20 text-red-300" : "bg-slate-700 text-slate-400"}`}>
                      {c.payment_status === "active" ? "✓ Ativo" : c.payment_status === "suspended" ? "⚠ Suspenso" : "Cancelado"}
                    </span>
                    {c.suspended_reason && <div className="text-xs text-red-300 mt-1">{c.suspended_reason}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 flex gap-2">
                    {c.payment_status === "active" && (
                      <button onClick={() => suspendClient(c.id)} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"><Ban className="w-3 h-3" /> Suspender</button>
                    )}
                    {c.payment_status === "suspended" && (
                      <button onClick={() => reactivateClient(c.id)} className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1"><Check className="w-3 h-3" /> Reativar</button>
                    )}
                  </td>
                </tr>
              ))}
              {companies.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum cliente.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
