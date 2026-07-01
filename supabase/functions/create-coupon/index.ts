// Edge Function: create-coupon
// Admin cria cupom de desconto
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
    if (!companyId || !["company_admin", "operator"].includes(role)) return json({ error: "Apenas admins" }, 403);

    const { code, description, discount_type, discount_value, max_uses, valid_from, valid_until } = await req.json();
    if (!code || !discount_type || !discount_value) return json({ error: "code, discount_type, discount_value obrigatórios" }, 400);
    if (!["percentage", "fixed"].includes(discount_type)) return json({ error: "discount_type inválido" }, 400);

    const { data: coupon, error } = await supabase.from("coupons").insert({
      company_id: companyId, code: code.toUpperCase(), description,
      discount_type, discount_value: Number(discount_value),
      max_uses: max_uses ? Number(max_uses) : null,
      valid_from: valid_from || null, valid_until: valid_until || null,
      active: true,
    }).select().single();

    if (error) {
      if (error.code === "23505") return json({ error: "Código já existe" }, 409);
      throw error;
    }

    return json({ success: true, coupon }, 201);
  } catch (err) {
    console.error("create-coupon error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
