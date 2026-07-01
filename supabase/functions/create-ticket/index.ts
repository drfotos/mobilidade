// Edge Function: create-ticket
// Abre chamado: client_to_superadmin | driver_to_client | passenger_to_client
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

    const { ticket_type, subject, description, priority = "normal" } = await req.json();
    if (!ticket_type || !subject || !description) return json({ error: "ticket_type, subject, description obrigatórios" }, 400);

    // Valida tipo de ticket vs role
    let validType = false;
    if (ticket_type === "client_to_superadmin" && role === "company_admin") validType = true;
    if (ticket_type === "driver_to_client" && role === "driver") validType = true;
    if (ticket_type === "passenger_to_client" && role === "passenger") validType = true;
    if (!validType) return json({ error: "Tipo de ticket inválido para seu perfil" }, 403);

    // Busca user id
    const { data: pubUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
    if (!pubUser) return json({ error: "Usuário não encontrado" }, 404);

    // Para client_to_superadmin, company_id é NULL (vai pro super admin)
    const ticketCompanyId = ticket_type === "client_to_superadmin" ? null : companyId;

    const { data: ticket, error } = await supabase.from("tickets").insert({
      company_id: ticketCompanyId, ticket_type, subject, description, priority,
      status: "open", opened_by: pubUser.id, opened_by_role: role || "passenger",
    }).select().single();

    if (error) throw error;

    return json({ success: true, ticket }, 201);
  } catch (err) {
    console.error("create-ticket error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
