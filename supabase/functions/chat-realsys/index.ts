// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o RealSys, assistente virtual integrado ao ERP RealSys. Responde sempre em português do Brasil, de forma cordial e objetiva.

Você pode ajudar o usuário a:
- Abrir formulários do sistema (clientes, produtos, pedidos, PDV, NFe, etc.)
- Cadastrar clientes e buscar dados via CNPJ (consulta externa)
- Consultar clientes, produtos e condições de pagamento cadastrados
- Criar pedidos (orçamentos) e FINALIZAR VENDAS (faturar/baixar estoque)
- EMITIR DOCUMENTOS FISCAIS (NFe e NFCe) — você tem autonomia para isso após conferência
- Extrair dados de documentos enviados pelo usuário (anexos XML, PDF, Imagens)
- Sugerir CFOPs de devolução para notas fiscais

Fluxo OBRIGATÓRIO para CRIAR PEDIDO/VENDA:
1. Pergunte ao vendedor: cliente, condição de pagamento, data de entrega, e a lista de produtos (nome, quantidade, preço).
2. Identifique o cliente via buscar_cliente. Se houver mais de um resultado, peça para escolher.
3. Identifique a condição de pagamento via buscar_cond_pagamento. Se ambígua, peça para escolher.
4. Para CADA produto informado por nome, chame buscar_produto e CONFIRME com o vendedor mostrando: código (produto_id), nome do produto e valor sugerido (vl_venda). Se o vendedor informar preço diferente, use o preço informado.
5. Resuma TUDO (cliente, vendedor=usuário logado, cond. pagamento, data entrega, itens com qt e preço, total) e peça confirmação final.
6. Só após o "ok" do vendedor, chame criar_pedido.
7. Se o usuário quiser FINALIZAR ou EMITIR, chame finalizar_venda_pdv e depois emitir_documento_fiscal.

Sempre que o usuário pedir uma ação que tenha uma ferramenta correspondente, USE a ferramenta — não simule. Antes de cadastrar/criar algo definitivo, confirme com o usuário os dados principais.

Quando o usuário enviar um anexo XML de NFe, você deve:
1. Ler o conteúdo (virá no contexto).
2. Identificar se é uma nota de compra ou venda.
3. Se for de devolução, sugerir os CFOPs invertidos usando sugerir_cfop_devolucao para cada item.
4. Oferecer para cadastrar o cliente/fornecedor se ele não existir.`;

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
  {
    type: "function",
    function: {
      name: "finalizar_venda_pdv",
      description: "Finaliza uma venda no PDV, alterando o status do movimento para 'Recebido'.",
      parameters: {
        type: "object",
        properties: {
          movimento_id: { type: "number" }
        },
        required: ["movimento_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "emitir_documento_fiscal",
      description: "Emite um documento fiscal (NFe ou NFCe) para um movimento já finalizado.",
      parameters: {
        type: "object",
        properties: {
          movimento_id: { type: "number" },
          modelo: { type: "number", enum: [55, 65], description: "55 para NFe, 65 para NFCe" }
        },
        required: ["movimento_id", "modelo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sugerir_cfop_devolucao",
      description: "Sugere o CFOP de devolução invertendo o CFOP de origem.",
      parameters: {
        type: "object",
        properties: {
          cfop_origem: { type: "string" }
        },
        required: ["cfop_origem"],
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

      case "buscar_cond_pagamento": {
        const termo = String(args.termo || "").trim();
        let q = supabase.from("condicao_pagamento")
          .select("condicao_id, descricao, qtd_parcelas, intervalo")
          .eq("excluido", false)
          .limit(10);
        if (empresaId) q = q.eq("empresa_id", empresaId);
        if (termo) q = q.ilike("descricao", `%${termo}%`);
        const { data, error } = await q;
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
        // Resolve funcionario (vendedor) — tenta achar um vendedor da empresa.
        let funcionarioId: number | null = null;
        const { data: funcs } = await supabase
          .from("funcionario")
          .select("funcionario_id, nome, vendedor")
          .eq("empresa_id", empresaId)
          .eq("vendedor", "S")
          .limit(2);
        if (funcs && funcs.length === 1) funcionarioId = funcs[0].funcionario_id;

        // Próximos IDs/Nº (mesmo padrão usado no PdvTela / PedidoForm)
        const { data: maxMov } = await supabase
          .from("movimento").select("movimento_id")
          .order("movimento_id", { ascending: false }).limit(1);
        const movId = ((maxMov && maxMov[0]?.movimento_id) || 0) + 1;

        const { data: maxNr } = await supabase
          .from("movimento").select("nr_movimento")
          .eq("empresa_id", empresaId)
          .order("nr_movimento", { ascending: false }).limit(1);
        const nr = ((maxNr && maxNr[0]?.nr_movimento) || 0) + 1;

        const itensSrc = Array.isArray(args.itens) ? args.itens : [];
        const vlProduto = itensSrc.reduce(
          (s: number, it: any) => s + (Number(it.qt) || 0) * (Number(it.vl_unitario) || 0),
          0,
        );

        const movPayload: any = {
          movimento_id: movId,
          empresa_id: empresaId,
          cadastro_id: args.cadastro_id,
          funcionario_id: funcionarioId,
          condicao_id: args.condpagto_id || null,
          nr_movimento: nr,
          tp_movimento: "PD",
          tp_origem: "ASSISTENTE",
          st_pedido: "O",
          faturado: "N",
          dt_emissao: new Date().toISOString(),
          dt_entrega: args.dt_entrega || new Date().toISOString().substring(0, 10),
          obs_pedido: String(args.obs || ""),
          vl_produto: vlProduto,
          vl_movimento: vlProduto,
          vl_desconto: 0,
          pc_desconto: 0,
          tp_desconto: "N",
          excluido: false,
        };

        const { error: e1 } = await supabase.from("movimento").insert(movPayload);
        if (e1) {
          console.error("criar_pedido movimento error", e1, movPayload);
          throw e1;
        }

        // Próximo movimento_item_id
        const { data: maxIt } = await supabase
          .from("movimento_item").select("movimento_item_id")
          .order("movimento_item_id", { ascending: false }).limit(1);
        let nextItId = ((maxIt && maxIt[0]?.movimento_item_id) || 0) + 1;

        // Busca nm_produto / unidade dos produtos referenciados
        const prodIds = itensSrc.map((it: any) => Number(it.produto_id)).filter(Boolean);
        const { data: prods } = await supabase
          .from("produto").select("produto_id, nm_produto, unidade_id")
          .in("produto_id", prodIds.length ? prodIds : [-1]);
        const prodMap = new Map<number, any>((prods || []).map((p: any) => [p.produto_id, p]));

        const itens = itensSrc.map((it: any) => {
          const p = prodMap.get(Number(it.produto_id));
          const qt = Number(it.qt) || 0;
          const vlu = Number(it.vl_unitario) || 0;
          return {
            movimento_item_id: nextItId++,
            empresa_id: empresaId,
            movimento_id: movId,
            produto_id: it.produto_id,
            nm_produto: p?.nm_produto || "",
            unidade_id: p?.unidade_id || null,
            tp_movimento: "PD",
            qt_movimento: qt,
            vl_und_produto: vlu,
            vl_produto: qt * vlu,
            vl_movimento: qt * vlu,
            vl_desconto: 0,
            pc_desconto: 0,
            tp_desconto: "N",
            excluido: false,
          };
        });

        if (itens.length) {
          const { error: e2 } = await supabase.from("movimento_item").insert(itens);
          if (e2) {
            console.error("criar_pedido movimento_item error", e2, itens);
            throw e2;
          }
        }

        // Recalcula totais
        try { await supabase.rpc("fu_recalcular_pedido", { _movimento_id: movId }); } catch (_) {}

        return {
          ok: true,
          movimento_id: movId,
          nr_movimento: nr,
          vendedor_resolvido: funcionarioId,
          ui_action: { type: "open_tab", component: "pedidos", titulo: "Pedidos" },
        };
      }

      case "finalizar_venda_pdv": {
        const { error } = await supabase.rpc("fu_mudar_status_pedido_pdv", {
          p_movimento_id: args.movimento_id,
          p_novo_status: "R",
        });
        if (error) throw error;
        return { ok: true, movimento_id: args.movimento_id, status: "R" };
      }

      case "emitir_documento_fiscal": {
        // Calcular impostos
        const { error: eTax } = await supabase.rpc("fu_calcular_impostos_movimento", {
          p_movimento_id: args.movimento_id,
        });
        if (eTax) throw eTax;

        // Pré-validar
        const { error: eVal } = await supabase.rpc("fn_prevalidar_nfe", {
          p_movimento_id: args.movimento_id,
        });
        if (eVal) throw eVal;

        // Inserir evento fiscal para o worker
        const { data, error } = await supabase.from("fiscal_evento").insert({
          empresa_id: empresaId,
          comando: args.modelo === 55 ? "NFE.CriarEnviarNFe" : "NFE.CriarEnviarNFCe",
          payload: { movimento_id: args.movimento_id, modelo: args.modelo },
          status: "PENDENTE",
          tipo: args.modelo === 55 ? "NFE" : "NFCE",
        }).select("id").single();

        if (error) throw error;
        return { ok: true, evento_id: data.id, msg: "Solicitação de emissão enviada para processamento." };
      }

      case "sugerir_cfop_devolucao": {
        const cf = String(args.cfop_origem || "");
        const MAP: Record<string, string> = {
          "5101": "1201", "5102": "1202", "5202": "1202", "5411": "1411", "5556": "1556",
          "6101": "2201", "6102": "2202", "6202": "2202", "6411": "2411", "6556": "2556",
          "1101": "5201", "1102": "5202", "1411": "5411", "1556": "5556",
          "2101": "6201", "2102": "6202", "2411": "6411", "2556": "6556",
        };
        let sug = MAP[cf];
        if (!sug) {
          const f = cf[0];
          if (f === "5") sug = "1" + cf.substring(1);
          else if (f === "6") sug = "2" + cf.substring(1);
          else if (f === "1") sug = "5" + cf.substring(1);
          else if (f === "2") sug = "6" + cf.substring(1);
        }
        return { sugerido: sug || "1202" };
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

    // Buscar configurações dinâmicas da empresa
    let iaInstructions = "";
    if (empresaId) {
      const { data: emp } = await supabase
        .from("empresa")
        .select("ia_instrucoes")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (emp?.ia_instrucoes) iaInstructions = emp.ia_instrucoes;
    }

    const conversation: any[] = [
      { role: "system", content: SYSTEM_PROMPT + (iaInstructions ? `\n\nINSTRUÇÕES ADICIONAIS DA EMPRESA:\n${iaInstructions}` : "") },
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
