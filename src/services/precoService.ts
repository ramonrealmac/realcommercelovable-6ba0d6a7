import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

/**
 * Converte e verifica se datas iniciais/finais são válidas para a data atual.
 */
export function isPromocaoValida(dtInicial: string | null | undefined, dtFinal: string | null | undefined): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dtInicial && dtInicial.trim()) {
    const dIni = parseAnyDate(dtInicial);
    if (dIni) {
      dIni.setHours(0, 0, 0, 0);
      if (today < dIni) return false;
    }
  }

  if (dtFinal && dtFinal.trim()) {
    const dFin = parseAnyDate(dtFinal);
    if (dFin) {
      dFin.setHours(23, 59, 59, 999);
      if (today > dFin) return false;
    }
  }

  return true;
}

function parseAnyDate(val: string): Date | null {
  const v = val.trim();
  // Formato brasileiro DD/MM/YYYY
  const brMatch = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return new Date(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1]));
  }
  // Formato ISO YYYY-MM-DD
  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 1. Verifica se o produto possui preço em uma PROMOÇÃO ativa, não excluída e válida pelas datas inicial/final.
 */
/**
 * 1. Verifica se o produto possui preço em uma PROMOÇÃO ativa, não excluída e válida pelas datas inicial/final.
 * promocaoModo: 'V' (A VISTA) | 'P' (A PRAZO)
 */
export async function obterPrecoPromocional(
  produtoId: number,
  promocaoModo: "V" | "P" = "V"
): Promise<number | null> {
  try {
    const { data: items, error } = await db
      .from("promocao_item")
      .select("valor_promocional, valor_promocional_prazo, promocao_id")
      .eq("produto_id", produtoId)
      .eq("excluido", false);

    if (error || !items || items.length === 0) return null;

    for (const item of items) {
      const { data: promo } = await db
        .from("promocao")
        .select("promocao_id, dt_inicial, dt_final, ativa, excluido")
        .eq("promocao_id", item.promocao_id)
        .maybeSingle();

      if (
        promo &&
        !promo.excluido &&
        (promo.ativa ?? true) &&
        isPromocaoValida(promo.dt_inicial, promo.dt_final)
      ) {
        if (promocaoModo === "P") {
          const pPrazo = Number(item.valor_promocional_prazo);
          return pPrazo > 0 ? pPrazo : Number(item.valor_promocional);
        }
        return Number(item.valor_promocional);
      }
    }
    return null;
  } catch (e) {
    console.warn("Erro ao buscar preço promocional:", e);
    return null;
  }
}

/**
 * 2. Busca o preço do produto em uma TABELA DE PREÇOS, verificando se a tabela está ativa, não excluída e válida por datas.
 */
export async function obterPrecoTabela(produtoId: number, tabelaId: number): Promise<number | null> {
  try {
    const { data: tab } = await db
      .from("tabela_preco")
      .select("tabela_id, dt_inicial, dt_final, ativa, excluido")
      .eq("tabela_id", tabelaId)
      .maybeSingle();

    if (!tab || tab.excluido || tab.ativa === false || !isPromocaoValida(tab.dt_inicial, tab.dt_final)) {
      return null;
    }

    const { data, error } = await db
      .from("tabela_preco_item")
      .select("preco")
      .eq("tabela_id", tabelaId)
      .eq("produto_id", produtoId)
      .eq("excluido", false)
      .maybeSingle();

    if (error) throw error;
    return data ? Number(data.preco) : null;
  } catch (e) {
    console.warn("Erro ao buscar preço da tabela:", e);
    return null;
  }
}

/**
 * 3. Função principal de obtenção do Preço Unitário para o Pedido:
 * Regras:
 * a - verifica se está na tabela de promoção
 * b - verifica se a promoção está ativa e não vencida
 * c - se estiver, pega o preço de acordo com o campo tp_pagamento da Tabela de Preço:
 *     - se tp_pagamento for V: pega o preço a vista da tabela de promoções
 *     - se tp_pagamento for P: pega o preço a prazo da tabela de promoções
 * d - se o produto não estiver na tabela de promoções ou a promoção estiver vencida/inativa:
 *     pega o preço unit da tabela de preço (se a tabela estiver ativa e não vencida)
 * e - se não tiver tabela de preço (ou inativa/vencida), pega o valor na tabela do produto
 */
export async function obterPrecoUnitarioItem(
  produtoId: number,
  tabelaPrecoId?: number | null,
  precoVendaPadrao?: number | null
): Promise<{ preco: number; fonte: "promocao" | "tabela" | "padrao" }> {
  // Descobre o modo de pagamento ('V' ou 'P') da Tabela de Preço selecionada
  let tpPagamento: "V" | "P" = "V";
  if (tabelaPrecoId) {
    try {
      const { data: tab } = await db
        .from("tabela_preco")
        .select("tp_pagamento")
        .eq("tabela_id", tabelaPrecoId)
        .maybeSingle();

      if (tab?.tp_pagamento === "P") {
        tpPagamento = "P";
      }
    } catch (e) {
      console.warn("Erro ao carregar tp_pagamento da tabela_preco:", e);
    }
  }

  // 1. Tenta buscar na Tabela de Promoções
  const precoPromo = await obterPrecoPromocional(produtoId, tpPagamento);
  if (precoPromo !== null) {
    return { preco: precoPromo, fonte: "promocao" };
  }

  // 2. Se o produto não estiver em promoção válida/ativa, tenta Tabela de Preço
  if (tabelaPrecoId) {
    const precoTab = await obterPrecoTabela(produtoId, tabelaPrecoId);
    if (precoTab !== null) {
      return { preco: precoTab, fonte: "tabela" };
    }
  }

  // 3. Fallback: valor na tabela do produto
  if (precoVendaPadrao !== undefined && precoVendaPadrao !== null) {
    return { preco: Number(precoVendaPadrao), fonte: "padrao" };
  }

  try {
    const { data: prod } = await db
      .from("produto")
      .select("preco_venda")
      .eq("produto_id", produtoId)
      .maybeSingle();
    return { preco: Number(prod?.preco_venda || 0), fonte: "padrao" };
  } catch {
    return { preco: 0, fonte: "padrao" };
  }
}
