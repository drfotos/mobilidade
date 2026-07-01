"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Building2, Car, TrendingUp, CreditCard, LogOut, Settings, MapPin, Tag, MessageSquare } from "lucide-react";

export default function AdminCompanyDashboard() {
  const router = useRouter();
  const [company, setCompany] = useState<any>(null);
  const [stats, setStats] = useState({ drivers: 0, driversOnline: 0, ridesToday: 0, ridesActive: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(url, key);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return router.push("/auth/login");
        const role = session.user.app_metadata?.role;
        const companyId = session.user.app_metadata?.company_id;
        if (!companyId || !["company_admin", "operator", "dispatcher", "support"].includes(role)) {
          await supabase.auth.signOut();
          return router.push("/auth/login");
        }
        const { data: comp } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
        setCompany(comp);
        if (comp?.theme?.primary) document.documentElement.style.setProperty("--tenant-primary", comp.theme.primary);
        if (comp?.theme?.secondary) document.documentElement.style.setProperty("--tenant-secondary", comp.theme.secondary);

        // Use regular select instead of head:true count (views don't support count headers)
        const { data: driversData } = await supabase.from("drivers").select("id").eq("company_id", companyId);
        const { data: driversOnlineData } = await supabase.from("drivers").select("id").eq("company_id", companyId).eq("status", "active");
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { data: ridesTodayData } = await supabase.from("rides").select("id").eq("company_id", companyId).gte("created_at", today.toISOString());
        const { data: payments } = await supabase.from("payments").select("amount").eq("company_id", companyId).eq("status", "paid");
        const revenue = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
        setStats({ drivers: driversData?.length || 0, driversOnline: driversOnlineData?.length || 0, ridesToday: ridesTodayData?.length || 0, ridesActive: 0, revenue });
        setLoading(false);
      } catch (err) {
        console.error("Dashboard load error:", err);
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function signOut() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    await createClient(url, key).auth.signOut();
    router.push("/auth/login");
  }

  if (loading || !company) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center"><Building2 className="w-5 h-5 text-white" /></div>
            <div><div className="font-bold text-slate-900">{company.name}</div><div className="text-xs text-slate-500">Plano {company.plan}</div></div>
          </div>
          <button onClick={signOut} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900"><LogOut className="w-4 h-4" /> Sair</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6 text-slate-900">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Kpi icon={<Car className="w-5 h-5 text-cyan-500" />} label="Motoristas" value={String(stats.drivers)} />
          <Kpi icon={<MapPin className="w-5 h-5 text-emerald-500" />} label="Online agora" value={String(stats.driversOnline)} />
          <Kpi icon={<TrendingUp className="w-5 h-5 text-violet-500" />} label="Corridas hoje" value={String(stats.ridesToday)} />
          <Kpi icon={<CreditCard className="w-5 h-5 text-amber-500" />} label="Receita (pago)" value={stats.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <NavCard href="/dashboard/drivers" icon={<Car className="w-5 h-5" />} title="Motoristas" desc="Cadastrar, aprovar, suspender" />
          <NavCard href="/dashboard/categories" icon={<Settings className="w-5 h-5" />} title="Categorias" desc="Pricing: bandeirada, km, min, paradas" />
          <NavCard href="/dashboard/zones" icon={<MapPin className="w-5 h-5" />} title="Zonas" desc="Desenhar áreas de operação" />
          <NavCard href="/dashboard/rides" icon={<TrendingUp className="w-5 h-5" />} title="Corridas" desc="Em andamento e histórico" />
          <NavCard href="/dashboard/coupons" icon={<Tag className="w-5 h-5" />} title="Cupons" desc="Cupons de desconto" />
          <NavCard href="/dashboard/tickets" icon={<MessageSquare className="w-5 h-5" />} title="Chamados" desc="Suporte motorista/passageiro" />
          <NavCard href="/dashboard/settings" icon={<Building2 className="w-5 h-5" />} title="Configurações" desc="Branding, mapa, pagamento" />
        </div>
      </main>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="bg-white rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-slate-500">{label}</span></div><div className="text-2xl font-bold text-slate-900">{value}</div></div>;
}
function NavCard({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return <Link href={href} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-cyan-400 hover:shadow-md transition-all"><div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-3 text-slate-700">{icon}</div><div className="font-semibold text-slate-900">{title}</div><div className="text-xs text-slate-500 mt-1">{desc}</div></Link>;
}
