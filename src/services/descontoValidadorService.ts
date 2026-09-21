import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface IValidaDescontoParams {
  empresaId: number;
  funcionarioId?: number | null; // Vendedor / Funcionário do pedido
  produtoId?: number | null;     // Produto do item (se validação por item)
  tabelaPrecoId?: number | null; // ID da Tabela de Preço
  tipoPrecoPadrao?: "V" | "P" | string | null; // Tipo Padrão (V=À Vista, P=À Prazo)
  pcDescontoTestar: number;       // Percentual de desconto a testar
}

export interface IValidaDescontoResult {
  permitido: boolean;
  maxDescontoPermitido: number;
  descontoPadraoTipo: string | null;
  mensagemErro?: string;
}

/**
 * Valida o desconto aplicado (no item ou geral do pedido) de acordo com o parâmetro 'desconto_padrao' da empresa.
 */
export async function validarDescontoPedido(
  params: IValidaDescontoParams
): Promise<IValidaDescontoResult> {
  const {
    empresaId,
    funcionarioId,
    produtoId,
    tabelaPrecoId,
    tipoPrecoPadrao = "V",
    pcDescontoTestar,
  } = params;

  if (pcDescontoTestar <= 0) {
    return { permitido: true, maxDescontoPermitido: 100, descontoPadraoTipo: null };
  }

  // 1. Busca parâmetro desconto_padrao na empresa
  const { data: emp } = await db
    .from("empresa")
    .select("desconto_padrao")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const tpDescPadrao = emp?.desconto_padrao?.trim()?.toUpperCase() || null;
  if (!tpDescPadrao) {
    // Sem regra de desconto padrão configurada na empresa
    return { permitido: true, maxDescontoPermitido: 100, descontoPadraoTipo: null };
  }

  // 2. Determinar se a tabela de preços é À Vista ("V") ou À Prazo ("P")
  let tpPagamento: "V" | "P" = tipoPrecoPadrao === "P" ? "P" : "V";
  if (tabelaPrecoId) {
    const { data: tab } = await db
      .from("tabela_preco")
      .select("tp_pagamento")
      .eq("tabela_id", tabelaPrecoId)
      .maybeSingle();
    if (tab?.tp_pagamento === "P") {
      tpPagamento = "P";
    } else if (tab?.tp_pagamento === "V") {
      tpPagamento = "V";
    }
  }

  let maxPermitido = 0;
  let tipoLabel = "";

  // 3. Verificar o limite de acordo com o desconto_padrao
  switch (tpDescPadrao) {
    case "C": { // CARGO
      tipoLabel = "Cargo do Vendedor";
      if (!funcionarioId) {
        return {
          permitido: false,
          maxDescontoPermitido: 0,
          descontoPadraoTipo: "C",
          mensagemErro: "O pedido deve ter um Vendedor selecionado para validar o desconto por Cargo.",
        };
      }

      // Busca cargo_id do funcionário
      const { data: func } = await db
        .from("funcionario")
        .select("cargo_id")
        .eq("funcionario_id", funcionarioId)
        .maybeSingle();

      if (!func?.cargo_id) {
        return {
          permitido: false,
          maxDescontoPermitido: 0,
          descontoPadraoTipo: "C",
          mensagemErro: "O Vendedor selecionado não possui um Cargo cadastrado.",
        };
      }

      // Busca desconto do cargo
      const { data: cargo } = await db
        .from("cargo")
        .select("pc_desc_maximo_av, pc_desc_maximo_prz")
        .eq("cargo_id", func.cargo_id)
        .maybeSingle();

      if (cargo) {
        maxPermitido = tpPagamento === "P"
          ? Number(cargo.pc_desc_maximo_prz || 0)
          : Number(cargo.pc_desc_maximo_av || 0);
      }
      break;
    }

    case "P": { // PRODUTO
      tipoLabel = "Produto";
      if (!produtoId) {
        return { permitido: true, maxDescontoPermitido: 100, descontoPadraoTipo: "P" };
      }
      const { data: prod } = await db
        .from("produto")
        .select("pc_desc_maximo_av, pc_desc_maximo_prz")
        .eq("produto_id", produtoId)
        .maybeSingle();

      if (prod) {
        maxPermitido = tpPagamento === "P"
          ? Number(prod.pc_desc_maximo_prz || 0)
          : Number(prod.pc_desc_maximo_av || 0);
      }
      break;
    }

    case "G": { // GRUPO DE PRODUTO
      tipoLabel = "Grupo de Produto";
      if (!produtoId) {
        return { permitido: true, maxDescontoPermitido: 100, descontoPadraoTipo: "G" };
      }
      const { data: prod } = await db
        .from("produto")
        .select("produto_grupo_id")
        .eq("produto_id", produtoId)
        .maybeSingle();

      if (prod?.produto_grupo_id) {
        const { data: grp } = await db
          .from("produto_grupo")
          .select("pc_desc_maximo_av, pc_desc_maximo_prz")
          .eq("produto_grupo_id", prod.produto_grupo_id)
          .maybeSingle();

        if (grp) {
          maxPermitido = tpPagamento === "P"
            ? Number(grp.pc_desc_maximo_prz || 0)
            : Number(grp.pc_desc_maximo_av || 0);
        }
      }
      break;
    }

    case "S": { // SUBGRUPO DE PRODUTO
      tipoLabel = "Subgrupo de Produto";
      if (!produtoId) {
        return { permitido: true, maxDescontoPermitido: 100, descontoPadraoTipo: "S" };
      }
      const { data: prod } = await db
        .from("produto")
        .select("produto_subgrupo_id")
        .eq("produto_id", produtoId)
        .maybeSingle();

      if (prod?.produto_subgrupo_id) {
        const { data: subg } = await db
          .from("produto_subgrupo")
          .select("pc_desc_maximo_av, pc_desc_maximo_prz")
          .eq("produto_subgrupo_id", prod.produto_subgrupo_id)
          .maybeSingle();

        if (subg) {
          maxPermitido = tpPagamento === "P"
            ? Number(subg.pc_desc_maximo_prz || 0)
            : Number(subg.pc_desc_maximo_av || 0);
        }
      }
      break;
    }

    case "L": { // LINHA DE PRODUTO
      tipoLabel = "Linha de Produto";
      if (!produtoId) {
        return { permitido: true, maxDescontoPermitido: 100, descontoPadraoTipo: "L" };
      }
      const { data: prod } = await db
        .from("produto")
        .select("linha_id")
        .eq("produto_id", produtoId)
        .maybeSingle();

      if (prod?.linha_id) {
        const { data: linha } = await db
          .from("linha_produto")
          .select("pc_desc_maximo_av, pc_desc_maximo_prz")
          .eq("linha_id", prod.linha_id)
          .maybeSingle();

        if (linha) {
          maxPermitido = tpPagamento === "P"
            ? Number(linha.pc_desc_maximo_prz || 0)
            : Number(linha.pc_desc_maximo_av || 0);
        }
      }
      break;
    }
  }

  const condicaoPagamentoLabel = tpPagamento === "P" ? "À Prazo" : "À Vista";

  if (pcDescontoTestar > maxPermitido + 0.0001) {
    return {
      permitido: false,
      maxDescontoPermitido: maxPermitido,
      descontoPadraoTipo: tpDescPadrao,
      mensagemErro: `Desconto de ${pcDescontoTestar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}% excede o limite máximo permitido de ${maxPermitido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}% para ${tipoLabel} (${condicaoPagamentoLabel}).`,
    };
  }

  return {
    permitido: true,
    maxDescontoPermitido: maxPermitido,
    descontoPadraoTipo: tpDescPadrao,
  };
}

export interface IConfigDescontoEmpresa {
  desconto_padrao: string | null;
  desconto_excedido: "B" | "L" | string;
}

/**
 * Retorna as configurações de desconto (desconto_padrao e desconto_excedido) da empresa.
 */
export async function obterConfigDescontoEmpresa(
  empresaId: number
): Promise<IConfigDescontoEmpresa> {
  const { data: emp } = await db
    .from("empresa")
    .select("desconto_padrao, desconto_excedido")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  return {
    desconto_padrao: emp?.desconto_padrao?.trim()?.toUpperCase() || null,
    desconto_excedido: emp?.desconto_excedido?.trim()?.toUpperCase() || "B",
  };
}


/**
 * Verifica se um pedido possui qualquer item ou desconto geral acima do limite permitido.
 */
export async function verificarPedidoTemDescontoExcedido(
  empresaId: number,
  movimentoId: number,
  funcionarioId?: number | null,
  tabelaPrecoId?: number | null,
  tipoPrecoPadrao?: string | null
): Promise<boolean> {
  const { data: emp } = await db
    .from("empresa")
    .select("desconto_padrao")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const tpDescPadrao = emp?.desconto_padrao?.trim()?.toUpperCase() || null;
  if (!tpDescPadrao) {
    return false;
  }

  const { data: mov } = await db
    .from("movimento")
    .select("funcionario_id, tabela_preco_id, tp_preco_padrao, pc_desconto")
    .eq("movimento_id", movimentoId)
    .maybeSingle();

  if (!mov) return false;

  const fId = funcionarioId ?? mov.funcionario_id;
  const tabId = tabelaPrecoId !== undefined ? tabelaPrecoId : mov.tabela_preco_id;
  const tpPadrao = tipoPrecoPadrao || mov.tp_preco_padrao || "V";

  // Check order level general discount
  const pcDescGeral = Number(mov.pc_desconto || 0);
  if (pcDescGeral > 0) {
    const resGeral = await validarDescontoPedido({
      empresaId,
      funcionarioId: fId,
      tabelaPrecoId: tabId,
      tipoPrecoPadrao: tpPadrao,
      pcDescontoTestar: pcDescGeral,
    });
    if (!resGeral.permitido) return true;
  }

  // Check each item discount
  const { data: itens } = await db
    .from("movimento_item")
    .select("produto_id, pc_desconto")
    .eq("movimento_id", movimentoId)
    .eq("excluido", false);

  if (itens && itens.length > 0) {
    for (const item of itens) {
      const pcItem = Number(item.pc_desconto || 0);
      if (pcItem > 0) {
        const resItem = await validarDescontoPedido({
          empresaId,
          funcionarioId: fId,
          produtoId: item.produto_id,
          tabelaPrecoId: tabId,
          tipoPrecoPadrao: tpPadrao,
          pcDescontoTestar: pcItem,
        });
        if (!resItem.permitido) return true;
      }
    }
  }

  return false;
}

