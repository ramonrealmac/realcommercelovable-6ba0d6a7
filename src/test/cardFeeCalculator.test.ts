import { describe, it, expect } from 'vitest';
import { calcularTaxasCartaoParcelado } from '../utils/cardFeeCalculator';

describe('cardFeeCalculator', () => {
  it('deve calcular corretamente venda em 3x com taxas da CIELO (ex: 3.5% operadora e 1.5% a.m. antecipação)', () => {
    const res = calcularTaxasCartaoParcelado({
      valorVenda: 1000,
      numeroParcelas: 3,
      taxaOperadoraPercent: 3.5,
      taxaAntecipacaoMensalPercent: 1.5,
    });

    // Valor da venda: 1000.00
    expect(res.valorVenda).toBe(1000.00);
    expect(res.numeroParcelas).toBe(3);

    // Taxa operadora: 3.5% -> R$ 35.00
    expect(res.taxaOperadoraPercent).toBe(3.5);
    expect(res.valorTaxaOperadora).toBe(35.00);

    // Antecipação por parcela:
    // Parcela 1: 333.33 * (1.5% * 1) = 5.00
    // Parcela 2: 333.33 * (1.5% * 2) = 10.00
    // Parcela 3: 333.34 * (1.5% * 3) = 15.00
    // Total Antecipação = 30.00
    expect(res.valorAntecipacaoTotal).toBe(30.00);

    // Taxa antecipação efetiva: (30 / 1000) * 100 = 3.00%
    expect(res.taxaAntecipacaoEfetivaPercent).toBe(3.00);

    // Valor líquido a receber: 1000 - 35 - 30 = 935.00
    expect(res.valorLiquidoReceber).toBe(935.00);

    // Detalhe das parcelas
    expect(res.detalheParcelas.length).toBe(3);
    expect(res.detalheParcelas[0]).toEqual({
      numeroParcela: 1,
      valorParcela: 333.33,
      prazoDias: 30,
      prazoMeses: 1,
      taxaAntecipacaoParcelaPercent: 1.5,
      valorAntecipacaoParcela: 5.00,
      valorLiquidoParcela: 316.66,
    });
    expect(res.detalheParcelas[1]).toEqual({
      numeroParcela: 2,
      valorParcela: 333.33,
      prazoDias: 60,
      prazoMeses: 2,
      taxaAntecipacaoParcelaPercent: 3.0,
      valorAntecipacaoParcela: 10.00,
      valorLiquidoParcela: 311.66,
    });
    expect(res.detalheParcelas[2]).toEqual({
      numeroParcela: 3,
      valorParcela: 333.34,
      prazoDias: 90,
      prazoMeses: 3,
      taxaAntecipacaoParcelaPercent: 4.5,
      valorAntecipacaoParcela: 15.00,
      valorLiquidoParcela: 306.67,
    });
  });

  it('deve calcular corretamente para venda em 1x (à vista)', () => {
    const res = calcularTaxasCartaoParcelado({
      valorVenda: 500,
      numeroParcelas: 1,
      taxaOperadoraPercent: 2.0,
      taxaAntecipacaoMensalPercent: 1.0,
    });

    expect(res.valorVenda).toBe(500);
    expect(res.valorTaxaOperadora).toBe(10.00); // 2% de 500
    expect(res.valorAntecipacaoTotal).toBe(5.00); // 1% * 1 mês em 500 = 5
    expect(res.valorLiquidoReceber).toBe(485.00);
  });

  it('deve tratar adequadamente valor zero ou negativo', () => {
    const res = calcularTaxasCartaoParcelado({
      valorVenda: 0,
      numeroParcelas: 3,
      taxaOperadoraPercent: 3.0,
      taxaAntecipacaoMensalPercent: 1.5,
    });

    expect(res.valorVenda).toBe(0);
    expect(res.valorTaxaOperadora).toBe(0);
    expect(res.valorAntecipacaoTotal).toBe(0);
    expect(res.valorLiquidoReceber).toBe(0);
  });
});
