"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, Trash2 } from "lucide-react";

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "car", color: "#06B6D4", base_fare: 4.5, per_km: 1.8, per_min: 0.4, min_fare: 8.0, wait_per_min: 0.3, cancel_fee: 5.0, radius_m: 5000, max_passengers: 4 });
  const [saving, setSaving] = useState(false);

  async function load() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push("/auth/login");
    const companyId = session.user.app_metadata?.company_id;
    const { data } = await supabase.from("categories").select("*").eq("company_id", companyId).order("created_at");
    setCategories(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [router]);

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const companyId = session.user.app_metadata?.company_id;
      const { error } = await supabase.from("categories").insert({ ...form, company_id: companyId, vehicle_types: ["sedan", "hatch"] });
      if (error) throw error;
      setShowForm(false);
      load();
    } catch (err) { alert("Erro: " + (err as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Excluir esta categoria?")) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key);
    await supabase.from("categories").delete().eq("id", id);
    load();
  }

  async function toggleActive(id: string, active: boolean) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key);
    await supabase.from("categories").update({ active: !active }).eq("id", id);
    load();
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Dashboard</Link>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-sm hover:bg-cyan-600"><Plus className="w-4 h-4" /> Nova categoria</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Categorias</h1>
        <p className="text-sm text-slate-600 mb-6">Defina tipos de serviço com pricing próprio.</p>
        {showForm && (
          <form onSubmit={createCategory} className="bg-white rounded-xl border border-slate-200 p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Nome</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Uber X" className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Ícone</label><input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="car, bike, truck" className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Cor</label><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full h-10 px-2 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Tarifa base (R$)</label><input type="number" step="0.01" required value={form.base_fare} onChange={(e) => setForm({ ...form, base_fare: parseFloat(e.target.value) })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Por km (R$)</label><input type="number" step="0.01" required value={form.per_km} onChange={(e) => setForm({ ...form, per_km: parseFloat(e.target.value) })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Por minuto (R$)</label><input type="number" step="0.01" required value={form.per_min} onChange={(e) => setForm({ ...form, per_min: parseFloat(e.target.value) })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Tarifa mínima (R$)</label><input type="number" step="0.01" required value={form.min_fare} onChange={(e) => setForm({ ...form, min_fare: parseFloat(e.target.value) })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Espera/min (R$)</label><input type="number" step="0.01" value={form.wait_per_min} onChange={(e) => setForm({ ...form, wait_per_min: parseFloat(e.target.value) })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Taxa cancelamento (R$)</label><input type="number" step="0.01" value={form.cancel_fee} onChange={(e) => setForm({ ...form, cancel_fee: parseFloat(e.target.value) })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Raio busca (m)</label><input type="number" value={form.radius_m} onChange={(e) => setForm({ ...form, radius_m: parseInt(e.target.value) })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Máx. passageiros</label><input type="number" value={form.max_passengers} onChange={(e) => setForm({ ...form, max_passengers: parseInt(e.target.value) })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div className="md:col-span-3 flex gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700">Cancelar</button>
            </div>
          </form>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => (
            <div key={c.id} className={`bg-white rounded-xl border ${c.active ? "border-slate-200" : "border-slate-200 opacity-60"} p-5`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: c.color + "20", color: c.color }}><span className="font-bold text-lg">{c.name.charAt(0)}</span></div>
                  <div><div className="font-semibold text-slate-900">{c.name}</div><div className="text-xs text-slate-500">{c.active ? "Ativa" : "Inativa"}</div></div>
                </div>
                <button onClick={() => deleteCategory(c.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>Base: <span className="font-mono">R$ {Number(c.base_fare).toFixed(2)}</span></div>
                <div>Mín: <span className="font-mono">R$ {Number(c.min_fare).toFixed(2)}</span></div>
                <div>Por km: <span className="font-mono">R$ {Number(c.per_km).toFixed(2)}</span></div>
                <div>Por min: <span className="font-mono">R$ {Number(c.per_min).toFixed(2)}</span></div>
                <div>Raio: {c.radius_m}m</div>
                <div>Max pass: {c.max_passengers}</div>
              </div>
              <button onClick={() => toggleActive(c.id, c.active)} className="mt-3 w-full px-3 py-1.5 rounded text-xs font-medium border border-slate-300 hover:bg-slate-50">{c.active ? "Desativar" : "Ativar"}</button>
            </div>
          ))}
          {categories.length === 0 && <div className="md:col-span-3 text-center py-12 text-slate-500">Nenhuma categoria. Clique em "Nova categoria".</div>}
        </div>
      </main>
    </div>
  );
}
