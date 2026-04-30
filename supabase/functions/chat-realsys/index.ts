// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o RealSys, assistente virtual integrado ao ERP RealSys. Responde sempre em português do Brasil, de forma cordial e objetiva.

Você pode ajudar o usuário a:
- Abrir formulários do sistema (clientes, produtos, pedidos, PDV, NFe, etc.)
- Cadastrar clientes
- Consultar clientes, produtos e condições de pagamento cadastrados
- Criar pedidos (orçamentos) — NÃO faturam e NÃO registram caixa, apenas geram o pedido em modo Orçamento (st_pedido='O')
- Extrair dados de documentos enviados pelo usuário (anexos)

Fluxo OBRIGATÓRIO para CRIAR PEDIDO:
1. Pergunte ao vendedor: cliente, condição de pagamento, data de entrega, e a lista de produtos (nome, quantidade, preço).
2. Identifique o cliente via buscar_cliente. Se houver mais de um resultado, peça para escolher.
3. Identifique a condição de pagamento via buscar_cond_pagamento. Se ambígua, peça para escolher.
4. Para CADA produto informado por nome, chame buscar_produto e CONFIRME com o vendedor mostrando: código (produto_id), nome do produto e valor sugerido (vl_venda). Se o vendedor informar preço diferente, use o preço informado.
5. Resuma TUDO (cliente, vendedor=usuário logado, cond. pagamento, data entrega, itens com qt e preço, total) e peça confirmação final.
6. Só após o "ok" do vendedor, chame criar_pedido. O vendedor (funcionario_id) é o usuário logado e será resolvido automaticamente — NÃO peça.

Sempre que o usuário pedir uma ação que tenha uma ferramenta correspondente, USE a ferramenta — não simule. Antes de cadastrar/criar algo definitivo, confirme com o usuário os dados principais.

Quando o usuário enviar um anexo (imagem/PDF/áudio), o conteúdo extraído virá como mensagem do sistema/tool. Use esse conteúdo para propor ações.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "abrir_formulario",
      description: "Abre uma aba/formulário do sistema para o usuário. Use quando o usuário pedir para abrir, ir para, ou trabalhar em alguma tela.",
      parameters: {
        type: "object",
        properties: {
          component: {
            type: "string",
            description: "ID do formulário. Valores válidos: cadastro-completo (clientes), fornecedores-transportadores, produtos, grupo-produtos, pdv (novo pedido), pedidos, pdv-caixa, nova-entrada, nfe-recebidas, mdfe, estoque, depositos, empresas, plano-contas, bancos, cond-pagamento, estados, cidades, rotas",
          },
          titulo: { type: "string", description: "Título amigável da aba" },
        },
        required: ["component", "titulo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_cliente",
      description: "Busca clientes pelo nome, CNPJ/CPF ou parte dele.",
      parameters: {
        type: "object",
        properties: { termo: { type: "string" } },
        required: ["termo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_produto",
      description: "Busca produtos pelo nome ou parte dele.",
      parameters: {
        type: "object",
        properties: { termo: { type: "string" } },
        required: ["termo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cadastrar_cliente",
      description: "Cria um novo cliente no sistema. Confirme os dados com o usuário antes de chamar.",
      parameters: {
        type: "object",
        properties: {
          razao_social: { type: "string" },
          nome_fantasia: { type: "string" },
          cnpj_cpf: { type: "string", description: "CNPJ ou CPF, somente dígitos" },
          email: { type: "string" },
          telefone: { type: "string" },
          endereco: { type: "string" },
          cep: { type: "string" },
        },
        required: ["razao_social"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_cond_pagamento",
      description: "Busca condições de pagamento (à vista, 30 dias, 30/60, etc.) pelo nome.",
      parameters: {
        type: "object",
        properties: { termo: { type: "string" } },
        required: ["termo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_pedido",
      description: "Cria um PEDIDO em modo Orçamento (st_pedido='O', tp_movimento='PD'). Não fatura nem registra caixa. O vendedor (funcionario_id) é o usuário logado e é resolvido automaticamente. Confirme TODOS os dados com o usuário antes de chamar.",
      parameters: {
        type: "object",
        properties: {
          cadastro_id: { type: "number", description: "ID do cliente (obtido via buscar_cliente)" },
          condpagto_id: { type: "number", description: "ID da condição de pagamento (obtido via buscar_cond_pagamento)" },
          dt_entrega: { type: "string", description: "Data de entrega no formato YYYY-MM-DD" },
          obs: { type: "string", description: "Observação opcional do pedido" },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                produto_id: { type: "number" },
                qt: { type: "number" },
                vl_unitario: { type: "number" },
              },
              required: ["produto_id", "qt", "vl_unitario"],
              additionalProperties: false,
            },
          },
        },
        required: ["cadastro_id", "condpagto_id", "dt_entrega", "itens"],
        additionalProperties: false,
      },
    },
  },
];

async function executeTool(
  name: string,
  args: any,
  ctx: { supabase: any; userId: string; empresaId: number },
): Promise<any> {
  const { supabase, userId, empresaId } = ctx;
  try {
    switch (name) {
      case "abrir_formulario":
        // UI executes; backend just acknowledges.
        return { ok: true, ui_action: { type: "open_tab", component: args.component, titulo: args.titulo } };

      case "buscar_cliente": {
        const termo = String(args.termo || "").trim();
        const digits = termo.replace(/\D/g, "");
        let q = supabase.from("cadastro").select("cadastro_id, razao_social, nome_fantasia, cnpj, fone_geral").eq("st_cliente", "S").eq("excluido_visivel", false).limit(10);
        if (digits.length >= 3) q = q.ilike("cnpj", `%${digits}%`);
        else q = q.ilike("razao_social", `%${termo}%`);
        const { data, error } = await q;
        if (error) throw error;
        return { resultados: data || [] };
      }

      case "buscar_produto": {
        const termo = String(args.termo || "").trim();
        const { data, error } = await supabase.from("produto").select("produto_id, nm_produto, vl_venda").ilike("nm_produto", `%${termo}%`).eq("excluido_visivel", false).limit(10);
        if (error) throw error;
        return { resultados: data || [] };
      }

      case "cadastrar_cliente": {
        const cnpj = String(args.cnpj_cpf || "").replace(/\D/g, "");
        const tpPessoa = cnpj.length === 14 ? "J" : "F";
        const razao = String(args.razao_social || "").trim();
        const fantasia = String(args.nome_fantasia || razao).trim();
        const payload: any = {
          empresa_id: empresaId,
          razao_social: razao,
          nome_fantasia: fantasia,
          nome_curto: fantasia.substring(0, 30),
          identificacao: "",
          cnpj,
          rg: "",
          inscricao_estadual: "",
          inscricao_municipal: "",
          email: String(args.email || "").trim(),
          tp_pessoa: tpPessoa,
          tp_contribuinte: "N",
          estado_civil: "",
          endereco_logradouro: String(args.endereco || "").trim(),
          endereco_numero: "",
          endereco_bairro: "",
          endereco_compl: "",
          endereco_cep: String(args.cep || "").replace(/\D/g, ""),
          endereco_ptoref: "",
          fone_geral: String(args.telefone || "").trim(),
          fone_comercial: "",
          fone_financeiro: "",
          fone_faturamento: "",
          conj_nome: "",
          conj_cpf: "",
          conj_telefone: "",
          dep_nome1: "",
          st_cliente: "S",
          st_fornecedor: "N",
          st_transportador: "N",
          st_vendedor: "N",
        };
        const { data, error } = await supabase.from("cadastro").insert(payload).select("cadastro_id, razao_social").single();
        if (error) {
          console.error("cadastrar_cliente insert error", error, payload);
          throw error;
        }
        return { ok: true, cliente: data, ui_action: { type: "open_tab", component: "cadastro-completo", titulo: "Clientes" } };
      }

      case "criar_pedido": {
        // Cria movimento + itens
        const { data: mov, error: e1 } = await supabase.from("movimento").insert({
          empresa_id: empresaId,
          cadastro_id: args.cadastro_id,
          tp_movimento: "S",
          st_pedido: "A",
          dt_emissao: new Date().toISOString(),
        }).select("movimento_id").single();
        if (e1) throw e1;

        const itens = (args.itens || []).map((it: any) => ({
          movimento_id: mov.movimento_id,
          produto_id: it.produto_id,
          qt_movimento: it.qt,
          vl_und_produto: it.vl_unitario,
          empresa_id: empresaId,
        }));
        if (itens.length) {
          const { error: e2 } = await supabase.from("movimento_item").insert(itens);
          if (e2) throw e2;
        }
        await supabase.rpc("fu_recalcular_pedido", { _movimento_id: mov.movimento_id });

        return { ok: true, movimento_id: mov.movimento_id, ui_action: { type: "open_tab", component: "pedidos", titulo: "Meus Pedidos" } };
      }

      default:
        return { error: `Ferramenta desconhecida: ${name}` };
    }
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { messages, empresaId } = await req.json();

    const conversation: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(messages || []),
    ];

    const ui_actions: any[] = [];
    const tool_results_log: any[] = [];

    // Tool-call loop (max 4 rounds)
    for (let round = 0; round < 4; round++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: conversation,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        const txt = await aiResp.text();
        console.error("AI gateway error", status, txt);
        if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione fundos em Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "Falha no provedor de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const aiJson = await aiResp.json();
      const choice = aiJson.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      conversation.push(msg);

      const toolCalls = msg.tool_calls || [];
      if (!toolCalls.length) {
        // final answer
        return new Response(JSON.stringify({
          content: msg.content || "",
          ui_actions,
          tool_results: tool_results_log,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Execute each tool call
      for (const tc of toolCalls) {
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
        const result = await executeTool(tc.function.name, args, { supabase, userId, empresaId: Number(empresaId) || 0 });
        if (result?.ui_action) ui_actions.push(result.ui_action);
        tool_results_log.push({ name: tc.function.name, args, result });
        conversation.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return new Response(JSON.stringify({ content: "Processamento interrompido (muitas iterações).", ui_actions, tool_results: tool_results_log }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("chat-realsys error", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
