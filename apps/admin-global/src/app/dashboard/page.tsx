"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Car, CreditCard, TrendingUp, LogOut, Shield, Users, MessageSquare } from "lucide-react";
import { getSession, supaQuery, signOut } from "@/lib/supa";

export default function AdminGlobalDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ companies: 0, activeCompanies: 0, suspendedCompanies: 0, totalDrivers: 0, totalRides: 0, ridesToday: 0, totalRevenue: 0 });
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const session = getSession();
        if (!session) return router.push("/auth/login");
        const role = session.user.app_metadata?.role;
        if (role !== "super_admin") {
          signOut();
          return;
        }

        const [companiesData, driversData, ridesData, payments] = await Promise.all([
          supaQuery(`companies?select=id,name,slug,plan,status,created_at&order=created_at.desc&limit=50`),
          supaQuery(`drivers?select=id`),
          supaQuery(`rides?select=id`),
          supaQuery(`payments?select=amount&status=eq.paid`),
        ]);

        setCompanies(companiesData || []);
        const active = (companiesData || []).filter((c: any) => c.status === "active").length;
        const suspended = (companiesData || []).filter((c: any) => c.status === "suspended").length;
        const revenue = (payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const ridesTodayData = await supaQuery(`rides?select=id&created_at=gte.${today.toISOString()}`);

        setStats({
          companies: companiesData?.length || 0,
          activeCompanies: active,
          suspendedCompanies: suspended,
          totalDrivers: driversData?.length || 0,
          totalRides: ridesData?.length || 0,
          ridesToday: ridesTodayData?.length || 0,
          totalRevenue: revenue,
        });
        setLoading(false);
      } catch (err) {
        console.error("Dashboard load error:", err);
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center"><Shield className="w-5 h-5 text-white" /></div>
            <div><div className="font-bold text-white">Admin Global</div><div className="text-xs text-slate-400">MobilerPremium SaaS</div></div>
          </div>
          <button onClick={signOut} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"><LogOut className="w-4 h-4" /> Sair</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6">Dashboard Global</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KpiCard icon={<Building2 className="w-5 h-5 text-cyan-400" />} label="Empresas ativas" value={String(stats.activeCompanies)} />
          <KpiCard icon={<Car className="w-5 h-5 text-violet-400" />} label="Motoristas totais" value={String(stats.totalDrivers)} />
          <KpiCard icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} label="Corridas hoje" value={String(stats.ridesToday)} />
          <KpiCard icon={<CreditCard className="w-5 h-5 text-amber-400" />} label="Receita processada" value={stats.totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        </div>

        {/* Nav cards para gestão */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/dashboard/clients" className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-cyan-500 transition-all">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-3 text-cyan-400"><Users className="w-5 h-5" /></div>
            <div className="font-semibold text-white">Gestão de clientes</div>
            <div className="text-xs text-slate-400 mt-1">Bloquear, reativar, trocar plano</div>
          </Link>
          <Link href="/dashboard/tickets" className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-cyan-500 transition-all">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-3 text-violet-400"><MessageSquare className="w-5 h-5" /></div>
            <div className="font-semibold text-white">Chamados dos clientes</div>
            <div className="text-xs text-slate-400 mt-1">Suporte ao seu cliente (dono do app)</div>
          </Link>
          <Link href="#empresas" className="bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-cyan-500 transition-all">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-3 text-emerald-400"><Building2 className="w-5 h-5" /></div>
            <div className="font-semibold text-white">Empresas recentes</div>
            <div className="text-xs text-slate-400 mt-1">Lista das últimas empresas criadas</div>
          </Link>
        </div>

        <div id="empresas" className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">Empresas recentes</h2>
            <span className="text-xs text-slate-400">{stats.companies} no total</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-slate-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Empresa</th>
                <th className="text-left px-4 py-2 font-medium">Slug</th>
                <th className="text-left px-4 py-2 font-medium">Plano</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Criada em</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-white">{c.name}</td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{c.slug}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${c.plan === "free" ? "bg-slate-700 text-slate-300" : c.plan === "starter" ? "bg-cyan-500/20 text-cyan-300" : c.plan === "pro" ? "bg-violet-500/20 text-violet-300" : "bg-amber-500/20 text-amber-300"}`}>{c.plan}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === "active" ? "bg-emerald-500/20 text-emerald-300" : c.status === "suspended" ? "bg-red-500/20 text-red-300" : "bg-slate-700 text-slate-400"}`}>{c.status}</span></td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {companies.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhuma empresa cadastrada ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-slate-400">{label}</span></div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
