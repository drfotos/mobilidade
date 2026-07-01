// Edge Function: finish-ride
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
    if (!companyId) return json({ error: "Sem empresa" }, 403);

    const { ride_id, actual_distance_m, actual_duration_s } = await req.json();
    if (!ride_id) return json({ error: "ride_id obrigatório" }, 400);

    const { data: ride } = await supabase.from("rides").select("*").eq("id", ride_id).eq("company_id", companyId).maybeSingle();
    if (!ride) return json({ error: "Corrida não encontrada" }, 404);
    if (ride.status !== "em_andamento") return json({ error: `Corrida não está em andamento (status: ${ride.status})` }, 400);

    let finalFare = ride.fare;
    let recalcReason: string | null = null;
    if (actual_distance_m && ride.estimated_distance_m && actual_distance_m > ride.estimated_distance_m * 1.15) {
      recalcReason = "distance_exceeded";
    } else if (actual_duration_s && ride.estimated_duration_s && actual_duration_s > ride.estimated_duration_s + 300) {
      recalcReason = "time_exceeded";
    }

    if (recalcReason) {
      const { data: cat } = await supabase.from("categories").select("*").eq("id", ride.category_id).maybeSingle();
      if (cat) {
        const distKm = (actual_distance_m || ride.estimated_distance_m) / 1000;
        const durMin = (actual_duration_s || ride.estimated_duration_s) / 60;
        const subtotal = cat.base_fare + cat.per_km * distKm + cat.per_min * durMin;
        finalFare = Math.max(subtotal * (ride.surge_mult || 1), cat.min_fare);
      }
    }

    const { data: updated } = await supabase.from("rides").update({
      status: "finalizada", actual_distance_m, actual_duration_s,
      fare: +finalFare.toFixed(2), finished_at: new Date().toISOString(),
    }).eq("id", ride_id).select().single();

    await supabase.from("ride_events").insert({
      company_id: companyId, ride_id, event_type: recalcReason ? "recalculated" : "finished",
      actor_type: role, actor_id: user.id,
      metadata: { reason: recalcReason, old_fare: ride.fare, new_fare: finalFare },
    });

    const commissionRate = 0.20;
    const commission = +(finalFare * commissionRate).toFixed(2);
    const driverPayout = +(finalFare - commission).toFixed(2);
    await supabase.from("payments").insert({
      company_id: companyId, ride_id, provider: ride.payment_method || "mercadopago",
      amount: finalFare, commission_rate: commissionRate, commission_amount: commission,
      driver_payout: driverPayout, status: "pending",
    });

    if (ride.driver_id) {
      const { data: drv } = await supabase.from("drivers").select("total_rides").eq("id", ride.driver_id).maybeSingle();
      await supabase.from("drivers").update({ total_rides: (drv?.total_rides || 0) + 1 }).eq("id", ride.driver_id);
    }

    return json({ success: true, ride: updated, fare: finalFare, recalcReason });
  } catch (err) {
    console.error("finish-ride error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
