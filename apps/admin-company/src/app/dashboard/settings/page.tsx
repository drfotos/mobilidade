"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [company, setCompany] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/auth/login");
      const companyId = session.user.app_metadata?.company_id;
      const { data } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
      setCompany(data);
    }
    load();
  }, [router]);

  async function save() {
    setSaving(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key);
      const { error } = await supabase.from("companies").update({ theme: company.theme, settings: company.settings }).eq("id", company.id);
      if (error) throw error;
      alert("Salvo!");
    } catch (err) { alert("Erro: " + (err as Error).message); }
    finally { setSaving(false); }
  }

  if (!company) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Dashboard</Link>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-sm hover:bg-cyan-600 disabled:opacity-50"><Save className="w-4 h-4" /> Salvar</button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Identidade visual</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do app</label><input value={company.theme.app_name || ""} onChange={(e) => setCompany({ ...company, theme: { ...company.theme, app_name: e.target.value } })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">URL logo</label><input value={company.theme.logo_url || ""} onChange={(e) => setCompany({ ...company, theme: { ...company.theme, logo_url: e.target.value } })} placeholder="https://..." className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Cor primária</label><input type="color" value={company.theme.primary || "#06B6D4"} onChange={(e) => setCompany({ ...company, theme: { ...company.theme, primary: e.target.value } })} className="w-full h-10 px-2 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Cor secundária</label><input type="color" value={company.theme.secondary || "#8B5CF6"} onChange={(e) => setCompany({ ...company, theme: { ...company.theme, secondary: e.target.value } })} className="w-full h-10 px-2 rounded-md border border-slate-300" /></div>
          </div>
        </section>
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Mapas e rotas</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Provedor de mapa</label>
            <select value={company.settings?.maps_provider || "osm"} onChange={(e) => setCompany({ ...company, settings: { ...company.settings, maps_provider: e.target.value } })} className="w-full h-10 px-3 rounded-md border border-slate-300">
              <option value="osm">OpenStreetMap (gratuito)</option>
              <option value="google">Google Maps (pago — Fase 3)</option>
              <option value="mapbox">Mapbox (pago — Fase 3)</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">OSM é gratuito. Troque para Google Maps quando precisar de maior precisão.</p>
          </div>
        </section>
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Pagamentos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Provider</label><select value={company.settings?.payment_provider || "mercadopago"} onChange={(e) => setCompany({ ...company, settings: { ...company.settings, payment_provider: e.target.value } })} className="w-full h-10 px-3 rounded-md border border-slate-300"><option value="mercadopago">Mercado Pago</option><option value="stripe">Stripe (Fase 3)</option></select></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Comissão (%)</label><input type="number" step="0.1" min="0" max="50" value={((company.settings?.commission_rate || 0.20) * 100).toFixed(1)} onChange={(e) => setCompany({ ...company, settings: { ...company.settings, commission_rate: parseFloat(e.target.value) / 100 } })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
          </div>
        </section>
      </main>
    </div>
  );
}
