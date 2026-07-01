// Edge Function: create-company (onboarding self-service)
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
    const { companyName, slug, adminEmail, adminPassword, adminName, adminPhone } = body;

    if (!companyName || !slug || !adminEmail || !adminPassword) return json({ error: "Campos obrigatórios faltando" }, 400);
    if (!/^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/.test(slug)) return json({ error: "Slug inválido" }, 400);
    if (adminPassword.length < 8) return json({ error: "Senha deve ter no mínimo 8 caracteres" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: existing } = await supabase.from("companies").select("id").eq("slug", slug).maybeSingle();
    if (existing) return json({ error: "Slug já cadastrado" }, 409);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail, password: adminPassword, email_confirm: true,
      user_metadata: { name: adminName || adminEmail.split("@")[0], phone: adminPhone },
    });
    if (authError) return json({ error: `Erro ao criar usuário: ${authError.message}` }, 400);
    const authUserId = authData.user.id;

    const { data: company, error: companyError } = await supabase.from("companies").insert({
      name: companyName, slug, plan: "free", status: "active",
      theme: { primary: "#06B6D4", secondary: "#8B5CF6", app_name: companyName },
      settings: { maps_provider: "osm", payment_provider: "mercadopago", commission_rate: 0.20, payout_cadence: "weekly" },
    }).select().single();

    if (companyError) {
      await supabase.auth.admin.deleteUser(authUserId);
      return json({ error: `Erro ao criar empresa: ${companyError.message}` }, 500);
    }

    await supabase.from("users").update({ company_id: company.id, role: "company_admin", name: adminName }).eq("auth_user_id", authUserId);
    await supabase.auth.admin.updateUserById(authUserId, { app_metadata: { company_id: company.id, role: "company_admin" } });

    return json({ success: true, company: { id: company.id, slug: company.slug, name: company.name }, message: "Empresa criada! Faça login no painel." }, 201);
  } catch (err) {
    console.error("create-company error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
