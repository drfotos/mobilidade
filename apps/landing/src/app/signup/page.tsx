"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ companyName: "", slug: "", adminName: "", adminEmail: "", adminPhone: "", adminPassword: "" });

  function updateSlug(value: string) {
    const slug = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
    setForm({ ...form, companyName: value, slug });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error("Supabase URL não configurada");
      const res = await fetch(`${supabaseUrl}/functions/v1/create-company`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar conta");
      const adminUrl = process.env.NEXT_PUBLIC_ADMIN_COMPANY_URL || "http://localhost:3002";
      router.push(`${adminUrl}/auth/login?slug=${form.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Criar minha operação</h1>
            <p className="text-sm text-slate-600 mt-2">Em 5 minutos sua empresa estará no ar com plano Free.</p>
          </div>
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome da empresa</label>
              <input type="text" required value={form.companyName} onChange={(e) => updateSlug(e.target.value)} placeholder="Ex: Acme Transportes" className="w-full h-10 px-3 rounded-md border border-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Slug (subdomínio)</label>
              <div className="flex items-center">
                <input type="text" required pattern="[a-z0-9-]+" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="acme" className="flex-1 h-10 px-3 rounded-l-md border border-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
                <span className="h-10 inline-flex items-center px-3 rounded-r-md bg-slate-100 border border-l-0 border-slate-300 text-sm text-slate-500">.mobilerpremium.app</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Seu nome</label>
              <input type="text" required value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300 focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
              <input type="email" required value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300 focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefone (opcional)</label>
              <input type="tel" value={form.adminPhone} onChange={(e) => setForm({ ...form, adminPhone: e.target.value })} placeholder="(11) 99999-9999" className="w-full h-10 px-3 rounded-md border border-slate-300 focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha (mínimo 8 caracteres)</label>
              <input type="password" required minLength={8} value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} className="w-full h-10 px-3 rounded-md border border-slate-300 focus:ring-2 focus:ring-cyan-500" />
            </div>
            {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}
            <button type="submit" disabled={loading} className="w-full h-10 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} {loading ? "Criando..." : "Criar operação"}
            </button>
            <p className="text-xs text-slate-500 text-center">Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade.</p>
          </form>
        </div>
      </main>
    </div>
  );
}
