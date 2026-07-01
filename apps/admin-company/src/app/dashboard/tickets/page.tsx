"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, Plus, Send } from "lucide-react";

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  async function load() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data: { session } } = await supabase.auth.getSession();
      if (session) { await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
    if (!session) return router.push("/auth/login");
    const companyId = session.user.app_metadata?.company_id;
    let query = supabase.from("tickets").select("*").or(`company_id.eq.${companyId},ticket_type.eq.client_to_superadmin`).order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setTickets(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [router, filter]);

  async function loadMessages(ticketId: string) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data: ticket } = await supabase.from("tickets").select("*").eq("id", ticketId).maybeSingle();
    setSelectedTicket(ticket);
    const { data: msgs } = await supabase.from("ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at");
    setMessages(msgs || []);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedTicket) return;
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
      const res = await fetch(`${url}/functions/v1/update-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}`, apikey: key },
        body: JSON.stringify({ ticket_id: selectedTicket.id, message: newMessage }),
      });
      if (!res.ok) throw new Error("Erro ao enviar");
      setNewMessage("");
      loadMessages(selectedTicket.id);
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  async function updateStatus(status: string) {
    if (!selectedTicket) return;
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }); }
      await fetch(`${url}/functions/v1/update-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}`, apikey: key },
        body: JSON.stringify({ ticket_id: selectedTicket.id, status }),
      });
      loadMessages(selectedTicket.id);
      load();
    } catch (err) { alert("Erro: " + (err as Error).message); }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Dashboard</Link>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 px-3 rounded-md border border-slate-300 text-sm">
            <option value="all">Todos</option>
            <option value="open">Abertos</option>
            <option value="in_progress">Em andamento</option>
            <option value="closed">Fechados</option>
          </select>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Chamados</h1>
        <p className="text-sm text-slate-600 mb-6">Chamados abertos por motoristas e passageiros da sua operação. Chamados para o suporte do SaaS aparecem aqui também.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 overflow-hidden max-h-[600px] overflow-y-auto">
            {tickets.map((t) => (
              <button key={t.id} onClick={() => loadMessages(t.id)} className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 ${selectedTicket?.id === t.id ? "bg-cyan-50" : ""}`}>
                <div className="flex items-start justify-between mb-1">
                  <span className="font-semibold text-slate-900 text-sm">{t.subject}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${t.status === "open" ? "bg-amber-100 text-amber-700" : t.status === "in_progress" ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-500"}`}>{t.status === "open" ? "Aberto" : t.status === "in_progress" ? "Em andamento" : "Fechado"}</span>
                </div>
                <div className="text-xs text-slate-500">{t.ticket_type === "driver_to_client" ? "Motorista" : t.ticket_type === "passenger_to_client" ? "Passageiro" : "Para o SaaS"} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</div>
              </button>
            ))}
            {tickets.length === 0 && <div className="p-8 text-center text-slate-500">Nenhum chamado.</div>}
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 flex flex-col max-h-[600px]">
            {selectedTicket ? (
              <>
                <div className="p-4 border-b border-slate-200">
                  <h2 className="font-semibold text-slate-900">{selectedTicket.subject}</h2>
                  <p className="text-sm text-slate-600 mt-1">{selectedTicket.description}</p>
                  <div className="flex gap-2 mt-3">
                    {selectedTicket.status !== "in_progress" && <button onClick={() => updateStatus("in_progress")} className="px-3 py-1 text-xs rounded bg-cyan-100 text-cyan-700 hover:bg-cyan-200">Marcar em andamento</button>}
                    {selectedTicket.status !== "closed" && <button onClick={() => updateStatus("closed")} className="px-3 py-1 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Fechar chamado</button>}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_role === "company_admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 ${m.sender_role === "company_admin" ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-900"}`}>
                        <div className="text-xs opacity-75 mb-1">{m.sender_role}</div>
                        <div className="text-sm">{m.message}</div>
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && <div className="text-center text-slate-500 text-sm">Nenhuma mensagem ainda.</div>}
                </div>
                <div className="p-4 border-t border-slate-200 flex gap-2">
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Responder..." className="flex-1 h-10 px-3 rounded-md border border-slate-300" />
                  <button onClick={sendMessage} className="px-4 py-2 rounded-md bg-cyan-500 text-white hover:bg-cyan-600"><Send className="w-4 h-4" /></button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">Selecione um chamado à esquerda</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
