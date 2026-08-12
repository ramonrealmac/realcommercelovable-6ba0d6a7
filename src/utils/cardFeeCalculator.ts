export interface ICalculoParcelaDetalhe {
  numeroParcela: number;
  valorParcela: number;
  prazoDias: number;
  prazoMeses: number;
  taxaAntecipacaoParcelaPercent: number;
  valorAntecipacaoParcela: number;
  valorLiquidoParcela: number;
}

export interface ICalculoTaxaCartaoInput {
  valorVenda: number;
  numeroParcelas: number;
  taxaOperadoraPercent: number; // % taxa da operadora (ex: 3.5)
  taxaAntecipacaoMensalPercent: number; // % taxa de antecipação mensal (ex: 1.5)
  prazosDias?: number[]; // Opcional, padrão: [30, 60, 90, ...]
}

export interface ICalculoTaxaCartaoResult {
  valorVenda: number;
  numeroParcelas: number;
  taxaOperadoraPercent: number;
  valorTaxaOperadora: number;
  taxaAntecipacaoMensalPercent: number;
  taxaAntecipacaoEfetivaPercent: number;
  valorAntecipacaoTotal: number;
  valorLiquidoReceber: number;
  detalheParcelas: ICalculoParcelaDetalhe[];
}

/**
 * Calcula as taxas de cartão de crédito para vendas parceladas.
 * 
 * Regras:
 * - Taxa operadora = Valor da venda × % taxa da operadora cadastrada para a quantidade de parcelas.
 * - Taxa antecipação = calculada conforme a taxa de antecipação mensal cadastrada e o prazo de recebimento de cada parcela (ex: 30d/60d/90d).
 * - Valor líquido = Valor da venda - Valor taxa operadora - Valor antecipação
 */
export function calcularTaxasCartaoParcelado(input: ICalculoTaxaCartaoInput): ICalculoTaxaCartaoResult {
  const { valorVenda, numeroParcelas, taxaOperadoraPercent, taxaAntecipacaoMensalPercent } = input;

  if (valorVenda <= 0 || numeroParcelas <= 0) {
    return {
      valorVenda: Math.max(0, valorVenda),
      numeroParcelas: Math.max(1, numeroParcelas),
      taxaOperadoraPercent: 0,
      valorTaxaOperadora: 0,
      taxaAntecipacaoMensalPercent: 0,
      taxaAntecipacaoEfetivaPercent: 0,
      valorAntecipacaoTotal: 0,
      valorLiquidoReceber: Math.max(0, valorVenda),
      detalheParcelas: [],
    };
  }

  // 1. Valor da Taxa da Operadora
  const valorTaxaOperadora = Number((valorVenda * (taxaOperadoraPercent / 100)).toFixed(2));

  // 2. Cálculo por Parcela
  const baseParcela = Math.floor((valorVenda / numeroParcelas) * 100) / 100;
  let somaParcelas = 0;

  const detalheParcelas: ICalculoParcelaDetalhe[] = [];
  let valorAntecipacaoTotal = 0;

  for (let i = 1; i <= numeroParcelas; i++) {
    const prazoDias = input.prazosDias?.[i - 1] ?? i * 30;
    const prazoMeses = Number((prazoDias / 30).toFixed(2));

    // Ajusta o valor da última parcela para fechar exatamente o valor total da venda
    const valorParcela = i === numeroParcelas
      ? Number((valorVenda - somaParcelas).toFixed(2))
      : baseParcela;

    somaParcelas = Number((somaParcelas + valorParcela).toFixed(2));

    // Taxa de antecipação proporcional ao prazo da parcela (ex: 1 mês = 1.5%, 2 meses = 3.0%, 3 meses = 4.5%)
    const taxaAntecipacaoParcelaPercent = Number((taxaAntecipacaoMensalPercent * prazoMeses).toFixed(4));
    const valorAntecipacaoParcela = Number((valorParcela * (taxaAntecipacaoParcelaPercent / 100)).toFixed(2));
    const valorLiquidoParcela = Number((valorParcela - (valorParcela * (taxaOperadoraPercent / 100)) - valorAntecipacaoParcela).toFixed(2));

    valorAntecipacaoTotal = Number((valorAntecipacaoTotal + valorAntecipacaoParcela).toFixed(2));

    detalheParcelas.push({
      numeroParcela: i,
      valorParcela,
      prazoDias,
      prazoMeses,
      taxaAntecipacaoParcelaPercent,
      valorAntecipacaoParcela,
      valorLiquidoParcela,
    });
  }

  // 3. Taxa Efetiva de Antecipação (%)
  const taxaAntecipacaoEfetivaPercent = valorVenda > 0
    ? Number(((valorAntecipacaoTotal / valorVenda) * 100).toFixed(4))
    : 0;

  // 4. Valor Líquido a Receber
  const valorLiquidoReceber = Number((valorVenda - valorTaxaOperadora - valorAntecipacaoTotal).toFixed(2));

  return {
    valorVenda: Number(valorVenda.toFixed(2)),
    numeroParcelas,
    taxaOperadoraPercent: Number(taxaOperadoraPercent.toFixed(4)),
    valorTaxaOperadora,
    taxaAntecipacaoMensalPercent: Number(taxaAntecipacaoMensalPercent.toFixed(4)),
    taxaAntecipacaoEfetivaPercent,
    valorAntecipacaoTotal,
    valorLiquidoReceber,
    detalheParcelas,
  };
}

/**
 * Busca dinamicamente as taxas no Supabase para a operadora (ex: 'CIELO') e número de parcelas (ex: 3),
 * e realiza o cálculo financeiro sem nenhuma taxa fixa (hardcoded) no código.
 */
export async function buscarECalcularTaxasOperadora(
  supabaseClient: any,
  empresaId: number,
  operadoraIdOuRazao: number | string,
  numeroParcelas: number,
  valorVenda: number
): Promise<{
  sucesso: boolean;
  mensagem?: string;
  operadoraNome?: string;
  calculo?: ICalculoTaxaCartaoResult;
}> {
  try {
    let operadoraId: number | null = typeof operadoraIdOuRazao === 'number' ? operadoraIdOuRazao : null;
    let operadoraNome = '';

    if (typeof operadoraIdOuRazao === 'string') {
      const { data: operData, error: operError } = await supabaseClient
        .from('operadora')
        .select('operadora_id, razao')
        .eq('empresa_id', empresaId)
        .ilike('razao', `%${operadoraIdOuRazao}%`)
        .limit(1)
        .maybeSingle();

      if (operError || !operData) {
        return {
          sucesso: false,
          mensagem: `Operadora "${operadoraIdOuRazao}" não encontrada para esta empresa.`
        };
      }

      operadoraId = operData.operadora_id;
      operadoraNome = operData.razao;
    } else {
      const { data: operData } = await supabaseClient
        .from('operadora')
        .select('razao')
        .eq('operadora_id', operadoraId)
        .maybeSingle();

      operadoraNome = operData?.razao || `Operadora #${operadoraId}`;
    }

    if (!operadoraId) {
      return { sucesso: false, mensagem: 'ID da operadora inválido.' };
    }

    // Busca as taxas cadastradas em operadora_taxa para a parcela informada (ex: '3')
    const { data: taxaData, error: taxaError } = await supabaseClient
      .from('operadora_taxa')
      .select('taxa_cartao, taxa_antecipacao')
      .eq('empresa_id', empresaId)
      .eq('operadora_id', operadoraId)
      .eq('parcela', String(numeroParcelas))
      .eq('excluido', false)
      .maybeSingle();

    if (taxaError || !taxaData) {
      return {
        sucesso: false,
        operadoraNome,
        mensagem: `Não há taxa cadastrada para a operadora ${operadoraNome} em ${numeroParcelas}x.`
      };
    }

    const taxaOperadoraPercent = Number(taxaData.taxa_cartao || 0);
    const taxaAntecipacaoMensalPercent = Number(taxaData.taxa_antecipacao || 0);

    const calculo = calcularTaxasCartaoParcelado({
      valorVenda,
      numeroParcelas,
      taxaOperadoraPercent,
      taxaAntecipacaoMensalPercent
    });

    return {
      sucesso: true,
      operadoraNome,
      calculo
    };
  } catch (err: unknown) {
    const errMsg = err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);

    return {
      sucesso: false,
      mensagem: `Erro ao buscar taxas da operadora: ${errMsg}`
    };
  }
}
