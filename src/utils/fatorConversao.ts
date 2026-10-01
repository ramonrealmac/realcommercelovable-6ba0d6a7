/**
 * Utilitário para cálculos e validações do Fator de Conversão de Produtos
 */

export interface IFatorConversao {
  produto_fator_conversao_id?: number;
  empresa_id?: number;
  produto_id?: number;
  unidade_entrada_id: string;
  unidade_saida_id: string;
  fator_conversao: number;
  tp_funcao: 'M' | 'D';
}

/**
 * Calcula a quantidade convertida de acordo com a unidade de entrada, fator e função.
 * 
 * Função M (Multiplicação): Quantidade de saída = Quantidade de entrada × Fator de conversão
 * Exemplo: 1 CX × 12 = 12 UN
 * 
 * Função D (Divisão): Quantidade de saída = Quantidade de entrada ÷ Fator de conversão
 * Exemplo: 12 UN ÷ 12 = 1 CX
 * 
 * Se não houver fator ou o fator for <= 0, retorna a quantidade original (conversão 1:1).
 */
export function calcularQuantidadeConvertida(
  quantidadeEntrada: number,
  fator: IFatorConversao | null | undefined
): number {
  const qtd = Number(quantidadeEntrada) || 0;
  if (qtd === 0) return 0;

  if (!fator || !fator.fator_conversao || Number(fator.fator_conversao) <= 0) {
    return qtd; // Fallback 1:1
  }

  const fc = Number(fator.fator_conversao);

  if (fator.tp_funcao === 'M') {
    return qtd * fc;
  } else if (fator.tp_funcao === 'D') {
    return qtd / fc;
  }

  return qtd;
}

/**
 * Valida os campos obrigatórios e regras de negócio do Fator de Conversão
 */
export function validarFatorConversao(fator: Partial<IFatorConversao>): string | null {
  if (!fator.unidade_entrada_id || !fator.unidade_entrada_id.trim()) {
    return "Unidade de entrada é obrigatória.";
  }
  if (!fator.unidade_saida_id || !fator.unidade_saida_id.trim()) {
    return "Unidade de saída é obrigatória.";
  }
  if (fator.fator_conversao === undefined || fator.fator_conversao === null || isNaN(Number(fator.fator_conversao))) {
    return "Fator de conversão é obrigatório.";
  }
  if (Number(fator.fator_conversao) <= 0) {
    return "Fator de conversão deve ser maior que zero.";
  }
  if (!fator.tp_funcao || (fator.tp_funcao !== 'M' && fator.tp_funcao !== 'D')) {
    return "Função é obrigatória (M para Multiplicação ou D para Divisão).";
  }

  return null;
}
