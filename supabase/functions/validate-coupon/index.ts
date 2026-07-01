// Edge Function: validate-coupon
// Passageiro valida cupom antes de pedir corrida
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

    const { code, fare_amount } = await req.json();
    if (!code) return json({ error: "code obrigatório" }, 400);

    const { data: coupon } = await supabase.from("coupons")
      .select("*").eq("company_id", companyId).eq("code", code.toUpperCase()).eq("active", true).maybeSingle();

    if (!coupon) return json({ error: "Cupom inválido" }, 404);

    // Valida validade
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) return json({ error: "Cupom ainda não válido" }, 400);
    if (coupon.valid_until && new Date(coupon.valid_until) < now) return json({ error: "Cupom expirado" }, 400);

    // Valida max_uses
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return json({ error: "Cupom esgotado" }, 400);

    // Calcula desconto
    let discount = 0;
    if (coupon.discount_type === "percentage") {
      discount = (Number(fare_amount || 0) * Number(coupon.discount_value)) / 100;
    } else {
      discount = Number(coupon.discount_value);
    }

    return json({
      success: true,
      coupon: { id: coupon.id, code: coupon.code, discount_type: coupon.discount_type, discount_value: coupon.discount_value },
      discount: +discount.toFixed(2),
    });
  } catch (err) {
    console.error("validate-coupon error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
