// Edge Function: update-company-maps
// Cliente configura provedor de mapa + chaves de API no painel
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
    if (!companyId || !["company_admin", "operator"].includes(role)) return json({ error: "Apenas admins" }, 403);

    const { provider, google_api_key, mapbox_token, here_api_key } = await req.json();
    if (!["osm", "google", "mapbox", "here"].includes(provider)) return json({ error: "provider inválido" }, 400);

    const mapsConfig: any = { provider };
    if (provider === "google" && google_api_key) mapsConfig.google_api_key = google_api_key;
    if (provider === "mapbox" && mapbox_token) mapsConfig.mapbox_token = mapbox_token;
    if (provider === "here" && here_api_key) mapsConfig.here_api_key = here_api_key;

    const { error } = await supabase.from("companies").update({ maps_config: mapsConfig }).eq("id", companyId);
    if (error) return json({ error: error.message }, 500);

    return json({ success: true, maps_config: mapsConfig });
  } catch (err) {
    console.error("update-company-maps error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
