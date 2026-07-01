"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Plus, Send, MessageSquare } from "lucide-react";

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", priority: "normal" });
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [role, setRole] = useState("");

  async function load() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push("/auth/login");
    setRole(session.user.app_metadata?.role || "passenger");
    const ticketType = session.user.app_metadata?.role === "driver" ? "driver_to_client" : "passenger_to_client";
    const { data: pubUser } = await supabase.from("users").select("id").eq("auth_user_id", session.user.id).maybeSingle();
    const { data } = await supabase.from("tickets").select("*").eq("ticket_type", ticketType).eq("opened_by", pubUser?.id).order("created_at", { ascending: false });
    setTickets(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [router]);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key);
      const { data: { session } } = await supabase.auth.getSession();
      const ticketType = session?.user.app_metadata?.role === "driver" ? "driver_to_client" : "passenger_to_client";
      const res = await fetch(`${url}/functions/v1/create-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}`, apikey: key },
        body: JSON.stringify({ ticket_type: ticketType, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowForm(false);
      setForm({ subject: "", description: "", priority: "normal" });
      load();
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function loadMessages(ticketId: string) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key);
    const { data: t } = await supabase.from("tickets").select("*").eq("id", ticketId).maybeSingle();
    setSelectedTicket(t);
    const { data: msgs } = await supabase.from("ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at");
    setMessages(msgs || []);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedTicket) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${url}/functions/v1/update-ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}`, apikey: key },
      body: JSON.stringify({ ticket_id: selectedTicket.id, message: newMessage }),
    });
    setNewMessage("");
    loadMessages(selectedTicket.id);
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => router.push("/app")} className="flex items-center gap-2 text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /> Voltar</button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500 text-white text-sm hover:bg-cyan-600"><Plus className="w-4 h-4" /> Novo</button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {showForm && (
          <form onSubmit={createTicket} className="bg-slate-900 rounded-xl border border-slate-800 p-4 mb-4 space-y-3">
            <h2 className="font-semibold">Abrir chamado</h2>
            <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Assunto" className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white" />
            <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descreva seu problema..." rows={4} className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white" />
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white">
              <option value="low">Baixa prioridade</option>
              <option value="normal">Normal</option>
              <option value="high">Alta prioridade</option>
              <option value="urgent">Urgente</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 h-10 rounded-md bg-cyan-500 text-white font-semibold hover:bg-cyan-600">Enviar</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 h-10 rounded-md border border-slate-700 text-slate-300">Cancelar</button>
            </div>
          </form>
        )}

        {selectedTicket ? (
          <div className="bg-slate-900 rounded-xl border border-slate-800 flex flex-col max-h-[600px]">
            <div className="p-4 border-b border-slate-800">
              <button onClick={() => setSelectedTicket(null)} className="text-xs text-slate-400 mb-2">← Voltar à lista</button>
              <h2 className="font-semibold text-white">{selectedTicket.subject}</h2>
              <p className="text-sm text-slate-400 mt-1">{selectedTicket.description}</p>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs ${selectedTicket.status === "open" ? "bg-amber-500/20 text-amber-300" : selectedTicket.status === "in_progress" ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-700 text-slate-400"}`}>
                {selectedTicket.status === "open" ? "Aberto" : selectedTicket.status === "in_progress" ? "Em andamento" : "Fechado"}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender_role === role ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 ${m.sender_role === role ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-100"}`}>
                    <div className="text-xs opacity-75 mb-1">{m.sender_role}</div>
                    <div className="text-sm">{m.message}</div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && <div className="text-center text-slate-500 text-sm">Aguardando resposta...</div>}
            </div>
            {selectedTicket.status !== "closed" && (
              <div className="p-4 border-t border-slate-800 flex gap-2">
                <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Mensagem..." className="flex-1 h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white" />
                <button onClick={sendMessage} className="px-4 py-2 rounded-md bg-cyan-500 text-white hover:bg-cyan-600"><Send className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.length === 0 && !showForm && (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">Nenhum chamado aberto.</p>
              </div>
            )}
            {tickets.map((t) => (
              <button key={t.id} onClick={() => loadMessages(t.id)} className="w-full text-left bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-cyan-500 transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <span className="font-semibold text-white text-sm">{t.subject}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${t.status === "open" ? "bg-amber-500/20 text-amber-300" : t.status === "in_progress" ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-700 text-slate-400"}`}>
                    {t.status === "open" ? "Aberto" : t.status === "in_progress" ? "Em andamento" : "Fechado"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">{t.description}</p>
                <div className="text-xs text-slate-500 mt-1">{new Date(t.created_at).toLocaleDateString("pt-BR")}</div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
