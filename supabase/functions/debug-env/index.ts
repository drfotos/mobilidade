import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const result: any = {};

  // Test 1: Raw fetch to REST API
  const rawRes = await fetch(`${url}/rest/v1/categories?select=id,name&limit=5`, {
    headers: { apikey: anonKey, Authorization: authHeader || "" },
  });
  result.raw_fetch = { status: rawRes.status, data: await rawRes.json() };

  // Test 2: Supabase JS client
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader || "" } },
  });
  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .select("id, name")
    .limit(5);
  result.js_client = { count: cats?.length || 0, error: catErr?.message, data: cats };

  // Test 3: Check what the JS client sends
  result.js_client_config = {
    url: url,
    has_auth: !!authHeader,
    auth_prefix: authHeader?.substring(0, 20),
  };

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
