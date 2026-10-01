import { describe, it, expect } from 'vitest';
import { calcularQuantidadeConvertida, validarFatorConversao, IFatorConversao } from './fatorConversao';

describe('Cálculos e Validações do Fator de Conversão', () => {

  // 1. Teste: 1 CX × 12 = 12 UN
  it('deve converter 1 CX em 12 UN usando função M (Multiplicação)', () => {
    const fator: IFatorConversao = {
      unidade_entrada_id: 'CX',
      unidade_saida_id: 'UN',
      fator_conversao: 12.0,
      tp_funcao: 'M'
    };
    const resultado = calcularQuantidadeConvertida(1, fator);
    expect(resultado).toBe(12);
  });

  // 2. Teste: 5 CX × 12 = 60 UN
  it('deve converter 5 CX em 60 UN usando função M (Multiplicação)', () => {
    const fator: IFatorConversao = {
      unidade_entrada_id: 'CX',
      unidade_saida_id: 'UN',
      fator_conversao: 12.0,
      tp_funcao: 'M'
    };
    const resultado = calcularQuantidadeConvertida(5, fator);
    expect(resultado).toBe(60);
  });

  // 3. Teste: 12 UN ÷ 12 = 1 CX
  it('deve converter 12 UN em 1 CX usando função D (Divisão)', () => {
    const fator: IFatorConversao = {
      unidade_entrada_id: 'UN',
      unidade_saida_id: 'CX',
      fator_conversao: 12.0,
      tp_funcao: 'D'
    };
    const resultado = calcularQuantidadeConvertida(12, fator);
    expect(resultado).toBe(1);
  });

  // 4. Teste: 24 UN ÷ 12 = 2 CX
  it('deve converter 24 UN em 2 CX usando função D (Divisão)', () => {
    const fator: IFatorConversao = {
      unidade_entrada_id: 'UN',
      unidade_saida_id: 'CX',
      fator_conversao: 12.0,
      tp_funcao: 'D'
    };
    const resultado = calcularQuantidadeConvertida(24, fator);
    expect(resultado).toBe(2);
  });

  // 5. Teste: Fallback 1:1 para produto sem fator de conversão
  it('deve retornar a quantidade original (1:1) se não houver fator de conversão cadastrado', () => {
    const resultado = calcularQuantidadeConvertida(10, null);
    expect(resultado).toBe(10);
  });

  // 6. Teste: Fator igual a zero
  it('deve rejeitar tentativa de cadastrar fator igual a zero', () => {
    const erro = validarFatorConversao({
      unidade_entrada_id: 'CX',
      unidade_saida_id: 'UN',
      fator_conversao: 0,
      tp_funcao: 'M'
    });
    expect(erro).toBe('Fator de conversão deve ser maior que zero.');
  });

  // 7. Teste: Fator negativo
  it('deve rejeitar tentativa de cadastrar fator negativo', () => {
    const erro = validarFatorConversao({
      unidade_entrada_id: 'CX',
      unidade_saida_id: 'UN',
      fator_conversao: -5,
      tp_funcao: 'M'
    });
    expect(erro).toBe('Fator de conversão deve ser maior que zero.');
  });

  // 8. Teste: Unidade de entrada não informada
  it('deve rejeitar quando a unidade de entrada não for informada', () => {
    const erro = validarFatorConversao({
      unidade_entrada_id: '',
      unidade_saida_id: 'UN',
      fator_conversao: 10,
      tp_funcao: 'M'
    });
    expect(erro).toBe('Unidade de entrada é obrigatória.');
  });

  // 9. Teste: Unidade de saída não informada
  it('deve rejeitar quando a unidade de saída não for informada', () => {
    const erro = validarFatorConversao({
      unidade_entrada_id: 'CX',
      unidade_saida_id: '',
      fator_conversao: 10,
      tp_funcao: 'M'
    });
    expect(erro).toBe('Unidade de saída é obrigatória.');
  });

  // 10. Teste: Função não informada
  it('deve rejeitar quando a função não for informada ou for inválida', () => {
    const erro = validarFatorConversao({
      unidade_entrada_id: 'CX',
      unidade_saida_id: 'UN',
      fator_conversao: 10,
      tp_funcao: '' as any
    });
    expect(erro).toBe('Função é obrigatória (M para Multiplicação ou D para Divisão).');
  });

});
