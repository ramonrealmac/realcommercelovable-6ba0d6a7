// Edge function: cria e gerencia usuários no Supabase Auth sem afetar a sessão do admin chamador
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateUserPayload {
  email: string;
  password?: string;
  nm_usuario?: string;
  ds_login?: string;
  ds_foto?: string;
  empresa_id?: number;
  fl_autorizado?: boolean;
  action?: string;
  user_id?: string;
  cnpj?: string;
}

// Algoritmo de validação estrutural de CNPJ (padrão brasileiro)
function isValidCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]+/g, "");

  if (cnpj.length !== 14) return false;

  // Elimina CNPJs invalidos conhecidos
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  // Valida DVs
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += Number(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== Number(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += Number(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== Number(digitos.charAt(1))) return false;

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const payload = (await req.json()) as CreateUserPayload;

    // Ação 1: AUTO-CADASTRO (Unauthenticated)
    if (payload.action === "self-register") {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      
      const email = payload.email.trim();
      const password = payload.password;
      const cnpj = payload.cnpj?.trim() || "";
      
      if (!email || !password || !cnpj) {
        return new Response(JSON.stringify({ error: "Dados incompletos para auto-cadastro" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Validar formato do CNPJ
      if (!isValidCNPJ(cnpj)) {
        return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanCnpj = cnpj.replace(/[^\d]+/g, "");
      const formattedCnpj = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

      // 2. Buscar a empresa correspondente pelo CNPJ (limpo ou formatado)
      const { data: empData, error: empErr } = await admin
        .from("empresa")
        .select("empresa_id")
        .or(`cnpj.eq.${cleanCnpj},cnpj.eq.${formattedCnpj}`)
        .eq("excluido", false)
        .limit(1);

      if (empErr) console.error("Erro ao buscar empresa:", empErr);

      const empresaId = empData?.[0]?.empresa_id;

      // Se a empresa não existir, retorna sucesso silencioso (segurança contra enumeração)
      if (!empresaId) {
        console.log(`[Self-Register] Empresa com CNPJ ${cnpj} não encontrada. Retornando sucesso silencioso.`);
        return new Response(JSON.stringify({ success: true, fl_autorizado: false }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Cadastrar o usuário no Supabase Auth usando o cliente ANON (envia e-mail automático)
      const userClient = createClient(SUPABASE_URL, ANON);
      const { data: signUpData, error: signUpErr } = await userClient.auth.signUp({
        email,
        password,
      });

      if (signUpErr) {
        console.error("Erro no signUp do auto-cadastro:", signUpErr);
        return new Response(JSON.stringify({ error: signUpErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newUserId = signUpData.user?.id;
      if (!newUserId) {
        return new Response(JSON.stringify({ error: "Falha ao registrar usuário no provedor de autenticação." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 4. Verificar se esta empresa já possui algum usuário ativo no empresa_usuario
      const { count, error: countErr } = await admin
        .from("empresa_usuario")
        .select("empresa_usuario_id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("fl_excluido", false);

      if (countErr) {
        console.error("Erro ao verificar contagem de usuários:", countErr);
      }

      // É o primeiro usuário se count for 0 ou nulo
      const isFirstUser = !count || count === 0;
      const flAutorizado = isFirstUser; // Autorizado automático se for o primeiro, caso contrário false (pendente)

      // Criar/atualizar perfil na tabela profiles
      const { error: profErr } = await admin.from("profiles").upsert({
        id: newUserId,
        email: email,
        nm_usuario: payload.nm_usuario?.trim() || "",
        ds_login: payload.ds_login?.trim() || "",
        ds_foto: payload.ds_foto?.trim() || "",
        fl_autorizado: flAutorizado,
      }, { onConflict: "id" });
      
      if (profErr) {
        console.error("Erro ao salvar perfil no auto-cadastro:", profErr);
        return new Response(JSON.stringify({ error: "Erro ao criar perfil do usuário." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Criar vínculo de empresa
      const { error: euErr } = await admin.from("empresa_usuario").insert({
        empresa_id: empresaId,
        user_id: newUserId,
        fl_excluido: false,
      });
      if (euErr) {
        console.error("Erro ao vincular empresa no auto-cadastro:", euErr);
      }

      // Se for o primeiro usuário, vincula ao perfil Administrador
      if (isFirstUser) {
        // Busca perfil de administrador existente para a empresa
        const { data: perfilData } = await admin
          .from("perfil")
          .select("perfil_id")
          .eq("empresa_id", empresaId)
          .eq("fl_administrador", true)
          .eq("fl_excluido", false)
          .limit(1);

        let perfilId = perfilData?.[0]?.perfil_id;
        
        // Se não existir perfil administrador na empresa, cria um
        if (!perfilId) {
          const { data: newPerfil, error: newPerfilErr } = await admin
            .from("perfil")
            .insert({
              empresa_id: empresaId,
              nm_perfil: "Administrador",
              fl_administrador: true,
            })
            .select("perfil_id")
            .single();
          
          if (newPerfilErr) {
            console.error("Falha ao criar perfil de administrador:", newPerfilErr);
          } else {
            perfilId = newPerfil.perfil_id;
          }
        }

        // Vincula ao perfil de administrador
        if (perfilId) {
          const { error: puErr } = await admin.from("perfil_usuario").insert({
            empresa_id: empresaId,
            user_id: newUserId,
            perfil_id: perfilId,
            fl_excluido: false,
          });
          if (puErr) console.error("Erro ao vincular perfil de administrador:", puErr);
        }
      }

      return new Response(JSON.stringify({ success: true, fl_autorizado: flAutorizado, is_first: isFirstUser }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- REQUISIÇÕES AUTENTICADAS (Apenas para administradores do sistema) ---
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Ação 2: ALTERAR PERFIL (Edição pelo admin)
    if (payload.action === "update") {
      if (!payload.user_id) {
        return new Response(JSON.stringify({ error: "ID do usuário é obrigatório para atualização" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: profErr } = await admin
        .from("profiles")
        .update({
          nm_usuario: payload.nm_usuario?.trim() || "",
          ds_login: payload.ds_login?.trim() || "",
          ds_foto: payload.ds_foto?.trim() || "",
          fl_autorizado: payload.fl_autorizado !== undefined ? payload.fl_autorizado : true,
        })
        .eq("id", payload.user_id);

      if (profErr) {
        return new Response(JSON.stringify({ error: profErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ação 3: CADASTRAR NOVO USUÁRIO (Inserção pelo admin)
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

    // Upsert profile do usuário
    const { error: profErr } = await admin.from("profiles").upsert({
      id: newUserId,
      email: payload.email.trim(),
      nm_usuario: payload.nm_usuario?.trim() || "",
      ds_login: payload.ds_login?.trim() || "",
      ds_foto: payload.ds_foto?.trim() || "",
      fl_autorizado: payload.fl_autorizado !== undefined ? payload.fl_autorizado : true,
    }, { onConflict: "id" });
    if (profErr) console.error("Erro ao cadastrar profile:", profErr);

    // Vincula à empresa
    if (payload.empresa_id) {
      const { error: euErr } = await admin.from("empresa_usuario").insert({
        empresa_id: payload.empresa_id,
        user_id: newUserId,
        fl_excluido: false,
      });
      if (euErr) console.error("Erro ao vincular empresa_usuario:", euErr);
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
