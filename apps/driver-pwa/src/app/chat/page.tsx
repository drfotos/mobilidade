"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Send } from "lucide-react";
import { Suspense } from "react";

export default function ChatPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><ChatInner /></Suspense>;
}

function ChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rideId = searchParams.get("ride_id");
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef<any>(null);

  useEffect(() => {
    async function init() {
      if (!rideId) return;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, key);
      supabaseRef.current = supabase;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/auth/login");
      setRole(session.user.app_metadata?.role || "passenger");
      const companyId = session.user.app_metadata?.company_id;

      // Busca ride
      const { data: r } = await supabase.from("rides").select("*").eq("id", rideId).maybeSingle();
      setRide(r);

      // Busca mensagens existentes
      const { data: msgs } = await supabase.from("chat_messages").select("*").eq("ride_id", rideId).order("created_at");
      setMessages(msgs || []);
      setLoading(false);

      // Subscribe a novas mensagens
      const channel = supabase.channel(`chat-${rideId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `ride_id=eq.${rideId}` }, (payload: any) => {
          setMessages((prev) => [...prev, payload.new]);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
    init();
  }, [rideId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!newMessage.trim() || !rideId) return;
    const message = newMessage.trim();
    setNewMessage("");
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      const res = await fetch(`${url}/functions/v1/send-chat-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}`, apikey: key },
        body: JSON.stringify({ ride_id: rideId, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err) {
      alert("Erro: " + (err as Error).message);
      setNewMessage(message); // restaura
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando...</div>;

  const isChatClosed = ride && ["finalizada", "pagamento", "avaliada", "cancelada", "expirada"].includes(ride.status);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <div className="font-semibold text-sm">Chat da corrida</div>
            {ride && <div className="text-xs text-slate-400">Status: {ride.status}</div>}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {messages.map((m) => {
            const isMine = (m.sender_type === "driver" && role === "driver") || (m.sender_type === "passenger" && role !== "driver");
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isMine ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-100"}`}>
                  <div className="text-xs opacity-75 mb-1">{m.sender_type === "driver" ? "Motorista" : "Passageiro"}</div>
                  <div className="text-sm">{m.message}</div>
                  <div className="text-xs opacity-50 mt-1">{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && <div className="text-center text-slate-500 text-sm mt-8">Nenhuma mensagem. Diga olá!</div>}
          <div ref={messagesEndRef} />
        </div>

        {isChatClosed ? (
          <div className="rounded-md bg-slate-800 border border-slate-700 px-4 py-3 text-center text-sm text-slate-400">
            Chat encerrado — corrida finalizada
          </div>
        ) : (
          <div className="flex gap-2">
            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Digite uma mensagem..." className="flex-1 h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white text-sm" />
            <button onClick={sendMessage} className="px-4 py-2 rounded-md bg-cyan-500 text-white hover:bg-cyan-600"><Send className="w-4 h-4" /></button>
          </div>
        )}
      </main>
    </div>
  );
}
