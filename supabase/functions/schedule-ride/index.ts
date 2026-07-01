// Edge Function: schedule-ride
// Passageiro agenda corrida para data futura. Não busca motorista automaticamente.
// Admin (cliente) aloca manualmente pelo painel.
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
    const role = user.app_metadata?.role;
    if (!companyId || role !== "passenger") return json({ error: "Apenas passageiros" }, 403);

    const body = await req.json();
    const { origin, destination, originAddress, destinationAddress, categoryId, paymentMethod, scheduled_for } = body;

    if (!origin || !destination || !scheduled_for) return json({ error: "origin, destination, scheduled_for obrigatórios" }, 400);

    const scheduledDate = new Date(scheduled_for);
    if (scheduledDate <= new Date()) return json({ error: "Data deve ser futura" }, 400);

    const { data: pubUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
    if (!pubUser) return json({ error: "Perfil não encontrado" }, 404);

    // Calcula tarifa estimada
    const OSRM_URL = Deno.env.get("OSRM_URL") || "https://router.project-osrm.org";
    const res = await fetch(`${OSRM_URL}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`);
    const routeData = await res.json();
    const route = routeData.routes?.[0];

    const { data: cat } = await supabase.from("categories").select("*").eq("id", categoryId).eq("company_id", companyId).maybeSingle();
    let estimatedFare = 0;
    if (cat && route) {
      const distanceKm = route.distance / 1000;
      const durationMin = route.duration / 60;
      const subtotal = Number(cat.base_fee) + Number(cat.per_km) * distanceKm + Number(cat.per_min) * durationMin;
      estimatedFare = +Math.max(subtotal, Number(cat.min_fare)).toFixed(2);
    }

    const { data: ride, error } = await supabase.from("rides").insert({
      company_id: companyId, passenger_id: pubUser.id, category_id: categoryId,
      status: "solicitada", // fica solicitada até admin alocar
      origin: `POINT(${origin.lng} ${origin.lat})`,
      destination: `POINT(${destination.lng} ${destination.lat})`,
      origin_address: originAddress, destination_address: destinationAddress,
      estimated_distance_m: route ? Math.round(route.distance) : null,
      estimated_duration_s: route ? Math.round(route.duration) : null,
      fare: estimatedFare, original_fare: estimatedFare,
      payment_method: paymentMethod,
      payment_status: "pending",
      is_scheduled: true,
      scheduled_for: scheduledDate.toISOString(),
    }).select().single();

    if (error) return json({ error: error.message }, 500);

    await supabase.from("ride_events").insert({
      company_id: companyId, ride_id: ride.id, event_type: "scheduled",
      actor_type: "passenger", actor_id: pubUser.id,
      metadata: { scheduled_for: scheduledDate.toISOString(), estimated_fare: estimatedFare },
    });

    return json({ success: true, ride, message: "Corrida agendada! O administrador irá alocar um motorista." }, 201);
  } catch (err) {
    console.error("schedule-ride error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
