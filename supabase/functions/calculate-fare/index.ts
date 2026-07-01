// Edge Function: calculate-fare
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
    const companyId = user.app_metadata?.company_id;
    if (!companyId) return json({ error: "Sem empresa" }, 403);

    const { origin, destination, categoryId } = await req.json();
    const { data: category } = await supabase.from("categories").select("*").eq("id", categoryId).eq("company_id", companyId).eq("active", true).maybeSingle();
    if (!category) return json({ error: "Categoria inválida" }, 400);

    const OSRM_URL = Deno.env.get("OSRM_URL") || "https://router.project-osrm.org";
    const res = await fetch(`${OSRM_URL}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`);
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return json({ error: "Rota não encontrada" }, 400);

    const distanceKm = route.distance / 1000;
    const durationMin = route.duration / 60;
    let subtotal = Number(category.base_fare) + Number(category.per_km) * distanceKm + Number(category.per_min) * durationMin;
    const total = Math.max(subtotal, Number(category.min_fare));

    return json({ fare: +total.toFixed(2), distance_m: Math.round(route.distance), duration_s: Math.round(route.duration) });
  } catch (err) {
    console.error("calculate-fare error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
