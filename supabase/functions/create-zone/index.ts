// Edge Function: create-zone
// Admin desenha polígono no mapa e cria zona de operação
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

    const { name, polygon, city, state } = await req.json();
    if (!name || !polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return json({ error: "name e polygon (array de {lat,lng}, min 3 pontos) obrigatórios" }, 400);
    }

    // Converte array de {lat,lng} para WKT POLYGON
    // PostGIS geography(Polygon, 4326) espera (lng lat, lng lat, ...)
    const coords = polygon.map((p: any) => `${p.lng} ${p.lat}`).join(", ");
    // Polígono deve fechar (primeiro = último)
    const first = polygon[0];
    const wkt = `POLYGON((${coords}, ${first.lng} ${first.lat}))`;

    const { data: zone, error } = await supabase.from("zones").insert({
      company_id: companyId, name, polygon: wkt, city: city || null, state: state || null, active: true,
    }).select().single();

    if (error) throw error;

    return json({ success: true, zone }, 201);
  } catch (err) {
    console.error("create-zone error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
