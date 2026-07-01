// Edge Function: auto-close-rides
// Cron job: finaliza corridas inativas (motorista esqueceu de encerrar)
// Critério: em_andamento há mais de 4 horas sem atualização de posição
// NÃO bloqueia motorista de aceitar novas corridas

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
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // Busca corridas em_andamento há mais de 4 horas
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: staleRides, error } = await admin
      .from("rides")
      .select("*")
      .eq("status", "em_andamento")
      .lt("accepted_at", fourHoursAgo);

    if (error) return json({ error: error.message }, 500);

    let closed = 0;
    for (const ride of staleRides || []) {
      // Finaliza com valores estimados (já que não temos os reais)
      const finalFare = Number(ride.fare) || 0;

      await admin.from("rides").update({
        status: "finalizada",
        actual_distance_m: ride.estimated_distance_m,
        actual_duration_s: ride.estimated_duration_s,
        fare: finalFare,
        final_fare: finalFare,
        finished_at: new Date().toISOString(),
      }).eq("id", ride.id);

      // Loga evento de auto-encerramento
      await admin.from("ride_events").insert({
        company_id: ride.company_id,
        ride_id: ride.id,
        event_type: "auto_closed",
        actor_type: "system",
        actor_id: null,
        metadata: { reason: "inactivity_timeout", threshold_hours: 4, original_fare: ride.fare },
      });

      // Cria payment se não existir
      const { data: existingPayment } = await admin.from("payments").select("id").eq("ride_id", ride.id).maybeSingle();
      if (!existingPayment) {
        await admin.from("payments").insert({
          company_id: ride.company_id, ride_id: ride.id,
          provider: ride.payment_method || "mercadopago",
          amount: finalFare, tip_amount: 0, final_amount: finalFare, discount_amount: 0,
          commission_rate: 0, commission_amount: 0, driver_payout: 0,
          status: "pending",
        });
      }

      closed++;
    }

    return json({
      success: true,
      closed,
      message: `${closed} corrida(s) auto-encerrada(s) por inatividade.`,
    });
  } catch (err) {
    console.error("auto-close-rides error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
