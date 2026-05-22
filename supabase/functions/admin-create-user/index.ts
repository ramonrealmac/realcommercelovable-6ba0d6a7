// Edge function: cria um usuário no Supabase Auth sem afetar a sessão do admin chamador
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateUserPayload {
  email: string;
  password: string;
  nm_usuario?: string;
  ds_login?: string;
  ds_foto?: string;
  empresa_id?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica quem está chamando
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as CreateUserPayload;
    if (!payload.email || !payload.password) {
      return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (payload.password.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter ao menos 6 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Cria já confirmado para login imediato
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: payload.email.trim(),
      password: payload.password,
      email_confirm: true,
    });

    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message || "Falha ao criar usuário" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = created.user.id;

    // Upsert profile
    const { error: profErr } = await admin.from("profiles").upsert({
      id: newUserId,
      email: payload.email.trim(),
      nm_usuario: payload.nm_usuario?.trim() || "",
      ds_login: payload.ds_login?.trim() || "",
      ds_foto: payload.ds_foto?.trim() || "",
    }, { onConflict: "id" });
    if (profErr) console.error("profile upsert error:", profErr);

    // Vincula à empresa, se informada
    if (payload.empresa_id) {
      const { error: euErr } = await admin.from("empresa_usuario").insert({
        empresa_id: payload.empresa_id,
        user_id: newUserId,
      });
      if (euErr) console.error("empresa_usuario insert error:", euErr);
    }

    return new Response(JSON.stringify({ user_id: newUserId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-create-user error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
