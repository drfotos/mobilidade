// Edge Function: create-driver
// Admin da empresa cadastra motorista pelo painel (cria auth user + driver + vehicle)
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
    if (!companyId || !["company_admin", "operator", "dispatcher"].includes(role)) {
      return json({ error: "Apenas admins da empresa podem cadastrar motoristas" }, 403);
    }

    const body = await req.json();
    const { name, email, phone, password, cnh_number, cnh_category, cnh_expires_at, cnh_img_url, vehicle_plate, vehicle_model, vehicle_color, vehicle_year, vehicle_insurance_url, vehicle_insurance_expires_at } = body;

    if (!name || !email || !password || !cnh_number || !vehicle_plate) {
      return json({ error: "Campos obrigatórios faltando" }, 400);
    }
    if (password.length < 8) return json({ error: "Senha deve ter no mínimo 8 caracteres" }, 400);

    // Admin client para criar auth user
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // Cria auth user com role=driver e company_id
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name, phone, company_id: companyId, role: "driver" },
    });
    if (authError) return json({ error: `Erro ao criar usuário: ${authError.message}` }, 400);

    const authUserId = authData.user.id;

    // Atualiza app_metadata
    await admin.auth.admin.updateUserById(authUserId, { app_metadata: { company_id: companyId, role: "driver" } });

    // Cria driver
    const { data: driver, error: driverErr } = await admin.from("drivers").insert({
      company_id: companyId, user_id: (await admin.from("users").select("id").eq("auth_user_id", authUserId).maybeSingle()).data?.id,
      cnh_number, cnh_category, cnh_expires_at, cnh_img_url: cnh_img_url || "pending",
      status: "active", rating: 5.0, total_rides: 0,
    }).select().single();

    if (driverErr) {
      await admin.auth.admin.deleteUser(authUserId);
      return json({ error: `Erro ao criar motorista: ${driverErr.message}` }, 500);
    }

    // Cria veículo
    if (vehicle_plate && vehicle_model) {
      await admin.from("vehicles").insert({
        company_id: companyId, driver_id: driver.id,
        plate: vehicle_plate, model: vehicle_model, color: vehicle_color || "", year: vehicle_year || new Date().getFullYear(),
        insurance_url: vehicle_insurance_url || "pending", insurance_expires_at: vehicle_insurance_expires_at || "2099-12-31",
      });
    }

    return json({ success: true, driver, message: "Motorista criado! Ele pode fazer login no app motorista." }, 201);
  } catch (err) {
    console.error("create-driver error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
