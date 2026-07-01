// Edge Function: create-payment-preference
// Cria preferência de pagamento no Mercado Pago (SEM split, direto pro cliente)
// Cliente configura access_token no painel admin-company
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
    if (!companyId) return json({ error: "Sem empresa" }, 403);

    const { ride_id } = await req.json();
    if (!ride_id) return json({ error: "ride_id obrigatório" }, 400);

    // Busca ride + payment + company (com MP config)
    const { data: ride } = await supabase.from("rides").select("*").eq("id", ride_id).eq("company_id", companyId).maybeSingle();
    if (!ride) return json({ error: "Corrida não encontrada" }, 404);

    const { data: payment } = await supabase.from("payments").select("*").eq("ride_id", ride_id).maybeSingle();
    if (!payment) return json({ error: "Pagamento não encontrado" }, 404);

    const { data: company } = await supabase.from("companies").select("mercadopago_config, name").eq("id", companyId).maybeSingle();
    const mpAccessToken = company?.mercadopago_config?.access_token;

    if (!mpAccessToken) return json({ error: "Mercado Pago não configurado. Solicite ao administrador." }, 400);

    // Cria preferência no MP (SEM split — direto pro cliente)
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{
          id: ride.id,
          title: `Corrida ${company.name} — ${ride.origin_address.substring(0, 50)}`,
          description: `Corrida de ${ride.origin_address} para ${ride.destination_address}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(payment.final_amount || payment.amount),
        }],
        payer: { email: user.email },
        external_reference: ride.id,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-mercadopago`,
        payment_methods: {
          installments: 1,
          default_payment_method_id: null,
        },
        statement_descriptor: company.name,
      }),
    });

    if (!mpResponse.ok) {
      const errText = await mpResponse.text();
      console.error("MP error:", errText);
      return json({ error: "Erro ao criar pagamento no Mercado Pago" }, 500);
    }

    const mpData = await mpResponse.json();

    // Atualiza payment com provider_payment_id
    await supabase.from("payments").update({
      provider_payment_id: mpData.id,
      payment_provider_config: { preference_id: mpData.id, init_point: mpData.init_point },
    }).eq("id", payment.id);

    return json({
      success: true,
      preference_id: mpData.id,
      init_point: mpData.init_point, // URL de checkout
      sandbox_init_point: mpData.sandbox_init_point,
    });
  } catch (err) {
    console.error("create-payment-preference error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
