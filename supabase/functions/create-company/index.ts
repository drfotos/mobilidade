// Edge Function: create-company (onboarding self-service completo)
// Recebe: plano, nome app, slug, dados proprietário (nome, CPF, RG, cidade, etc), logo, cores
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
    const {
      companyName, slug, adminEmail, adminPassword, adminName, adminPhone,
      plan = "free",
      ownerName, ownerCpf, ownerRg, ownerCity, ownerState, ownerPhone,
      logoUrl, primaryColor = "#06B6D4", secondaryColor = "#8B5CF6",
    } = body;

    // Validações
    if (!companyName || !slug || !adminEmail || !adminPassword || !ownerName || !ownerCpf) {
      return json({ error: "Campos obrigatórios faltando: companyName, slug, adminEmail, adminPassword, ownerName, ownerCpf" }, 400);
    }
    if (!/^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/.test(slug)) return json({ error: "Slug inválido" }, 400);
    if (adminPassword.length < 8) return json({ error: "Senha deve ter no mínimo 8 caracteres" }, 400);
    if (!["free", "starter", "pro", "enterprise"].includes(plan)) return json({ error: "Plano inválido" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // Verifica slug único
    const { data: existing } = await supabase.from("companies").select("id").eq("slug", slug).maybeSingle();
    if (existing) return json({ error: "Slug já cadastrado. Escolha outro." }, 409);

    // Verifica e-mail único
    const { data: existingEmail } = await supabase.from("users").select("id").eq("email", adminEmail).maybeSingle();
    if (existingEmail) return json({ error: "E-mail já cadastrado" }, 409);

    // Cria auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail, password: adminPassword, email_confirm: true,
      user_metadata: { name: adminName || ownerName, phone: adminPhone || ownerPhone },
    });
    if (authError) return json({ error: `Erro ao criar usuário: ${authError.message}` }, 400);
    const authUserId = authData.user.id;

    // Cria empresa com todos os dados
    const { data: company, error: companyError } = await supabase.from("companies").insert({
      name: companyName, slug,
      plan, status: "active", payment_status: "active",
      theme: { primary: primaryColor, secondary: secondaryColor, app_name: companyName, logo_url: logoUrl || null },
      settings: { maps_provider: "osm", payment_provider: "mercadopago", commission_rate: 0.20, payout_cadence: "weekly" },
      // Dados do proprietário
      owner_name: ownerName, owner_cpf: ownerCpf, owner_rg: ownerRg || null,
      owner_city: ownerCity || null, owner_state: ownerState || null, owner_phone: ownerPhone || adminPhone || null,
      // Branding
      logo_url: logoUrl || null, primary_color: primaryColor, secondary_color: secondaryColor,
      // Configurações iniciais
      maps_config: { provider: "osm" },
      mercadopago_config: {},
    }).select().single();

    if (companyError) {
      await supabase.auth.admin.deleteUser(authUserId);
      return json({ error: `Erro ao criar empresa: ${companyError.message}` }, 500);
    }

    // Atualiza public.users com company_id + role + dados do proprietário
    await supabase.from("users").update({
      company_id: company.id, role: "company_admin", name: ownerName, phone: ownerPhone || adminPhone,
    }).eq("auth_user_id", authUserId);

    // Atualiza app_metadata do auth user (vai para JWT)
    await supabase.auth.admin.updateUserById(authUserId, {
      app_metadata: { company_id: company.id, role: "company_admin" },
    });

    return json({
      success: true,
      company: { id: company.id, slug: company.slug, name: company.name, plan: company.plan },
      message: "Empresa criada! Faça login no painel.",
    }, 201);
  } catch (err) {
    console.error("create-company error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
