// Edge Function: create-ride
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getRoute(origin: any, destination: any, stops?: any[]) {
  const OSRM_URL = Deno.env.get("OSRM_URL") || "https://router.project-osrm.org";
  const coords = [origin, ...(stops || []), destination].map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("Nenhuma rota encontrada");
  return { distance_m: route.distance, duration_s: route.duration };
}

function calculateFare(route: any, category: any, surgeMult = 1) {
  const distanceKm = route.distance_m / 1000;
  const durationMin = route.duration_s / 60;
  let subtotal = category.base_fare + category.per_km * distanceKm + category.per_min * durationMin;
  subtotal *= surgeMult;
  return +Math.max(subtotal, category.min_fare).toFixed(2);
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

    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) return json({ error: "Sessão inválida" }, 401);
    const companyId = user.app_metadata?.company_id;
    const role = user.app_metadata?.role;
    if (!companyId) return json({ error: "Sem empresa associada" }, 403);
    if (role !== "passenger") return json({ error: "Apenas passageiros podem pedir corridas" }, 403);

    const body = await req.json();
    const { data: category, error: catErr } = await supabase.from("categories").select("*").eq("id", body.categoryId).eq("company_id", companyId).eq("active", true).maybeSingle();
    if (catErr || !category) return json({ error: "Categoria inválida" }, 400);

    const route = await getRoute(body.origin, body.destination, body.stops);
    const fare = calculateFare(route, category, 1.0);

    const { data: pubUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
    if (!pubUser) return json({ error: "Perfil não encontrado" }, 404);

    const { data: ride, error: rideErr } = await supabase.from("rides").insert({
      company_id: companyId, passenger_id: pubUser.id, category_id: body.categoryId, status: "solicitada",
      origin: `POINT(${body.origin.lng} ${body.origin.lat})`,
      destination: `POINT(${body.destination.lng} ${body.destination.lat})`,
      origin_address: body.originAddress, destination_address: body.destinationAddress,
      stops: body.stops || null,
      estimated_distance_m: Math.round(route.distance_m), estimated_duration_s: Math.round(route.duration_s),
      fare, original_fare: fare, surge_mult: 1.0,
      payment_method: body.paymentMethod,
      payment_status: body.paymentMethod === "cash" ? "cash_pending" : "pending",
    }).select().single();

    if (rideErr) return json({ error: `Erro ao criar corrida: ${rideErr.message}` }, 500);

    await supabase.from("ride_events").insert({
      company_id: companyId, ride_id: ride.id, event_type: "requested", actor_type: "passenger", actor_id: pubUser.id,
      metadata: { fare, distance_m: route.distance_m, duration_s: route.duration_s },
    });

    return json({ success: true, ride, fare, estimatedDistance: route.distance_m, estimatedDuration: route.duration_s }, 201);
  } catch (err) {
    console.error("create-ride error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
