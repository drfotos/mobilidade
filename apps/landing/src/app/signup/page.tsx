"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Check, Car, CreditCard, User, Palette, Building } from "lucide-react";

const PLANS = [
  { id: "free", name: "Free", price: 0, max_drivers: 5, max_zones: 1, features: ["5 motoristas", "1 zona", "200 corridas/mês", "OSM gratuito"] },
  { id: "starter", name: "Starter", price: 149, max_drivers: 25, max_zones: 3, features: ["25 motoristas", "3 zonas", "2.000 corridas/mês", "Suporte e-mail"] },
  { id: "pro", name: "Pro", price: 499, max_drivers: 100, max_zones: null, features: ["100 motoristas", "Zonas ilimitadas", "20.000 corridas/mês", "Domínio próprio", "API"] },
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const [form, setForm] = useState({
    plan: "free",
    appName: "",
    slug: "",
    ownerName: "", ownerCpf: "", ownerRg: "", ownerCity: "", ownerState: "", ownerPhone: "",
    email: "", password: "",
    logoUrl: "",
    primaryColor: "#06B6D4",
    secondaryColor: "#8B5CF6",
  });

  function updateSlug(value: string) {
    const slug = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
    setForm({ ...form, appName: value, slug });
    setSlugAvailable(null);
  }

  async function checkSlug() {
    if (!form.slug || form.slug.length < 3) return;
    setCheckingSlug(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(url, key);
      const { data } = await supabase.from("companies").select("id").eq("slug", form.slug).maybeSingle();
      setSlugAvailable(!data);
    } catch { setSlugAvailable(null); }
    finally { setCheckingSlug(false); }
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error("Supabase URL não configurada");
      const res = await fetch(`${supabaseUrl}/functions/v1/create-company`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          companyName: form.appName,
          slug: form.slug,
          adminEmail: form.email,
          adminPassword: form.password,
          adminName: form.ownerName,
          adminPhone: form.ownerPhone,
          plan: form.plan,
          ownerName: form.ownerName, ownerCpf: form.ownerCpf, ownerRg: form.ownerRg,
          ownerCity: form.ownerCity, ownerState: form.ownerState, ownerPhone: form.ownerPhone,
          logoUrl: form.logoUrl, primaryColor: form.primaryColor, secondaryColor: form.secondaryColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar conta");
      const adminUrl = process.env.NEXT_PUBLIC_ADMIN_COMPANY_URL || "http://localhost:3002";
      router.push(`${adminUrl}/auth/login?slug=${form.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStep(1);
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (step === 1 && !form.plan) return;
    if (step === 2 && (!form.appName || !form.slug || slugAvailable !== true)) return;
    if (step === 3 && (!form.ownerName || !form.ownerCpf || !form.email || !form.password)) return;
    setStep(step + 1);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${s === step ? "bg-cyan-500 text-white" : s < step ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Step 1: Plano */}
          {step === 1 && (
            <div>
              <div className="text-center mb-8">
                <CreditCard className="w-10 h-10 mx-auto text-cyan-500 mb-3" />
                <h1 className="text-2xl font-bold text-slate-900">Escolha seu plano</h1>
                <p className="text-sm text-slate-600 mt-2">Comece grátis. Faça upgrade quando precisar.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((p) => (
                  <button key={p.id} onClick={() => setForm({ ...form, plan: p.id })} className={`text-left p-5 rounded-xl border-2 transition-all ${form.plan === p.id ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    <div className="font-bold text-slate-900">{p.name}</div>
                    <div className="text-2xl font-extrabold text-slate-900 my-2">R$ {p.price}<span className="text-sm font-normal text-slate-500">/mês</span></div>
                    <ul className="text-xs text-slate-600 space-y-1">
                      {p.features.map((f) => <li key={f} className="flex items-start gap-1"><Check className="w-3 h-3 text-emerald-500 mt-0.5" />{f}</li>)}
                    </ul>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end"><button onClick={next} className="px-6 py-2 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600">Continuar</button></div>
            </div>
          )}

          {/* Step 2: App */}
          {step === 2 && (
            <div>
              <div className="text-center mb-8">
                <Car className="w-10 h-10 mx-auto text-cyan-500 mb-3" />
                <h1 className="text-2xl font-bold text-slate-900">Configure seu app</h1>
                <p className="text-sm text-slate-600 mt-2">Escolha o nome e a URL da sua operação.</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-md mx-auto">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do app</label>
                  <input type="text" required value={form.appName} onChange={(e) => updateSlug(e.target.value)} placeholder="Ex: Acme Transportes" className="w-full h-10 px-3 rounded-md border border-slate-300 focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Endereço (URL)</label>
                  <div className="flex items-center">
                    <input type="text" required pattern="[a-z0-9-]+" value={form.slug} onChange={(e) => { setForm({ ...form, slug: e.target.value.toLowerCase() }); setSlugAvailable(null); }} onBlur={checkSlug} placeholder="acme" className="flex-1 h-10 px-3 rounded-l-md border border-slate-300 focus:ring-2 focus:ring-cyan-500" />
                    <span className="h-10 inline-flex items-center px-3 rounded-r-md bg-slate-100 border border-l-0 border-slate-300 text-sm text-slate-500">.vercel.app</span>
                  </div>
                  {checkingSlug && <p className="text-xs text-slate-500 mt-1">Verificando...</p>}
                  {slugAvailable === true && <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> Disponível!</p>}
                  {slugAvailable === false && <p className="text-xs text-red-600 mt-1">Indisponível — escolha outro</p>}
                </div>
              </div>
              <div className="mt-6 flex justify-between"><button onClick={() => setStep(1)} className="px-6 py-2 rounded-md border border-slate-300 text-slate-700">Voltar</button><button onClick={next} disabled={slugAvailable !== true} className="px-6 py-2 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50">Continuar</button></div>
            </div>
          )}

          {/* Step 3: Dados do proprietário */}
          {step === 3 && (
            <div>
              <div className="text-center mb-8">
                <User className="w-10 h-10 mx-auto text-cyan-500 mb-3" />
                <h1 className="text-2xl font-bold text-slate-900">Seus dados</h1>
                <p className="text-sm text-slate-600 mt-2">Precisamos dos seus dados para criar a conta de administrador.</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Nome completo *</label><input required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">CPF *</label><input required value={form.ownerCpf} onChange={(e) => setForm({ ...form, ownerCpf: e.target.value })} placeholder="000.000.000-00" className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">RG</label><input value={form.ownerRg} onChange={(e) => setForm({ ...form, ownerRg: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Telefone</label><input value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} placeholder="(11) 99999-9999" className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Cidade</label><input value={form.ownerCity} onChange={(e) => setForm({ ...form, ownerCity: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Estado</label><input value={form.ownerState} onChange={(e) => setForm({ ...form, ownerState: e.target.value })} placeholder="SP" className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail (login) *</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Senha (mín 8 chars) *</label><input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
              </div>
              <div className="mt-6 flex justify-between"><button onClick={() => setStep(2)} className="px-6 py-2 rounded-md border border-slate-300 text-slate-700">Voltar</button><button onClick={next} className="px-6 py-2 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600">Continuar</button></div>
            </div>
          )}

          {/* Step 4: Branding */}
          {step === 4 && (
            <div>
              <div className="text-center mb-8">
                <Palette className="w-10 h-10 mx-auto text-cyan-500 mb-3" />
                <h1 className="text-2xl font-bold text-slate-900">Identidade visual</h1>
                <p className="text-sm text-slate-600 mt-2">Personalize seu app com suas cores e logomarca.</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-md mx-auto">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">URL da logomarca (opcional)</label>
                  <input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." className="w-full h-10 px-3 rounded-md border border-slate-300" />
                  <p className="text-xs text-slate-500 mt-1">URL pública da sua logo (PNG ou SVG)</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Cor primária</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="w-12 h-10 rounded border border-slate-300" />
                      <input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="flex-1 h-10 px-2 rounded-md border border-slate-300 font-mono text-xs" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Cor secundária</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} className="w-12 h-10 rounded border border-slate-300" />
                      <input value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} className="flex-1 h-10 px-2 rounded-md border border-slate-300 font-mono text-xs" />
                    </div>
                  </div>
                </div>
                <div className="rounded-md bg-slate-50 border border-slate-200 p-4">
                  <div className="text-xs text-slate-500 mb-2">Pré-visualização</div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${form.primaryColor}, ${form.secondaryColor})` }}>
                      <Building className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{form.appName || "Sua empresa"}</div>
                      <button className="text-xs px-2 py-1 rounded text-white" style={{ background: form.primaryColor }}>Botão de exemplo</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(3)} className="px-6 py-2 rounded-md border border-slate-300 text-slate-700">Voltar</button>
                <button onClick={handleSubmit} disabled={loading} className="px-6 py-2 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} Criar operação
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
