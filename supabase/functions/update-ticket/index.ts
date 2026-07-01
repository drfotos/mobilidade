// Edge Function: update-ticket
// Atualiza status do chamado ou responde
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

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false }, global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const { ticket_id, status, message } = await req.json();
    if (!ticket_id) return json({ error: "ticket_id obrigatório" }, 400);

    // Busca ticket
    const { data: ticket } = await supabase.from("tickets").select("*").eq("id", ticket_id).maybeSingle();
    if (!ticket) return json({ error: "Ticket não encontrado" }, 404);

    // Atualiza status se fornecido
    if (status && ["open", "in_progress", "closed"].includes(status)) {
      const update: any = { status };
      if (status === "closed") update.closed_at = new Date().toISOString();
      await supabase.from("tickets").update(update).eq("id", ticket_id);
    }

    // Adiciona mensagem se fornecida
    if (message && message.trim()) {
      const { data: pubUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (pubUser) {
        await supabase.from("ticket_messages").insert({
          ticket_id, sender_id: pubUser.id, sender_role: user.app_metadata?.role || "passenger",
          message: message.trim(),
        });
      }
    }

    return json({ success: true });
  } catch (err) {
    console.error("update-ticket error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
