// Edge Function: accept-ride (first-accept-wins)
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
    if (!companyId || role !== "driver") return json({ error: "Apenas motoristas podem aceitar corridas" }, 403);

    const { ride_id } = await req.json();
    if (!ride_id) return json({ error: "ride_id obrigatório" }, 400);

    const { data: driverRow } = await supabase.from("users").select("id, drivers!inner(id, status)").eq("auth_user_id", user.id).maybeSingle();
    if (!driverRow?.drivers?.[0]) return json({ error: "Motorista não encontrado" }, 404);
    const driverId = driverRow.drivers[0].id;
    if (driverRow.drivers[0].status !== "active") return json({ error: "Motorista não está ativo" }, 403);

    const { data: updated, error: updErr } = await supabase.from("rides").update({ driver_id: driverId, status: "aceita", accepted_at: new Date().toISOString() })
      .eq("id", ride_id).eq("company_id", companyId).in("status", ["solicitada", "buscando"]).select().maybeSingle();

    if (updErr) return json({ error: "Erro ao aceitar corrida" }, 500);
    if (!updated) return json({ error: "Corrida não está mais disponível" }, 409);

    await supabase.from("ride_events").insert({
      company_id: companyId, ride_id, event_type: "accepted", actor_type: "driver", actor_id: driverId, metadata: {},
    });

    return json({ success: true, ride: updated });
  } catch (err) {
    console.error("accept-ride error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
