// Edge Function: suspend-client
// Super admin suspende/reativa cliente por falta de pagamento
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
    const role = user.app_metadata?.role;
    if (role !== "super_admin") return json({ error: "Apenas super admin" }, 403);

    const { company_id, action, reason } = await req.json();
    if (!company_id || !["suspend", "reactivate", "cancel"].includes(action)) {
      return json({ error: "company_id e action (suspend|reactivate|cancel) obrigatórios" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const update: any = {};
    if (action === "suspend") {
      update.payment_status = "suspended";
      update.suspended_reason = reason || "Pagamento em atraso";
      update.suspended_at = new Date().toISOString();
    } else if (action === "reactivate") {
      update.payment_status = "active";
      update.suspended_reason = null;
      update.suspended_at = null;
    } else if (action === "cancel") {
      update.payment_status = "canceled";
      update.status = "suspended";
    }

    const { data: company, error } = await admin.from("companies").update(update).eq("id", company_id).select().single();
    if (error) return json({ error: error.message }, 500);

    // Se suspendido, revoga todas as sessões ativas (sign out all users)
    if (action === "suspend" || action === "cancel") {
      const { data: users } = await admin.from("users").select("auth_user_id").eq("company_id", company_id);
      if (users) {
        for (const u of users) {
          await admin.auth.admin.signOut(u.auth_user_id, "global");
        }
      }
    }

    return json({ success: true, company, message: `Cliente ${action === "suspend" ? "suspenso" : action === "reactivate" ? "reativado" : "cancelado"}` });
  } catch (err) {
    console.error("suspend-client error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
