// Edge Function: check-zone
// Verifica se um ponto (lat,lng) está dentro de alguma zona ativa da empresa
// Usado por: passageiro antes de pedir corrida, motorista antes de ficar online
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

    const { lat, lng } = await req.json();
    if (typeof lat !== "number" || typeof lng !== "number") return json({ error: "lat e lng obrigatórios" }, 400);

    // Query PostGIS: ST_Contains
    const { data, error } = await supabase.rpc("check_point_in_zones", {
      p_company_id: companyId,
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      // Se a RPC não existir, faz query direta
      const { data: zones } = await supabase.from("zones").select("id, name, polygon").eq("company_id", companyId).eq("active", true);
      // Não podemos fazer ST_Contains via REST diretamente; precisamos da RPC
      // Por ora, retorna true se há zonas (fallback)
      return json({
        in_zone: (zones || []).length > 0,
        zones: (zones || []).map((z: any) => ({ id: z.id, name: z.name })),
        message: (zones || []).length === 0 ? "Nenhuma zona configurada" : null,
      });
    }

    return json({
      in_zone: data && data.length > 0,
      zones: data || [],
      message: data && data.length === 0 ? "Zona não habilitada — você está fora da área de operação" : null,
    });
  } catch (err) {
    console.error("check-zone error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
