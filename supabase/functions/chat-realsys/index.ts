// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o RealSys, assistente virtual integrado ao ERP RealSys. Responde sempre em português do Brasil.

Você TEM AUTONOMIA TOTAL para executar ações no sistema através de ferramentas. NUNCA diga que não pode emitir notas, clicar em botões ou executar ações — você tem ferramentas para isso.

REGRA OBRIGATÓRIA — XML DE DEVOLUÇÃO:
Quando o usuário enviar um XML de NFe e pedir devolução, chame IMEDIATAMENTE "processar_devolucao_xml" extraindo do XML: cnpj_emitente, razao_emitente, chave_nfe, nr_nfe_original, e itens (nome_produto, cfop_origem, qt, vl_unitario). Use emitir_nfe: true. Faça isso SEM confirmação prévia.

REGRA OBRIGATÓRIA — CRIAR PEDIDO:
Para criar qualquer pedido, use SEMPRE "criar_pedido_completo" passando nomes (não IDs):
- nome_cliente: nome ou CNPJ do cliente
- nome_cond_pagamento: ex "à vista", "30 dias"
- itens: lista com nome_produto, qt, e vl_unitario (0 para usar preço cadastrado)
- finalizar: true se quiser já faturar; emitir_nfe/emitir_nfce: true para emitir
NUNCA chame buscar_cliente ou buscar_produto separadamente para criar pedidos.

Sempre use ferramentas para executar ações — nunca simule ou peça ao usuário para fazer manualmente.`;


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
  {
    type: "function",
    function: {
      name: "processar_devolucao_xml",
      description: "Processa uma nota fiscal de DEVOLUÇÃO a partir de dados extraídos de um XML de NFe. Cria o fornecedor se não existir, gera o movimento de devolução e emite a NFe — tudo automaticamente. Use SEMPRE que o usuário enviar um XML e pedir devolução.",
      parameters: {
        type: "object",
        properties: {
          cnpj_emitente: { type: "string", description: "CNPJ do emitente da nota original, somente dígitos" },
          razao_emitente: { type: "string", description: "Razão social do emitente" },
          chave_nfe: { type: "string", description: "Chave de acesso da NFe original (44 dígitos)" },
          nr_nfe_original: { type: "string", description: "Número da NFe original" },
          itens: {
            type: "array",
            description: "Itens da nota a serem devolvidos",
            items: {
              type: "object",
              properties: {
                nome_produto: { type: "string" },
                cfop_origem: { type: "string" },
                qt: { type: "number" },
                vl_unitario: { type: "number" },
              },
              required: ["nome_produto", "qt", "vl_unitario"],
              additionalProperties: false,
            },
          },
          emitir_nfe: { type: "boolean", description: "Se true, emite a NFe após criar o movimento" },
        },
        required: ["cnpj_emitente", "razao_emitente", "itens"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_pedido_completo",
      description: "Cria um pedido aceitando NOMES (não IDs) de cliente, condição de pagamento e produtos. Resolve todos os IDs automaticamente no servidor. Use SEMPRE que precisar criar um pedido — não chame buscar_cliente/buscar_produto separadamente.",
      parameters: {
        type: "object",
        properties: {
          nome_cliente: { type: "string", description: "Nome, razão social ou CNPJ do cliente" },
          nome_cond_pagamento: { type: "string", description: "Nome da condição de pagamento (ex: à vista, 30 dias)" },
          dt_entrega: { type: "string", description: "Data de entrega YYYY-MM-DD" },
          obs: { type: "string" },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nome_produto: { type: "string", description: "Nome, código ou parte do nome do produto" },
                qt: { type: "number" },
                vl_unitario: { type: "number", description: "Preço unitário. 0 para usar o preço cadastrado." },
              },
              required: ["nome_produto", "qt"],
              additionalProperties: false,
            },
          },
          finalizar: { type: "boolean", description: "Se true, já finaliza a venda (status Recebido)" },
          emitir_nfe: { type: "boolean", description: "Se true, emite NFe após finalizar" },
          emitir_nfce: { type: "boolean", description: "Se true, emite NFCe (cupom) após finalizar" },
        },
        required: ["nome_cliente", "itens"],
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
        let q = supabase.from("cadastro").select("cadastro_id, razao_social, nome_fantasia, cnpj, fone_geral").eq("st_cliente", "S").eq("excluido", false).limit(10);
        if (empresaId) q = q.eq("empresa_id", empresaId);
        if (digits.length >= 3) q = q.ilike("cnpj", `%${digits}%`);
        else q = q.ilike("razao_social", `%${termo}%`);
        const { data, error } = await q;
        if (error) throw error;
        return { resultados: data || [] };
      }

      case "buscar_produto": {
        const termo = String(args.termo || "").trim();
        const { data, error } = await supabase.from("produto").select("produto_id, nome, preco_venda").ilike("nome", `%${termo}%`).eq("excluido", false).limit(10);
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


      case "finalizar_venda_pdv": {
        const { error } = await supabase.rpc("fu_mudar_status_pedido_pdv", {
          p_movimento_id: Number(args.movimento_id),
          p_novo_status: "R",
        });
        if (error) throw error;
        return { ok: true, movimento_id: args.movimento_id, status: "R" };
      }

      case "emitir_documento_fiscal": {
        const movId = Number(args.movimento_id);
        const modelo = Number(args.modelo);

        // Calcular impostos - retorna nfe_cabecalho_id
        const { data: nfeId, error: eTax } = await supabase.rpc("fu_calcular_impostos_movimento", {
          p_movimento_id: movId,
          p_modelo: String(modelo),
        });
        if (eTax) {
          console.error("fu_calcular_impostos_movimento error", eTax);
          throw eTax;
        }

        // Pré-validar usando o ID do cabeçalho retornado
        const { error: eVal } = await supabase.rpc("fn_prevalidar_nfe", {
          p_nfe_cabecalho_id: nfeId,
          p_empresa_id: empresaId,
        });
        if (eVal) {
          console.error("fn_prevalidar_nfe error", eVal);
          throw eVal;
        }

        // Inserir evento fiscal para o worker
        const { data, error } = await supabase.from("fiscal_evento").insert({
          empresa_id: empresaId,
          comando: modelo === 55 ? "NFE.CriarEnviarNFe" : "NFE.CriarEnviarNFCe",
          payload: { movimento_id: movId, modelo: modelo, nfe_cabecalho_id: nfeId },
          status: "PENDENTE",
          tipo: modelo === 55 ? "NFE" : "NFCE",
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

      case "processar_devolucao_xml": {
        const cnpj = String(args.cnpj_emitente || "").replace(/\D/g, "");
        const razao = String(args.razao_emitente || "").trim();
        const itensSrc: any[] = Array.isArray(args.itens) ? args.itens : [];
        const emitir = args.emitir_nfe !== false; // default true

        // 1. Buscar ou criar fornecedor
        let cadastroId: number | null = null;
        const { data: fornExist } = await supabase.from("cadastro")
          .select("cadastro_id").eq("cnpj", cnpj).maybeSingle();
        if (fornExist) {
          cadastroId = fornExist.cadastro_id;
        } else {
          // Criar fornecedor automaticamente
          const { data: novoForn, error: eForn } = await supabase.from("cadastro").insert({
            empresa_id: empresaId,
            razao_social: razao,
            nome_fantasia: razao,
            nome_curto: razao.substring(0, 30),
            identificacao: "",
            cnpj,
            tp_pessoa: cnpj.length === 14 ? "J" : "F",
            tp_contribuinte: "N",
            st_cliente: "N",
            st_fornecedor: "S",
            st_transportador: "N",
            st_vendedor: "N",
          }).select("cadastro_id").single();
          if (eForn) throw eForn;
          cadastroId = novoForn.cadastro_id;
        }

        // 2. Resolver condição de pagamento padrão (à vista)
        const { data: condPadrao } = await supabase.from("condicao_pagamento")
          .select("condicao_id").eq("empresa_id", empresaId).eq("excluido", false)
          .ilike("descricao", "%vista%").limit(1).maybeSingle();

        const vlTotal = itensSrc.reduce((s: number, it: any) => s + (Number(it.qt) || 0) * (Number(it.vl_unitario) || 0), 0);

        const { data: movRow, error: eMov } = await supabase.from("movimento").insert({
          empresa_id: empresaId,
          cadastro_id: cadastroId,
          condicao_id: condPadrao?.condicao_id || null,
          tp_movimento: "PD",
          tp_origem: "DEVOLUCAO_XML",
          st_pedido: "O",
          faturado: "N",
          dt_emissao: new Date().toISOString(),
          dt_entrega: new Date().toISOString().substring(0, 10),
          obs_pedido: `Devolução NFe ${args.nr_nfe_original || ""} | Chave: ${args.chave_nfe || ""}`,
          vl_produto: vlTotal,
          vl_movimento: vlTotal,
          vl_desconto: 0,
          pc_desconto: 0,
          tp_desconto: "N",
          excluido: false,
        }).select("movimento_id, nr_movimento").single();
        if (eMov) throw eMov;
        const movId = movRow!.movimento_id;
        const nr = movRow!.nr_movimento;

        // 4. Mapear itens por nome no banco e inserir


        const itensInsert = await Promise.all(itensSrc.map(async (it: any) => {
          const CFOP_MAP: Record<string, string> = {
            "5101": "1201","5102": "1202","5201": "1201","5202": "1202",
            "6101": "2201","6102": "2202","6201": "2201","6202": "2202",
            "5411": "1411","6411": "2411","5556": "1556","6556": "2556",
          };
          const cfopDev = CFOP_MAP[String(it.cfop_origem || "")] || "1202";
          // Tenta achar produto por nome
          const { data: prod } = await supabase.from("produto")
            .select("produto_id, nome, unidade_id")
            .ilike("nome", `%${String(it.nome_produto).split(" ")[0]}%`)
            .eq("excluido", false).limit(1).maybeSingle();
          const qt = Number(it.qt) || 0;
          const vlu = Number(it.vl_unitario) || 0;
          return {
            empresa_id: empresaId,
            movimento_id: movId,
            produto_id: prod?.produto_id || null,
            nm_produto: prod?.nome || it.nome_produto,
            unidade_id: prod?.unidade_id || null,
            cfop_id: cfopDev,
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
        }));

        const { error: eIt } = await supabase.from("movimento_item").insert(itensInsert);
        if (eIt) throw eIt;
        try { await supabase.rpc("fu_recalcular_pedido", { _movimento_id: movId }); } catch (_) {}

        // Devolução não altera status de pedido (não há pedido vinculado).


        let eventoId = null;
        if (emitir) {
          // 6. Calcular impostos e emitir
          const { data: nfeId, error: eTax } = await supabase.rpc("fu_calcular_impostos_movimento", {
            p_movimento_id: movId,
            p_modelo: "55",
          });
          if (eTax) throw eTax;
          const { error: eVal } = await supabase.rpc("fn_prevalidar_nfe", {
            p_nfe_cabecalho_id: nfeId,
            p_empresa_id: empresaId,
          });
          if (eVal) throw eVal;

          // Gravar NF-e referenciada (chave da NFe de origem da devolução)
          if (args.chave_nfe) {
            await supabase.from("fiscal_nfe_referenciada").insert({
              nfe_cabecalho_id: nfeId,
              chave_ref: String(args.chave_nfe).replace(/\D/g, ""),
            });
          }

          // Gravar pagamento (devolução: sem pagamento - código 90)
          await supabase.from("fiscal_nfe_pagamento").insert({
            nfe_cabecalho_id: nfeId,
            t_pag: "90",
            v_pag: vlTotal,
          });

          const { data: ev, error: eEv } = await supabase.from("fiscal_evento").insert({
            empresa_id: empresaId,
            comando: "NFE.CriarEnviarNFe",
            payload: { movimento_id: movId, modelo: 55, nfe_cabecalho_id: nfeId, chave_ref: args.chave_nfe },
            status: "PENDENTE",
            tipo: "NFE",
          }).select("id").single();
          if (eEv) throw eEv;
          eventoId = ev.id;
        }

        return {
          ok: true,
          movimento_id: movId,
          nr_movimento: nr,
          fornecedor_id: cadastroId,
          evento_id: eventoId,
          msg: emitir
            ? `Devolução criada (Pedido #${nr}) e nota fiscal enviada para processamento.`
            : `Devolução criada (Pedido #${nr}). Aguardando confirmação para emitir.`,
          ui_action: { type: "open_tab", component: "pedidos", titulo: "Pedidos" },
        };
      }

      case "criar_pedido_completo": {
        const nomeCliente = String(args.nome_cliente || "").trim();
        const nomeCond = String(args.nome_cond_pagamento || "vista").trim();
        const itensSrc: any[] = Array.isArray(args.itens) ? args.itens : [];

        // 1. Resolver cliente
        const digits = nomeCliente.replace(/\D/g, "");
        let qCli = supabase.from("cadastro").select("cadastro_id, razao_social").eq("excluido", false).limit(1);
        if (empresaId) qCli = qCli.eq("empresa_id", empresaId);
        if (digits.length >= 11) {
          qCli = qCli.ilike("cnpj", `%${digits}%`);
        } else {
          qCli = qCli.or(`razao_social.ilike.%${nomeCliente}%,nome_fantasia.ilike.%${nomeCliente}%`);
        }
        const { data: clientes } = await qCli;
        if (!clientes || clientes.length === 0) return { error: `Cliente '${nomeCliente}' não encontrado.` };
        const cadastroId = clientes[0].cadastro_id;

        // 2. Resolver condição de pagamento
        const { data: conds } = await supabase.from("condicao_pagamento")
          .select("condicao_id, descricao").eq("empresa_id", empresaId).eq("excluido", false)
          .ilike("descricao", `%${nomeCond}%`).limit(1);
        const condId = conds && conds[0] ? conds[0].condicao_id : null;

        // 3. Resolver produtos e calcular totais
        const itensResolvidos: any[] = [];
        let vlTotal = 0;
        for (const it of itensSrc) {
          const nomeProd = String(it.nome_produto || "").trim();
          let orQuery = `nome.ilike.%${nomeProd}%,gtin.ilike.%${nomeProd}%`;
          if (!isNaN(Number(nomeProd)) && nomeProd !== "") {
            orQuery += `,produto_id.eq.${Number(nomeProd)}`;
          }
          const { data: prods, error: prodsErr } = await supabase.from("produto")
            .select("produto_id, nome, preco_venda, unidade_id")
            .eq("excluido", false)
            .or(orQuery)
            .limit(1);
          if (prodsErr) return { error: `Erro SQL buscando produto: ${prodsErr.message}` };
          if (!prods || prods.length === 0) return { error: `Produto '${nomeProd}' não encontrado.` };
          const prod = prods[0];
          const qt = Number(it.qt) || 1;
          const vlu = Number(it.vl_unitario) > 0 ? Number(it.vl_unitario) : Number(prod.preco_venda) || 0;
          vlTotal += qt * vlu;
          itensResolvidos.push({ produto_id: prod.produto_id, nm_produto: prod.nome, unidade_id: prod.unidade_id, qt, vlu });
        }

        const { data: movRow2, error: eMov2 } = await supabase.from("movimento").insert({
          empresa_id: empresaId, cadastro_id: cadastroId,
          condicao_id: condId, tp_movimento: "PD", tp_origem: "ASSISTENTE",
          st_pedido: "O", faturado: "N", dt_emissao: new Date().toISOString(),
          dt_entrega: args.dt_entrega || new Date().toISOString().substring(0, 10),
          obs_pedido: String(args.obs || ""),
          vl_produto: vlTotal, vl_movimento: vlTotal, vl_desconto: 0, pc_desconto: 0, tp_desconto: "N", excluido: false,
        }).select("movimento_id, nr_movimento").single();
        if (eMov2) throw eMov2;
        const movId2 = movRow2!.movimento_id;
        const nr2 = movRow2!.nr_movimento;

        const itensDb = itensResolvidos.map((it) => ({
          empresa_id: empresaId, movimento_id: movId2,
          produto_id: it.produto_id, nm_produto: it.nm_produto, unidade_id: it.unidade_id,
          tp_movimento: "PD", qt_movimento: it.qt, vl_und_produto: it.vlu,
          vl_produto: it.qt * it.vlu, vl_movimento: it.qt * it.vlu,
          vl_desconto: 0, pc_desconto: 0, tp_desconto: "N", excluido: false,
        }));
        const { error: eIt2 } = await supabase.from("movimento_item").insert(itensDb);
        if (eIt2) throw eIt2;
        try { await supabase.rpc("fu_recalcular_pedido", { _movimento_id: movId2 }); } catch (_) {}

        let eventoId2 = null;
        const deveEmitir = args.emitir_nfe || args.emitir_nfce;
        if (args.finalizar || deveEmitir) {
          const { error: eFin2 } = await supabase.rpc("fu_mudar_status_pedido_pdv", { p_movimento_id: movId2, p_novo_status: "R" });
          if (eFin2) throw eFin2;
          if (deveEmitir) {
            const modelo = args.emitir_nfce ? 65 : 55;
            const { data: nfeId2, error: eTax2 } = await supabase.rpc("fu_calcular_impostos_movimento", { p_movimento_id: movId2, p_modelo: String(modelo) });
            if (eTax2) throw eTax2;
            const { error: eVal2 } = await supabase.rpc("fn_prevalidar_nfe", { p_nfe_cabecalho_id: nfeId2, p_empresa_id: empresaId });
            if (eVal2) throw eVal2;

            // Gravar pagamentos do movimento em fiscal_nfe_pagamento
            const { data: pagsMov } = await supabase.from("movimento_pagamento")
              .select("tp_pagamento, vl_pagamento").eq("movimento_id", movId2).eq("excluido", false);
            const mapPag: Record<string, string> = {
              DINHEIRO: "01", CHEQUE: "02", CARTAO_CREDITO: "03", CARTAO_DEBITO: "04",
              CREDITO_LOJA: "05", VALE_ALIMENTACAO: "10", VALE_REFEICAO: "11",
              VALE_PRESENTE: "12", VALE_COMBUSTIVEL: "13", BOLETO: "15",
              PIX: "17", TRANSFERENCIA: "18", SEM_PAGAMENTO: "90", OUTRO: "99",
            };
            const pagsNfe = (pagsMov && pagsMov.length > 0)
              ? pagsMov.map((p: any) => ({
                  nfe_cabecalho_id: nfeId2,
                  t_pag: mapPag[String(p.tp_pagamento || "").toUpperCase()] || "01",
                  v_pag: Number(p.vl_pagamento || 0),
                }))
              : [{ nfe_cabecalho_id: nfeId2, t_pag: "01", v_pag: vlTotal }];
            await supabase.from("fiscal_nfe_pagamento").insert(pagsNfe);

            const { data: ev2, error: eEv2 } = await supabase.from("fiscal_evento").insert({
              empresa_id: empresaId, comando: modelo === 65 ? "NFE.CriarEnviarNFCe" : "NFE.CriarEnviarNFe",
              payload: { movimento_id: movId2, modelo, nfe_cabecalho_id: nfeId2 },
              status: "PENDENTE", tipo: modelo === 65 ? "NFCE" : "NFE",
            }).select("id").single();
            if (eEv2) throw eEv2;
            eventoId2 = ev2.id;
          }
        }

        return {
          ok: true, movimento_id: movId2, nr_movimento: nr2,
          cliente: clientes[0].razao_social, itens: itensResolvidos.map(i => i.nm_produto),
          evento_id: eventoId2,
          ui_action: { type: "open_tab", component: "pedidos", titulo: "Pedidos" },
        };
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

    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Corpo da requisição inválido" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { messages, empresaId } = payload;

    // Buscar configurações dinâmicas da empresa
    let iaInstructions = "";
    let iaModel = "gpt-4o-mini"; 
    if (empresaId) {
      const { data: emp } = await supabase
        .from("empresa")
        .select("ia_instrucoes, ia_modelo")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (emp?.ia_instrucoes) iaInstructions = emp.ia_instrucoes;
      if (emp?.ia_modelo) iaModel = emp.ia_modelo;
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
          model: iaModel,
          messages: conversation,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        const txt = await aiResp.text();
        console.error("AI gateway error", status, txt);
        return new Response(JSON.stringify({ error: `Erro no provedor ${iaModel} (Status ${status}): ${txt.substring(0, 300)}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    return new Response(JSON.stringify({ error: `Erro interno RealSys: ${e?.message || String(e)}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
