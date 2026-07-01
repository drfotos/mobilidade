// Edge Function: send-chat-message
// Motorista ou passageiro envia mensagem de texto no chat da corrida
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const companyId = user.app_metadata?.company_id;
    const role = user.app_metadata?.role;
    if (!companyId) return json({ error: "Sem empresa" }, 403);

    const { ride_id, message } = await req.json();
    if (!ride_id || !message || !message.trim()) return json({ error: "ride_id e message obrigatórios" }, 400);
    if (message.length > 1000) return json({ error: "Mensagem muito longa (máx 1000 chars)" }, 400);

    // Busca ride — verifica se está ativa (não finalizada)
    const { data: ride } = await supabase.from("rides").select("id, status, passenger_id, driver_id").eq("id", ride_id).eq("company_id", companyId).maybeSingle();
    if (!ride) return json({ error: "Corrida não encontrada" }, 404);

    // Chat encerra quando corrida finalizada
    if (["finalizada", "pagamento", "avaliada", "cancelada", "expirada"].includes(ride.status)) {
      return json({ error: "Chat encerrado (corrida finalizada)" }, 403);
    }

    // Determina sender_type
    const senderType = role === "driver" ? "driver" : "passenger";

    // Busca sender_id em public.users
    const { data: pubUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
    if (!pubUser) return json({ error: "Usuário não encontrado" }, 404);

    // Insere mensagem
    const { data: msg, error } = await supabase.from("chat_messages").insert({
      company_id: companyId, ride_id, sender_type: senderType, sender_id: pubUser.id, message: message.trim(),
    }).select().single();

    if (error) throw error;

    return json({ success: true, message: msg }, 201);
  } catch (err) {
    console.error("send-chat-message error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
