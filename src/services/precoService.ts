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
export async function obterPrecoPromocional(produtoId: number): Promise<number | null> {
  try {
    const { data: items, error } = await db
      .from("promocao_item")
      .select("valor_promocional, promocao_id")
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
 * Ordem de prioridade:
 * 1º Preço em Promoção (se ativa, não excluída e válida pelas datas inicial/final)
 * 2º Preço na Tabela de Preços do cliente (se ativa, não excluída e válida pelas datas)
 * 3º Preço de venda padrão do Produto (fallback)
 */
export async function obterPrecoUnitarioItem(
  produtoId: number,
  tabelaPrecoId?: number | null,
  precoVendaPadrao?: number | null
): Promise<{ preco: number; fonte: "promocao" | "tabela" | "padrao" }> {
  // 1. Tenta Promoção
  const precoPromo = await obterPrecoPromocional(produtoId);
  if (precoPromo !== null) {
    return { preco: precoPromo, fonte: "promocao" };
  }

  // 2. Tenta Tabela de Preço do Cliente
  if (tabelaPrecoId) {
    const precoTab = await obterPrecoTabela(produtoId, tabelaPrecoId);
    if (precoTab !== null) {
      return { preco: precoTab, fonte: "tabela" };
    }
  }

  // 3. Fallback Preço Padrão do Produto
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
