// Edge Function: finish-ride-payment
// Finaliza corrida + processa pagamento (cartão/PIX = automático, dinheiro/maquininha = manual)
// Calcula tarifa COMPLETA: base_fee + km + minuto + paradas + espera - desconto + gorjeta, aplica mínima

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function calculateFullFare(opts: {
  base_fee: number; per_km: number; per_min: number; min_fare: number;
  per_stop_fee: number; wait_per_min: number;
  distance_m: number; duration_s: number; stops_count: number; wait_minutes: number;
  km_enabled: boolean; minute_enabled: boolean; min_enabled: boolean;
  tip_amount: number; discount_amount: number;
  surge_mult: number;
}): { base: number; kmCost: number; minCost: number; stopsFee: number; waitCost: number; subtotal: number; surge: number; afterSurge: number; minApplied: boolean; afterMin: number; discount: number; tip: number; total: number; } {
  const distanceKm = opts.distance_m / 1000;
  const durationMin = opts.duration_s / 60;
  const base = opts.base_fee;
  const kmCost = opts.km_enabled ? opts.per_km * distanceKm : 0;
  const minCost = opts.minute_enabled ? opts.per_min * durationMin : 0;
  const stopsFee = opts.per_stop_fee * Math.max(0, opts.stops_count);
  const waitCost = opts.wait_per_min * Math.max(0, opts.wait_minutes - 5); // 5 min grátis
  let subtotal = base + kmCost + minCost + stopsFee + waitCost;
  const surge = subtotal * (opts.surge_mult - 1);
  subtotal += surge;
  const minApplied = opts.min_enabled && subtotal < opts.min_fare;
  const afterMin = minApplied ? opts.min_fare : subtotal;
  const discount = Math.min(opts.discount_amount, afterMin);
  const afterDiscount = afterMin - discount;
  const tip = opts.tip_amount;
  const total = +(afterDiscount + tip).toFixed(2);
  return { base, kmCost, minCost, stopsFee, waitCost, subtotal, surge, afterSurge: subtotal, minApplied, afterMin, discount, tip, total };
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
    if (!companyId) return json({ error: "Sem empresa" }, 403);

    const body = await req.json();
    const { ride_id, actual_distance_m, actual_duration_s, tip_amount = 0, wait_minutes = 0 } = body;
    if (!ride_id) return json({ error: "ride_id obrigatório" }, 400);

    // Busca ride
    const { data: ride } = await supabase.from("rides").select("*").eq("id", ride_id).eq("company_id", companyId).maybeSingle();
    if (!ride) return json({ error: "Corrida não encontrada" }, 404);
    if (ride.status !== "em_andamento") return json({ error: `Corrida não está em andamento (status: ${ride.status})` }, 400);

    // Busca categoria com pricing completo
    const { data: cat } = await supabase.from("categories").select("*").eq("id", ride.category_id).maybeSingle();
    if (!cat) return json({ error: "Categoria não encontrada" }, 400);

    // Calcula número de paradas
    const stopsCount = ride.stops ? (Array.isArray(ride.stops) ? ride.stops.length : 0) : 0;

    // Calcula tarifa final
    const fare = calculateFullFare({
      base_fee: Number(cat.base_fee) || 0,
      per_km: Number(cat.per_km) || 0,
      per_min: Number(cat.per_min) || 0,
      min_fare: Number(cat.min_fare) || 0,
      per_stop_fee: Number(cat.per_stop_fee) || 0,
      wait_per_min: Number(cat.wait_per_min) || 0,
      distance_m: actual_distance_m || ride.estimated_distance_m || 0,
      duration_s: actual_duration_s || ride.estimated_duration_s || 0,
      stops_count: stopsCount,
      wait_minutes,
      km_enabled: cat.km_enabled !== false,
      minute_enabled: cat.minute_enabled !== false,
      min_enabled: cat.min_enabled !== false,
      tip_amount,
      discount_amount: Number(ride.discount_amount) || 0,
      surge_mult: Number(ride.surge_mult) || 1,
    });

    // Atualiza ride
    const { data: updated } = await supabase.from("rides").update({
      status: "finalizada",
      actual_distance_m, actual_duration_s,
      fare: fare.afterMin, // tarifa sem gorjeta
      final_fare: fare.total, // tarifa + gorjeta
      tip_amount,
      finished_at: new Date().toISOString(),
    }).eq("id", ride_id).select().single();

    // Loga evento
    await supabase.from("ride_events").insert({
      company_id: companyId, ride_id, event_type: "finished",
      actor_type: role, actor_id: user.id,
      metadata: { fare_breakdown: fare, recalc_reason: null },
    });

    // Cria payment (SEM split — direto pro cliente)
    const { data: payment } = await supabase.from("payments").insert({
      company_id: companyId, ride_id,
      provider: ride.payment_method || "mercadopago",
      amount: fare.afterMin,
      tip_amount: fare.tip,
      discount_amount: fare.discount,
      final_amount: fare.total,
      // Split columns mantidas para compatibilidade mas zeradas (sem split)
      commission_rate: 0, commission_amount: 0, driver_payout: 0,
      status: ride.payment_method === "cash" || ride.payment_method === "machine" ? "pending" : "pending",
    }).select().single();

    // Se pagamento for cartão/PIX, dispara criação de preference no Mercado Pago
    // (será processado pela function create-payment-preference chamada pelo app)
    // Por ora, apenas criamos o payment record e deixamos passageiro pagar via app

    // Se pagamento for dinheiro/maquininha, motorista confirma recebimento manualmente
    // (auto-encerra após 24h se não confirmar — ver function auto-close-rides)

    return json({
      success: true,
      ride: updated,
      payment,
      fare_breakdown: fare,
      message: "Corrida finalizada. Aguarde avaliação.",
    });
  } catch (err) {
    console.error("finish-ride-payment error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
