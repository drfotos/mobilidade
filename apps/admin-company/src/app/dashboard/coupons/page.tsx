"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Tag } from "lucide-react";

export default function CouponsPage() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", description: "", discount_type: "percentage", discount_value: 10, max_uses: "", valid_until: "" });

  async function load() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push("/auth/login");
    const companyId = session.user.app_metadata?.company_id;
    const { data } = await supabase.from("coupons").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    setCoupons(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [router]);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${url}/functions/v1/create-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}`, apikey: key },
        body: JSON.stringify({
          code: form.code, description: form.description,
          discount_type: form.discount_type, discount_value: Number(form.discount_value),
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          valid_until: form.valid_until || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      setForm({ code: "", description: "", discount_type: "percentage", discount_value: 10, max_uses: "", valid_until: "" });
      load();
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function deleteCoupon(id: string) {
    if (!confirm("Excluir cupom?")) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key);
    await supabase.from("coupons").delete().eq("id", id);
    load();
  }

  async function toggleActive(id: string, active: boolean) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key);
    await supabase.from("coupons").update({ active: !active }).eq("id", id);
    load();
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Dashboard</Link>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-sm hover:bg-cyan-600"><Plus className="w-4 h-4" /> Novo cupom</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Cupons de desconto</h1>
        <p className="text-sm text-slate-600 mb-6">Crie códigos promocionais para seus passageiros. Cada cupom pode ser percentual ou valor fixo.</p>

        {showForm && (
          <form onSubmit={createCoupon} className="bg-white rounded-xl border border-slate-200 p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Código</label><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="PROMO10" className="w-full h-10 px-3 rounded-md border border-slate-300 font-mono" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de desconto</label><select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300"><option value="percentage">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">{form.discount_type === "percentage" ? "Percentual (%)" : "Valor (R$)"}</label><input type="number" step="0.01" required value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Máximo de usos (opcional)</label><input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Válido até (opcional)</label><input type="datetime-local" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300" /></div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600">Criar cupom</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700">Cancelar</button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="text-left px-4 py-2 font-medium">Código</th><th className="text-left px-4 py-2 font-medium">Descrição</th><th className="text-left px-4 py-2 font-medium">Desconto</th><th className="text-left px-4 py-2 font-medium">Usos</th><th className="text-left px-4 py-2 font-medium">Status</th><th className="text-left px-4 py-2 font-medium">Ações</th></tr></thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono font-semibold text-cyan-600">{c.code}</td>
                  <td className="px-4 py-3 text-slate-600">{c.description || "—"}</td>
                  <td className="px-4 py-3">{c.discount_type === "percentage" ? `${c.discount_value}%` : `R$ ${Number(c.discount_value).toFixed(2)}`}</td>
                  <td className="px-4 py-3 text-slate-600">{c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{c.active ? "Ativo" : "Inativo"}</span></td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => toggleActive(c.id, c.active)} className="text-xs text-slate-600 hover:text-slate-900">{c.active ? "Desativar" : "Ativar"}</button>
                    <button onClick={() => deleteCoupon(c.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum cupom criado.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
