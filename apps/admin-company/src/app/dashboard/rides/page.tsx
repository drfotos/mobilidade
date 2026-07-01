"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession, supaQuery } from "@/lib/supa";

export default function RidesPage() {
  const router = useRouter();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  async function load() {
    const session = getSession();
    if (!session) return router.push("/auth/login");
    const companyId = session.user.app_metadata?.company_id;
    try {
      let path = `rides?select=*&company_id=eq.${companyId}&order=created_at.desc&limit=100`;
      if (filter !== "all") path += `&status=eq.${filter}`;
      const data = await supaQuery(path);
      setRides(data || []);
    } catch (err) {
      console.error("load rides error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [router, filter]);

  const statusLabels: Record<string, string> = {
    solicitada: "Solicitada", buscando: "Buscando", aceita: "Aceita", chegando: "A caminho",
    embarque: "Embarque", em_andamento: "Em andamento", finalizada: "Finalizada",
    pagamento: "Pagamento", avaliada: "Avaliada", cancelada: "Cancelada", expirada: "Expirada",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Dashboard</Link>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 px-3 rounded-md border border-slate-300 text-sm">
            <option value="all">Todas</option>
            <option value="solicitada">Solicitada</option>
            <option value="aceita">Aceita</option>
            <option value="em_andamento">Em andamento</option>
            <option value="finalizada">Finalizada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Corridas</h1>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="text-left px-4 py-2 font-medium">Data</th><th className="text-left px-4 py-2 font-medium">Origem</th><th className="text-left px-4 py-2 font-medium">Destino</th><th className="text-left px-4 py-2 font-medium">Status</th><th className="text-left px-4 py-2 font-medium">Valor</th><th className="text-left px-4 py-2 font-medium">Pagamento</th></tr></thead>
            <tbody>
              {rides.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-xs text-slate-600">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-slate-700 text-xs max-w-xs truncate">{r.origin_address}</td>
                  <td className="px-4 py-3 text-slate-700 text-xs max-w-xs truncate">{r.destination_address}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${r.status === "finalizada" || r.status === "avaliada" ? "bg-emerald-100 text-emerald-700" : r.status === "cancelada" || r.status === "expirada" ? "bg-red-100 text-red-700" : r.status === "em_andamento" ? "bg-cyan-100 text-cyan-700" : "bg-amber-100 text-amber-700"}`}>{statusLabels[r.status] || r.status}</span></td>
                  <td className="px-4 py-3 text-slate-900 font-mono">{r.fare ? Number(r.fare).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{r.payment_method || "—"}</td>
                </tr>
              ))}
              {rides.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhuma corrida encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
