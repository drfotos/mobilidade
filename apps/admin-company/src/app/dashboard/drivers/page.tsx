"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { getSession, supaQuery, supaUpdate } from "@/lib/supa";

export default function DriversPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const session = getSession();
    if (!session) return router.push("/auth/login");
    const companyId = session.user.app_metadata?.company_id;
    try {
      const data = await supaQuery(`drivers?select=id,status,rating,total_rides,cnh_number,cnh_category,users(name,email,phone)&company_id=eq.${companyId}&order=created_at.desc`);
      setDrivers(data || []);
    } catch (err) {
      console.error("load drivers error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [router]);

  async function updateStatus(id: string, status: string) {
    try {
      await supaUpdate("drivers", `id=eq.${id}`, { status });
      load();
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center"><Link href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Dashboard</Link></div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Motoristas</h1>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="text-left px-4 py-2 font-medium">Nome</th><th className="text-left px-4 py-2 font-medium">Contato</th><th className="text-left px-4 py-2 font-medium">CNH</th><th className="text-left px-4 py-2 font-medium">Status</th><th className="text-left px-4 py-2 font-medium">Corridas</th><th className="text-left px-4 py-2 font-medium">Avaliação</th><th className="text-left px-4 py-2 font-medium">Ações</th></tr></thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-900">{d.users?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs"><div>{d.users?.email || "—"}</div><div>{d.users?.phone || "—"}</div></td>
                  <td className="px-4 py-3 text-slate-600 text-xs"><div>{d.cnh_number}</div><div>Cat. {d.cnh_category}</div></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${d.status === "active" ? "bg-emerald-100 text-emerald-700" : d.status === "pending" ? "bg-amber-100 text-amber-700" : d.status === "offline" ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-700"}`}>{d.status}</span></td>
                  <td className="px-4 py-3 text-slate-600">{d.total_rides}</td>
                  <td className="px-4 py-3 text-slate-600">{Number(d.rating).toFixed(1)}★</td>
                  <td className="px-4 py-3">
                    {d.status === "pending" && <button onClick={() => updateStatus(d.id, "active")} className="text-emerald-600 hover:text-emerald-700 mr-2"><Check className="w-4 h-4 inline" /></button>}
                    {d.status === "active" && <button onClick={() => updateStatus(d.id, "suspended")} className="text-red-600 hover:text-red-700"><X className="w-4 h-4 inline" /></button>}
                    {d.status === "suspended" && <button onClick={() => updateStatus(d.id, "active")} className="text-emerald-600 hover:text-emerald-700"><Check className="w-4 h-4 inline" /></button>}
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Nenhum motorista. Motoristas se cadastram via o app motorista.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
