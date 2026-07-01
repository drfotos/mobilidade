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
  const [mpConfig, setMpConfig] = useState({ access_token: "", public_key: "" });
  const [mapsConfig, setMapsConfig] = useState({ provider: "osm", google_api_key: "", mapbox_token: "", here_api_key: "" });

  useEffect(() => {
    async function load() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
      if (!session) return router.push("/auth/login");
      const companyId = session.user.app_metadata?.company_id;
      const { data } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
      setCompany(data);
      setMpConfig(data?.mercadopago_config || { access_token: "", public_key: "" });
      setMapsConfig(data?.maps_config || { provider: "osm", google_api_key: "", mapbox_token: "", here_api_key: "" });
    }
    load();
  }, [router]);

  async function saveBranding() {
    setSaving(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { error } = await supabase.from("companies").update({
        theme: { primary: company.primary_color, secondary: company.secondary_color, app_name: company.name, logo_url: company.logo_url },
        primary_color: company.primary_color, secondary_color: company.secondary_color, logo_url: company.logo_url,
        owner_name: company.owner_name, owner_cpf: company.owner_cpf, owner_rg: company.owner_rg,
        owner_city: company.owner_city, owner_state: company.owner_state, owner_phone: company.owner_phone,
      }).eq("id", company.id);
      if (error) throw error;
      alert("Identidade visual salva!");
    } catch (err) { alert("Erro: " + (err as Error).message); }
    finally { setSaving(false); }
  }

  async function saveMaps() {
    setSaving(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
      const res = await fetch(`${url}/functions/v1/update-company-maps`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}`, apikey: key },
        body: JSON.stringify(mapsConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("Configuração de mapas salva!");
    } catch (err) { alert("Erro: " + (err as Error).message); }
    finally { setSaving(false); }
  }

  async function saveMP() {
    setSaving(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { error } = await supabase.from("companies").update({ mercadopago_config: mpConfig }).eq("id", company.id);
      if (error) throw error;
      alert("Mercado Pago configurado! Pagamentos vão direto para sua conta.");
    } catch (err) { alert("Erro: " + (err as Error).message); }
    finally { setSaving(false); }
  }

  if (!company) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Dashboard</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>

        {/* Branding */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Identidade visual</h2>
            <button onClick={saveBranding} disabled={saving} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-sm hover:bg-cyan-600 disabled:opacity-50"><Save className="w-4 h-4" /> Salvar</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do app</label><input value={company.name || ""} onChange={(e) => setCompany({ ...company, name: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">URL logo</label><input value={company.logo_url || ""} onChange={(e) => setCompany({ ...company, logo_url: e.target.value })} placeholder="https://..." className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Cor primária</label><input type="color" value={company.primary_color || "#06B6D4"} onChange={(e) => setCompany({ ...company, primary_color: e.target.value })} className="w-full h-10 px-2 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Cor secundária</label><input type="color" value={company.secondary_color || "#8B5CF6"} onChange={(e) => setCompany({ ...company, secondary_color: e.target.value })} className="w-full h-10 px-2 rounded-md border border-slate-300" /></div>
          </div>
        </section>

        {/* Dados do proprietário */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Dados do proprietário</h2>
            <button onClick={saveBranding} disabled={saving} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-sm hover:bg-cyan-600 disabled:opacity-50"><Save className="w-4 h-4" /> Salvar</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Nome completo</label><input value={company.owner_name || ""} onChange={(e) => setCompany({ ...company, owner_name: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">CPF</label><input value={company.owner_cpf || ""} onChange={(e) => setCompany({ ...company, owner_cpf: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">RG</label><input value={company.owner_rg || ""} onChange={(e) => setCompany({ ...company, owner_rg: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Telefone</label><input value={company.owner_phone || ""} onChange={(e) => setCompany({ ...company, owner_phone: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Cidade</label><input value={company.owner_city || ""} onChange={(e) => setCompany({ ...company, owner_city: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Estado</label><input value={company.owner_state || ""} onChange={(e) => setCompany({ ...company, owner_state: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
          </div>
        </section>

        {/* Mapas — configuração POR CLIENTE (chaves do cliente, nunca do super admin) */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Mapas e rotas</h2>
            <button onClick={saveMaps} disabled={saving} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-sm hover:bg-cyan-600 disabled:opacity-50"><Save className="w-4 h-4" /> Salvar</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Provedor de mapa</label>
              <select value={mapsConfig.provider} onChange={(e) => setMapsConfig({ ...mapsConfig, provider: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300">
                <option value="osm">OpenStreetMap (gratuito — recomendado)</option>
                <option value="google">Google Maps (pago — você usa sua key)</option>
                <option value="mapbox">Mapbox (pago — você usa seu token)</option>
                <option value="here">HERE (pago — você usa sua key)</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">OSM é gratuito. Para Google/Mapbox/HERE, use suas próprias chaves de API — o custo é seu, não do SaaS.</p>
            </div>
            {mapsConfig.provider === "google" && (
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Google Maps API Key</label><input type="password" value={mapsConfig.google_api_key || ""} onChange={(e) => setMapsConfig({ ...mapsConfig, google_api_key: e.target.value })} placeholder="AIza..." className="w-full h-10 px-3 rounded-md border border-slate-300 font-mono text-xs" /><p className="text-xs text-slate-500 mt-1">Obtenha em https://console.cloud.google.com/google/maps-apis</p></div>
            )}
            {mapsConfig.provider === "mapbox" && (
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Mapbox Access Token</label><input type="password" value={mapsConfig.mapbox_token || ""} onChange={(e) => setMapsConfig({ ...mapsConfig, mapbox_token: e.target.value })} placeholder="pk..." className="w-full h-10 px-3 rounded-md border border-slate-300 font-mono text-xs" /></div>
            )}
            {mapsConfig.provider === "here" && (
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">HERE API Key</label><input type="password" value={mapsConfig.here_api_key || ""} onChange={(e) => setMapsConfig({ ...mapsConfig, here_api_key: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300 font-mono text-xs" /></div>
            )}
          </div>
        </section>

        {/* Mercado Pago — SEM split, direto pro cliente */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Mercado Pago</h2>
            <button onClick={saveMP} disabled={saving} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-sm hover:bg-cyan-600 disabled:opacity-50"><Save className="w-4 h-4" /> Salvar</button>
          </div>
          <div className="space-y-4">
            <div className="rounded-md bg-cyan-50 border border-cyan-200 px-4 py-3 text-sm text-cyan-800">
              <strong>Sem split de pagamento.</strong> Os pagamentos vão direto para sua conta Mercado Pago. Você recebe 100% do valor e repassa ao motorista conforme sua política.
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Access Token</label><input type="password" value={mpConfig.access_token || ""} onChange={(e) => setMpConfig({ ...mpConfig, access_token: e.target.value })} placeholder="APP_USR-..." className="w-full h-10 px-3 rounded-md border border-slate-300 font-mono text-xs" /><p className="text-xs text-slate-500 mt-1">Obtenha em https://www.mercadopago.com.br/developers/panel/app</p></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Public Key</label><input type="password" value={mpConfig.public_key || ""} onChange={(e) => setMpConfig({ ...mpConfig, public_key: e.target.value })} placeholder="APP_USR-..." className="w-full h-10 px-3 rounded-md border border-slate-300 font-mono text-xs" /></div>
          </div>
        </section>
      </main>
    </div>
  );
}
