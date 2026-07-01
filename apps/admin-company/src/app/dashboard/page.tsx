"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Car, TrendingUp, CreditCard, LogOut, Settings, MapPin, Tag, MessageSquare } from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Helper: raw fetch with JWT — bypasses Supabase JS client auth issues
async function supaQuery(path: string, token: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Query failed: ${res.status}`);
  return res.json();
}

export default function AdminCompanyDashboard() {
  const router = useRouter();
  const [company, setCompany] = useState<any>(null);
  const [stats, setStats] = useState({ drivers: 0, driversOnline: 0, ridesToday: 0, ridesActive: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Read session from localStorage (set by Supabase Auth on login)
        const storageKey = `sb-vlkrlpcniippudhgggwt-auth-token`;
        const stored = localStorage.getItem(storageKey);
        if (!stored) return router.push("/auth/login");
        const session = JSON.parse(stored);
        const token = session.access_token;
        const user = session.user;
        if (!user) return router.push("/auth/login");
        const role = user.app_metadata?.role;
        const companyId = user.app_metadata?.company_id;
        if (!companyId || !["company_admin", "operator", "dispatcher", "support"].includes(role)) {
          return router.push("/auth/login");
        }

        // Use raw fetch with JWT — no Supabase JS client needed
        const [compData, driversData, driversOnlineData, ridesTodayData, paymentsData] = await Promise.all([
          supaQuery(`companies?select=name,plan,theme,primary_color,secondary_color&id=eq.${companyId}`, token),
          supaQuery(`drivers?select=id&company_id=eq.${companyId}`, token),
          supaQuery(`drivers?select=id&company_id=eq.${companyId}&status=eq.active`, token),
          supaQuery(`rides?select=id&company_id=eq.${companyId}&created_at=gte.${new Date().toISOString().split("T")[0]}T00:00:00.000Z`, token),
          supaQuery(`payments?select=amount&company_id=eq.${companyId}&status=eq.paid`, token),
        ]);

        const comp = compData?.[0];
        if (!comp) { console.error("Company not found"); setLoading(false); return; }
        setCompany(comp);
        if (comp.primary_color) document.documentElement.style.setProperty("--tenant-primary", comp.primary_color);
        else if (comp.theme?.primary) document.documentElement.style.setProperty("--tenant-primary", comp.theme.primary);
        if (comp.secondary_color) document.documentElement.style.setProperty("--tenant-secondary", comp.secondary_color);
        else if (comp.theme?.secondary) document.documentElement.style.setProperty("--tenant-secondary", comp.theme.secondary);

        const revenue = (paymentsData || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        setStats({
          drivers: driversData?.length || 0,
          driversOnline: driversOnlineData?.length || 0,
          ridesToday: ridesTodayData?.length || 0,
          ridesActive: 0,
          revenue,
        });
        setLoading(false);
      } catch (err) {
        console.error("Dashboard load error:", err);
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function signOut() {
    localStorage.removeItem(`sb-vlkrlpcniippudhgggwt-auth-token`);
    router.push("/auth/login");
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Carregando...</div>;
  if (!company) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Erro ao carregar empresa.</div>;

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
