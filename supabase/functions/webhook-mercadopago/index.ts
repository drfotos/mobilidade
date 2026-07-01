// Edge Function: webhook-mercadopago
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
    const body = await req.json();
    const webhookId = body.id || body.webhook_id || crypto.randomUUID();
    const paymentId = body.data?.id || body.id;
    const status = body.action === "payment.updated" ? "paid" : "pending";

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    // Idempotência: se já existe webhook_id, retorna 200 sem reprocessar
    const { data: existing } = await supabase.from("payments").select("id").eq("webhook_id", String(webhookId)).maybeSingle();
    if (existing) return json({ success: true, message: "Already processed" });

    if (paymentId) {
      await supabase.from("payments").update({
        provider_payment_id: String(paymentId), status, paid_at: status === "paid" ? new Date().toISOString() : null,
      }).eq("provider_payment_id", String(paymentId));
    }

    return json({ success: true });
  } catch (err) {
    console.error("webhook-mercadopago error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
