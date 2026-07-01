// Edge Function: rate-ride
// Passageiro ou motorista avalia a corrida (1-5 estrelas, sem comentários)
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
    if (!companyId) return json({ error: "Sem empresa" }, 403);

    const { ride_id, stars } = await req.json();
    if (!ride_id || !stars || stars < 1 || stars > 5) return json({ error: "ride_id e stars (1-5) obrigatórios" }, 400);

    // Busca ride
    const { data: ride } = await supabase.from("rides").select("*").eq("id", ride_id).eq("company_id", companyId).maybeSingle();
    if (!ride) return json({ error: "Corrida não encontrada" }, 404);
    if (ride.status !== "finalizada" && ride.status !== "pagamento" && ride.status !== "avaliada") {
      return json({ error: "Só pode avaliar corrida finalizada" }, 400);
    }

    // Determina quem está avaliando quem
    const raterType = role === "driver" ? "driver" : "passenger";
    const ratedType = raterType === "driver" ? "passenger" : "driver";
    const raterId = raterType === "driver" ? ride.driver_id : ride.passenger_id;
    const ratedId = raterType === "driver" ? ride.passenger_id : ride.driver_id;

    if (!ratedId) return json({ error: "Não há contraparte para avaliar" }, 400);

    // Insere avaliação (UNIQUE por ride+rater_type)
    const { error: ratingErr } = await supabase.from("ratings").insert({
      company_id: companyId, ride_id, rater_type: raterType, rater_id: raterId,
      rated_type: ratedType, rated_id: ratedId, stars,
    });
    if (ratingErr) {
      if (ratingErr.code === "23505") return json({ error: "Você já avaliou esta corrida" }, 409);
      throw ratingErr;
    }

    // Atualiza média de avaliação do avaliado
    const { data: ratings } = await supabase.from("ratings").select("stars").eq("rated_id", ratedId).eq("rated_type", ratedType);
    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((s, r) => s + r.stars, 0) / ratings.length;
      if (ratedType === "driver") {
        await supabase.from("drivers").update({ rating: +avg.toFixed(1) }).eq("id", ratedId);
      } else {
        // Para passageiro, poderíamos ter campo rating em users — por ora só guardamos em ratings
      }
    }

    // Se ambos avaliaram (ou pelo menos um), marca ride como avaliada
    await supabase.from("rides").update({ status: "avaliada" }).eq("id", ride_id);

    return json({ success: true, message: "Avaliação registrada!" });
  } catch (err) {
    console.error("rate-ride error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
