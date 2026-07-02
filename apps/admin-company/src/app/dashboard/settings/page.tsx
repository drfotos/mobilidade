"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { getSession, supaQuery, supaUpdate, callFunction } from "@/lib/supa";

export default function SettingsPage() {
  const router = useRouter();
  const [company, setCompany] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [mpConfig, setMpConfig] = useState({ access_token: "", public_key: "" });
  const [mapsConfig, setMapsConfig] = useState({ provider: "osm", google_api_key: "", mapbox_token: "", here_api_key: "" });
  const [paymentMethods, setPaymentMethods] = useState({ cash: true, credit_card: false, pix: false, machine: false });

  useEffect(() => {
    async function load() {
      const session = getSession();
      if (!session) return router.push("/auth/login");
      const companyId = session.user.app_metadata?.company_id;
      try {
        const data = await supaQuery(`companies?select=*&id=eq.${companyId}`);
        const comp = data?.[0];
        setCompany(comp);
        setMpConfig(comp?.mercadopago_config || { access_token: "", public_key: "" });
        setMapsConfig(comp?.maps_config || { provider: "osm", google_api_key: "", mapbox_token: "", here_api_key: "" });
        setPaymentMethods(comp?.settings?.payment_methods || { cash: true, credit_card: false, pix: false, machine: false });
      } catch (err) {
        console.error("load settings error:", err);
      }
    }
    load();
  }, [router]);

  async function saveBranding() {
    setSaving(true);
    try {
      await supaUpdate("companies", `id=eq.${company.id}`, {
        theme: { primary: company.primary_color, secondary: company.secondary_color, app_name: company.name, logo_url: company.logo_url },
        primary_color: company.primary_color, secondary_color: company.secondary_color, logo_url: company.logo_url,
        owner_name: company.owner_name, owner_cpf: company.owner_cpf, owner_rg: company.owner_rg,
        owner_city: company.owner_city, owner_state: company.owner_state, owner_phone: company.owner_phone,
      });
      alert("Identidade visual salva!");
    } catch (err) { alert("Erro: " + (err as Error).message); }
    finally { setSaving(false); }
  }

  async function saveMaps() {
    setSaving(true);
    try {
      await callFunction("update-company-maps", mapsConfig);
      alert("Configuração de mapas salva!");
    } catch (err) { alert("Erro: " + (err as Error).message); }
    finally { setSaving(false); }
  }

  async function saveMP() {
    setSaving(true);
    try {
      await supaUpdate("companies", `id=eq.${company.id}`, { mercadopago_config: mpConfig });
      alert("Mercado Pago configurado! Pagamentos vão direto para sua conta.");
    } catch (err) { alert("Erro: " + (err as Error).message); }
    finally { setSaving(false); }
  }

  async function savePaymentMethods() {
    setSaving(true);
    try {
      const newSettings = { ...company.settings, payment_methods: paymentMethods };
      await supaUpdate("companies", `id=eq.${company.id}`, { settings: newSettings });
      setCompany({ ...company, settings: newSettings });
      alert("Formas de pagamento salvas!");
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

        {/* Formas de pagamento */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Formas de pagamento</h2>
            <button onClick={savePaymentMethods} disabled={saving} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-sm hover:bg-cyan-600 disabled:opacity-50"><Save className="w-4 h-4" /> Salvar</button>
          </div>
          <p className="text-sm text-slate-600 mb-4">Habilite as formas de pagamento que sua operação aceita. O passageiro só verá as opções habilitadas.</p>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={paymentMethods.cash} onChange={(e) => setPaymentMethods({ ...paymentMethods, cash: e.target.checked })} className="w-5 h-5 rounded" />
              <div><div className="font-medium text-slate-900">💵 Dinheiro</div><div className="text-xs text-slate-500">Passageiro paga em dinheiro direto ao motorista</div></div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={paymentMethods.credit_card} onChange={(e) => setPaymentMethods({ ...paymentMethods, credit_card: e.target.checked })} className="w-5 h-5 rounded" />
              <div><div className="font-medium text-slate-900">💳 Cartão de crédito (Mercado Pago)</div><div className="text-xs text-slate-500">Cobrança automática ao finalizar corrida. Requer Mercado Pago configurado abaixo.</div></div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={paymentMethods.pix} onChange={(e) => setPaymentMethods({ ...paymentMethods, pix: e.target.checked })} className="w-5 h-5 rounded" />
              <div><div className="font-medium text-slate-900">📱 PIX (Mercado Pago)</div><div className="text-xs text-slate-500">Gera QR Code PIX para o passageiro pagar. Requer Mercado Pago configurado.</div></div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={paymentMethods.machine} onChange={(e) => setPaymentMethods({ ...paymentMethods, machine: e.target.checked })} className="w-5 h-5 rounded" />
              <div><div className="font-medium text-slate-900">🏪 Maquininha do motorista</div><div className="text-xs text-slate-500">Motorista confirma recebimento manualmente ao finalizar</div></div>
            </label>
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
